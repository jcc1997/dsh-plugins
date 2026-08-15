// client/editor.tsx — 流水线编辑器（独立页面视图）：左 NodeGraph 图 + 右面板（节点编辑/版本列表）
// 交互：点节点选中 → 右侧编辑（标题/依赖/配置 JSON）；边中点 + 与面板按钮新增；卡片 × 删除；↑↓ 调整顺序。
import React, { useState, useEffect, useCallback } from 'react'
import type { HostLike } from './page'
import { NodeGraph, NODE_LABEL, NODE_DEFAULT_CONFIG, NODE_TYPES, TYPE_DESC } from './graph'
import type { GraphNode } from './graph'
import { IconChevronUpOutline14, IconChevronDownOutline14, IconChevronRightOutline14 } from '@dsh-plugins/ui'

export interface EditorPipeline {
  id: string; name: string; description: string; kind: string; tags: string[]
  latestVersion: string; publishedVersion: string | null
  versions: Array<{
    version: string; published: boolean; publishedAt?: string; changelog?: string; createdAt: string
    nodes: GraphNode[]
    inputSchema?: any
  }>
  createdAt: string; updatedAt: string
}

/** 配置 JSON 示例提示（按类型） */
const CONFIG_HINT: Record<string, string> = {
  input: '{\n  "keys": ["text"]\n}   // 从入参抽取的字段；空 = 透传全部',
  output: '{\n  "pick": ["output"]\n}   // 只输出这些字段；空 = 合并全部上游',
  exec: '{\n  "command": "echo {input.text}",\n  "workdir": "/tmp",\n  "timeoutMs": 60000\n}   // {input.x} / {up.<nodeId>.<f>} 占位符',
  fetch: '{\n  "url": "https://api.example.com/x",\n  "method": "GET",\n  "headers": {},\n  "body": {} }',
  transform: '{\n  "mappings": { "a": "input.text" },\n  "template": "{{up.in.text}}-done"\n}',
  llm: '{\n  "prompt": "请总结：{{up.in.output}}"\n}   // 沙箱子 agent 延后实现，当前占位',
  pipeline: '{\n  "ref": "<pipelineId>@<version>",\n  "inputs": { "text": "input.text" }\n}   // @latest = 已发布最新',
}

export function EditorView(props: { host: HostLike; pipelineId: string; onBack: () => void; onChanged: () => void }) {
  const [p, setP] = useState<EditorPipeline | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [kind, setKind] = useState<'atomic' | 'combined'>('atomic')
  const [tags, setTags] = useState('')
  const [nodes, setNodes] = useState<GraphNode[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [showBasic, setShowBasic] = useState(true)
  const [publishRelease, setPublishRelease] = useState<'major' | 'minor' | 'patch'>('patch')
  const [changelog, setChangelog] = useState('')
  const [showPublish, setShowPublish] = useState(false)
  const [runInputs, setRunInputs] = useState('{}')
  const [showRun, setShowRun] = useState(false)
  const [runResult, setRunResult] = useState<any>(null)
  // 边中点插入的类型选择（from→to）
  const [edgeInsert, setEdgeInsert] = useState<{ from: string; to: string } | null>(null)
  // 右侧浮窗开关（编辑画布全幅时浮于其上）
  const [sideOpen, setSideOpen] = useState(true)
  // 版本查看：null = 最新草稿（可编辑）；非 null = 查看该版本（只读）
  const [viewVersion, setViewVersion] = useState<string | null>(null)
  // 删除版本确认
  const [confirmDelVer, setConfirmDelVer] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const r = await props.host.call('get', { pipeline_id: props.pipelineId })
      if (!r.ok) { setError(r.error || 'not found'); setLoading(false); return }
      const pl = r.pipeline as EditorPipeline
      setP(pl)
      setName(pl.name)
      setDescription(pl.description)
      setKind(pl.kind === 'combined' ? 'combined' : 'atomic')
      setTags((pl.tags || []).join(', '))
      const latest = pl.versions.find((v) => v.version === pl.latestVersion)
      setNodes(latest ? JSON.parse(JSON.stringify(latest.nodes)) : [])
      setViewVersion(null)
      setConfirmDelVer(null)
      setSelectedId('')
      setLoading(false)
    } catch (e) {
      setError(String(e && (e as Error).message ? (e as Error).message : e))
      setLoading(false)
    }
  }, [props.host, props.pipelineId])

  useEffect(() => { load() }, [load])

  async function save() {
    if (!p) return
    setBusy(true)
    try {
      const r = await props.host.call('update', {
        pipeline_id: p.id, name, description, tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        nodes,
      })
      if (r.ok) { await load(); props.onChanged() } else setError(r.error || '保存失败')
    } catch (e) {
      setError(String(e && (e as Error).message ? (e as Error).message : e))
    } finally { setBusy(false) }
  }

  async function deleteVersion() {
    if (!p || !confirmDelVer) return
    setBusy(true)
    try {
      const r = await props.host.call('delete-version', { pipeline_id: p.id, version: confirmDelVer })
      if (r.ok) { setConfirmDelVer(null); await load(); props.onChanged() } else setError(r.error || '删除版本失败')
    } catch (e) {
      setError(String(e && (e as Error).message ? (e as Error).message : e))
    } finally { setBusy(false) }
  }

  async function publish() {
    if (!p) return
    setBusy(true)
    try {
      const r = await props.host.call('publish', { pipeline_id: p.id, release: publishRelease, changelog })
      if (r.ok) { setShowPublish(false); setChangelog(''); await load(); props.onChanged() } else setError(r.error || '发布失败')
    } catch (e) {
      setError(String(e && (e as Error).message ? (e as Error).message : e))
    } finally { setBusy(false) }
  }

  async function run() {
    if (!p) return
    setBusy(true)
    setRunResult(null)
    try {
      let inputs: any = {}
      try { inputs = JSON.parse(runInputs || '{}') } catch { setError('入参不是合法 JSON'); setBusy(false); return }
      const r = await props.host.call('run', { pipeline_id: p.id, version: p.publishedVersion || p.latestVersion, inputs })
      if (r.ok) { setRunResult({ run_id: r.run_id, status: r.status }); props.onChanged() } else setError(r.error || '运行失败')
    } catch (e) {
      setError(String(e && (e as Error).message ? (e as Error).message : e))
    } finally { setBusy(false) }
  }

  /* ── 节点操作（本地 state，保存时统一提交） ── */
  function patchNode(nodeId: string, patch: Partial<GraphNode>) {
    setNodes((ns) => ns.map((n) => (n.id === nodeId ? { ...n, ...patch } : n)))
  }
  function normalizeOrder(arr: GraphNode[]): GraphNode[] {
    return arr.map((n, i) => ({ ...n, order: i * 10 }))
  }
  /** 在 afterId 之后插入新节点 */
  function insertNode(afterId: string | null, type: string) {
    setNodes((ns) => {
      const sorted = [...ns].sort((a, b) => a.order - b.order)
      const afterIdx = afterId ? sorted.findIndex((n) => n.id === afterId) : -1
      const node: GraphNode = {
        id: 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
        title: NODE_LABEL[type] || type,
        type,
        order: 0,
        inputs: afterIdx >= 0 ? [sorted[afterIdx].id] : [],
        config: JSON.parse(JSON.stringify(NODE_DEFAULT_CONFIG[type] || {})),
      }
      const arr = [...sorted]
      arr.splice(afterIdx + 1, 0, node)
      const normalized = normalizeOrder(arr)
      setSelectedId(node.id)
      return normalized
    })
  }
  /** 在 from→to 边之间插入：新节点依赖 from，to 的依赖 from 替换为新节点 */
  function insertBetween(from: string, to: string, type: string) {
    setNodes((ns) => {
      const sorted = [...ns].sort((a, b) => a.order - b.order)
      const fromIdx = sorted.findIndex((n) => n.id === from)
      const node: GraphNode = {
        id: 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
        title: NODE_LABEL[type] || type,
        type,
        order: 0,
        inputs: [from],
        config: JSON.parse(JSON.stringify(NODE_DEFAULT_CONFIG[type] || {})),
      }
      const arr = [...sorted]
      arr.splice(fromIdx + 1, 0, node)
      // to 的依赖里 from → node（串联进链）
      const normalized = normalizeOrder(arr).map((n) => (n.id === to ? { ...n, inputs: (n.inputs || []).map((d) => (d === from ? node.id : d)) } : n))
      setSelectedId(node.id)
      return normalized
    })
  }
  function deleteNode(nodeId: string) {
    setNodes((ns) => {
      const arr = normalizeOrder(ns.filter((n) => n.id !== nodeId))
      if (selectedId === nodeId) setSelectedId('')
      return arr
    })
  }
  function moveNode(nodeId: string, dir: -1 | 1) {
    setNodes((ns) => {
      const sorted = [...ns].sort((a, b) => a.order - b.order)
      const i = sorted.findIndex((n) => n.id === nodeId)
      const j = i + dir
      if (i < 0 || j < 0 || j >= sorted.length) return ns
      const t = sorted[i]; sorted[i] = sorted[j]; sorted[j] = t
      return normalizeOrder(sorted)
    })
  }

  if (loading) return <div className="plp-loading">加载中…</div>
  if (!p) return <div className="plp-loading">{error || '流水线不存在'}</div>

  const sel = selectedId ? nodes.find((n) => n.id === selectedId) || null : null
  const viewVer = viewVersion ? (p.versions.find((v) => v.version === viewVersion) || null) : null
  const graphNodes = viewVer ? JSON.parse(JSON.stringify(viewVer.nodes)) : nodes
  const sortedNodes = [...graphNodes].sort((a, b) => a.order - b.order)
  const readonlyView = viewVer !== null

  return (
    <div className="plp-editor">
      {/* ── 顶栏 ── */}
      <header className="plp-header plp-editor-head">
        <button className="plp-icon-btn" type="button" title="返回列表" onClick={props.onBack}>
          <svg width={16} height={16} viewBox="0 0 14 14" fill="none"><path d="M8.5 2.15L8.08 2.58 5.35 5.3c-.26.26-.43.48-.51.69-.09.22-.09.4 0 .62.08.21.25.43.51.69l2.73 2.72.42.43-.85.85-.42-.43-2.73-2.72c-.28-.28-.53-.56-.7-.84-.16-.27-.24-.56-.24-.88s.08-.61.24-.88c.17-.28.42-.56.7-.84l2.73-2.72.42-.43.85.85z" fill="currentColor"/></svg>
        </button>
        <span className="plp-title">{name}</span>
        <span className={'plp-badge' + (p.kind === 'combined' ? ' plp-badge-kind' : '')}>{p.kind}</span>
        <span className="plp-version">最新 {p.latestVersion}</span>
        {p.publishedVersion ? <span className="plp-version">已发布 {p.publishedVersion}</span> : <span className="plp-badge">未发布</span>}
        <div className="plp-header-actions">
          <button className="plp-btn" type="button" onClick={() => setSideOpen(!sideOpen)} title="显示/隐藏右侧浮窗">{sideOpen ? '收起面板' : '打开面板'}</button>
          <button className="plp-btn" type="button" onClick={() => setShowRun(true)} disabled={busy}>运行调试</button>
          <button className="plp-btn" type="button" onClick={() => setShowPublish(true)} disabled={busy}>发布新版本</button>
          <button className="plp-btn plp-primary" type="button" onClick={save} disabled={busy}>{busy ? '保存中…' : '保存'}</button>
        </div>
      </header>
      {error ? <div className="plp-error">{error}</div> : null}

      {/* ── 基本信息（可折叠） ── */}
      <div className="plp-editor-basic">
        <button type="button" className="plp-basic-toggle" onClick={() => setShowBasic(!showBasic)}>
          <span>基本信息</span>
          {showBasic ? <IconChevronUpOutline14 /> : <IconChevronDownOutline14 />}
        </button>
        {showBasic ? (
          <div className="plp-basic-grid">
            <div className="plp-field" style={{ marginBottom: 0 }}>
              <label className="plp-field-label">名称</label>
              <input className="plp-input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="plp-field" style={{ marginBottom: 0 }}>
              <label className="plp-field-label">描述</label>
              <input className="plp-input" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="plp-field" style={{ marginBottom: 0 }}>
              <label className="plp-field-label">类型</label>
              <select className="plp-select" value={kind} onChange={(e) => setKind(e.target.value as any)}>
                <option value="atomic">atomic（基础单元）</option>
                <option value="combined">combined（组合流水线）</option>
              </select>
            </div>
            <div className="plp-field" style={{ marginBottom: 0 }}>
              <label className="plp-field-label">标签</label>
              <input className="plp-input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="逗号分隔" />
            </div>
          </div>
        ) : null}
      </div>

      {/* ── 主区：画布全幅（浮窗侧栏覆盖其上） ── */}
      <div className="plp-editor-body">
        <div className="plp-graph-scroll">
          {readonlyView ? (
            <div className="plp-ver-banner">
              <span>正在查看版本 <b>{viewVersion}</b>（{viewVer && viewVer.published ? '已发布' : '草稿'}，只读）</span>
              <button className="plp-btn" type="button" onClick={() => setViewVersion(null)}>回到最新草稿</button>
            </div>
          ) : null}
          <div className="plp-graph-inner">
            <NodeGraph
              nodes={graphNodes}
              readonly={readonlyView}
              selectedId={selectedId}
              onSelect={(id) => setSelectedId(id)}
              onAdd={(afterIndex, type) => { const a = sortedNodes[afterIndex] || null; insertNode(a ? a.id : null, type) }}
              onAddEdge={(from, to) => setEdgeInsert({ from, to })}
              onDelete={deleteNode}
              onMove={moveNode}
              onAddTail={(type) => { const last = sortedNodes[sortedNodes.length - 1] || null; insertNode(last ? last.id : null, type) }}
            />
          </div>
        </div>
        {sideOpen ? (
          <aside className="plp-editor-side">
            <div className="plp-side-head">
              <span className="plp-side-title">{sel ? '节点编辑' : '面板'}</span>
              <button className="plp-icon-btn" type="button" title="收起面板" aria-label="收起面板" onClick={() => setSideOpen(false)}>
                <IconChevronRightOutline14 />
              </button>
            </div>
            <div className="plp-side-body">
              {sel ? (
                <NodePanel
                  node={sel}
                  allNodes={sortedNodes}
                  onPatch={(patch) => patchNode(sel.id, patch)}
                  onDelete={() => deleteNode(sel.id)}
                />
              ) : (
                <div className="plp-panel-empty">点击图中节点编辑配置<br />边中点 + 可插入节点</div>
              )}
              <div className="plp-ver-block">
                <div className="plp-section-title">版本（semver）</div>
                {(p.versions || []).map((v) => (
                  <div
                    key={v.version}
                    className={'plp-ver-row' + (viewVersion === v.version ? ' plp-ver-row-sel' : '')}
                    onClick={() => setViewVersion(viewVersion === v.version ? null : v.version)}
                    title={viewVersion === v.version ? '回到最新草稿' : '点击查看该版本节点'}
                  >
                    <span className={'plp-ver-chip ' + (v.published ? 'plp-ver-published' : 'plp-ver-draft')}>{v.version}</span>
                    {v.version === p.latestVersion ? <span className="plp-ver-latest">最新</span> : null}
                    {v.version === p.publishedVersion ? <span className="plp-ver-latest">已发布</span> : null}
                    <span className="plp-ver-meta">{v.published ? (v.changelog || '已发布') : '草稿'}</span>
                    {!v.published && v.version !== p.latestVersion ? (
                      <button
                        className="plp-icon-btn"
                        type="button"
                        title="删除该草稿版本"
                        onClick={(e) => { e.stopPropagation(); setConfirmDelVer(v.version) }}
                      >×</button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </aside>
        ) : null}
      </div>

      {/* ── 边中点插入类型选择 ── */}
      {edgeInsert ? (
        <TypePickerModal
          title="在连线中间插入节点"
          onClose={() => setEdgeInsert(null)}
          onPick={(type) => { insertBetween(edgeInsert.from, edgeInsert.to, type); setEdgeInsert(null) }}
        />
      ) : null}

      {/* ── 发布弹窗 ── */}
      {/* ── 删除版本确认弹窗 ── */}
      {confirmDelVer ? (
        <div className="plp-mask">
          <div className="plp-modal" style={{ width: 400 }}>
            <div className="plp-modal-head">
              <span className="plp-modal-title">删除版本</span>
              <button className="plp-icon-btn" type="button" onClick={() => setConfirmDelVer(null)}>×</button>
            </div>
            <div className="plp-modal-body">
              <p style={{ fontSize: 13, lineHeight: 1.8 }}>
                确认删除草稿版本 <span className="plp-version">{confirmDelVer}</span>？删除后不可恢复（已发布版本不可删除）。
              </p>
            </div>
            <div className="plp-modal-foot" style={{ padding: '0 16px 16px' }}>
              <button className="plp-btn" type="button" onClick={() => setConfirmDelVer(null)}>取消</button>
              <button className="plp-btn plp-danger" type="button" onClick={deleteVersion} disabled={busy}>删除</button>
            </div>
          </div>
        </div>
      ) : null}

      {showPublish ? (
        <div className="plp-mask">
          <div className="plp-modal">
            <div className="plp-modal-head">
              <span className="plp-modal-title">发布新版本</span>
              <button className="plp-icon-btn" type="button" onClick={() => setShowPublish(false)}>×</button>
            </div>
            <div className="plp-modal-body">
              <p style={{ fontSize: 12, color: 'var(--dsw-alias-label-secondary)', lineHeight: 1.8 }}>
                当前已发布：<span className="plp-version">{p.publishedVersion || '无'}</span>。发布后版本不可变，可作为子单元被 combined 引用。
              </p>
              <div className="plp-field">
                <label className="plp-field-label">版本升位</label>
                <select className="plp-select" value={publishRelease} onChange={(e) => setPublishRelease(e.target.value as any)}>
                  <option value="patch">patch（修复，x.y.z+1）</option>
                  <option value="minor">minor（新功能，x.y+1.0）</option>
                  <option value="major">major（破坏性变更，x+1.0.0）</option>
                </select>
              </div>
              <div className="plp-field">
                <label className="plp-field-label">变更说明</label>
                <textarea className="plp-textarea" value={changelog} onChange={(e) => setChangelog(e.target.value)} />
              </div>
            </div>
            <div className="plp-modal-foot" style={{ padding: '0 16px 16px' }}>
              <button className="plp-btn" type="button" onClick={() => setShowPublish(false)}>取消</button>
              <button className="plp-btn plp-primary" type="button" onClick={publish} disabled={busy}>发布</button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── 运行弹窗 ── */}
      {showRun ? (
        <div className="plp-mask">
          <div className="plp-modal">
            <div className="plp-modal-head">
              <span className="plp-modal-title">运行调试</span>
              <button className="plp-icon-btn" type="button" onClick={() => setShowRun(false)}>×</button>
            </div>
            <div className="plp-modal-body">
              <p style={{ fontSize: 12, color: 'var(--dsw-alias-label-secondary)', lineHeight: 1.8 }}>
                将使用版本 <span className="plp-version">{p.publishedVersion || p.latestVersion}</span> 运行，进入队列串行执行。
              </p>
              <div className="plp-field">
                <label className="plp-field-label">入参（JSON）</label>
                <textarea className="plp-textarea" style={{ fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace' }} value={runInputs} onChange={(e) => setRunInputs(e.target.value)} />
              </div>
              {runResult ? (
                <div className="plp-pre">{JSON.stringify(runResult, null, 2)}</div>
              ) : null}
            </div>
            <div className="plp-modal-foot" style={{ padding: '0 16px 16px' }}>
              <button className="plp-btn" type="button" onClick={() => setShowRun(false)}>关闭</button>
              <button className="plp-btn plp-primary" type="button" onClick={run} disabled={busy}>运行</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/* ── 节点编辑面板 ── */
function NodePanel(props: { node: GraphNode; allNodes: GraphNode[]; onPatch: (p: Partial<GraphNode>) => void; onDelete: () => void }) {
  const n = props.node
  const [cfgText, setCfgText] = useState<string>(() => JSON.stringify(n.config || {}, null, 2))
  const [dirty, setDirty] = useState(false)
  // 节点切换时重置编辑缓冲
  useEffect(() => { setCfgText(JSON.stringify(n.config || {}, null, 2)); setDirty(false) }, [n.id])
  const others = props.allNodes.filter((x) => x.id !== n.id)
  const deps = n.inputs || []
  function toggleDep(id: string) {
    const next = deps.includes(id) ? deps.filter((d) => d !== id) : [...deps, id]
    props.onPatch({ inputs: next })
  }
  function commitCfg() {
    try { props.onPatch({ config: JSON.parse(cfgText) }); setDirty(false) } catch { /* 非法 JSON 忽略 */ }
  }
  return (
    <div className="plp-nodepanel">
      <div className="plp-section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className={'plp-graph-type plp-graph-type-' + n.type}>{NODE_LABEL[n.type] || n.type}</span>
        <span style={{ fontSize: 12, color: 'var(--dsw-alias-label-tertiary)' }}>{n.id}</span>
      </div>
      <div className="plp-field">
        <label className="plp-field-label">节点名</label>
        <input className="plp-input" value={n.title || ''} onChange={(e) => props.onPatch({ title: e.target.value })} />
      </div>
      <div className="plp-field">
        <label className="plp-field-label">依赖上游（勾选；不勾 = 串联上一个）</label>
        <div className="plp-dep-list">
          {others.length === 0 ? <span style={{ fontSize: 12, color: 'var(--dsw-alias-label-tertiary)' }}>没有其他节点</span> : null}
          {others.map((o) => (
            <label key={o.id} className="plp-dep-item">
              <input type="checkbox" checked={deps.includes(o.id)} onChange={() => toggleDep(o.id)} />
              <span className="plp-dep-name" title={o.id}>{o.title || o.id}</span>
              <span className="plp-dep-id">{o.id}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="plp-field">
        <label className="plp-field-label">配置（JSON）</label>
        <textarea
          className="plp-textarea plp-cfg-json"
          style={{ fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace', minHeight: 140 }}
          value={cfgText}
          onChange={(e) => { setCfgText(e.target.value); setDirty(true) }}
          onBlur={commitCfg}
        />
        <div className="plp-cfg-hint">{CONFIG_HINT[n.type] || ''}</div>
        {dirty ? <button className="plp-btn" type="button" onClick={commitCfg}>应用配置</button> : null}
      </div>
      <button className="plp-btn plp-danger" type="button" onClick={props.onDelete}>删除节点</button>
    </div>
  )
}

/* ── 类型选择弹窗 ── */
function TypePickerModal(props: { title: string; onClose: () => void; onPick: (type: string) => void }) {
  return (
    <div className="plp-mask plp-mask-clear" onClick={props.onClose}>
      <div className="plp-modal" style={{ width: 380 }} onClick={(e) => e.stopPropagation()}>
        <div className="plp-modal-head">
          <span className="plp-modal-title">{props.title}</span>
          <button className="plp-icon-btn" type="button" onClick={props.onClose}>×</button>
        </div>
        <div className="plp-modal-body">
          <div className="plp-type-grid">
            {NODE_TYPES.map((t) => (
              <button key={t} type="button" className="plp-type-cell" onClick={() => props.onPick(t)}>
                <span className={'plp-graph-type plp-graph-type-' + t}>{NODE_LABEL[t]}</span>
                <span className="plp-type-desc">{TYPE_DESC[t]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
