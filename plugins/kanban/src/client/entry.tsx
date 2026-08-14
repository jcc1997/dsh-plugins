// 入口：组装 client 插件（构建产物供 cordis_define 的 code.client 加载）
import React, { useState } from 'react'
import { IconBoard } from '@dsh-plugins/ui'
import { KanbanPage } from './page'
import { KanbanSettings } from './settings'
import { CtxLike } from '@dsh-plugins/ui'
import { kbnbCss } from './styles'

interface SlotsLike {
  inject(name: string, fn: () => unknown): void
}

/** 受限环境注入的 host.call（构建后引用全局 host） */
declare const host: { call(method: string, args?: unknown): Promise<any> }
declare const styles: { insert(css: string): unknown }

function makePlugin() {
  return {
    name: 'kanban',
    apply(ctx: CtxLike) {
      styles.insert(kbnbCss)
      const slots = ctx.get('slots') as SlotsLike | undefined
      if (!slots) return

      // 侧边栏入口：按钮 + 全屏看板（单一组件，无跨组件状态）
      function KanbanEntry(props: { wide: boolean }) {
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
            {open ? <KanbanPage host={host} onClose={() => setOpen(false)} /> : null}
          </div>
        )
      }

      slots.inject('sidebar.footer.action', () =>
        slots.register(
          { name: 'sidebar.footer.action', id: 'kanban', order: 10, label: () => '看板' },
          (props: { wide: boolean }) => <KanbanEntry wide={props.wide} />,
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
