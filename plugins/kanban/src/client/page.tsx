// 看板页面：顶部栏 + 竖线分割列 + 拖拽 + 编辑抽屉 + 新建弹窗 + 列配置弹窗
import React, { useState } from 'react'
import { IconChevronLeftOutline14 } from '@dsh-plugins/ui'
import { Modal } from '@dsh-plugins/ui'
import { CardDrawer } from './drawer'
import { CreateCardModal } from './create'
import { ColumnsPanel } from './columns'
import { safeId, safeNow, appendActivity } from '@dsh-plugins/ui'
import { useKanbanBoard, HostLike } from './board-hook'

export interface DrawerState {
  columnId: string
  cardId: string
}

export interface RenderSlotLike {
  (key: string, owner: unknown, opts?: unknown): unknown
}

export interface SessionsLike {
  open(id: string): void
}

export function KanbanPage(props: {
  host: HostLike
  onClose: () => void
  renderSlot?: RenderSlotLike
  sessions?: SessionsLike
}) {
  const kb = useKanbanBoard(props.host)
  const [drawer, setDrawer] = useState<DrawerState | null>(null)
  const [creating, setCreating] = useState<string | null>(null)
  const [showColumns, setShowColumns] = useState(false)
  const [drag, setDrag] = useState<{ kind: 'card'; cardId: string; from: string } | { kind: 'column'; from: number } | null>(null)
  const [hint, setHint] = useState<{ columnId: string; index: number } | null>(null)

  const board = kb.board

  function openCard(columnId: string, cardId: string) {
    setDrawer({ columnId, cardId })
  }
  function saveCard(title: string, description: string) {
    if (!drawer) return
    kb.saveCard(drawer.cardId, title, description)
  }
  function moveCardToStatus(targetColId: string) {
    if (!drawer) return
    kb.moveCardToStatus(drawer.cardId, targetColId)
    setDrawer({ columnId: targetColId, cardId: drawer.cardId })
  }
  function deleteCard() {
    if (!drawer) return
    kb.deleteCard(drawer.cardId)
    setDrawer(null)
  }
  function updateTags(cardId: string, add: string[], remove: string[]) {
    kb.updateTags(cardId, add, remove)
  }
  function addComment(text: string) {
    if (!drawer) return
    kb.addComment(drawer.cardId, text)
  }
  function addRef(cardId: string, ref: { kind: string; externalId: string; url?: string; display?: string }) {
    kb.addRef(cardId, ref)
  }
  function removeRef(cardId: string, refId: string) {
    kb.removeRef(cardId, refId)
  }
  function createCard(columnId: string, title: string, description: string, tags: string[] = []) {
    kb.mutate((b) => {
      const col = b.columns.find((c) => c.id === columnId)
      if (!col) return
      const card = {
        id: safeId('k'),
        title,
        description,
        tags,
        links: [],
        meta: {},
        comments: [],
        activity: [],
        createdAt: safeNow(),
        updatedAt: safeNow(),
      }
      appendActivity(card, '创建卡片')
      col.cards.push(card)
    })
  }
  function openSession(sessionId: string) {
    setDrawer(null)
    if (props.sessions && typeof props.sessions.open === 'function') {
      try { props.sessions.open(sessionId) } catch { /* 会话可能已不存在 */ }
    }
    props.onClose()
  }

  function addColumn(title: string) { kb.addColumn(title) }
  function renameColumn(colId: string, title: string) { kb.renameColumn(colId, title) }
  function deleteColumn(colId: string) { kb.deleteColumn(colId) }
  function moveColumn(colId: string, dir: number) { kb.moveColumn(colId, dir) }
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
      kb.mutate((b) => {
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
          card.updatedAt = safeNow()
          appendActivity(card, '调整顺序')
        } else {
          toCol.cards.splice(index, 0, card)
          card.updatedAt = safeNow()
          appendActivity(card, '状态变更：' + fromCol.title + ' → ' + toCol.title)
        }
      })
    } else if (drag.kind === 'column') {
      kb.mutate((b) => {
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
        <div className="kbnb-loading">{kb.error || '加载中…'}</div>
      </div>
    )
  }

  const drawerHit = drawer ? kb.findCard(drawer.cardId) : null
  const drawerCard = drawerHit ? drawerHit.card : null

  return (
    <div className="kbnb-page">
      <header className="kbnb-header">
        <button className="kbnb-icon-btn kbnb-back" type="button" title="返回" onClick={props.onClose}>
          <IconChevronLeftOutline14 />
        </button>
        <span className="kbnb-title">看板</span>
        <span className="kbnb-stats">{board.columns.length} 列 · {board.columns.reduce((n, col) => n + col.cards.length, 0)} 张卡</span>
        <span className="kbnb-saving">{kb.saving ? '保存中…' : ''}</span>
        <div className="kbnb-header-actions">
          <button className="kbnb-btn" type="button" onClick={() => setShowColumns(true)}>
            列配置
          </button>
        </div>
      </header>
      {kb.error ? <div className="kbnb-error">{kb.error}</div> : null}
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
                    className={
                      'kbnb-card' +
                      (drag && drag.kind === 'card' && drag.cardId === card.id ? ' kbnb-card-drag' : '') +
                      (drawer && drawer.cardId === card.id ? ' kbnb-card-active' : '')
                    }
                    draggable
                    onDragStart={(evt) => {
                      evt.dataTransfer.effectAllowed = 'move'
                      setDrag({ kind: 'card', cardId: card.id, from: col.id })
                    }}
                    onDragEnd={onDragEnd}
                    onClick={() => openCard(col.id, card.id)}
                  >
                    <div className="kbnb-card-title">{card.title}</div>
                    {card.tags && card.tags.length > 0 ? (
                      <div className="kbnb-card-tags">
                        {card.tags.map((tg) => (
                          <span key={tg} className="kbnb-tag">{tg}</span>
                        ))}
                      </div>
                    ) : null}
                    {card.description ? (
                      <div className="kbnb-card-desc">{card.description.split(String.fromCharCode(10))[0]}</div>
                    ) : null}
                  </article>
                ))}
                {hint && hint.columnId === col.id ? <div className="kbnb-drop-line" /> : null}
              </div>
              <button className="kbnb-add-card" type="button" onClick={() => setCreating(col.id)}>
                + 添加卡片
              </button>
            </section>
          ))
        )}
      </main>
      {drawer && drawerCard ? (
        <CardDrawer
          key={drawer.cardId}
          card={drawerCard}
          columns={board.columns}
          onSave={saveCard}
          onDelete={deleteCard}
          onClose={() => setDrawer(null)}
          onAddComment={addComment}
          onUpdateTags={(add, remove) => updateTags(drawer.cardId, add, remove)}
          onMoveStatus={moveCardToStatus}
          onAddRef={(ref) => addRef(drawer.cardId, ref)}
          onRemoveRef={(refId) => removeRef(drawer.cardId, refId)}
          onOpenSession={openSession}
          actionHost={props.renderSlot ? () => (
            <div className="kbnb-card-actions">
              {props.renderSlot!('kanban.card.actions', { cardId: drawer.cardId, onSynced: kb.reload }, {})}
            </div>
          ) : null}
        />
      ) : null}
      {creating ? (
        <CreateCardModal
          onCreate={(title, description, tags) => createCard(creating, title, description, tags)}
          onClose={() => setCreating(null)}
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
