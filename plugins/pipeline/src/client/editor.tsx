// client/editor.tsx — 流水线编辑器：meta / 版本列表 / 节点图编辑 / 发布 / 运行调试
import React, { useState, useEffect, useCallback } from 'react'
import type { HostLike } from './page'

export interface EditorPipeline {
  id: string; name: string; description: string; kind: string; tags: string[]
  latestVersion: string; publishedVersion: string | null
  versions: Array<{
    version: string; published: boolean; publishedAt?: string; changelog?: string; createdAt: string
    nodes: Array<{ id: string; title: string; type: string; order: number; inputs?: string[]; config: Record<string, unknown> }>
    inputSchema?: any
  }>
  createdAt: string; updatedAt: string
}

const NODE_TYPES = ['input', 'output', 'exec', 'fetch', 'transform', 'llm', 'pipeline']
const NODE_LABEL: Record<string, string> = {
  input: '输入', output: '输出', exec: 'Shell 命令', fetch: 'HTTP 请求',
  transform: '转换', llm: 'LLM 分析', pipeline: '子流水线',
}

export function EditorView(props: { host: HostLike; pipelineId: string | null; onClose: () => void; onChanged: () => void }) {
  const [p, setP] = useState<EditorPipeline | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  // 本地编辑缓冲：meta + 最新版本节点
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [kind, setKind] = useState<'atomic' | 'combined'>('atomic')
  const [tags, setTags] = useState('')
  const [nodes, setNodes] = useState<any[]>([])
  const [publishRelease, setPublishRelease] = useState<'major' | 'minor' | 'patch'>('patch')
  const [changelog, setChangelog] = useState('')
  const [showPublish, setShowPublish] = useState(false)
  const [runInputs, setRunInputs] = useState('{}')
  const [showRun, setShowRun] = useState(false)
  const [runResult, setRunResult] = useState<any>(null)

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
        nodes, kind,
      })
      if (r.ok) { await load(); props.onChanged() } else setError(r.error || '保存失败')
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

  function patchNode(nodeId: string, patch: any) {
    setNodes((ns) => ns.map((n) => (n.id === nodeId ? { ...n, ...patch } : n)))
  }
  function addNode(type: string) {
    setNodes((ns) => {
      const maxOrder = ns.reduce((m, n) => Math.max(m, n.order), 0)
      return [...ns, { id: 'n' + Date.now().toString(36), title: NODE_LABEL[type] || type, type, order: maxOrder + 10, inputs: [], config: {} }]
    })
  }
  function removeNode(nodeId: string) {
    setNodes((ns) => ns.filter((n) => n.id !== nodeId))
  }

  if (loading) return <div className="plp-loading">加载中…</div>
  if (!p) return <div className="plp-loading">{error || '流水线不存在'}</div>

  const latestVer = p.versions.find((v) => v.version === p.latestVersion)

  return (
    <div>
      {/* ── meta 表单 ── */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
        <button className="plp-btn" type="button" onClick={props.onClose}>返回</button>
        <span className="plp-title">{p.name}</span>
        <span className={'plp-badge' + (p.kind === 'combined' ? ' plp-badge-kind' : '')}>{p.kind}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="plp-btn" type="button" onClick={() => setShowRun(true)} disabled={busy}>运行调试</button>
          <button className="plp-btn" type="button" onClick={() => setShowPublish(true)} disabled={busy}>发布新版本</button>
          <button className="plp-btn plp-primary" type="button" onClick={save} disabled={busy}>{busy ? '保存中…' : '保存'}</button>
        </div>
      </div>
      {error ? <div className="plp-error">{error}</div> : null}

      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* ── meta ── */}
          <div className="plp-field">
            <label className="plp-field-label">名称</label>
            <input className="plp-input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="plp-field">
            <label className="plp-field-label">描述</label>
            <textarea className="plp-textarea" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div className="plp-field" style={{ flex: 1 }}>
              <label className="plp-field-label">类型</label>
              <select className="plp-select" value={kind} onChange={(e) => setKind(e.target.value as any)}>
                <option value="atomic">atomic（无依赖基础单元）</option>
                <option value="combined">combined（组合流水线）</option>
              </select>
            </div>
            <div className="plp-field" style={{ flex: 2 }}>
              <label className="plp-field-label">标签（逗号分隔）</label>
              <input className="plp-input" value={tags} onChange={(e) => setTags(e.target.value)} />
            </div>
          </div>

          {/* ── 节点编辑 ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '20px 0 12px' }}>
            <span className="plp-section-title" style={{ margin: 0 }}>节点图（{p.latestVersion} 草稿）</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              {NODE_TYPES.map((t) => (
                <button key={t} className="plp-btn" type="button" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => addNode(t)}>
                  + {NODE_LABEL[t]}
                </button>
              ))}
            </div>
          </div>
          <div className="plp-nodes">
            {nodes.map((n) => (
              <NodeRow key={n.id} node={n} onPatch={(patch) => patchNode(n.id, patch)} onRemove={() => removeNode(n.id)} />
            ))}
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--dsw-alias-label-tertiary)' }}>
            提示：未显式声明依赖（inputs）时按 order 串联；output 节点自动合并上游输出。
          </div>
        </div>

        {/* ── 版本列表 ── */}
        <div style={{ width: 280, flex: 'none' }}>
          <div className="plp-section-title">版本（npm 风格 semver）</div>
          {(p.versions || []).map((v) => (
            <div key={v.version} className="plp-ver-row">
              <span className={'plp-ver-chip ' + (v.published ? 'plp-ver-published' : 'plp-ver-draft')}>{v.version}</span>
              {v.version === p.latestVersion ? <span className="plp-ver-latest">最新</span> : null}
              {v.version === p.publishedVersion ? <span className="plp-ver-latest">已发布</span> : null}
              <span className="plp-ver-meta">{v.published ? (v.changelog || '已发布') : '草稿'}{v.publishedAt ? ' · ' + fmt(v.publishedAt) : ''}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 发布弹窗 ── */}
      {showPublish ? (
        <div className="plp-mask">
          <div className="plp-modal">
            <div className="plp-modal-head">
              <span className="plp-modal-title">发布新版本</span>
              <button className="plp-icon-btn" type="button" onClick={() => setShowPublish(false)}>×</button>
            </div>
            <div className="plp-modal-body">
              <p style={{ fontSize: 12, color: 'var(--dsw-alias-label-secondary)', lineHeight: 1.8 }}>
                当前已发布：<span className="plp-version">{p.publishedVersion || '无'}</span>。
                发布基于当前已发布版本升位（缺省 patch）。发布后版本不可变，可作为子单元被 combined 引用。
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

/* ── 节点行（内联编辑） ── */
function NodeRow(props: { node: any; onPatch: (patch: any) => void; onRemove: () => void }) {
  const n = props.node
  const [cfgText, setCfgText] = useState<string>(() => JSON.stringify(n.config || {}, null, 2))
  const [depsText, setDepsText] = useState<string>(() => (n.inputs || []).join(', '))

  function commitCfg() {
    try { props.onPatch({ config: JSON.parse(cfgText) }) } catch { /* 忽略非法 JSON，保留原值 */ }
  }
  function commitDeps() {
    props.onPatch({ inputs: depsText.split(',').map((s) => s.trim()).filter(Boolean) })
  }

  return (
    <div className="plp-node">
      <div className="plp-node-left">
        <div className="plp-node-type">{NODE_LABEL[n.type] || n.type}</div>
        <input className="plp-node-input plp-node-title" style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }} value={n.title || ''}
          onChange={(e) => props.onPatch({ title: e.target.value })} placeholder="节点名" />
        <div className="plp-node-config">
          <input className="plp-node-input" value={depsText} onChange={(e) => setDepsText(e.target.value)} onBlur={commitDeps}
            placeholder="依赖节点 id（逗号分隔，留空 = 串联上游）" />
          <textarea className="plp-node-input" style={{ minHeight: 60, fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace', resize: 'vertical' }}
            value={cfgText} onChange={(e) => setCfgText(e.target.value)} onBlur={commitCfg} placeholder="节点配置 JSON" />
        </div>
      </div>
      <button className="plp-icon-btn plp-node-remove" type="button" title="删除节点" onClick={props.onRemove}>
        <svg width={14} height={14} viewBox="0 0 16 16" fill="none"><path d="M14.48 4.84l-.27 5.28c-.1 2.07-.14 2.89-.83 3.84-.28.4-.63.73-1.04.99-.52.34-1.1.48-1.78.55-.67.07-1.51.07-2.56.07s-1.89 0-2.56-.07c-.68-.07-1.26-.21-1.78-.55-.41-.26-.76-.59-1.04-.99-.69-.95-.73-1.77-.83-3.84l-.27-5.28 1.37-.07.26 5.28c.11 2.17.17 2.55.58 3.11.18.25.4.47.67.64.26.17.6.28 1.18.33.59.06 1.34.06 2.42.06s1.83 0 2.42-.06c.58-.05.92-.16 1.18-.33.27-.17.49-.39.67-.64.41-.56.47-.94.58-3.11l.26-5.28 1.37.07zM5.43 6.23h1.37v5.16H5.43V6.23zm3.77 0h1.37v5.16H9.2V6.23zM8.54.43c.64 0 1.11-.01 1.56.14.14.05.27.1.4.17.42.21.75.55 1.2 1.01l.8.8h2.87v1.37H.63V2.54h2.88l.79-.79c.46-.46.78-.8 1.2-1.01.13-.07.26-.12.4-.17.45-.14.92-.14 1.56-.14h1.07zm-1.07 1.37c-.73 0-.95.01-1.14.07a1.3 1.3 0 0 0-.21.08c-.15.08-.3.2-.67.58h5.11c-.38-.38-.52-.5-.67-.58a1.3 1.3 0 0 0-.21-.08c-.19-.06-.41-.07-1.14-.07h-1.07z" fill="currentColor"/></svg>
      </button>
    </div>
  )
}

function fmt(iso?: string): string {
  try {
    const d = new Date(iso || '')
    const p = (n: number) => (n < 10 ? '0' + n : String(n))
    return p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes())
  } catch { return '' }
}
