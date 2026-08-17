// client/board-view.tsx — Kanban视图：顶栏工具行（分组/列配置）+ 列/Ticket渲染 + Ticket拖拽
// 分组：不分组 = 单泳道（整体横向滚动）；Git 仓库 = 按 github-repo 关联分泳道（组内横向滚动）
// 拖拽：仅Ticket（组内排序/跨列移动）；跨组拖拽忽略；列头不可拖拽（列排序走设置页列配置）
import React, { useState } from 'react'
import { safeNow, appendActivity } from '@dsh-plugins/ui'
import { KanbanBoard } from '@dsh-plugins/ui'
import { ticketRepoOf } from './board-util'
import { useKanbanBoard } from './board-hook'

export type GroupBy = 'none' | 'repo'

export interface Group {
  key: string
  label: string
  count: number
  columns: Array<{ id: string; title: string; tickets: any[]; meta?: any }>
}

type DragState = { kind: 'ticket'; ticketId: string; from: string; groupKey: string } | null

export function BoardView(props: {
  board: KanbanBoard
  groupBy: GroupBy
  onGroupByChange: (v: GroupBy) => void
  onOpenTicket: (columnId: string, ticketId: string) => void
  onStartCreate: (columnId: string) => void
  activeTicketId: string | null
  kb: ReturnType<typeof useKanbanBoard>
}) {
  const [drag, setDrag] = useState<DragState>(null)
  const [hint, setHint] = useState<{ columnId: string; index: number } | null>(null)

  /** 按鼠标位置计算Ticket插入下标（落点指示线用） */
  function computeTicketIndex(evt: React.DragEvent) {
    const el = evt.currentTarget
    try {
      const tickets = Array.from(el.children).filter(
        (child) => child instanceof HTMLElement && child.getAttribute('data-ticket') !== null,
      )
      for (let i = 0; i < tickets.length; i++) {
        const r = tickets[i].getBoundingClientRect()
        if (evt.clientY < r.top + r.height / 2) return i
      }
      return tickets.length
    } catch {
      return 0
    }
  }
  function onColumnOver(columnId: string, evt: React.DragEvent) {
    evt.preventDefault()
    if (!drag) return
    if (drag.kind === 'ticket') setHint({ columnId, index: computeTicketIndex(evt) })
  }
  /** 落点：Ticket移动（跨组忽略；组内排序 / 跨列移动） */
  function onColumnDrop(columnId: string, groupKey: string, evt: React.DragEvent) {
    evt.preventDefault()
    if (!drag) return
    if (drag.kind !== 'ticket') { setDrag(null); setHint(null); return }
    if (drag.groupKey !== groupKey) {
      setDrag(null)
      setHint(null)
      return
    }
    const index = computeTicketIndex(evt)
    props.kb.mutate((b) => {
      const fromCol = b.columns.find((c) => c.id === drag.from)
      const toCol = b.columns.find((c) => c.id === columnId)
      if (!fromCol || !toCol) return
      const idx = fromCol.tickets.findIndex((k) => k.id === drag.ticketId)
      if (idx < 0) return
      const [ticket] = fromCol.tickets.splice(idx, 1)
      if (fromCol.id === toCol.id) {
        let target = index
        if (idx < target) target -= 1
        toCol.tickets.splice(target, 0, ticket)
        ticket.updatedAt = safeNow()
        appendActivity(ticket, '调整顺序')
      } else {
        toCol.tickets.splice(index, 0, ticket)
        ticket.updatedAt = safeNow()
        appendActivity(ticket, '状态变更：' + fromCol.title + ' → ' + toCol.title)
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
        count: props.board.columns.reduce((n, c) => n + c.tickets.length, 0),
        columns: props.board.columns.map((c) => ({ ...c })),
      }]
    }
    const map = new Map<string, Group>()
    const keys: string[] = []
    for (const col of props.board.columns) {
      for (const ticket of col.tickets) {
        const key = ticketRepoOf(ticket)
        if (!map.has(key)) {
          map.set(key, { key, label: key || '未关联', count: 0, columns: props.board.columns.map((c) => ({ ...c, tickets: [] })) })
          keys.push(key)
        }
      }
    }
    keys.sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a < b ? -1 : a > b ? 1 : 0))
    for (const col of props.board.columns) {
      const colIdx = props.board.columns.findIndex((c) => c.id === col.id)
      for (const ticket of col.tickets) {
        const g = map.get(ticketRepoOf(ticket))
        if (g) {
          g.columns[colIdx].tickets.push(ticket)
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
          <span className="kbnb-column-count">{col.tickets.length}</span>
        </header>
        <div className="kbnb-tickets">
          {col.tickets.map((ticket: any) => (
            <article
              key={ticket.id}
              data-ticket=""
              className={
                'kbnb-ticket' +
                (drag && drag.kind === 'ticket' && drag.ticketId === ticket.id ? ' kbnb-ticket-drag' : '') +
                (props.activeTicketId === ticket.id ? ' kbnb-ticket-active' : '')
              }
              draggable
              onDragStart={(evt) => {
                evt.dataTransfer.effectAllowed = 'move'
                setDrag({ kind: 'ticket', ticketId: ticket.id, from: col.id, groupKey })
              }}
              onDragEnd={onDragEnd}
              onClick={() => props.onOpenTicket(col.id, ticket.id)}
            >
              {/* Ticket展示：title + 标签 + 一句话纯文本描述（单行省略，无预览） */}
              <div className="kbnb-ticket-title">{ticket.title}</div>
              {ticket.tags && ticket.tags.length > 0 ? (
                <div className="kbnb-ticket-tags">
                  {ticket.tags.map((tg: string) => (
                    <span key={tg} className="kbnb-tag">{tg}</span>
                  ))}
                </div>
              ) : null}
              {ticket.description ? <div className="kbnb-ticket-desc">{ticket.description}</div> : null}
            </article>
          ))}
          {hint && hint.columnId === col.id ? <div className="kbnb-drop-line" /> : null}
        </div>
        <button className="kbnb-add-ticket" type="button" onClick={() => props.onStartCreate(col.id)}>
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
