// client/page.tsx — 看板页装配：顶栏 + 左侧边栏导航（看板/归档/设置）+ 主区视图切换
// 看板视图在 board-view.tsx，归档视图在 archive-view.tsx，设置视图复用 settings.tsx；
// 抽屉/新建/列配置弹窗在此装配；数据操作全部走 useKanbanBoard。
import React, { useState } from 'react'
import { IconChevronLeftOutline14, IconSettingsOutline16 } from '@dsh-plugins/ui'
import { CardDrawer } from './drawer'
import { CreateCardModal } from './create'
import { ColumnsPanel } from './columns'
import { KanbanSettings } from './settings'
import { safeId, safeNow, appendActivity } from '@dsh-plugins/ui'
import { useKanbanBoard, HostLike } from './board-hook'
import { KanbanBlock } from '@dsh-plugins/ui'
import { BoardView, GroupBy } from './board-view'
import { ArchiveView } from './archive-view'

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

  const board = kb.board

  /* ── 卡片操作回调（透传给抽屉） ── */
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

  return (
    <div className="kbnb-page">
      {/* 顶栏：返回 / 标题 / 统计 / 保存状态 */}
      <header className="kbnb-header">
        <button className="kbnb-icon-btn kbnb-back" type="button" title="返回" onClick={props.onClose}>
          <IconChevronLeftOutline14 />
        </button>
        <span className="kbnb-title">看板</span>
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

        {/* ══ 主区：视图切换 ══ */}
        <main className="kbnb-main">
          {view === 'board' ? (
            <BoardView
              board={board}
              groupBy={groupBy}
              onGroupByChange={setGroupBy}
              onOpenCard={openCard}
              onStartCreate={setCreating}
              activeCardId={drawer ? drawer.cardId : null}
              kb={kb}
            />
          ) : null}
          {view === 'archive' ? <ArchiveView board={board} kb={kb} onBackToBoard={() => setView('board')} /> : null}
          {view === 'settings' ? (
            <div className="kbnb-archive">
              <KanbanSettings host={props.host} />
              <section className="kbnb-settings kbnb-settings-cols">
                <h3 className="kbnb-settings-title">列配置</h3>
                <ColumnsPanel
                  columns={board.columns}
                  onAdd={addColumn}
                  onRename={renameColumn}
                  onDelete={deleteColumn}
                  onMove={moveColumn}
                />
              </section>
            </div>
          ) : null}
        </main>
      </div>

      {/* 卡片抽屉（key 按 cardId 重建，保证切换卡片时状态干净） */}
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
              {props.renderSlot!('kanban.card.actions', { cardId: drawer.cardId, onSynced: kb.reload }, {}) as React.ReactNode}
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
    </div>
  )
}

/** 侧边栏图标（官方风格，本地绘制） */
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
