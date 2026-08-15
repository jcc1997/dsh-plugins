// client/drawer-side.tsx — 抽屉右侧栏：状态切换 + 归档/删除 + 标签 + Git 关联卡片 + 外部关联 + 门禁 + 变更记录
import React, { useState } from 'react'
import { fmtTime, safeId } from '@dsh-plugins/ui'
import { KanbanCard, KanbanColumn, CardGate } from '@dsh-plugins/ui'

/** 关联类型定义（新增/展示按类型；git 关联 + 会话关联） */
export const REF_KINDS: { kind: string; label: string }[] = [
  { kind: 'github-repo', label: 'GitHub 仓库' },
  { kind: 'github-branch', label: 'GitHub 分支' },
  { kind: 'github-mr', label: 'GitHub MR' },
  { kind: 'local-repo', label: '本地仓库' },
  { kind: 'session', label: '会话' },
]

export function DrawerSide(props: {
  card: KanbanCard
  columns: KanbanColumn[]
  onMoveStatus: (targetColId: string) => void
  onDelete: () => void
  onArchive?: () => void
  onUpdateTags: (add: string[], remove: string[]) => void
  onAddRef: (ref: { kind: string; externalId: string; url?: string; display?: string }) => void
  onRemoveRef: (refId: string) => void
  onOpenSession: (sessionId: string) => void
  onAddGate?: (gate: CardGate) => void
  onRemoveGate?: (gateId: string) => void
  actionHost?: (() => React.ReactNode) | null
}) {
  const activity = props.card.activity || []
  const currentCol = props.columns.find((c) => c.cards.some((k) => k.id === props.card.id))

  return (
    <div className="kbnb-drawer-side">
      {/* 工具/状态栏：状态切换 + 归档 + 删除 */}
      <div className="kbnb-toolbar">
        <label className="kbnb-status">
          <span className="kbnb-status-label">状态</span>
          <select
            className="kbnb-status-select"
            value={currentCol ? currentCol.id : ''}
            onChange={(evt) => {
              const target = evt.target.value
              if (target && currentCol && target !== currentCol.id) props.onMoveStatus(target)
            }}
          >
            {props.columns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
        <span className="kbnb-spacer" />
        {typeof props.onArchive === 'function' ? (
          <button className="kbnb-btn" type="button" title="移出看板，可在侧边栏归档中找回" onClick={props.onArchive}>
            归档
          </button>
        ) : null}
        <button className="kbnb-btn kbnb-danger" type="button" onClick={props.onDelete}>
          删除
        </button>
      </div>

      {/* 标签（chips，可点 × 移除；输入框回车添加） */}
      <div className="kbnb-tag-row">
        <span className="kbnb-field-label">标签</span>
        {(props.card.tags || []).map((tg) => (
          <span key={tg} className="kbnb-tag kbnb-tag-removable" title={'移除标签 ' + tg} onClick={() => props.onUpdateTags([], [tg])}>
            {tg}
            <span className="kbnb-tag-x">×</span>
          </span>
        ))}
        <TagInput onAdd={(t) => props.onUpdateTags([t], [])} />
      </div>

      {/* Git 关联卡片：repo/分支/MR + 同步状态 + 新增 git 关联（git 插件槽位注入同步按钮） */}
      <GitCard card={props.card} onAddRef={props.onAddRef} onRemoveRef={props.onRemoveRef} actionHost={props.actionHost ? () => props.actionHost!() : null} />

      {/* 会话关联：列表 + 新增（仅此两种关联入口：git / 会话） */}
      <SessionCard card={props.card} onAddRef={props.onAddRef} onRemoveRef={props.onRemoveRef} onOpenSession={props.onOpenSession} />

      {/* 门禁（v4）：挂在此卡上的行为门禁，动作触发时检查；可增删 */}
      {typeof props.onAddGate === 'function' ? (
        <GateCard card={props.card} onAddGate={props.onAddGate} onRemoveGate={props.onRemoveGate || (() => {})} />
      ) : null}

      {/* 变更记录：时间 + 操作者徽章 + 内容 */}
      <section className="kbnb-section">
        <div className="kbnb-section-title">变更记录 {activity.length}</div>
        {activity.length === 0 ? <div className="kbnb-section-empty">暂无记录</div> : null}
        {activity.map((a) => (
          <div key={a.id} className="kbnb-activity">
            <span className="kbnb-activity-time">{fmtTime(a.at)}</span>
            {a.actor ? <span className="kbnb-activity-actor">{a.actor}</span> : null}
            <span className="kbnb-activity-text">{a.text}</span>
          </div>
        ))}
      </section>
    </div>
  )
}

/** Git 关联卡片：repo + 分支 + MR 列表 + 同步状态 + 新增 git 关联（新增只有 git / 会话两种入口） */
function GitCard(props: {
  card: KanbanCard
  onAddRef: (ref: { kind: string; externalId: string; url?: string; display?: string }) => void
  onRemoveRef: (refId: string) => void
  actionHost?: (() => React.ReactNode) | null
}) {
  const refs: any[] = (props.card as any).refs || []
  const meta: any = (props.card as any).meta || {}
  const syncEnv = meta.sync && meta.sync.github ? meta.sync.github : null
  const repoRef = refs.find((r) => r.kind === 'github-repo')
  const branchRefs = refs.filter((r) => r.kind === 'github-branch')
  const mrRefs = refs.filter((r) => r.kind === 'github-mr')
  const snapshotMrs: any[] = syncEnv && syncEnv.snapshot && Array.isArray(syncEnv.snapshot.mrs) ? syncEnv.snapshot.mrs : []
  // 新增 git 关联表单
  const [adding, setAdding] = useState(false)
  const [repoText, setRepoText] = useState('')
  const [branchText, setBranchText] = useState('')
  const [mrText, setMrText] = useState('')

  function submit() {
    if (repoText.trim() && !repoRef) props.onAddRef({ kind: 'github-repo', externalId: repoText.trim(), url: 'https://github.com/' + repoText.trim() })
    if (branchText.trim()) props.onAddRef({ kind: 'github-branch', externalId: branchText.trim(), display: branchText.trim() })
    for (const n of mrText.split(/[,，\s]+/)) {
      if (n.trim()) props.onAddRef({ kind: 'github-mr', externalId: n.trim().replace('#', '') })
    }
    setRepoText(''); setBranchText(''); setMrText(''); setAdding(false)
  }

  const hasAny = repoRef || branchRefs.length > 0 || mrRefs.length > 0 || snapshotMrs.length > 0 || syncEnv
  return (
    <section className="kbnb-card kbnb-git-card">
      <header className="kbnb-card-sec-head">
        <span className="kbnb-card-sec-title">Git 关联</span>
        <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {props.actionHost ? <span className="kbnb-card-actions">{props.actionHost()}</span> : null}
          <button className="kbnb-btn kbnb-ref-add-btn" type="button" onClick={() => setAdding(!adding)}>
            {adding ? '收起' : '+ 新增 git 关联'}
          </button>
        </span>
      </header>

      {adding ? (
        <div className="kbnb-ref-add">
          <input className="kbnb-input" value={repoText} onChange={(e) => setRepoText(e.target.value)} placeholder="仓库 owner/repo（如 jcc1997/dsh-plugins）" />
          <input className="kbnb-input" value={branchText} onChange={(e) => setBranchText(e.target.value)} placeholder="分支名（可选，如 workflow/demo-1）" />
          <input className="kbnb-input" value={mrText} onChange={(e) => setMrText(e.target.value)} placeholder="MR 号（可选，多个逗号分隔）" />
          <button className="kbnb-btn kbnb-primary" type="button" disabled={!repoText.trim()} onClick={submit}>添加</button>
        </div>
      ) : null}

      {!hasAny && !adding ? <div className="kbnb-git-empty">暂无 Git 关联：点「+ 新增 git 关联」或 agent 工具 git_link</div> : null}

      {repoRef ? (
        <div className="kbnb-git-repo">
          <span className="kbnb-git-repo-label">仓库</span>
          {repoRef.url ? (
            <a className="kbnb-git-repo-name" href={repoRef.url} target="_blank" rel="noreferrer">{repoRef.externalId}</a>
          ) : (
            <span className="kbnb-git-repo-name">{repoRef.externalId}</span>
          )}
          <span className="kbnb-ref-x" title="移除仓库关联" onClick={() => props.onRemoveRef(repoRef.id)}>×</span>
        </div>
      ) : null}

      {branchRefs.map((b) => (
        <div key={b.id} className="kbnb-git-repo">
          <span className="kbnb-git-repo-label">分支</span>
          <span className="kbnb-git-repo-name">{b.externalId}</span>
          <span className="kbnb-ref-x" title="移除分支关联" onClick={() => props.onRemoveRef(b.id)}>×</span>
        </div>
      ))}

      {snapshotMrs.length > 0 ? (
        <div className="kbnb-git-mrs">
          <div className="kbnb-git-mrs-label">MR {snapshotMrs.length}</div>
          {snapshotMrs.map((m, i) => {
            const state = m.state || 'open'
            const linkedRef = mrRefs.find((r) => r.externalId === String(m.number))
            return (
              <div key={i} className="kbnb-git-mr">
                <span className={'kbnb-mr-badge kbnb-mr-' + state}>
                  <span className="kbnb-mr-number">#{m.number}</span>
                  <span className="kbnb-mr-state">{state}</span>
                </span>
                {m.url ? (
                  <a className="kbnb-git-mr-title" href={m.url} target="_blank" rel="noreferrer">{m.title}</a>
                ) : (
                  <span className="kbnb-git-mr-title">{m.title}</span>
                )}
                {m.updatedAt ? <span className="kbnb-git-mr-updated">{fmtTime(m.updatedAt)}</span> : null}
                {linkedRef ? (
                  <span className="kbnb-ref-x" title="移除 MR 关联" onClick={() => props.onRemoveRef(linkedRef.id)}>×</span>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : (hasAny ? <div className="kbnb-git-empty">尚未同步 MR（点右上「同步」或 agent 工具 git_sync）</div> : null)}

      <div className="kbnb-git-status">
        {syncEnv && syncEnv.lastSyncAt ? (
          <span className="kbnb-mr-synced">同步于 {fmtTime(syncEnv.lastSyncAt)}</span>
        ) : null}
        {syncEnv && syncEnv.error ? <span className="kbnb-mr-error">上次同步失败：{syncEnv.error}</span> : null}
        {syncEnv && syncEnv.snapshot && syncEnv.snapshot.repo && syncEnv.snapshot.repo.branch ? (
          <span className="kbnb-git-status-branch">分支 {syncEnv.snapshot.repo.branch}</span>
        ) : null}
      </div>
    </section>
  )
}

/** 会话关联卡片：列表 + 新增会话 */
function SessionCard(props: {
  card: KanbanCard
  onAddRef: (ref: { kind: string; externalId: string; url?: string; display?: string }) => void
  onRemoveRef: (refId: string) => void
  onOpenSession: (sessionId: string) => void
}) {
  const sessions = ((props.card.refs || []) as any[]).filter((r) => r.kind === 'session')
  const [adding, setAdding] = useState(false)
  const [sid, setSid] = useState('')
  const [disp, setDisp] = useState('')
  function submit() {
    if (!sid.trim()) return
    props.onAddRef({ kind: 'session', externalId: sid.trim(), display: disp.trim() || undefined })
    setSid(''); setDisp(''); setAdding(false)
  }
  return (
    <section className="kbnb-card kbnb-refs-card">
      <header className="kbnb-card-sec-head">
        <span className="kbnb-card-sec-title">会话关联 {sessions.length}</span>
        <button className="kbnb-btn kbnb-ref-add-btn" type="button" onClick={() => setAdding(!adding)}>
          {adding ? '收起' : '+ 新增会话关联'}
        </button>
      </header>
      {sessions.length === 0 && !adding ? <div className="kbnb-refs-empty">暂无会话关联</div> : null}
      {sessions.map((r) => (
        <div key={r.id} className="kbnb-ref-row">
          <button className="kbnb-ref-link kbnb-ref-session" type="button" title={'打开会话 ' + r.externalId} onClick={() => props.onOpenSession(String(r.externalId))}>
            {r.display || r.externalId}
          </button>
          <span className="kbnb-ref-x" title="移除会话关联" onClick={() => props.onRemoveRef(r.id)}>×</span>
        </div>
      ))}
      {adding ? (
        <div className="kbnb-ref-add">
          <input className="kbnb-input" value={sid} onChange={(e) => setSid(e.target.value)} placeholder="会话 id（打开会话后可从会话页复制）" />
          <input className="kbnb-input" value={disp} onChange={(e) => setDisp(e.target.value)} placeholder="展示文本（会话标题，可选）" />
          <button className="kbnb-btn kbnb-primary" type="button" disabled={!sid.trim()} onClick={submit}>添加</button>
        </div>
      ) : null}
    </section>
  )
}

/** 标签添加输入：回车/失焦确认 */
function TagInput(props: { onAdd: (tag: string) => void }) {
  const [v, setV] = useState('')
  function commit() {
    const t = v.trim()
    if (t) props.onAdd(t)
    setV('')
  }
  return (
    <input
      className="kbnb-input kbnb-tag-input"
      value={v}
      onChange={(evt) => setV(evt.target.value)}
      placeholder="+ 添加标签"
      onKeyDown={(evt) => {
        if (evt.key === 'Enter') commit()
      }}
      onBlur={commit}
    />
  )
}

/* ── 门禁卡片（v4）：列表 + 添加折叠表单 ── */
const GATE_KINDS: { kind: string; label: string }[] = [
  { kind: 'mr-merged', label: 'MR 已合并' },
  { kind: 'mr-linked', label: '已关联 MR' },
  { kind: 'tag-required', label: '必须含标签' },
  { kind: 'field-nonempty', label: '字段非空' },
  { kind: 'code', label: '代码检查' },
  { kind: 'pipeline', label: 'pipeline 检查' },
]
const GATE_ONS: { on: string; label: string }[] = [
  { on: 'move', label: '移动状态' },
  { on: 'tags', label: '增减标签' },
  { on: 'archive', label: '归档' },
]
const GATE_ON_LABEL: Record<string, string> = { move: '移动状态', tags: '增减标签', archive: '归档' }
const GATE_KIND_LABEL: Record<string, string> = { 'mr-merged': 'MR 已合并', 'mr-linked': '已关联 MR', 'tag-required': '必须含标签', 'field-nonempty': '字段非空', 'code': '代码检查', 'pipeline': 'pipeline 检查' }

function gateSummary(g: CardGate): string {
  const t = g.checker ? g.checker.type : (g as any).kind
  const cfg = g.checker ? g.checker.config : (g as any).config
  if (t === 'tag-required') return '需含标签：' + String((cfg && (cfg as any).tags || [])).replace(/,/g, ', ')
  if (t === 'field-nonempty') return '字段「' + String((cfg && (cfg as any).field) || 'description') + '」非空'
  if (t === 'mr-linked') return '必须已关联仓库与 MR'
  if (t === 'mr-merged') return '关联 MR 必须已合并'
  if (t === 'code') return '执行代码' + ((cfg && (cfg as any).script) ? '（' + (cfg as any).script + '）' : '（内联 JS）')
  if (t === 'pipeline') return '跑 pipeline：' + String((cfg && (cfg as any).pipelines || (cfg as any).pipelineId || ''))
  return String(t)
}

function GateCard(props: {
  card: KanbanCard
  onAddGate: (gate: CardGate) => void
  onRemoveGate: (gateId: string) => void
}) {
  const [adding, setAdding] = useState(false)
  const [kind, setKind] = useState('mr-merged')
  const [on, setOn] = useState('archive')
  const [name, setName] = useState('')
  const [cfgText, setCfgText] = useState('')
  const [openGateId, setOpenGateId] = useState<string | null>(null)
  const gates: CardGate[] = (props.card.gates || []) as CardGate[]

  function submit() {
    let config: Record<string, unknown> | undefined
    if (cfgText.trim()) {
      try { config = JSON.parse(cfgText) } catch { config = undefined }
    } else {
      if (kind === 'tag-required') config = { tags: [] }
      if (kind === 'field-nonempty') config = { field: 'description' }
      if (kind === 'pipeline') config = { pipelines: [] }
      if (kind === 'code') config = { code: "const c = await gate.card({});\nreturn { ok: true, reason: '示例' }" }
    }
    props.onAddGate({
      id: safeId('g'),
      name: name.trim() || (GATE_KIND_LABEL[kind] + '（' + GATE_ON_LABEL[on] + '）'),
      on: on as CardGate['on'],
      checker: { type: kind as any, config: config || {} },
    })
    setName('')
    setCfgText('')
    setAdding(false)
  }

  return (
    <section className="kbnb-card kbnb-gates-card">
      <header className="kbnb-card-sec-head">
        <span className="kbnb-card-sec-title">门禁 {gates.length}</span>
        <button className="kbnb-btn kbnb-ref-add-btn" type="button" onClick={() => setAdding(!adding)}>
          {adding ? '收起' : '+ 新增'}
        </button>
      </header>
      {gates.length === 0 ? <div className="kbnb-refs-empty">暂无门禁：动作不受限制</div> : null}
      {gates.map((g) => {
        const expanded = openGateId === g.id
        return (
          <div key={g.id}>
            <div className="kbnb-gate-row kbnb-gate-row-click" onClick={() => setOpenGateId(expanded ? null : g.id)} title={expanded ? '收起' : '点击查看门禁详情'}>
              <span className="kbnb-gate-name" title={g.name}>{g.name}</span>
              <span className="kbnb-gate-meta">{GATE_ON_LABEL[g.on]} · {GATE_KIND_LABEL[g.checker ? g.checker.type : (g as any).kind]}</span>
              <span className="kbnb-gate-summary" title={gateSummary(g)}>{gateSummary(g)}</span>
              <span className="kbnb-ref-x" title="移除门禁" onClick={(e) => { e.stopPropagation(); props.onRemoveGate(g.id) }}>×</span>
            </div>
            {expanded ? (
              <div className="kbnb-gate-detail">
                <div className="kbnb-gate-detail-row"><span className="kbnb-gate-detail-k">触发</span><span>{GATE_ON_LABEL[g.on]}{g.to ? '（目标列：' + g.to + '）' : ''}</span></div>
                <div className="kbnb-gate-detail-row"><span className="kbnb-gate-detail-k">检查器</span><span>{g.checker ? g.checker.type : (g as any).kind}</span></div>
                <div className="kbnb-gate-detail-row"><span className="kbnb-gate-detail-k">配置</span><pre className="kbnb-gate-detail-pre">{JSON.stringify(g.checker ? g.checker.config : (g as any).config, null, 2)}</pre></div>
              </div>
            ) : null}
          </div>
        )
      })}
      {adding ? (
        <div className="kbnb-gate-add">
          <select className="kbnb-input" value={kind} onChange={(e) => setKind(e.target.value)}>
            {GATE_KINDS.map((k) => <option key={k.kind} value={k.kind}>{k.label}</option>)}
          </select>
          <select className="kbnb-input" value={on} onChange={(e) => setOn(e.target.value)}>
            {GATE_ONS.map((o) => <option key={o.on} value={o.on}>{o.label}</option>)}
          </select>
          <input className="kbnb-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="门禁名（可选）" />
          <input
            className="kbnb-input"
            value={cfgText}
            onChange={(e) => setCfgText(e.target.value)}
            placeholder={
              kind === 'tag-required' ? '配置 JSON：{"tags":["done"]}'
              : kind === 'field-nonempty' ? '配置 JSON：{"field":"description"}'
              : kind === 'mr-merged' ? '无需配置（读取 github-repo + github-mr 关联）'
              : '配置 JSON（可选）'
            }
          />
          <button className="kbnb-btn kbnb-primary" type="button" onClick={submit}>添加门禁</button>
        </div>
      ) : null}
    </section>
  )
}


