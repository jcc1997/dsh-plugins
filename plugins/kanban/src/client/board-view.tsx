// client/board-view.tsx — Kanban视图：顶栏工具行（分组/列配置）+ 列/Ticket渲染 + Ticket拖拽
// 分组：不分组 = 单泳道（整体横向滚动）；Git 仓库 = 按 github-repo 关联分泳道（组内横向滚动）
// 拖拽：仅Ticket（组内排序/跨列移动）；跨组拖拽忽略；列头不可拖拽（列排序走设置页列配置）
import React, { useState } from 'react'
import { safeNow, appendActivity } from '@dsh-plugins/ui'
import { KanbanBoard } from '@dsh-plugins/ui'
import { cardRepoOf } from './board-util'
import { useKanbanBoard } from './board-hook'

export type GroupBy = 'none' | 'repo'

export interface Group {
  key: string
  label: string
  count: number
  columns: Array<{ id: string; title: string; cards: any[]; meta?: any }>
}

type DragState = { kind: 'card'; cardId: string; from: string; groupKey: string } | null

export function BoardView(props: {
  board: KanbanBoard
  groupBy: GroupBy
  onGroupByChange: (v: GroupBy) => void
  onOpenCard: (columnId: string, cardId: string) => void
  onStartCreate: (columnId: string) => void
  activeCardId: string | null
  kb: ReturnType<typeof useKanbanBoard>
}) {
  const [drag, setDrag] = useState<DragState>(null)
  const [hint, setHint] = useState<{ columnId: string; index: number } | null>(null)

  /** 按鼠标位置计算Ticket插入下标（落点指示线用） */
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
  /** 落点：Ticket移动（跨组忽略；组内排序 / 跨列移动） */
  function onColumnDrop(columnId: string, groupKey: string, evt: React.DragEvent) {
    evt.preventDefault()
    if (!drag) return
    if (drag.kind !== 'card') { setDrag(null); setHint(null); return }
    if (drag.groupKey !== groupKey) {
      setDrag(null)
      setHint(null)
      return
    }
    const index = computeCardIndex(evt)
    props.kb.mutate((b) => {
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
    setDrag(null)
    setHint(null)
  }
  function onDragEnd() {
    setDrag(null)
    setHint(null)
  }

  /** 分组计算：none 单组；repo 按 github-repo 分组（未关联在最后） */
  function buildGroups(): Group[] {
    if (props.groupBy === 'none') {
      return [{
        key: '',
        label: '',
        count: props.board.columns.reduce((n, c) => n + c.cards.length, 0),
        columns: props.board.columns.map((c) => ({ ...c })),
      }]
    }
    const map = new Map<string, Group>()
    const keys: string[] = []
    for (const col of props.board.columns) {
      for (const card of col.cards) {
        const key = cardRepoOf(card)
        if (!map.has(key)) {
          map.set(key, { key, label: key || '未关联', count: 0, columns: props.board.columns.map((c) => ({ ...c, cards: [] })) })
          keys.push(key)
        }
      }
    }
    keys.sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a < b ? -1 : a > b ? 1 : 0))
    for (const col of props.board.columns) {
      const colIdx = props.board.columns.findIndex((c) => c.id === col.id)
      for (const card of col.cards) {
        const g = map.get(cardRepoOf(card))
        if (g) {
          g.columns[colIdx].cards.push(card)
          g.count += 1
        }
      }
    }
    return keys.map((k) => map.get(k)!)
  }

  /** 单列渲染：列头（可拖拽排序）+ Ticket列表（独立滚动）+ 添加Ticket */
  function renderColumn(col: any, _colIndex: number, groupKey: string) {
    return (
      <section
        key={col.id}
        className={'kbnb-column' + (hint && hint.columnId === col.id ? ' kbnb-column-drop' : '')}
        onDragOver={(evt) => onColumnOver(col.id, evt)}
        onDrop={(evt) => onColumnDrop(col.id, groupKey, evt)}
      >
        <header className="kbnb-column-head">
          <span className="kbnb-column-title" title={col.title}>
            {col.title}
          </span>
          <span className="kbnb-column-count">{col.cards.length}</span>
        </header>
        <div className="kbnb-cards">
          {col.cards.map((card: any) => (
            <article
              key={card.id}
              data-card=""
              className={
                'kbnb-card' +
                (drag && drag.kind === 'card' && drag.cardId === card.id ? ' kbnb-card-drag' : '') +
                (props.activeCardId === card.id ? ' kbnb-card-active' : '')
              }
              draggable
              onDragStart={(evt) => {
                evt.dataTransfer.effectAllowed = 'move'
                setDrag({ kind: 'card', cardId: card.id, from: col.id, groupKey })
              }}
              onDragEnd={onDragEnd}
              onClick={() => props.onOpenCard(col.id, card.id)}
            >
              {/* Ticket展示：title + 标签 + 一句话纯文本描述（单行省略，无预览） */}
              <div className="kbnb-card-title">{card.title}</div>
              {card.tags && card.tags.length > 0 ? (
                <div className="kbnb-card-tags">
                  {card.tags.map((tg: string) => (
                    <span key={tg} className="kbnb-tag">{tg}</span>
                  ))}
                </div>
              ) : null}
              {card.description ? <div className="kbnb-card-desc">{card.description}</div> : null}
            </article>
          ))}
          {hint && hint.columnId === col.id ? <div className="kbnb-drop-line" /> : null}
        </div>
        <button className="kbnb-add-card" type="button" onClick={() => props.onStartCreate(col.id)}>
          + 添加Ticket
        </button>
      </section>
    )
  }

  const groups = buildGroups()
  return (
    <>
      {/* 工具行：分组切换 + 列配置 */}
      <div className="kbnb-board-toolbar">
        <label className="kbnb-status">
          <span className="kbnb-status-label">分组</span>
          <select
            className="kbnb-status-select"
            value={props.groupBy}
            onChange={(evt) => props.onGroupByChange(evt.target.value as GroupBy)}
          >
            <option value="none">不分组</option>
            <option value="repo">Git 仓库</option>
          </select>
        </label>
      </div>
      {props.board.columns.length === 0 ? (
        <div className="kbnb-empty">空Kanban，去左侧「设置」添加列</div>
      ) : (
        <main className={'kbnb-board' + (props.groupBy === 'repo' ? ' kbnb-board-groups' : '')}>
          {groups.map((g) => (
            <section key={g.key || '__single__'} className={'kbnb-group' + (props.groupBy === 'none' ? ' kbnb-group-single' : '')}>
              {props.groupBy === 'repo' ? (
                <header className="kbnb-group-head">
                  <span className="kbnb-group-title">{g.label}</span>
                  <span className="kbnb-group-count">{g.count} 张卡</span>
                </header>
              ) : null}
              <div className="kbnb-group-row">
                {g.columns.map((col, colIndex) => renderColumn(col, colIndex, g.key))}
              </div>
            </section>
          ))}
        </main>
      )}
    </>
  )
}
