// client/index.ts — dsh-markdown-review 客户端半(正式 bundle 形态)
// 接管工具卡片:tool.call.toolview keyed 槽位 key='md_doc_open',locale='conversation'
// (与 pipeline_run 卡片同款机制;组件只依赖 ToolViewProps 公开契约)。
import React from 'react'
import { mdrCss } from './styles'
import { composerCss } from '@dsh-plugins/ui'
import { MdDocCard } from './card'

export const name = 'markdown-review'
export const inject = ['slots']

interface CtxLike { get(name: string): unknown }
interface SlotsLike {
  inject(name: string, fn: () => unknown): void
  register(options: Record<string, unknown>, component: (props: any) => unknown): unknown
}

export function apply(ctx: CtxLike) {
  try {
    if (!document.querySelector('style[data-plugin-css="markdown-review/all"]')) {
      const el = document.createElement('style')
      el.dataset.plugin = 'dsh-markdown-review'
      el.dataset.pluginCss = 'markdown-review/all'
      el.textContent = mdrCss + composerCss
      document.head.appendChild(el)
    }
  } catch { /* 样式注入失败不阻断 */ }

  const slots = ctx.get('slots') as SlotsLike | undefined
  if (!slots) return

  slots.inject('tool.call.toolview', () =>
    slots.register({ name: 'tool.call.toolview', key: 'md_doc_open', locale: 'conversation' }, MdDocCard),
  )
}
