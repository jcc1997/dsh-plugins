// git 插件客户端半（正式 bundle 形态）：向 kanban.card.actions 槽位注册「同步」按钮
// onClick → fetch POST /api/git/sync（host webServer 路由）→ 完成后调用 owner 的 onSynced 刷新看板
// 样式：apply 时注入 <style>（正式形态无 styles 全局，直接用 document）
import React, { useState } from 'react'

export const name = 'git'
export const inject = ['slots']

const gitCss = `.git-sync-btn-wrap{display:inline-flex;align-items:center;gap:8px}
.git-sync-done{font-size:12px;color:var(--dsw-alias-state-success-primary)}
.git-sync-error{font-size:12px;color:var(--dsw-alias-state-error-primary)}`

/** 与 kanban 声明的 owner props 对齐（见 plugins/kanban/src/client/entry.tsx） */
interface CardActionsOwner {
  cardId: string
  onSynced: () => void
}

export function apply(ctx: { get(name: string): unknown }) {
  // 样式注入（幂等：带 data-plugin 标记，重复 apply 不叠加）
  try {
    if (!document.querySelector('style[data-plugin-css="git/sync"]')) {
      const el = document.createElement('style')
      el.dataset.plugin = 'dsh-git'
      el.dataset.pluginCss = 'git/sync'
      el.textContent = gitCss
      document.head.appendChild(el)
    }
  } catch { /* 样式注入失败不阻断 */ }

  const slots = ctx.get('slots') as {
    inject(name: string, fn: () => unknown): void
    register(options: Record<string, unknown>, component: (props: any) => unknown): unknown
  } | undefined
  if (!slots) return

  // 同步按钮：单卡同步。kanban 未激活/未声明槽位 → inject 等待声明出现后执行（天然降级）
  function SyncButton(props: CardActionsOwner) {
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const [done, setDone] = useState(false)
    function run() {
      setBusy(true)
      setError('')
      setDone(false)
      fetch('/api/git/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId: props.cardId }),
      })
        .then((r) => r.json())
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
    return React.createElement('div', { className: 'git-sync-btn-wrap' },
      React.createElement('button', {
        className: 'kbnb-btn kbnb-primary git-sync-btn',
        type: 'button',
        disabled: busy,
        onClick: run,
        title: '拉取该卡片关联仓库的 open MR 并刷新状态',
      }, busy ? '同步中…' : '同步'),
      done ? React.createElement('span', { className: 'git-sync-done' }, '已同步') : null,
      error ? React.createElement('span', { className: 'git-sync-error' }, error) : null,
    )
  }

  slots.inject('kanban.card.actions', () =>
    slots.register(
      { name: 'kanban.card.actions', id: 'git-sync', order: 10, label: () => '同步' },
      (props: CardActionsOwner) => React.createElement(SyncButton, { cardId: props.cardId, onSynced: props.onSynced }),
    ),
  )
}
