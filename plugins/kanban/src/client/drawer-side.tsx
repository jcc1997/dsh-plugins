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
  const [refKind, setRefKind] = useState('github-repo')
  const [refExt, setRefExt] = useState('')
  const [refDisplay, setRefDisplay] = useState('')
  const [refUrl, setRefUrl] = useState('')
  const [addingRef, setAddingRef] = useState(false)

  const refs: any[] = props.card.refs || []
  const activity = props.card.activity || []
  const currentCol = props.columns.find((c) => c.cards.some((k) => k.id === props.card.id))

  function submitRef() {
    if (!refExt.trim()) return
    props.onAddRef({
      kind: refKind,
      externalId: refExt.trim(),
      display: refDisplay.trim() || undefined,
      url: refUrl.trim() || undefined,
    })
    setRefExt('')
    setRefDisplay('')
    setRefUrl('')
    setAddingRef(false)
  }

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

      {/* Git 关联卡片：repo + MR 列表 + 状态徽标 + 同步时间 + 同步按钮（git 插件槽位注入） */}
      <GitCard card={props.card} onRemoveRef={props.onRemoveRef} actionHost={props.actionHost ? () => props.actionHost!() : null} />

      {/* 关联卡片（按类型管理）：git 分支/本地仓库/会话 + 新增折叠表单 + 删除 */}
      <section className="kbnb-card kbnb-refs-card">
        <header className="kbnb-card-sec-head">
          <span className="kbnb-card-sec-title">{refsTitle(refs)}</span>
          <button className="kbnb-btn kbnb-ref-add-btn" type="button" onClick={() => setAddingRef(!addingRef)}>
            {addingRef ? '收起' : '+ 新增'}
          </button>
        </header>

        {refs.length === 0 ? <div className="kbnb-refs-empty">暂无关联</div> : null}
        {refs.map((r) => (
          <div key={r.id} className="kbnb-ref-row">
            <span className="kbnb-ref-kind">{r.kind}</span>
            {r.kind === 'session' ? (
              <button
                className="kbnb-ref-link kbnb-ref-session"
                type="button"
                title={'打开会话 ' + r.externalId}
                onClick={() => props.onOpenSession(String(r.externalId))}
              >
                {r.display || r.externalId}
              </button>
            ) : r.url ? (
              <a className="kbnb-ref-link" href={r.url} target="_blank" rel="noreferrer">
                {r.display || r.externalId}
              </a>
            ) : (
              <span className="kbnb-ref-text">{r.display || r.externalId}</span>
            )}
            <span className="kbnb-ref-x" title="移除关联" onClick={() => props.onRemoveRef(r.id)}>
              ×
            </span>
          </div>
        ))}

        {addingRef ? (
          <div className="kbnb-ref-add">
            <select className="kbnb-input kbnb-ref-kind-select" value={refKind} onChange={(evt) => setRefKind(evt.target.value)}>
              {REF_KINDS.map((k) => (
                <option key={k.kind} value={k.kind}>
                  {k.label}
                </option>
              ))}
            </select>
            <input
              className="kbnb-input kbnb-ref-ext"
              value={refExt}
              onChange={(evt) => setRefExt(evt.target.value)}
              placeholder={refKind === 'session' ? '会话 id（打开会话后可从会话页复制）' : 'external id（owner/repo、MR 号、路径…）'}
            />
            <input
              className="kbnb-input kbnb-ref-display"
              value={refDisplay}
              onChange={(evt) => setRefDisplay(evt.target.value)}
              placeholder={refKind === 'session' ? '展示文本（会话标题，可选）' : '展示文本（可选）'}
            />
            {refKind !== 'session' ? (
              <input
                className="kbnb-input kbnb-ref-url"
                value={refUrl}
                onChange={(evt) => setRefUrl(evt.target.value)}
                placeholder="链接（可选）"
              />
            ) : null}
            <button className="kbnb-btn kbnb-primary" type="button" disabled={!refExt.trim()} onClick={submitRef}>
              添加
            </button>
          </div>
        ) : null}
      </section>

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

/** Git 关联卡片：repo + MR 列表 + 状态徽标 + 同步时间 + 同步按钮（git 插件槽位注入） */
function GitCard(props: {
  card: KanbanCard
  onRemoveRef: (refId: string) => void
  actionHost?: (() => React.ReactNode) | null
}) {
  const refs: any[] = (props.card as any).refs || []
  const meta: any = (props.card as any).meta || {}
  const syncEnv = meta.sync && meta.sync.github ? meta.sync.github : null
  const repoRef = refs.find((r) => r.kind === 'github-repo')
  const mrRefs = refs.filter((r) => r.kind === 'github-mr')
  // MR 列表优先用同步快照（含 title/state/url/updatedAt），fallback 到 refs
  const snapshotMrs: any[] = syncEnv && syncEnv.snapshot && Array.isArray(syncEnv.snapshot.mrs) ? syncEnv.snapshot.mrs : []
  const hasAny = repoRef || mrRefs.length > 0 || snapshotMrs.length > 0 || syncEnv
  if (!hasAny) {
    return (
      <section className="kbnb-card kbnb-git-card">
        <header className="kbnb-card-sec-head">
          <span className="kbnb-card-sec-title">Git 关联</span>
          {props.actionHost ? <span className="kbnb-card-actions">{props.actionHost()}</span> : null}
        </header>
        <div className="kbnb-git-empty">暂无 Git 关联：可关联 github-repo 后同步 MR 状态（agent 工具 git_link / git_sync）</div>
      </section>
    )
  }
  return (
    <section className="kbnb-card kbnb-git-card">
      <header className="kbnb-card-sec-head">
        <span className="kbnb-card-sec-title">Git 关联</span>
        {props.actionHost ? <span className="kbnb-card-actions">{props.actionHost()}</span> : null}
      </header>

      {/* 仓库 */}
      {repoRef ? (
        <div className="kbnb-git-repo">
          <span className="kbnb-git-repo-label">仓库</span>
          {repoRef.url ? (
            <a className="kbnb-git-repo-name" href={repoRef.url} target="_blank" rel="noreferrer">
              {repoRef.externalId}
            </a>
          ) : (
            <span className="kbnb-git-repo-name">{repoRef.externalId}</span>
          )}
          <span className="kbnb-ref-x" title="移除仓库关联" onClick={() => props.onRemoveRef(repoRef.id)}>
            ×
          </span>
        </div>
      ) : (
        <div className="kbnb-git-repo">
          <span className="kbnb-git-repo-label">仓库</span>
          <span className="kbnb-git-repo-missing">未关联（agent: git_link github-repo）</span>
        </div>
      )}

      {/* MR 列表：同步快照优先 */}
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
                  <a className="kbnb-git-mr-title" href={m.url} target="_blank" rel="noreferrer">
                    {m.title}
                  </a>
                ) : (
                  <span className="kbnb-git-mr-title">{m.title}</span>
                )}
                {m.updatedAt ? <span className="kbnb-git-mr-updated">{fmtTime(m.updatedAt)}</span> : null}
                {linkedRef ? (
                  <span className="kbnb-ref-x" title="移除 MR 关联" onClick={() => props.onRemoveRef(linkedRef.id)}>
                    ×
                  </span>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="kbnb-git-empty">尚未同步 MR（点右上「同步」或 agent 工具 git_sync）</div>
      )}

      {/* 同步状态 */}
      <div className="kbnb-git-status">
        {syncEnv && syncEnv.lastSyncAt ? (
          <span className="kbnb-mr-synced">同步于 {fmtTime(syncEnv.lastSyncAt)}</span>
        ) : (
          <span className="kbnb-git-status-muted">未同步过</span>
        )}
        {syncEnv && syncEnv.error ? <span className="kbnb-mr-error">上次同步失败：{syncEnv.error}</span> : null}
        {syncEnv && syncEnv.snapshot && syncEnv.snapshot.repo && syncEnv.snapshot.repo.branch ? (
          <span className="kbnb-git-status-branch">分支 {syncEnv.snapshot.repo.branch}</span>
        ) : null}
      </div>
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
      {gates.map((g) => (
        <div key={g.id} className="kbnb-gate-row">
          <span className="kbnb-gate-name" title={g.name}>{g.name}</span>
          <span className="kbnb-gate-meta">{GATE_ON_LABEL[g.on]} · {GATE_KIND_LABEL[g.checker ? g.checker.type : (g as any).kind]}</span>
          <span className="kbnb-gate-summary" title={gateSummary(g)}>{gateSummary(g)}</span>
          <span className="kbnb-ref-x" title="移除门禁" onClick={() => props.onRemoveGate(g.id)}>×</span>
        </div>
      ))}
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

/** 关联卡片标题：全 session → 「session 关联」；全 git 系（github 前缀/local-repo）→ 「Git 关联」；混合/空 → 「关联」（不显示数量） */
function refsTitle(refs: { kind: string }[]): string {
  if (refs.length === 0) return '关联'
  const kinds = refs.map((r) => r.kind)
  const allSession = kinds.every((k) => k === 'session')
  const allGit = kinds.every((k) => k.startsWith('github-') || k === 'local-repo')
  if (allSession) return 'session 关联'
  if (allGit) return 'Git 关联'
  return '关联'
}
