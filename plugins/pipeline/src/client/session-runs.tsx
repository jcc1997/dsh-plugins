// client/session-runs.tsx — 会话「流水线」tab（conversation.view 槽位）
// 对话中查看流水线卡片：最近运行列表（实时轮询 1.5s），显示状态徽章、进度条、节点进度；
// 点击卡片 → requestOpenRun(runId) 打开主面板并定位到该 run 详情。
import React, { useEffect, useState, useCallback } from 'react'
import type { HostLike } from './page'
import { requestOpenRun } from './nav'

export interface SessionRunsProps {
  sessionId?: string
  host: HostLike
}

const STATUS_LABEL: Record<string, string> = {
  queued: '排队中', running: '运行中', success: '成功', failed: '失败', cancelled: '已取消',
}

export function SessionRunsPanel(props: SessionRunsProps) {
  const [doc, setDoc] = useState<any>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const r = await props.host.call('load')
      if (r && r.doc) setDoc(r.doc)
      else setError((r && r.error) || '加载失败')
    } catch (e) {
      setError(String(e && (e as Error).message ? (e as Error).message : e))
    }
  }, [props.host])

  useEffect(() => {
    load()
    const t = setInterval(load, 1500)
    return () => clearInterval(t)
  }, [load])

  const runs = doc ? [...doc.runs].sort((a: any, b: any) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))).slice(0, 20) : []

  return (
    <div className="plp-session">
      <header className="plp-session-head">
        <span className="plp-session-title">流水线运行</span>
        {runs.length > 0 ? <span className="plp-session-count">最近 {runs.length} 条</span> : null}
      </header>
      {error ? <div className="plp-error">{error}</div> : null}
      {runs.length === 0 ? (
        <div className="plp-session-empty">
          暂无流水线运行记录。在对话中调用 pipeline_run，或在 Pipeline 面板点击「运行调试」后，这里会实时显示进度。
        </div>
      ) : (
        <div className="plp-session-list">
          {runs.map((r: any) => {
            const pipe = doc.pipelines.find((p: any) => p.id === r.pipelineId)
            const pct = runPct(r)
            return (
              <button
                key={r.id}
                type="button"
                className="plp-session-card"
                onClick={() => requestOpenRun(r.id)}
                title="点击跳转到 Pipeline 面板查看详情"
              >
                <span className={'plp-run-status plp-st-' + r.status} />
                <span className="plp-session-card-main">
                  <span className="plp-session-card-title">
                    {pipe ? pipe.name : r.pipelineId}
                    <span className="plp-version">{r.version}</span>
                  </span>
                  <span className="plp-session-card-meta">
                    <span className={'plp-session-status plp-sess-st-' + r.status}>{STATUS_LABEL[r.status] || r.status}</span>
                    {r.status === 'running' ? (
                      <span className="plp-progress" style={{ width: 120 }}>
                        <span className="plp-progress-fill" style={{ width: pct + '%' }} />
                      </span>
                    ) : null}
                    {r.status === 'running' ? (
                      <span>{doneNodes(r)}/{r.nodes.length} 节点</span>
                    ) : null}
                    <span>{fmt(r.createdAt)}</span>
                  </span>
                  {r.error ? <span className="plp-session-card-err">{r.error}</span> : null}
                </span>
                <span className="plp-session-card-go">详情</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function runPct(r: any): number {
  if (!Array.isArray(r.nodes) || r.nodes.length === 0) return 0
  const done = r.nodes.filter((n: any) => n.status === 'success' || n.status === 'failed' || n.status === 'skipped').length
  return Math.round(done * 100 / r.nodes.length)
}

function doneNodes(r: any): number {
  if (!Array.isArray(r.nodes)) return 0
  return r.nodes.filter((n: any) => n.status === 'success' || n.status === 'failed' || n.status === 'skipped').length
}

function fmt(iso?: string): string {
  try {
    const d = new Date(iso || '')
    const p = (n: number) => (n < 10 ? '0' + n : String(n))
    return p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes())
  } catch { return '' }
}
