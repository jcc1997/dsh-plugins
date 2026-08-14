// git 插件客户端半（M3）：向 kanban.card.actions 槽位注册「同步」按钮
// onClick → host.call('git/sync', { cardId })（git 私有 RPC）→ 完成后调用 owner 的 onSynced 刷新看板
import React, { useState } from 'react'

interface CtxLike {
  get(name: string): unknown
}
interface SlotsLike {
  inject(name: string, fn: () => unknown): void
  register(options: Record<string, unknown>, component: (props: any) => unknown): unknown
}

/** 受限环境注入的 host.call（构建后引用全局 host） */
declare const host: { call(method: string, args?: unknown): Promise<any> }
declare const styles: { insert(css: string): unknown }

/** 与 kanban 声明的 owner props 对齐（见 plugins/kanban/src/client/entry.tsx） */
interface CardActionsOwner {
  cardId: string
  onSynced: () => void
}

// git 按钮样式：跟随 kanban 的 kbnb-btn 基调 + 自身状态色；全部走宿主 tokens
const gitCss = `
.git-sync-btn-wrap{display:inline-flex;align-items:center;gap:8px}
.git-sync-done{font-size:12px;color:var(--dsw-alias-state-success-primary)}
.git-sync-error{font-size:12px;color:var(--dsw-alias-state-error-primary)}
`

function makePlugin() {
  return {
    name: 'git',
    apply(ctx: CtxLike) {
      try { styles.insert(gitCss) } catch { /* styles 注入失败不阻断 */ }
      const slots = ctx.get('slots') as SlotsLike | undefined
      if (!slots) return

      // 同步按钮：单卡同步（G6）。kanban 未激活/未声明槽位 → inject 等待声明出现后执行（天然降级）
      function SyncButton(props: CardActionsOwner) {
        const [busy, setBusy] = useState(false)
        const [error, setError] = useState('')
        const [done, setDone] = useState(false)
        function run() {
          setBusy(true)
          setError('')
          setDone(false)
          host
            .call('git/sync', { cardId: props.cardId })
            .then((res) => {
              setBusy(false)
              if (res && res.ok) {
                setDone(true)
                if (typeof props.onSynced === 'function') props.onSynced()
              } else {
                setError((res && res.error) || '同步失败')
              }
            })
            .catch((e) => {
              setBusy(false)
              setError('同步失败: ' + String(e))
            })
        }
        return (
          <div className="git-sync-btn-wrap">
            <button
              className="kbnb-btn kbnb-primary git-sync-btn"
              type="button"
              disabled={busy}
              onClick={run}
              title="拉取该卡片关联仓库的 open MR 并刷新状态"
            >
              {busy ? '同步中…' : '同步'}
            </button>
            {done ? <span className="git-sync-done">已同步</span> : null}
            {error ? <span className="git-sync-error">{error}</span> : null}
          </div>
        )
      }

      slots.inject('kanban.card.actions', () =>
        slots.register(
          { name: 'kanban.card.actions', id: 'git-sync', order: 10, label: () => '同步' },
          (props: CardActionsOwner) => React.createElement(SyncButton, { cardId: props.cardId, onSynced: props.onSynced }),
        ),
      )
    },
  }
}
export default makePlugin()
