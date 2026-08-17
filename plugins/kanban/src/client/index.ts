// kanban 插件客户端半（正式 bundle 形态）：侧边栏入口 + 全屏Kanban + 会话Ticket tab
// 数据通道：hostBridge（fetch → /api/kanban/* webServer 路由）替代动态形态的 host.call；
// 样式：apply 时注入 kbnbCss <style>（正式形态无 styles 全局）；
// 组件层（page/board-view/drawer/rich-text 等）零改动，仅换数据入口。
import React from 'react'
import { kbnbCss } from './styles'
import { KanbanPage } from './page'
import { SessionTaskPanel } from './session-tasks'

export const name = 'kanban'
export const inject = ['slots', 'sessions']

/** 宿主服务形状 */
interface CtxLike {
  get(name: string): unknown
}
interface SlotsLike {
  inject(name: string, fn: () => unknown): void
  register(options: Record<string, unknown>, component: (props: any) => unknown): unknown
}
interface SessionsLike {
  open(id: string): void
}

/** 数据桥：host.call('kanban/load') → fetch POST /api/kanban/load（与 host 半 webServer 路由对应） */
function makeHostBridge(): { call(method: string, args?: unknown): Promise<any> } {
  return {
    call: async (method: string, args?: unknown) => {
      const path = method.startsWith('kanban/') ? '/kanban-api/' + method.slice('kanban/'.length) : '/' + method
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args !== undefined ? args : {}),
      })
      return res.json()
    },
  }
}

/** 侧边栏图标（官方风格，本地绘制；与 page.tsx 的导航图标同源） */
function IconBoardGlyph() {
  return React.createElement('svg', { width: 15, height: 15, viewBox: '0 0 16 16', fill: 'none', xmlns: 'http://www.w3.org/2000/svg', className: 'kbnb-nav-icon' },
    React.createElement('rect', { x: 1.5, y: 2, width: 4, height: 12, rx: 1, stroke: 'currentColor', strokeWidth: 1.2 }),
    React.createElement('rect', { x: 6, y: 2, width: 4, height: 8, rx: 1, stroke: 'currentColor', strokeWidth: 1.2 }),
    React.createElement('rect', { x: 10.5, y: 2, width: 4, height: 5, rx: 1, stroke: 'currentColor', strokeWidth: 1.2 }),
  )
}

export function apply(ctx: CtxLike) {
  // 样式注入（幂等：data-plugin-css 标记去重；正式形态直接用 document）
  try {
    if (!document.querySelector('style[data-plugin-css="kanban/all"]')) {
      const el = document.createElement('style')
      el.dataset.plugin = 'dsh-kanban'
      el.dataset.pluginCss = 'kanban/all'
      el.textContent = kbnbCss
      document.head.appendChild(el)
    }
  } catch { /* 样式注入失败不阻断 */ }

  const slots = ctx.get('slots') as SlotsLike | undefined
  const sessions = ctx.get('sessions') as SessionsLike | undefined
  if (!slots) return
  const host = makeHostBridge()

  // 侧边栏入口：按钮 + 全屏Kanban（单一组件，无跨组件状态）
  // 声明子槽位 kanban.ticket.actions（list）：git 等插件向其中注册「同步」按钮；
  // 声明方（本条目）独占渲染授权，经 renderSlot 渲染到Ticket抽屉。
  function KanbanEntry(props: { wide: boolean; renderSlot?: (key: string, owner: unknown, opts?: unknown) => unknown }) {
    const [open, setOpen] = React.useState(false)
    return React.createElement('div', null,
      React.createElement('button', {
        className: 'kbnb-side-btn' + (props.wide ? '' : ' kbnb-side-btn-rail') + (open ? ' kbnb-side-btn-on' : ''),
        type: 'button',
        title: 'Kanban',
        'aria-label': 'Kanban',
        onClick: () => setOpen(!open),
      }, props.wide
        ? React.createElement(React.Fragment, null, React.createElement(IconBoardGlyph, null), React.createElement('span', null, 'Kanban'))
        : React.createElement(IconBoardGlyph, null)),
      open ? React.createElement(KanbanPage, { host, onClose: () => setOpen(false), renderSlot: props.renderSlot, sessions }) : null,
    )
  }

  slots.inject('sidebar.footer.action', () =>
    slots.register(
      {
        name: 'sidebar.footer.action',
        id: 'kanban',
        order: 10,
        label: () => 'Kanban',
        children: {
          'kanban.ticket.actions': { kind: 'list', scope: 'root' },
        },
      },
      (props: { wide: boolean; renderSlot?: (key: string, owner: unknown, opts?: unknown) => unknown }) =>
        React.createElement(KanbanEntry, { wide: props.wide, renderSlot: props.renderSlot }),
    ),
  )
  // 会话「Ticket」tab：当前会话关联的 task 详情（可编辑）
  slots.inject('conversation.view', () =>
    slots.register(
      { name: 'conversation.view', id: 'kanban-task', order: 20, label: () => 'Ticket' },
      (props: { sessionId?: string }) => React.createElement(SessionTaskPanel, { sessionId: props.sessionId, host, sessions }),
    ),
  )
}