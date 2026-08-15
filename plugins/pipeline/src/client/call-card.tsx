// client/call-card.tsx — 对话流中的 pipeline 工具卡片（tool.call.toolview keyed 槽位）
// 接管 pipeline_run / pipeline_run_status 在会话消息流中的渲染：
//   1. 提取 run_id（结果 meta 或入参）
//   2. 轮询 /pipeline-api/run-status 显示实时状态 + 进度条 + 节点进度
//   3. 「查看详情」按钮 → requestOpenRun 打开主面板并定位该 run
// 组件只依赖官方 ToolCallOwnerProps 的公开字段（callId/toolName/block/inspect），不 import 宿主内部。
import React, { useEffect, useRef, useState } from 'react'
import { requestOpenRun } from './nav'

const STATUS_LABEL: Record<string, string> = {
  queued: '排队中', running: '运行中', success: '成功', failed: '失败', cancelled: '已取消',
}

/** 宿主 owner props 形状（tool.call.toolview keyed 槽位；与 dsh-client-ui-tool 契约一致） */
export interface ToolViewProps {
  callId: string
  toolName: string
  block: any
  cwd?: string
  openFile?: (path: string) => void
  inspect?: () => void
  t?: (key: string, params?: Record<string, unknown>) => string
}

/** 从 block 提取 run_id：settled 时优先 meta（pipeline_run 的 presentationMeta），
 *  fallback 解析入参 args（pipeline_run_status 的 run_id 在入参里） */
function extractRunId(block: any): string | null {
  const settled = block && typeof block === 'object' && 'kind' in block
  if (settled) {
    if (block.meta && typeof block.meta === 'object' && typeof block.meta.run_id === 'string') return block.meta.run_id
    if (block.call && typeof block.call.argsRaw === 'string') {
      try {
        const a = JSON.parse(block.call.argsRaw)
        if (a && typeof a.run_id === 'string') return a.run_id
      } catch { /* ignore */ }
    }
  } else if (block && typeof block.argsRaw === 'string') {
    try {
      const a = JSON.parse(block.argsRaw)
      if (a && typeof a.run_id === 'string') return a.run_id
    } catch { /* ignore */ }
  }
  return null
}

function pctOf(run: any): number {
  const nodes = run && Array.isArray(run.nodes) ? run.nodes : []
  if (nodes.length === 0) return run && run.status === 'success' ? 100 : 0
  const done = nodes.filter((n: any) => n.status === 'success' || n.status === 'failed' || n.status === 'skipped').length
  return Math.round(done * 100 / nodes.length)
}

function doneOf(run: any): number {
  const nodes = run && Array.isArray(run.nodes) ? run.nodes : []
  return nodes.filter((n: any) => n.status === 'success' || n.status === 'failed' || n.status === 'skipped').length
}

function outputPreview(run: any): string {
  if (!run || !run.output) return ''
  try { return JSON.stringify(run.output) } catch { return '' }
}

export function PipelineCallCard(props: ToolViewProps) {
  const { toolName, block, inspect } = props
  const settled = block && typeof block === 'object' && 'kind' in block
  const runId = extractRunId(block)
  const [run, setRun] = useState<any>(null)
  const timerRef = useRef<any>(null)

  // 轮询运行状态：run 终态后停止
  useEffect(() => {
    if (!runId) return
    let stopped = false
    const poll = async () => {
      try {
        const res = await fetch('/pipeline-api/run-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ run_id: runId }),
        })
        const data = await res.json()
        if (stopped) return
        if (data && data.run) setRun(data.run)
        const status = data && data.run && data.run.status
        if (status && status !== 'queued' && status !== 'running') return
      } catch { /* 网络失败下一轮重试 */ }
      timerRef.current = setTimeout(poll, 1500)
    }
    poll()
    return () => {
      stopped = true
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [runId])

  // settled 结果中的 meta 摘要（pipeline_run_status 的 presentationMeta：status/done/total）
  const meta = settled && block.meta && typeof block.meta === 'object' ? block.meta : null
  const isError = settled && block.isError === true
  const status = run ? run.status : (meta && meta.status ? meta.status : (settled ? (isError ? 'failed' : null) : null))

  const label = toolName === 'pipeline_run' ? '运行流水线' : '查询流水线进度'
  const pct = run ? pctOf(run) : (meta && meta.total > 0 ? Math.round((meta.done || 0) * 100 / meta.total) : 0)

  return (
    <div className="plp-callcard">
      <div className="plp-callcard-head">
        <svg width={14} height={14} viewBox="0 0 16 16" fill="none" className="plp-callcard-icon">
          <rect x="1.5" y="3" width="3.4" height="3.4" rx="1" stroke="currentColor" strokeWidth="1.2" />
          <rect x="11.1" y="9.6" width="3.4" height="3.4" rx="1" stroke="currentColor" strokeWidth="1.2" />
          <path d="M4.9 4.7h2.6c.55 0 1 .45 1 1v1.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M8.5 8.8v.5c0 .55.45 1 1 1h1.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        <span className="plp-callcard-title">{label}</span>
        {runId ? <span className="plp-callcard-runid" title={runId}>{runId}</span> : null}
        {status ? <span className={'plp-callcard-status plp-sess-st-' + status}>{STATUS_LABEL[status] || status}</span> : null}
        <span className="plp-callcard-spacer" />
        {typeof inspect === 'function' ? (
          <button className="plp-callcard-inspect" type="button" onClick={inspect} title="在轨迹视图查看">轨迹</button>
        ) : null}
      </div>
      {status === 'running' || status === 'queued' ? (
        <div className="plp-callcard-progress">
          <div className="plp-progress" style={{ flex: 1 }}>
            <div className="plp-progress-fill" style={{ width: pct + '%' }} />
          </div>
          <span className="plp-callcard-progress-text">{status === 'queued' ? '排队中…' : '节点 ' + doneOf(run) + '/' + (run && run.nodes ? run.nodes.length : 0) + ' · ' + pct + '%'}</span>
        </div>
      ) : null}
      {run && run.error ? <div className="plp-callcard-error">{run.error}</div> : null}
      {settled && isError && !run ? <div className="plp-callcard-error">调用失败</div> : null}
      {run && run.output ? <div className="plp-callcard-output" title={outputPreview(run)}>{outputPreview(run)}</div> : null}
      {runId ? (
        <div className="plp-callcard-foot">
          <button className="plp-callcard-go" type="button" onClick={() => requestOpenRun(runId)}>
            查看详情
          </button>
        </div>
      ) : null}
    </div>
  )
}
