// client/page.tsx — Pipeline 主界面：顶栏 + 左侧导航（流水线 / 运行 / 设置）+ 主区视图切换
// 数据操作全部走 HostLike（fetch → /pipeline-api/*）；视图组件在 views.tsx。
import React, { useState, useEffect, useCallback } from 'react'
import { IconChevronLeftOutline14, IconCloseOutline16, IconPlusOutline16, useEscClose } from '@dsh-plugins/ui'
import { EditorView } from './editor'

export interface HostLike { call(method: string, args?: unknown): Promise<any> }

export interface PipelineSummary {
  id: string; name: string; description: string; kind: string; tags: string[]
  latestVersion: string; publishedVersion: string | null
  versionCount?: number; nodeCount?: number; updatedAt?: string; createdAt?: string
  versions?: any[]
}

export interface PipelineDoc {
  version: number
  pipelines: PipelineSummary[]
  runs: any[]
  queue: string[]
}

export function PipelinePage(props: { onClose: () => void; focusRunId?: string | null }) {
  const host = React.useMemo(() => ({
    call: async (method: string, args?: unknown) => {
      const res = await fetch('/pipeline-api/' + method, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args !== undefined ? args : {}),
      })
      return res.json()
    },
  }), [])

  const [view, setView] = useState<'list' | 'editor' | 'runs' | 'settings'>('list')
  const [doc, setDoc] = useState<PipelineDoc | null>(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await host.call('load')
      if (r && r.doc) setDoc(r.doc)
      else setError(r && r.error ? r.error : '加载失败')
    } catch (e) {
      setError(String(e && (e as Error).message ? (e as Error).message : e))
    }
  }, [host])

  useEffect(() => { load() }, [load])

  // 外部跳转（对话流卡片点击）：切到运行视图并定位 run
  useEffect(() => {
    if (props.focusRunId) {
      setView('runs')
      setEditing(null)
    }
  }, [props.focusRunId])

  // 导航切换即重新加载(面板数据只在打开时加载一次,不轮询;切换/重进视图触发刷新)
  const nav = (v: 'list' | 'runs' | 'settings') => { setView(v); setEditing(null); load() }
  const openEditor = (id: string) => { setEditing(id); setView('editor') }
  const backToList = () => { setEditing(null); setView('list') }

  return (
    <div className="plp-page">
      <header className="plp-header">
        <button className="plp-icon-btn" type="button" title="返回" onClick={props.onClose}>
          <IconChevronLeftOutline14 />
        </button>
        <span className="plp-title">Pipeline</span>
        <span className="plp-saving">{error ? '' : ''}</span>
        <div className="plp-header-actions">
          <button className="plp-btn plp-primary" type="button" onClick={() => setCreating(true)}>
            <IconPlusOutline16 />
            新建流水线
          </button>
        </div>
      </header>
      {error ? <div className="plp-error">{error}</div> : null}
      <div className="plp-body">
        {/* 编辑页隐藏左侧导航（画布全幅）；其余视图保留 */}
        {view !== 'editor' ? (
          <aside className="plp-app-side">
            <div className="plp-nav-section">管理</div>
            <button type="button" className={'plp-nav-item' + (view === 'list' ? ' plp-nav-on' : '')} onClick={() => nav('list')}>
              <span className="plp-nav-label">流水线</span>
              <span className="plp-nav-badge">{doc ? doc.pipelines.length : 0}</span>
            </button>
            <button type="button" className={'plp-nav-item' + (view === 'runs' ? ' plp-nav-on' : '')} onClick={() => nav('runs')}>
              <span className="plp-nav-label">运行与队列</span>
              <span className="plp-nav-badge">{doc ? doc.runs.filter((r: any) => r.status === 'running' || r.status === 'queued').length : 0}</span>
            </button>
            <div className="plp-nav-section">其他</div>
            <button type="button" className={'plp-nav-item' + (view === 'settings' ? ' plp-nav-on' : '')} onClick={() => nav('settings')}>
              <span className="plp-nav-label">说明</span>
            </button>
          </aside>
        ) : null}
        <main className={'plp-main' + (view === 'editor' ? ' plp-main-editor' : '')}>
          {!doc ? <div className="plp-loading">加载中…</div> : null}
          {doc && view === 'list' ? <ListView doc={doc} host={host} onOpen={openEditor} onChanged={load} /> : null}
          {doc && view === 'editor' && editing ? <EditorView host={host} pipelineId={editing} onBack={backToList} onChanged={load} /> : null}
          {doc && view === 'runs' ? <RunsView doc={doc} host={host} onChanged={load} focusRunId={props.focusRunId} /> : null}
          {doc && view === 'settings' ? <AboutView /> : null}
          {creating ? <CreateModal host={host} onCreated={(id) => { setCreating(false); openEditor(id); load() }} onClose={() => setCreating(false)} /> : null}
        </main>
      </div>
    </div>
  )
}

/* ── 新建弹窗 ── */
function CreateModal(props: { host: HostLike; onCreated: (id: string) => void; onClose: () => void }) {
  useEscClose(true, props.onClose)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<'atomic' | 'combined'>('atomic')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function create() {
    if (!name.trim()) { setError('请输入名称'); return }
    setBusy(true)
    try {
      const r = await props.host.call('create', { name: name.trim(), kind, description })
      if (r.ok && r.pipeline) props.onCreated(r.pipeline.id)
      else setError((r && r.error) || '创建失败')
    } catch (e) {
      setError(String(e && (e as Error).message ? (e as Error).message : e))
    } finally { setBusy(false) }
  }

  return (
    <div className="plp-mask">
      <div className="plp-modal">
        <div className="plp-modal-head">
          <span className="plp-modal-title">新建流水线</span>
          <button className="plp-icon-btn" type="button" onClick={props.onClose}><IconCloseOutline16 /></button>
        </div>
        <div className="plp-modal-body">
          {error ? <div style={{ color: 'var(--dsw-alias-state-error-primary)', fontSize: 12, marginBottom: 12 }}>{error}</div> : null}
          <div className="plp-field">
            <label className="plp-field-label">名称</label>
            <input className="plp-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="如：视频转 mp3" autoFocus />
          </div>
          <div className="plp-field">
            <label className="plp-field-label">类型</label>
            <select className="plp-select" value={kind} onChange={(e) => setKind(e.target.value as any)}>
              <option value="atomic">atomic（无依赖基础单元，可被复用）</option>
              <option value="combined">combined（组合流水线，引用 atomic 单元）</option>
            </select>
          </div>
          <div className="plp-field">
            <label className="plp-field-label">描述</label>
            <textarea className="plp-textarea" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="一句话描述这个流水线做什么" />
          </div>
        </div>
        <div className="plp-modal-foot" style={{ padding: '0 16px 16px' }}>
          <button className="plp-btn" type="button" onClick={props.onClose}>取消</button>
          <button className="plp-btn plp-primary" type="button" onClick={create} disabled={busy}>创建</button>
        </div>
      </div>
    </div>
  )
}

/* ── 列表视图 ── */
function ListView(props: { doc: PipelineDoc; host: HostLike; onOpen: (id: string) => void; onChanged: () => void }) {
  const [kw, setKw] = useState('')
  const list = props.doc.pipelines.filter((p) => !kw || p.name.toLowerCase().includes(kw.toLowerCase()) || p.description.toLowerCase().includes(kw.toLowerCase()))
  return (
    <div>
      <div className="plp-field">
        <input className="plp-input" placeholder="搜索流水线…" value={kw} onChange={(e) => setKw(e.target.value)} />
      </div>
      {list.length === 0 ? <div className="plp-empty">还没有流水线。点击右上角「新建流水线」开始。</div> : null}
      <div className="plp-list-grid">
        {list.map((p) => (
          <div key={p.id} className="plp-row" onClick={() => props.onOpen(p.id)}>
            <div className="plp-row-main">
              <div className="plp-row-title">{p.name}</div>
              <div className="plp-row-desc">{p.description || '（无描述）'}</div>
              <div className="plp-row-meta">
                <span className={'plp-badge' + (p.kind === 'combined' ? ' plp-badge-kind' : '')}>{p.kind === 'combined' ? 'combined' : 'atomic'}</span>
                <span className="plp-version">最新 {p.latestVersion}</span>
                {p.publishedVersion ? <span className="plp-version">已发布 {p.publishedVersion}</span> : <span className="plp-badge">未发布</span>}
                {p.tags && p.tags.length > 0 ? p.tags.map((t) => <span key={t} className="plp-badge">{t}</span>) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── 运行与队列视图 ── */
function RunsView(props: { doc: PipelineDoc; host: HostLike; onChanged: () => void; focusRunId?: string | null }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [pipeFilter, setPipeFilter] = useState<string>('')
  useEffect(() => {
    const t = setInterval(() => props.onChanged(), 1500)
    return () => clearInterval(t)
  }, [props.onChanged])
  // 外部跳转定位：focusRunId 变化时选中
  useEffect(() => {
    if (props.focusRunId) setSelected(props.focusRunId)
  }, [props.focusRunId])
  const allRuns = [...props.doc.runs].sort((a: any, b: any) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
  const runs = pipeFilter ? allRuns.filter((r: any) => r.pipelineId === pipeFilter) : allRuns
  const sel = selected ? allRuns.find((r: any) => r.id === selected) : null
  return (
    <div style={{ display: 'flex', gap: 16, minHeight: 0 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <span className="plp-section-title" style={{ margin: 0 }}>运行与队列（{props.doc.queue.length} 排队 / {allRuns.filter((r: any) => r.status === 'running').length} 进行中）</span>
          <select className="plp-select" style={{ width: 220, marginLeft: 'auto' }} value={pipeFilter} onChange={(e) => setPipeFilter(e.target.value)} title="按流水线筛选">
            <option value="">全部流水线</option>
            {props.doc.pipelines.map((p) => (
              <option key={p.id} value={p.id}>{p.name}（{allRuns.filter((r: any) => r.pipelineId === p.id).length}）</option>
            ))}
          </select>
        </div>
        {runs.length === 0 ? <div className="plp-empty">{pipeFilter ? '该流水线暂无运行记录。' : '暂无运行记录。在流水线编辑页点击「运行」触发。'}</div> : null}
        {runs.map((r: any) => (
          <div key={r.id} className={'plp-run' + (selected === r.id ? ' plp-run-sel' : '')} onClick={() => setSelected(r.id)}>
            <span className={'plp-run-status plp-st-' + r.status} />
            <div className="plp-run-main">
              <div className="plp-run-title">{pipeName(props.doc, r.pipelineId)} <span className="plp-version">{r.version}</span></div>
              <div className="plp-run-meta">
                <span className="plp-run-id">{r.id}</span>
                <span>{r.status}</span>
                {r.source ? <span>来源：{r.source}</span> : null}
                <span>{fmt(r.createdAt)}</span>
              </div>
              {r.status === 'running' && r.nodes && r.nodes.length > 0 ? (
                <div className="plp-progress">
                  <div className="plp-progress-fill" style={{ width: pct(r.nodes) + '%' }} />
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      {sel ? <RunDetail run={sel} doc={props.doc} host={props.host} /> : null}
    </div>
  )
}

function RunDetail(props: { run: any; doc: PipelineDoc; host: HostLike }) {
  const r = props.run
  return (
    <div style={{ width: 360, flex: 'none', borderLeft: '1px solid var(--dsw-alias-border-l2)', paddingLeft: 16 }}>
      <div className="plp-section-title">运行详情</div>
      <div className="plp-kv"><span className="plp-kv-key">run_id</span><span className="plp-kv-val">{r.id}</span></div>
      <div className="plp-kv"><span className="plp-kv-key">状态</span><span className="plp-kv-val">{r.status}</span></div>
      <div className="plp-kv"><span className="plp-kv-key">入参</span></div>
      <div className="plp-pre">{JSON.stringify(r.inputs, null, 2)}</div>
      {r.error ? <div className="plp-node-state-err">{r.error}</div> : null}
      {r.output ? (
        <>
          <div className="plp-kv"><span className="plp-kv-key">输出</span></div>
          <div className="plp-pre">{JSON.stringify(r.output, null, 2)}</div>
        </>
      ) : null}
      {r.nodes && r.nodes.length > 0 ? (
        <>
          <div className="plp-section-title" style={{ marginTop: 12 }}>节点进度</div>
          {r.nodes.map((n: any) => (
            <div key={n.nodeId} className="plp-node-state">
              <span className={'plp-node-state-dot plp-st-' + n.status} style={{ width: 7, height: 7 }} />
              <span className="plp-node-state-name">{nodeName(props.doc, r.pipelineId, r.version, n.nodeId)}</span>
              <span>{n.status}</span>
            </div>
          ))}
        </>
      ) : null}
    </div>
  )
}

function nodeName(doc: PipelineDoc, pipelineId: string, version: string, nodeId: string): string {
  const p = doc.pipelines.find((x) => x.id === pipelineId)
  if (!p || !p.versions) return nodeId
  const v = p.versions.find((x) => x.version === version) || p.versions[p.versions.length - 1]
  if (!v) return nodeId
  const n = v.nodes && v.nodes.find((x: any) => x.id === nodeId)
  return n ? n.title : nodeId
}

function pipeName(doc: PipelineDoc, id: string): string {
  const p = doc.pipelines.find((x) => x.id === id)
  return p ? p.name : id
}

function pct(nodes: any[]): number {
  const done = nodes.filter((n) => n.status === 'success' || n.status === 'failed' || n.status === 'skipped').length
  return nodes.length ? Math.round(done * 100 / nodes.length) : 0
}

function fmt(iso?: string): string {
  try {
    const d = new Date(iso || '')
    const p = (n: number) => (n < 10 ? '0' + n : String(n))
    return p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes())
  } catch { return '' }
}

/* ── 说明视图 ── */
function AboutView() {
  return (
    <div style={{ maxWidth: 640 }}>
      <div className="plp-section-title">关于 Pipeline</div>
      <p style={{ fontSize: 13, lineHeight: 1.9, color: 'var(--dsw-alias-label-secondary)' }}>
        Pipeline 是可复用的流水线：由节点（input / output / exec / fetch / transform / llm / pipeline）组成的有向图，
        一个节点就是一个基本单元。版本采用 npm 风格 semver（如 v1.0.1），发布后不可变。
      </p>
      <ul style={{ fontSize: 13, lineHeight: 2, color: 'var(--dsw-alias-label-secondary)', paddingLeft: 18 }}>
        <li><b>atomic（无依赖）</b>：基础单元，如「视频转 mp3」「mp3 转文字」。</li>
        <li><b>combined（组合）</b>：引用已发布的 atomic 单元组合成完整流程，如「bilibili 视频总结」。</li>
        <li><b>版本</b>：每次发布生成新 semver 版本；未发布的最新版本是可编辑草稿。</li>
        <li><b>运行</b>：运行进入队列串行执行；可在「运行与队列」查看进度与节点状态。</li>
        <li><b>面向 agent</b>：对话上下文可用 pipeline_* 工具管理/运行/查进度。</li>
        <li><b>跨插件</b>：其他插件可经 ctx.get('pipeline') 服务调用 run / runAsync / catalog。</li>
      </ul>
    </div>
  )
}
