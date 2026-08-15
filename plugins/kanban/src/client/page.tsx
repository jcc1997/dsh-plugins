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
import { KanbanBlock, CardGate, CardTemplate, KanbanBoard } from '@dsh-plugins/ui'
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

type View = 'board' | 'archive' | 'gates' | 'templates' | 'settings'

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
  /** 门禁视图点击卡片：活动卡开抽屉；归档卡切归档视图 */
  function openCardFromAnywhere(cardId: string) {
    for (const col of (board ? board.columns : [])) {
      if ((col.cards || []).some((k: any) => k.id === cardId)) { setDrawer({ columnId: col.id, cardId }); return }
    }
    setView('archive')
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
  function createCard(columnId: string, title: string, description: string, tags: string[], content: KanbanBlock[], gates?: CardGate[], templateName?: string) {
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
        gates: gates || [],
        createdAt: safeNow(),
        updatedAt: safeNow(),
      }
      appendActivity(card, '创建卡片' + (templateName ? '（模板：' + templateName + '）' : ''))
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
  const gateCount = (() => {
    let n = 0
    for (const col of board.columns) for (const k of col.cards) n += (k.gates || []).length
    for (const k of board.archive || []) n += (k.gates || []).length
    return n
  })()

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
            className={'kbnb-nav-item' + (view === 'gates' ? ' kbnb-nav-on' : '')}
            onClick={() => setView('gates')}
          >
            <IconGateGlyph />
            <span className="kbnb-nav-label">门禁</span>
            <span className="kbnb-nav-badge">{gateCount}</span>
          </button>
          <button
            type="button"
            className={'kbnb-nav-item' + (view === 'templates' ? ' kbnb-nav-on' : '')}
            onClick={() => setView('templates')}
          >
            <IconTemplateGlyph />
            <span className="kbnb-nav-label">模板</span>
            <span className="kbnb-nav-badge">{(board.templates || []).length}</span>
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
          {view === 'gates' ? <GatesView board={board} onOpenCard={(cardId) => openCardFromAnywhere(cardId)} /> : null}
          {view === 'templates' ? <TemplatesView board={board} kb={kb} /> : null}
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
          onAddGate={(gate) => kb.addGate(drawer.cardId, gate)}
          onRemoveGate={(gateId) => kb.removeGate(drawer.cardId, gateId)}
          actionHost={props.renderSlot ? () => (
            <div className="kbnb-card-actions">
              {props.renderSlot!('kanban.card.actions', { cardId: drawer.cardId, onSynced: kb.reload }, {}) as React.ReactNode}
            </div>
          ) : null}
        />
      ) : null}
      {creating ? (
        <CreateCardModal
          templates={board.templates || []}
          onCreate={(title, description, tags, content, gates, templateName) => createCard(creating, title, description, tags, content, gates, templateName)}
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


/* ── 门禁总览视图：列出全板带门禁的卡片与其门禁 ── */
function GatesView(props: { board: KanbanBoard; onOpenCard: (cardId: string) => void }) {
  const rows: Array<{ card: any; colTitle: string; archived: boolean }> = []
  for (const col of props.board.columns || []) {
    for (const k of col.cards || []) {
      if ((k.gates || []).length > 0) rows.push({ card: k, colTitle: col.title, archived: false })
    }
  }
  for (const k of props.board.archive || []) {
    if ((k.gates || []).length > 0) rows.push({ card: k, colTitle: '归档', archived: true })
  }
  return (
    <div className="kbnb-archive">
      <h3 className="kbnb-settings-title">门禁总览（{rows.length} 张卡）</h3>
      {rows.length === 0 ? <div className="kbnb-settings-empty">暂无卡片挂门禁。打开卡片抽屉 →「门禁」区块挂载，或用 agent 工具 kanban_gate_add。</div> : null}
      {rows.map(({ card, colTitle, archived }) => (
        <section key={card.id} className="kbnb-settings">
          <button className="kbnb-gates-cardlink" type="button" title="打开卡片" onClick={() => props.onOpenCard(card.id)}>
            <span className="kbnb-gates-cardtitle">{card.title}</span>
            <span className="kbnb-gates-col">{colTitle}</span>
          </button>
          {(card.gates || []).map((g: any) => {
            const t = g.checker ? g.checker.type : g.kind
            return (
              <div key={g.id} className="kbnb-gate-row">
                <span className="kbnb-gate-name">{g.name}</span>
                <span className="kbnb-gate-meta">{(g.on === 'move' ? '移动' : g.on === 'tags' ? '标签' : '归档') + (g.to ? '→' + g.to : '')} · {t}</span>
                <span className="kbnb-gate-summary">{typeof g.checker !== 'undefined' && g.checker.config ? JSON.stringify(g.checker.config) : ''}</span>
              </div>
            )
          })}
        </section>
      ))}
    </div>
  )
}

/* ── 模板视图：列表 + 新建 + 删除（预置描述/标签/门禁） ── */
function TemplatesView(props: { board: KanbanBoard; kb: ReturnType<typeof useKanbanBoard> }) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [tagsText, setTagsText] = useState('')
  const [gatesText, setGatesText] = useState('')
  const templates = props.board.templates || []
  function create() {
    if (!name.trim()) return
    let gates: CardGate[] = []
    if (gatesText.trim()) {
      try { gates = JSON.parse(gatesText) } catch { gates = [] }
    }
    props.kb.mutate((b) => {
      if (!Array.isArray(b.templates)) b.templates = []
      b.templates.push({
        id: safeId('t'), name: name.trim(), description: desc.trim(),
        tags: tagsText.split(/[,，\s]+/).map((x) => x.trim()).filter(Boolean),
        content: [], gates,
        createdAt: safeNow(), updatedAt: safeNow(),
      })
    })
    setName(''); setDesc(''); setTagsText(''); setGatesText(''); setAdding(false)
  }
  function remove(id: string) {
    props.kb.mutate((b) => {
      b.templates = (b.templates || []).filter((t) => t.id !== id)
    })
  }
  return (
    <div className="kbnb-archive">
      <div className="kbnb-settings-title-row">
        <h3 className="kbnb-settings-title">创建模板（{templates.length}）</h3>
        <button className="kbnb-btn kbnb-primary" type="button" onClick={() => setAdding(!adding)}>{adding ? '收起' : '+ 新建模板'}</button>
      </div>
      {adding ? (
        <section className="kbnb-settings">
          <div className="kbnb-field">
            <label className="kbnb-field-label">名称</label>
            <input className="kbnb-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="如：workflow" />
          </div>
          <div className="kbnb-field">
            <label className="kbnb-field-label">预置描述</label>
            <input className="kbnb-input" value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
          <div className="kbnb-field">
            <label className="kbnb-field-label">预置标签（逗号分隔）</label>
            <input className="kbnb-input" value={tagsText} onChange={(e) => setTagsText(e.target.value)} />
          </div>
          <div className="kbnb-field">
            <label className="kbnb-field-label">预置门禁（JSON 数组）</label>
            <textarea className="kbnb-textarea" style={{ minHeight: 90, fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace' }} value={gatesText} onChange={(e) => setGatesText(e.target.value)} placeholder='[{"on":"move","to":"Done","checker":{"type":"mr-merged"}}]' />
          </div>
          <button className="kbnb-btn kbnb-primary" type="button" disabled={!name.trim()} onClick={create}>创建</button>
        </section>
      ) : null}
      {templates.length === 0 && !adding ? <div className="kbnb-settings-empty">暂无模板。模板预置描述/标签/内容/门禁，新建卡片时引用免重复输入（agent: kanban_template_create）。</div> : null}
      {templates.map((t: CardTemplate) => (
        <section key={t.id} className="kbnb-settings kbnb-tpl-row">
          <div className="kbnb-tpl-main">
            <span className="kbnb-tpl-name">{t.name}</span>
            <span className="kbnb-tpl-desc">{t.description || '（无描述）'}{t.tags && t.tags.length ? ' · 标签 ' + t.tags.join(', ') : ''}{t.gates && t.gates.length ? ' · 门禁 ' + t.gates.length : ''}</span>
          </div>
          <button className="kbnb-btn kbnb-danger" type="button" onClick={() => remove(t.id)}>删除</button>
        </section>
      ))}
    </div>
  )
}

/* ── 导航图标 ── */
function IconGateGlyph() {
  return (
    <svg width={15} height={15} viewBox="0 0 16 16" fill="none" className="kbnb-nav-icon">
      <path d="M8 1.5l5.5 2v4.2c0 3.1-2.2 5.6-5.5 6.8-3.3-1.2-5.5-3.7-5.5-6.8V3.5L8 1.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M5.8 8l1.5 1.5 2.9-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconTemplateGlyph() {
  return (
    <svg width={15} height={15} viewBox="0 0 16 16" fill="none" className="kbnb-nav-icon">
      <rect x="2" y="1.5" width="9" height="13" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5 4.5h3M5 7h3M5 9.5h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M11 4h1.5c.55 0 1 .45 1 1v8.5c0 .55-.45 1-1 1H12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}
