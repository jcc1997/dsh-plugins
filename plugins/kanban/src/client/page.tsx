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
  function createCard(columnId: string, title: string, description: string, tags: string[], content: KanbanBlock[], gateIds?: string[], templateName?: string) {
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
        gateIds: gateIds || [],
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
  const gateCount = (board.gateLibrary || []).length

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
            <span className="kbnb-nav-label">Gates</span>
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
          {view === 'gates' ? <GatesView board={board} kb={kb} onOpenCard={(cardId) => openCardFromAnywhere(cardId)} /> : null}
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
          gateLibrary={board.gateLibrary || []}
          onAddGate={(gateId) => kb.attachGate(drawer.cardId, gateId)}
          onRemoveGate={(gateId) => kb.removeGate(drawer.cardId, gateId)}
          onOpenGatesView={() => setView('gates')}
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
          gateLibrary={board.gateLibrary || []}
          onCreate={(title, description, tags, content, gateIds, templateName) => createCard(creating, title, description, tags, content, gateIds, templateName)}
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
      <rect x="1.5" y="2" width="4" height="12" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="6" y="2" width="4" height="8" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="10.5" y="2" width="4" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  )
}
function IconArchiveGlyph() {
  return (
    <svg width={15} height={15} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="kbnb-nav-icon">
      <rect x="1.5" y="1.5" width="13" height="3.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <path d="M3 5v8.5c0 .55.45 1 1 1h8c.55 0 1-.45 1-1V5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M6.5 8.5h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}


/* ── 门禁库视图（v6）：每个门禁是独立实体，单独配置；卡片/模板按 id 勾选 ── */
const GATE_KIND_OPTIONS: { type: string; label: string }[] = [
  { type: 'tag-required', label: '必须含标签' },
  { type: 'field-nonempty', label: '字段非空' },
  { type: 'mr-linked', label: '已关联 MR' },
  { type: 'branch-linked', label: '已关联 workflow 分支' },
  { type: 'mr-merged', label: 'MR 已合并' },
  { type: 'pipeline', label: 'pipeline 检查' },
  { type: 'code', label: '代码检查（沙箱）' },
]
const GATE_ON_OPTIONS: { on: string; label: string }[] = [
  { on: 'move', label: '移动状态' },
  { on: 'tags', label: '增减标签' },
  { on: 'archive', label: '归档' },
]
const GATE_ON_LABEL_P: Record<string, string> = { move: '移动', tags: '标签', archive: '归档' }

function gateTypeLabel(g: any): string {
  const t = g.checker ? g.checker.type : g.kind
  return (GATE_KIND_OPTIONS.find((o) => o.type === t) || { label: String(t) }).label
}

function gateConfigPlaceholder(type: string): string {
  if (type === 'tag-required') return '{"tags":["done"]}'
  if (type === 'field-nonempty') return '{"field":"description"}'
  if (type === 'pipeline') return '{"pipelines":["pipeline-id"]}'
  if (type === 'code') return '{"code":"const c = await gate.card({});\\nreturn { ok: true, reason: \'通过\' }"}'
  return '无需配置'
}

function GatesView(props: { board: KanbanBoard; kb: ReturnType<typeof useKanbanBoard>; onOpenCard: (cardId: string) => void }) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [on, setOn] = useState('move')
  const [to, setTo] = useState('')
  const [type, setType] = useState('mr-merged')
  const [cfgText, setCfgText] = useState('')
  const lib = props.board.gateLibrary || []

  function submit() {
    let config: Record<string, unknown> = {}
    if (cfgText.trim()) { try { config = JSON.parse(cfgText) } catch { config = {} } }
    const gate: any = {
      name: name.trim() || (gateTypeLabel({ checker: { type } }) + '（' + GATE_ON_LABEL_P[on] + (to ? '→' + to : '') + '）'),
      on,
      checker: { type, config },
    }
    if (on === 'move' && to.trim()) gate.to = to.trim()
    props.kb.createGate(gate)
    setName(''); setTo(''); setCfgText(''); setAdding(false)
  }

  function usersOf(gateId: string): { cards: Array<{ id: string; title: string; col: string }>; templates: string[] } {
    const cards: Array<{ id: string; title: string; col: string }> = []
    for (const col of props.board.columns || []) {
      for (const k of col.cards || []) {
        if (Array.isArray(k.gateIds) && k.gateIds.includes(gateId)) cards.push({ id: k.id, title: k.title, col: col.title })
      }
    }
    for (const k of props.board.archive || []) {
      if (Array.isArray(k.gateIds) && k.gateIds.includes(gateId)) cards.push({ id: k.id, title: k.title, col: '归档' })
    }
    const templates = (props.board.templates || []).filter((t) => Array.isArray(t.gateIds) && t.gateIds.includes(gateId)).map((t) => t.name)
    return { cards, templates }
  }

  return (
    <div className="kbnb-archive">
      <div className="kbnb-settings-title-row">
        <h3 className="kbnb-settings-title">Gates（{lib.length}）</h3>
        <button className="kbnb-btn kbnb-primary" type="button" onClick={() => setAdding(!adding)}>{adding ? '收起' : '+ 新建门禁'}</button>
      </div>
      {adding ? (
        <section className="kbnb-settings">
          <div className="kbnb-field">
            <label className="kbnb-field-label">门禁名</label>
            <input className="kbnb-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="如：MR 合并后才能进 Done（可留空自动生成）" />
          </div>
          <div className="kbnb-field-row kbnb-gate-form-row">
            <label className="kbnb-field-label">触发</label>
            <select className="kbnb-input" value={on} onChange={(e) => setOn(e.target.value)}>
              {GATE_ON_OPTIONS.map((o) => <option key={o.on} value={o.on}>{o.label}</option>)}
            </select>
            {on === 'move' ? (
              <input className="kbnb-input" value={to} onChange={(e) => setTo(e.target.value)} placeholder="限定目标列（可选）" />
            ) : null}
          </div>
          <div className="kbnb-field">
            <label className="kbnb-field-label">检查器</label>
            <select className="kbnb-input" value={type} onChange={(e) => setType(e.target.value)}>
              {GATE_KIND_OPTIONS.map((o) => <option key={o.type} value={o.type}>{o.label}</option>)}
            </select>
          </div>
          <div className="kbnb-field">
            <label className="kbnb-field-label">配置（JSON，可选）</label>
            <textarea
              className="kbnb-textarea"
              style={{ minHeight: 80, fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace' }}
              value={cfgText}
              onChange={(e) => setCfgText(e.target.value)}
              placeholder={gateConfigPlaceholder(type)}
            />
          </div>
          <button className="kbnb-btn kbnb-primary" type="button" onClick={submit}>创建门禁</button>
        </section>
      ) : null}
      {lib.length === 0 && !adding ? (
        <div className="kbnb-settings-empty">暂无 Gates。新建后可在卡片抽屉「Gates」区块勾选挂载、在模板勾选预置（agent 工具：kanban_gate_create / kanban_gate_add）。</div>
      ) : null}
      <div className="kbnb-gates-grid">
        {lib.map((g: any) => {
          const users = usersOf(g.id)
          const cfg = g.checker && g.checker.config
          return (
            <section key={g.id} className="kbnb-settings kbnb-gate-card">
              <header className="kbnb-gate-card-head">
                <div className="kbnb-tpl-main">
                  <span className="kbnb-tpl-name">{g.name}</span>
                  <span className="kbnb-tpl-desc">
                    {GATE_ON_LABEL_P[g.on]}{g.to ? '→' + g.to : ''} · {gateTypeLabel(g)}
                  </span>
                </div>
                <button className="kbnb-btn kbnb-danger kbnb-gate-del" type="button" title="删除门禁（同时从卡片/模板摘除）" onClick={() => props.kb.deleteGate(g.id)}>删除</button>
              </header>
              {cfg && Object.keys(cfg).length > 0 ? (
                <pre className="kbnb-gate-detail-pre">{JSON.stringify(cfg, null, 2)}</pre>
              ) : null}
              <div className="kbnb-gate-users">
                {users.cards.length > 0 || users.templates.length > 0 ? (
                  <>
                    <span className="kbnb-field-label">引用：</span>
                    {users.templates.map((tn) => <span key={'t' + tn} className="kbnb-tag">模板 {tn}</span>)}
                    {users.cards.map((c) => (
                      <button key={c.id} className="kbnb-gates-cardlink" type="button" title={'打开卡片（' + c.col + '）'} onClick={() => props.onOpenCard(c.id)}>
                        {c.title} <span className="kbnb-gates-col">{c.col}</span>
                      </button>
                    ))}
                  </>
                ) : <span className="kbnb-field-label">暂无引用</span>}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

/* ── 模板视图（v6）：模板卡片展示 + 点击卡片展开编辑；门禁从门禁库勾选 ── */
function TemplatesView(props: { board: KanbanBoard; kb: ReturnType<typeof useKanbanBoard> }) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [tagsText, setTagsText] = useState('')
  const [selGateIds, setSelGateIds] = useState<string[]>([])
  const templates = props.board.templates || []
  const lib = props.board.gateLibrary || []
  function toggleSel(id: string) {
    setSelGateIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }
  function create() {
    if (!name.trim()) return
    const tags = tagsText.split(/[,，\s]+/).map((x) => x.trim()).filter(Boolean)
    props.kb.createTemplate(name.trim(), desc.trim(), tags, selGateIds)
    setName(''); setDesc(''); setTagsText(''); setSelGateIds([]); setAdding(false)
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
            <label className="kbnb-field-label">勾选 Gates</label>
            {lib.length === 0 ? (
              <div className="kbnb-settings-empty">暂无 Gates：先到「Gates」页新建，或用 agent 工具 kanban_gate_create。</div>
            ) : (
              <div className="kbnb-gate-checks">
                {lib.map((g: any) => (
                  <label key={g.id} className="kbnb-gate-check">
                    <input type="checkbox" checked={selGateIds.includes(g.id)} onChange={() => toggleSel(g.id)} />
                    <span>{g.name}</span>
                    <span className="kbnb-gate-check-meta">{GATE_ON_LABEL_P[g.on]}{g.to ? '→' + g.to : ''} · {gateTypeLabel(g)}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <button className="kbnb-btn kbnb-primary" type="button" disabled={!name.trim()} onClick={create}>创建</button>
        </section>
      ) : null}
      {templates.length === 0 && !adding ? <div className="kbnb-settings-empty">暂无模板。模板预置描述/标签/内容/门禁，新建卡片时引用免重复输入（agent: kanban_template_create）。</div> : null}
      {templates.map((t) => (
        <TemplateCard key={t.id} tpl={t} lib={lib} kb={props.kb} />
      ))}
    </div>
  )
}

/** 单张模板卡片：点击展开编辑（名称/描述/标签/门禁勾选） */
function TemplateCard(props: { tpl: CardTemplate; lib: CardGate[]; kb: ReturnType<typeof useKanbanBoard> }) {
  const t = props.tpl
  const ids = Array.isArray(t.gateIds) ? t.gateIds : []
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(t.name)
  const [desc, setDesc] = useState(t.description || '')
  const [tagsText, setTagsText] = useState((t.tags || []).join(', '))
  const [selIds, setSelIds] = useState<string[]>(ids.slice())
  function beginEdit() {
    setName(t.name)
    setDesc(t.description || '')
    setTagsText((t.tags || []).join(', '))
    setSelIds(ids.slice())
    setEditing(true)
  }
  function save() {
    if (!name.trim()) return
    const tags = tagsText.split(/[,，\s]+/).map((x) => x.trim()).filter(Boolean)
    props.kb.updateTemplate(t.id, { name: name.trim(), description: desc.trim(), tags, gateIds: selIds })
    setEditing(false)
  }
  const gates = ids.map((id) => props.lib.find((g: any) => g.id === id)).filter(Boolean)
  return (
    <section className="kbnb-settings kbnb-tpl-card">
      <header className="kbnb-tpl-card-head" onClick={() => { if (!editing) beginEdit() }} title={editing ? '编辑中' : '点击编辑模板'}>
        <div className="kbnb-tpl-main">
          <span className="kbnb-tpl-name">{t.name}</span>
          <span className="kbnb-tpl-desc">{t.description || '（无描述）'}</span>
        </div>
        <div className="kbnb-tpl-card-btns">
          <button
            className="kbnb-btn"
            type="button"
            onClick={(e) => { e.stopPropagation(); editing ? setEditing(false) : beginEdit() }}
          >
            {editing ? '收起' : '编辑'}
          </button>
          <button
            className="kbnb-btn kbnb-danger"
            type="button"
            onClick={(e) => { e.stopPropagation(); props.kb.deleteTemplate(t.id) }}
          >
            删除
          </button>
        </div>
      </header>
      <div className="kbnb-tpl-chips">
        {(t.tags || []).map((tg) => <span key={tg} className="kbnb-tag">{tg}</span>)}
        {gates.map((g: any) => (
          <span key={g.id} className="kbnb-tag kbnb-tag-gate" title={GATE_ON_LABEL_P[g.on] + (g.to ? '→' + g.to : '') + ' · ' + gateTypeLabel(g)}>
            {g.name}
          </span>
        ))}
        {(t.tags || []).length === 0 && gates.length === 0 ? <span className="kbnb-field-label">无标签 / 无门禁</span> : null}
      </div>
      {editing ? (
        <div className="kbnb-tpl-edit">
          <div className="kbnb-field">
            <label className="kbnb-field-label">名称</label>
            <input className="kbnb-input" value={name} onChange={(e) => setName(e.target.value)} />
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
            <label className="kbnb-field-label">勾选 Gates</label>
            {props.lib.length === 0 ? (
              <div className="kbnb-settings-empty">暂无 Gates：先到「Gates」页新建，或用 agent 工具 kanban_gate_create。</div>
            ) : (
              <div className="kbnb-gate-checks">
                {props.lib.map((g: any) => (
                  <label key={g.id} className="kbnb-gate-check">
                    <input
                      type="checkbox"
                      checked={selIds.includes(g.id)}
                      onChange={() => setSelIds((prev) => (prev.includes(g.id) ? prev.filter((x) => x !== g.id) : [...prev, g.id]))}
                    />
                    <span>{g.name}</span>
                    <span className="kbnb-gate-check-meta">{GATE_ON_LABEL_P[g.on]}{g.to ? '→' + g.to : ''} · {gateTypeLabel(g)}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="kbnb-tpl-edit-btns">
            <button className="kbnb-btn kbnb-primary" type="button" disabled={!name.trim()} onClick={save}>保存</button>
            <button className="kbnb-btn" type="button" onClick={() => setEditing(false)}>取消</button>
          </div>
        </div>
      ) : null}
    </section>
  )
}

/* ── 导航图标 ── */
function IconGateGlyph() {
  return (
    <svg width={15} height={15} viewBox="0 0 16 16" fill="none" className="kbnb-nav-icon">
      <path d="M8 1.5l5.5 2v4.2c0 3.1-2.2 5.6-5.5 6.8-3.3-1.2-5.5-3.7-5.5-6.8V3.5L8 1.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M5.8 8l1.5 1.5 2.9-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconTemplateGlyph() {
  return (
    <svg width={15} height={15} viewBox="0 0 16 16" fill="none" className="kbnb-nav-icon">
      <rect x="2" y="1.5" width="9" height="13" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5 4.5h3M5 7h3M5 9.5h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M11 4h1.5c.55 0 1 .45 1 1v8.5c0 .55-.45 1-1 1H12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}
