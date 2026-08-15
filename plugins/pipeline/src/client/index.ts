// pipeline 插件客户端半（正式 bundle 形态）：侧边栏入口 + 全屏流水线面板
// 数据通道：fetch → /pipeline-api/* webServer 路由；样式注入同 kanban。
// React Flow（@xyflow/react）打进 bundle，其样式经 loader '.css': 'text' 以字符串引入，apply 时注入 <style>。
import React from 'react'
import xyflowCss from '@xyflow/react/dist/style.css'
import { plpCss, xyflowThemeCss } from './styles'
import { PipelinePage } from './page'
import { PipelineCallCard } from './call-card'
import { registerOpenHandler } from './nav'

export const name = 'pipeline'
export const inject = ['slots']

interface SlotsLike {
  inject(name: string, fn: () => unknown): void
  register(options: Record<string, unknown>, component: (props: any) => unknown): unknown
}

export interface HostLike {
  call(method: string, args?: unknown): Promise<any>
}

/** 数据桥：fetch → /pipeline-api/<method> */
export function makeHostBridge(): HostLike {
  return {
    call: async (method: string, args?: unknown) => {
      const path = '/pipeline-api/' + method
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args !== undefined ? args : {}),
      })
      return res.json()
    },
  }
}

function IconPipelineGlyph() {
  return React.createElement('svg', { width: 15, height: 15, viewBox: '0 0 16 16', fill: 'none', xmlns: 'http://www.w3.org/2000/svg', className: 'plp-nav-icon' },
    React.createElement('rect', { x: 1.5, y: 3, width: 3.4, height: 3.4, rx: 1, stroke: 'currentColor', strokeWidth: 1.2 }),
    React.createElement('rect', { x: 11.1, y: 9.6, width: 3.4, height: 3.4, rx: 1, stroke: 'currentColor', strokeWidth: 1.2 }),
    React.createElement('path', { d: 'M4.9 4.7h2.6c.55 0 1 .45 1 1v1.6', stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round' }),
    React.createElement('path', { d: 'M8.5 8.8v.5c0 .55.45 1 1 1h1.6', stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round' }),
    React.createElement('circle', { cx: 3.2, cy: 4.7, r: 1.4, stroke: 'currentColor', strokeWidth: 1.2 }),
  )
}

export function apply(ctx: { get(name: string): unknown }) {
  try {
    if (!document.querySelector('style[data-plugin-css="pipeline/all"]')) {
      const el = document.createElement('style')
      el.dataset.plugin = 'dsh-pipeline'
      el.dataset.pluginCss = 'pipeline/all'
      el.textContent = plpCss
      document.head.appendChild(el)
    }
    // React Flow 官方样式（打进 bundle 的字符串）+ 主题变量对齐宿主 --dsw-* tokens
    if (!document.querySelector('style[data-plugin-css="pipeline/xyflow"]')) {
      const el = document.createElement('style')
      el.dataset.plugin = 'dsh-pipeline'
      el.dataset.pluginCss = 'pipeline/xyflow'
      el.textContent = xyflowCss + xyflowThemeCss
      document.head.appendChild(el)
    }
  } catch { /* ignore */ }

  const slots = ctx.get('slots') as SlotsLike | undefined
  if (!slots) return
  const host: HostLike = makeHostBridge()

  function PipelineEntry(props: { wide: boolean }) {
    const [open, setOpen] = React.useState(false)
    const [focusRunId, setFocusRunId] = React.useState<string | null>(null)
    // 注册跳转总线：会话 tab 卡片点击 → 打开面板 + 定位 run
    React.useEffect(() => registerOpenHandler((runId) => {
      setFocusRunId(runId)
      setOpen(true)
    }), [])
    return React.createElement('div', null,
      React.createElement('button', {
        className: 'plp-side-btn' + (open ? ' plp-side-btn-on' : ''),
        type: 'button',
        title: 'Pipeline',
        'aria-label': 'Pipeline',
        onClick: () => setOpen(!open),
      }, props.wide
        ? React.createElement(React.Fragment, null, React.createElement(IconPipelineGlyph, null), React.createElement('span', null, 'Pipeline'))
        : React.createElement(IconPipelineGlyph, null)),
      open ? React.createElement(PipelinePage, {
        onClose: () => { setOpen(false); setFocusRunId(null) },
        focusRunId,
      }) : null,
    )
  }

  slots.inject('sidebar.footer.action', () =>
    slots.register(
      { name: 'sidebar.footer.action', id: 'pipeline', order: 11, label: () => 'Pipeline' },
      (props: { wide: boolean }) => React.createElement(PipelineEntry, { wide: props.wide }),
    ),
  )

  // 对话流工具卡片：接管 pipeline_run / pipeline_run_status 的渲染
  // （tool.call.toolview keyed 槽位，key = 工具名；实时进度 + 点击跳转主面板详情）
  slots.inject('tool.call.toolview', () =>
    slots.register({ name: 'tool.call.toolview', key: 'pipeline_run', locale: 'conversation' }, PipelineCallCard),
  )
  slots.inject('tool.call.toolview', () =>
    slots.register({ name: 'tool.call.toolview', key: 'pipeline_run_status', locale: 'conversation' }, PipelineCallCard),
  )
}
