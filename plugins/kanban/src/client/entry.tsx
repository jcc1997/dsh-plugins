// 入口：组装 client 插件（构建产物供 cordis_define 的 code.client 加载）
import React, { useState } from 'react'
import { IconBoard } from '@dsh-plugins/ui'
import { KanbanPage } from './page'
import { KanbanSettings } from './settings'
import { CtxLike } from '@dsh-plugins/ui'
import { kbnbCss } from './styles'

interface SlotsLike {
  inject(name: string, fn: () => unknown): void
  register(options: Record<string, unknown>, component: (props: any) => unknown): unknown
}

/** 受限环境注入的 host.call（构建后引用全局 host） */
declare const host: { call(method: string, args?: unknown): Promise<any> }
declare const styles: { insert(css: string): unknown }

/** kanban.card.actions 槽位的 owner props：卡片 id + 刷新回调（git 插件注册的按钮消费） */
export interface CardActionsOwner {
  cardId: string
  onSynced: () => void
}

function makePlugin() {
  return {
    name: 'kanban',
    apply(ctx: CtxLike) {
      styles.insert(kbnbCss)
      const slots = ctx.get('slots') as SlotsLike | undefined
      if (!slots) return

      // 侧边栏入口：按钮 + 全屏看板（单一组件，无跨组件状态）
      // 声明子槽位 kanban.card.actions（list）：git 等插件向其中注册「同步」按钮；
      // 声明方（本条目）独占渲染授权，经 renderSlot 渲染到卡片抽屉。
      function KanbanEntry(props: { wide: boolean; renderSlot?: (key: string, owner: unknown, opts?: unknown) => unknown }) {
        const [open, setOpen] = useState(false)
        return (
          <div>
            <button
              className={'kbnb-side-btn' + (open ? ' kbnb-side-btn-on' : '')}
              type="button"
              title="看板"
              aria-label="看板"
              onClick={() => setOpen(!open)}
            >
              {props.wide ? (
                <>
                  <IconBoard />
                  <span>看板</span>
                </>
              ) : (
                <IconBoard />
              )}
            </button>
            {open ? <KanbanPage host={host} onClose={() => setOpen(false)} renderSlot={props.renderSlot} /> : null}
          </div>
        )
      }

      slots.inject('sidebar.footer.action', () =>
        slots.register(
          {
            name: 'sidebar.footer.action',
            id: 'kanban',
            order: 10,
            label: () => '看板',
            children: {
              'kanban.card.actions': { kind: 'list', scope: 'root' },
            },
          },
          (props: { wide: boolean; renderSlot?: (key: string, owner: unknown, opts?: unknown) => unknown }) => (
            <KanbanEntry wide={props.wide} renderSlot={props.renderSlot} />
          ),
        ),
      )
      slots.inject('settings.section', () =>
        slots.register(
          { name: 'settings.section', id: 'kanban', order: 30, label: () => '看板' },
          () => <KanbanSettings host={host} />,
        ),
      )
    },
  }
}

export default makePlugin()
