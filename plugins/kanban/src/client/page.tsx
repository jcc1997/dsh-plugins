// 看板页面：顶栏 + 左侧边栏（看板/归档/设置）+ 主区（分组看板/归档列表/设置）
// 布局：页面上下撑满；列间竖线拉到底；每列独立纵向滚动；看板整体横向滚动
import React, { useState } from 'react'
import { IconChevronLeftOutline14, IconSettingsOutline16 } from '@dsh-plugins/ui'
import { Modal } from '@dsh-plugins/ui'
import { CardDrawer } from './drawer'
import { CreateCardModal } from './create'
import { ColumnsPanel } from './columns'
import { KanbanSettings } from './settings'
import { safeId, safeNow, appendActivity, fmtTime } from '@dsh-plugins/ui'
import { useKanbanBoard, HostLike, cardRepoOf } from './board-hook'
import { KanbanBlock } from '@dsh-plugins/ui'

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

type View = 'board' | 'archive' | 'settings'
type GroupBy = 'none' | 'repo'

interface Group {
  key: string
  label: string
  count: number
  columns: Array<{ id: string; title: string; cards: any[]; meta?: any }>
}

export function KanbanPage(props: {
  host: HostLike
  onClose: () => void
  renderSlot?: RenderSlotLike
  sessions?: SessionsLike
}) {
  const kb = useKanbanBoard(props.host)
  const [view, setView] = useState<View>('board')
  const [groupBy, setGroupBy] = useState<GroupBy>('none')
  const [drawer, setDrawer] = useState<DrawerState | null>(null)
  const [creating, setCreating] = useState<string | null>(null)
  const [showColumns, setShowColumns] = useState(false)
  const [drag, setDrag] = useState<{ kind: 'card'; cardId: string; from: string; groupKey: string } | { kind: 'column'; from: number } | null>(null)
  const [hint, setHint] = useState<{ columnId: string; index: number } | null>(null)

  const board = kb.board

  function openCard(columnId: string, cardId: string) {
    setDrawer({ columnId, cardId })
  }
  function saveCard(title: string, description: string, content: KanbanBlock[]) {
    if (!drawer) return
    kb.saveCard(drawer.cardId, title, description, content)
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
  function archiveCard() {
    if (!drawer) return
    kb.archiveCard(drawer.cardId)
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
  function createCard(columnId: string, title: string, description: string, tags: string[], content: KanbanBlock[]) {
    kb.mutate((b) => {
      const col = b.columns.find((c) => c.id === columnId)
      if (!col) return
      const card = {
        id: safeId('k'),
        title,
        description,
        content,
        tags,
        links: [],
        refs: [],
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
  function onColumnDrop(columnId: string, groupKey: string, evt: React.DragEvent) {
    evt.preventDefault()
    if (!drag) return
    if (drag.kind === 'card') {
      if (drag.groupKey !== groupKey) {
        setDrag(null)
        setHint(null)
        return
      }
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
  const archived = board.archive || []
  const activeCount = board.columns.reduce((n, col) => n + col.cards.length, 0)

  /** 分组计算：groupBy=none 时单组；repo 时按 github-repo 关联分组（未关联在最后） */
  function buildGroups(): Group[] {
    if (groupBy === 'none') {
      return [{
        key: '',
        label: '',
        count: activeCount,
        columns: board.columns.map((c) => ({ ...c })),
      }]
    }
    const map = new Map<string, Group>()
    const keys: string[] = []
    for (const col of board.columns) {
      for (const card of col.cards) {
        const key = cardRepoOf(card)
        if (!map.has(key)) {
          map.set(key, {
            key,
            label: key || '未关联',
            count: 0,
            columns: board.columns.map((c) => ({ ...c, cards: [] })),
          })
          keys.push(key)
        }
      }
    }
    keys.sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a < b ? -1 : a > b ? 1 : 0))
    for (const col of board.columns) {
      const colIdx = board.columns.findIndex((c) => c.id === col.id)
      for (const card of col.cards) {
        const key = cardRepoOf(card)
        const g = map.get(key)
        if (g) {
          g.columns[colIdx].cards.push(card)
          g.count += 1
        }
      }
    }
    return keys.map((k) => map.get(k)!)
  }

  /** 渲染单列（分组模式传入 groupKey 限制拖拽范围） */
  function renderColumn(col: any, colIndex: number, groupKey: string) {
    return (
      <section
        key={col.id}
        className={'kbnb-column' + (hint && hint.columnId === col.id ? ' kbnb-column-drop' : '')}
        onDragOver={(evt) => onColumnOver(col.id, evt)}
        onDrop={(evt) => onColumnDrop(col.id, groupKey, evt)}
      >
        <header
          className="kbnb-column-head"
          draggable={groupBy === 'none'}
          onDragStart={(evt) => {
            evt.dataTransfer.effectAllowed = 'move'
            setDrag({ kind: 'column', from: colIndex })
          }}
          onDragEnd={onDragEnd}
        >
          <span className="kbnb-column-title" title={groupBy === 'none' ? '拖拽排序' : col.title}>
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
                (drawer && drawer.cardId === card.id ? ' kbnb-card-active' : '')
              }
              draggable
              onDragStart={(evt) => {
                evt.dataTransfer.effectAllowed = 'move'
                setDrag({ kind: 'card', cardId: card.id, from: col.id, groupKey })
              }}
              onDragEnd={onDragEnd}
              onClick={() => openCard(col.id, card.id)}
            >
              <div className="kbnb-card-title">{card.title}</div>
              {card.tags && card.tags.length > 0 ? (
                <div className="kbnb-card-tags">
                  {card.tags.map((tg: string) => (
                    <span key={tg} className="kbnb-tag">{tg}</span>
                  ))}
                </div>
              ) : null}
              {card.description ? (
                <div className="kbnb-card-desc">{card.description}</div>
              ) : null}
            </article>
          ))}
          {hint && hint.columnId === col.id ? <div className="kbnb-drop-line" /> : null}
        </div>
        <button className="kbnb-add-card" type="button" onClick={() => setCreating(col.id)}>
          + 添加卡片
        </button>
      </section>
    )
  }

  const groups = buildGroups()

  return (
    <div className="kbnb-page">
      <header className="kbnb-header">
        <button className="kbnb-icon-btn kbnb-back" type="button" title="返回" onClick={props.onClose}>
          <IconChevronLeftOutline14 />
        </button>
        <span className="kbnb-title">看板</span>
        <span className="kbnb-stats">{board.columns.length} 列 · {activeCount} 张卡 · 归档 {archived.length}</span>
        <span className="kbnb-saving">{kb.saving ? '保存中…' : ''}</span>
      </header>
      {kb.error ? <div className="kbnb-error">{kb.error}</div> : null}
      <div className="kbnb-body">
        {/* ══ 左侧边栏：看板 / 归档 / 设置 ══ */}
        <aside className="kbnb-app-side">
          <button
            type="button"
            className={'kbnb-nav-item' + (view === 'board' ? ' kbnb-nav-on' : '')}
            onClick={() => setView('board')}
          >
            <IconBoardGlyph />
            <span className="kbnb-nav-label">看板</span>
            <span className="kbnb-nav-badge">{activeCount}</span>
          </button>
          <button
            type="button"
            className={'kbnb-nav-item' + (view === 'archive' ? ' kbnb-nav-on' : '')}
            onClick={() => setView('archive')}
          >
            <IconArchiveGlyph />
            <span className="kbnb-nav-label">归档</span>
            {archived.length > 0 ? <span className="kbnb-nav-badge">{archived.length}</span> : null}
          </button>
          <button
            type="button"
            className={'kbnb-nav-item' + (view === 'settings' ? ' kbnb-nav-on' : '')}
            onClick={() => setView('settings')}
          >
            <IconSettingsOutline16 />
            <span className="kbnb-nav-label">设置</span>
          </button>
        </aside>

        <main className="kbnb-main">
          {view === 'board' ? (
            <>
              <div className="kbnb-board-toolbar">
                <label className="kbnb-status">
                  <span className="kbnb-status-label">分组</span>
                  <select
                    className="kbnb-status-select"
                    value={groupBy}
                    onChange={(evt) => setGroupBy(evt.target.value as GroupBy)}
                  >
                    <option value="none">不分组</option>
                    <option value="repo">Git 仓库</option>
                  </select>
                </label>
                <span className="kbnb-spacer" />
                <button className="kbnb-btn" type="button" onClick={() => setShowColumns(true)}>
                  列配置
                </button>
              </div>
              {board.columns.length === 0 ? (
                <div className="kbnb-empty">空看板，点右上角「列配置」添加列</div>
              ) : (
                <main className={'kbnb-board' + (groupBy === 'repo' ? ' kbnb-board-groups' : '')}>
                  {groups.map((g) => (
                    <section key={g.key || '__single__'} className={'kbnb-group' + (groupBy === 'none' ? ' kbnb-group-single' : '')}>
                      {groupBy === 'repo' ? (
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
          ) : null}

          {view === 'archive' ? (
            <div className="kbnb-archive">
              <div className="kbnb-archive-head">
                <span className="kbnb-archive-title">归档 {archived.length}</span>
                {archived.length > 0 ? (
                  <button
                    className="kbnb-btn kbnb-danger"
                    type="button"
                    onClick={() => {
                      if (window.confirm('清空归档？所有归档卡片将被永久删除，不可恢复。')) {
                        kb.mutate((b) => {
                          b.archive = []
                        })
                      }
                    }}
                  >
                    清空归档
                  </button>
                ) : null}
              </div>
              {archived.length === 0 ? (
                <div className="kbnb-empty">归档为空。看板卡片右上角「归档」后可在侧边栏这里找回。</div>
              ) : (
                <div className="kbnb-archive-list">
                  {archived.map((card: any) => {
                    const fromCol = board.columns.find((c) => c.id === (card.archivedFrom || ''))
                    return (
                      <div key={card.id} className="kbnb-arch-row">
                        <div className="kbnb-arch-info">
                          <div className="kbnb-arch-title">{card.title}</div>
                          {card.description ? <div className="kbnb-arch-desc">{card.description}</div> : null}
                          <div className="kbnb-arch-meta">
                            {fromCol ? <span className="kbnb-arch-col">原列 {fromCol.title}</span> : null}
                            {card.archivedAt ? <span className="kbnb-arch-time">归档于 {fmtTime(card.archivedAt)}</span> : null}
                          </div>
                        </div>
                        <div className="kbnb-arch-actions">
                          <button
                            className="kbnb-btn"
                            type="button"
                            onClick={() => {
                              kb.unarchiveCard(card.id)
                              setView('board')
                            }}
                          >
                            恢复
                          </button>
                          <button
                            className="kbnb-btn kbnb-danger"
                            type="button"
                            onClick={() => {
                              if (window.confirm('永久删除卡片「' + card.title + '」？不可恢复。')) {
                                kb.deleteArchivedCard(card.id)
                              }
                            }}
                          >
                            删除
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ) : null}

          {view === 'settings' ? (
            <div className="kbnb-archive">
              <KanbanSettings host={props.host} />
            </div>
          ) : null}
        </main>
      </div>

      {drawer && drawerCard ? (
        <CardDrawer
          key={drawer.cardId}
          card={drawerCard}
          columns={board.columns}
          onSave={saveCard}
          onDelete={deleteCard}
          onArchive={archiveCard}
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
          onCreate={(title, description, tags, content) => createCard(creating, title, description, tags, content)}
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

function IconBoardGlyph() {
  return (
    <svg width={15} height={15} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="kbnb-nav-icon">
      <rect x="1.5" y="2" width="4" height="12" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <rect x="6" y="2" width="4" height="8" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <rect x="10.5" y="2" width="4" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}
function IconArchiveGlyph() {
  return (
    <svg width={15} height={15} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="kbnb-nav-icon">
      <rect x="1.5" y="1.5" width="13" height="3.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <path d="M3 5v8.5c0 .55.45 1 1 1h8c.55 0 1-.45 1-1V5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M6.5 8.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}
