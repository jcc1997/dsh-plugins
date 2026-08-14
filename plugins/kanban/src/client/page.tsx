// 看板页面：顶部栏 + 竖线分割列 + 拖拽 + 抽屉 + 列配置弹窗
import React, { useEffect, useState } from 'react'
import { IconChevronLeftOutline14 } from '@dsh-plugins/ui'
import { Modal } from '@dsh-plugins/ui'
import { CardDrawer } from './drawer'
import { ColumnsPanel } from './columns'
import { appendActivity, colTitle, findCard, safeId, safeNow } from '@dsh-plugins/ui'
import { KanbanBoard } from '@dsh-plugins/ui'

export interface DrawerState {
  columnId: string
  cardId: string | null // null = 新建
}

export function KanbanPage(props: { host: { call(method: string, args?: unknown): Promise<any> }; onClose: () => void }) {
  const [board, setBoard] = useState<KanbanBoard | null>(null)
  const [error, setError] = useState('')
  const [drawer, setDrawer] = useState<DrawerState | null>(null)
  const [showColumns, setShowColumns] = useState(false)
  const [drag, setDrag] = useState<{ kind: 'card'; cardId: string; from: string } | { kind: 'column'; from: number } | null>(null)
  const [hint, setHint] = useState<{ columnId: string; index: number } | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    props.host
      .call('kanban/load', {})
      .then((r) => setBoard(r.board))
      .catch((e) => setError('加载失败: ' + String(e)))
  }, [props.host])

  function save(next: KanbanBoard) {
    setBoard(next)
    setSaving(true)
    props.host
      .call('kanban/save', { board: next })
      .then(() => setSaving(false))
      .catch((e) => {
        setSaving(false)
        setError('保存失败: ' + String(e))
      })
  }
  function mutate<T>(fn: (b: KanbanBoard) => T): T | null {
    if (!board) return null
    const next = JSON.parse(JSON.stringify(board)) as KanbanBoard
    const result = fn(next)
    save(next)
    return result
  }

  // ── 卡片操作 ──
  function openNewCard(columnId: string) {
    setDrawer({ columnId, cardId: null })
  }
  function openCard(columnId: string, cardId: string) {
    setDrawer({ columnId, cardId })
  }
  function saveCard(title: string, description: string) {
    if (!drawer) return
    const colId = drawer.columnId
    if (drawer.cardId) {
      mutate((b) => {
        const col = b.columns.find((c) => c.id === colId)
        const card = col && col.cards.find((k) => k.id === drawer.cardId)
        if (card) {
          card.title = title
          card.description = description
          card.updatedAt = safeNow()
          appendActivity(card, '更新卡片')
        }
      })
    } else {
      const newId = mutate((b) => {
        const col = b.columns.find((c) => c.id === colId)
        if (!col) return null
        const card = {
          id: safeId('k'),
          title,
          description,
          links: [],
          meta: {},
          comments: [],
          activity: [],
          createdAt: safeNow(),
          updatedAt: safeNow(),
        }
        appendActivity(card, '创建卡片')
        col.cards.push(card)
        return card.id
      })
      if (newId) setDrawer({ columnId: colId, cardId: newId })
    }
  }
  function deleteCard() {
    if (!drawer || !drawer.cardId) return
    const colId = drawer.columnId
    const cardId = drawer.cardId
    mutate((b) => {
      const col = b.columns.find((c) => c.id === colId)
      if (col) col.cards = col.cards.filter((k) => k.id !== cardId)
    })
    setDrawer(null)
  }
  function addComment(text: string) {
    if (!drawer || !drawer.cardId) return
    const colId = drawer.columnId
    const cardId = drawer.cardId
    mutate((b) => {
      const col = b.columns.find((c) => c.id === colId)
      const card = col && col.cards.find((k) => k.id === cardId)
      if (!card) return
      if (!card.comments) card.comments = []
      card.comments.push({ id: safeId('m'), text, createdAt: safeNow() })
      appendActivity(card, '添加评论')
    })
  }

  // ── 列操作 ──
  function addColumn(title: string) {
    mutate((b) => b.columns.push({ id: safeId('c'), title, cards: [], meta: {} }))
  }
  function renameColumn(colId: string, title: string) {
    mutate((b) => {
      const col = b.columns.find((c) => c.id === colId)
      if (col) col.title = title
    })
  }
  function deleteColumn(colId: string) {
    mutate((b) => {
      b.columns = b.columns.filter((c) => c.id !== colId)
    })
  }
  function moveColumn(colId: string, dir: number) {
    mutate((b) => {
      const idx = b.columns.findIndex((c) => c.id === colId)
      const to = idx + dir
      if (idx < 0 || to < 0 || to >= b.columns.length) return
      const [col] = b.columns.splice(idx, 1)
      b.columns.splice(to, 0, col)
    })
  }

  // ── 拖拽 ──
  function computeCardIndex(evt: React.DragEvent) {
    const el = evt.currentTarget
    try {
      const cards = Array.from(el.children).filter(
        (child) => child instanceof HTMLElement && child.getAttribute('data-card') !== null,
      )
      for (let i = 0; i < cards.length; i++) {
        const r = cards[i].getBoundingClientRect()
        if (evt.clientY < r.top + r.height / 2) return i
      }
      return cards.length
    } catch {
      return 0
    }
  }
  function onColumnOver(columnId: string, evt: React.DragEvent) {
    evt.preventDefault()
    if (!drag) return
    if (drag.kind === 'card') setHint({ columnId, index: computeCardIndex(evt) })
  }
  function onColumnDrop(columnId: string, evt: React.DragEvent) {
    evt.preventDefault()
    if (!drag) return
    if (drag.kind === 'card') {
      const index = computeCardIndex(evt)
      mutate((b) => {
        const fromCol = b.columns.find((c) => c.id === drag.from)
        const toCol = b.columns.find((c) => c.id === columnId)
        if (!fromCol || !toCol) return
        const idx = fromCol.cards.findIndex((k) => k.id === drag.cardId)
        if (idx < 0) return
        const [card] = fromCol.cards.splice(idx, 1)
        if (fromCol.id === toCol.id) {
          let target = index
          if (idx < target) target -= 1
          toCol.cards.splice(target, 0, card)
        } else {
          toCol.cards.splice(index, 0, card)
        }
        card.updatedAt = safeNow()
        appendActivity(card, '移至「' + toCol.title + '」')
      })
    } else if (drag.kind === 'column') {
      mutate((b) => {
        const from = drag.from
        const to = b.columns.findIndex((c) => c.id === columnId)
        if (from < 0 || to < 0 || from === to) return
        const [col] = b.columns.splice(from, 1)
        b.columns.splice(to, 0, col)
      })
    }
    setDrag(null)
    setHint(null)
  }
  function onDragEnd() {
    setDrag(null)
    setHint(null)
  }

  if (!board) {
    return (
      <div className="kbnb-page">
        <div className="kbnb-loading">{error || '加载中…'}</div>
      </div>
    )
  }

  const drawerCard = drawer && drawer.cardId ? findCard(board, drawer.columnId, drawer.cardId) : null

  return (
    <div className="kbnb-page">
      <header className="kbnb-header">
        <button className="kbnb-icon-btn kbnb-back" type="button" title="返回" onClick={props.onClose}>
          <IconChevronLeftOutline14 />
        </button>
        <span className="kbnb-title">看板</span>
        <span className="kbnb-saving">{saving ? '保存中…' : ''}</span>
        <div className="kbnb-header-actions">
          <button className="kbnb-btn" type="button" onClick={() => setShowColumns(true)}>
            列配置
          </button>
        </div>
      </header>
      {error ? <div className="kbnb-error">{error}</div> : null}
      <main className="kbnb-board">
        {board.columns.length === 0 ? (
          <div className="kbnb-empty">空看板，点右上角「列配置」添加列</div>
        ) : (
          board.columns.map((col, colIndex) => (
            <section
              key={col.id}
              className={'kbnb-column' + (hint && hint.columnId === col.id ? ' kbnb-column-drop' : '')}
              onDragOver={(evt) => onColumnOver(col.id, evt)}
              onDrop={(evt) => onColumnDrop(col.id, evt)}
            >
              <header
                className="kbnb-column-head"
                draggable
                onDragStart={(evt) => {
                  evt.dataTransfer.effectAllowed = 'move'
                  setDrag({ kind: 'column', from: colIndex })
                }}
                onDragEnd={onDragEnd}
              >
                <span className="kbnb-column-title" title="拖拽排序">
                  {col.title}
                </span>
                <span className="kbnb-column-count">{col.cards.length}</span>
              </header>
              <div className="kbnb-cards">
                {col.cards.map((card) => (
                  <article
                    key={card.id}
                    data-card=""
                    className={'kbnb-card' + (drag && drag.kind === 'card' && drag.cardId === card.id ? ' kbnb-card-drag' : '')}
                    draggable
                    onDragStart={(evt) => {
                      evt.dataTransfer.effectAllowed = 'move'
                      setDrag({ kind: 'card', cardId: card.id, from: col.id })
                    }}
                    onDragEnd={onDragEnd}
                    onClick={() => openCard(col.id, card.id)}
                  >
                    <div className="kbnb-card-title">{card.title}</div>
                    {card.description ? (
                      <div className="kbnb-card-desc">
                        {card.description.replace(/[#*`\[\]()\-]/g, '').split(/\n{2,}/)[0]}
                      </div>
                    ) : null}
                  </article>
                ))}
                {hint && hint.columnId === col.id ? <div className="kbnb-drop-line" /> : null}
              </div>
              <button className="kbnb-add-card" type="button" onClick={() => openNewCard(col.id)}>
                + 添加卡片
              </button>
            </section>
          ))
        )}
      </main>
      {drawer ? (
        <CardDrawer
          key={drawer.cardId || 'new'}
          card={drawerCard}
          isNew={!drawer.cardId}
          onSave={saveCard}
          onDelete={deleteCard}
          onClose={() => setDrawer(null)}
          onAddComment={addComment}
        />
      ) : null}
      {showColumns ? (
        <Modal title="列配置" width={420} onClose={() => setShowColumns(false)}>
          <ColumnsPanel
            columns={board.columns}
            onAdd={addColumn}
            onRename={renameColumn}
            onDelete={deleteColumn}
            onMove={moveColumn}
          />
        </Modal>
      ) : null}
    </div>
  )
}
