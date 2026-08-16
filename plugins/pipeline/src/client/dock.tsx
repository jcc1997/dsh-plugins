// client/dock.tsx — Pipeline 常驻 dock 条(conversation.input.dock,Composer 上方整行)
// 形态(用户定):像 todo 一样展开全部运行;每行 = 状态 icon + pipeline 名 + run id + 详情跳转 icon;
// 已完成的可点击删除(本地隐藏,不删数据);轮询 /pipeline-api/dock-runs 保持实时。
import React, { useEffect, useState } from 'react'
import { IconChevronDownOutline14, IconChevronUpOutline14, IconCloseOutline16, IconGoalOutline16 } from '@dsh-plugins/ui'
import { requestOpenRun } from './nav'

export interface DockRun {
  id: string
  pipelineId: string
  pipelineName: string
  status: 'queued' | 'running' | 'success' | 'failed' | 'cancelled'
  version: string
  createdAt: string
  startedAt?: string
  finishedAt?: string
  error?: string
  output?: Record<string, unknown> | null
  done: number
  total: number
}

const STATUS_LABEL: Record<string, string> = {
  queued: '排队中', running: '运行中', success: '成功', failed: '失败', cancelled: '已取消',
}

/** 本地隐藏(已完成 run 的删除 = 从 dock 收起,不删数据) */
function loadDismissed(): Set<string> {
  try {
    const raw = sessionStorage.getItem('plp-dock-dismissed')
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch { return new Set() }
}

export function PipelineDock() {
  const [runs, setRuns] = useState<DockRun[]>([])
  const [collapsed, setCollapsed] = useState(false)
  const [dismissed, setDismissed] = useState<Set<string>>(() => loadDismissed())
  const [error, setError] = useState('')

  // 轮询运行列表(运行中时保持实时;全部完成后放慢)
  useEffect(() => {
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const poll = async () => {
      try {
        const res = await fetch('/pipeline-api/dock-runs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
        const data = await res.json()
        if (stopped) return
        if (data && Array.isArray(data.runs)) {
          setRuns(data.runs)
          setError('')
        } else {
          setError((data && data.error) || '加载失败')
        }
      } catch { /* 下一轮重试 */ }
      if (stopped) return
      const hasActive = runs.some((r) => r.status === 'queued' || r.status === 'running')
      timer = setTimeout(poll, hasActive ? 2000 : 8000)
    }
    poll()
    return () => {
      stopped = true
      if (timer) clearTimeout(timer)
    }
  }, [])

  const dismiss = (id: string) => {
    const next = new Set(dismissed)
    next.add(id)
    setDismissed(next)
    try { sessionStorage.setItem('plp-dock-dismissed', JSON.stringify([...next])) } catch { /* ignore */ }
  }

  const visible = runs.filter((r) => !dismissed.has(r.id))
  if (visible.length === 0 && !error) return null

  return (
    <div className="plp-dock">
      <div className="plp-dock-head">
        <span className="plp-dock-title">流水线运行</span>
        <span className="plp-dock-count">{visible.length}</span>
        <span className="plp-dock-spacer" />
        <button className="plp-dock-collapse" type="button" title={collapsed ? '展开' : '收起'} onClick={() => setCollapsed((c) => !c)}>
          {collapsed ? <IconChevronUpOutline14 /> : <IconChevronDownOutline14 />}
        </button>
      </div>
      {error ? <div className="plp-dock-error">{error}</div> : null}
      {!collapsed ? (
        <div className="plp-dock-list">
          {visible.map((r) => (
            <div key={r.id} className="plp-dock-row">
              <span className={'plp-dock-dot plp-st-' + r.status} title={STATUS_LABEL[r.status] || r.status} />
              <span className="plp-dock-name" title={r.pipelineName}>{r.pipelineName}</span>
              <span className="plp-dock-status">{STATUS_LABEL[r.status] || r.status}</span>
              {r.status === 'running' || r.status === 'queued' ? (
                <span className="plp-dock-progress">{r.total > 0 ? r.done + '/' + r.total : '排队中'}</span>
              ) : null}
              <span className="plp-dock-id" title={r.id}>{r.id}</span>
              <button className="plp-dock-go" type="button" title="打开详情" onClick={() => requestOpenRun(r.id)}>
                <IconGoalOutline16 size={14} />
              </button>
              {r.status !== 'queued' && r.status !== 'running' ? (
                <button className="plp-dock-x" type="button" title="从列表移除" onClick={() => dismiss(r.id)}>
                  <IconCloseOutline16 size={12} />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
