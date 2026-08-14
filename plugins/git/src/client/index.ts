// git 插件客户端半（正式 bundle 形态）：向 kanban.card.actions 槽位注册「同步」按钮
// onClick → fetch POST /api/git/sync（host webServer 路由）→ 完成后调用 owner 的 onSynced 刷新看板
// 样式：apply 时注入 <style>（正式形态无 styles 全局，直接用 document）
import React, { useState } from 'react'

export const name = 'git'
export const inject = ['slots']

const gitCss = `.git-sync-btn-wrap{display:inline-flex;align-items:center;gap:8px}
.git-sync-icon-btn{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:6px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-l2);color:var(--dsw-alias-label-primary);cursor:pointer;padding:0;transition:border-color 150ms cubic-bezier(.4, 0, .2, 1),color 150ms cubic-bezier(.4, 0, .2, 1)}
.git-sync-icon-btn:hover{border-color:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-state-business-primary)}
.git-sync-icon-btn:disabled{cursor:default;opacity:.75}
.git-sync-spin{animation:gitSyncSpin 0.9s linear infinite}
@keyframes gitSyncSpin{to{transform:rotate(360deg)}}
.git-sync-done{color:var(--dsw-alias-state-success-primary)}
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

  // 同步按钮：图标按钮（refresh → spin → check）。无文字、无 emoji；hover 可再次同步；done 状态移出鼠标即复原
  function SyncButton(props: CardActionsOwner) {
    const [phase, setPhase] = useState<'idle' | 'busy' | 'done'>('idle')
    const [hoverAgain, setHoverAgain] = useState(false)
    const [error, setError] = useState('')
    function run() {
      if (phase === 'busy') return
      setPhase('busy')
      setError('')
      fetch('/git-api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId: props.cardId }),
      })
        .then((r) => r.json())
        .then((res) => {
          if (res && res.ok) {
            setPhase('done')
            if (typeof props.onSynced === 'function') props.onSynced()
          } else {
            setPhase('idle')
            setError((res && res.error) || '同步失败')
          }
        })
        .catch((e) => {
          setPhase('idle')
          setError('同步失败: ' + String(e))
        })
    }
    // done 时悬浮切回 refresh 图标，允许再次同步；移出复原 check
    const showRefresh = phase === 'idle' || (phase === 'done' && hoverAgain)
    return React.createElement('div', { className: 'git-sync-btn-wrap' },
      React.createElement('button', {
        className: 'git-sync-icon-btn' + (phase === 'busy' ? ' git-sync-spin' : '') + (phase === 'done' && !hoverAgain ? ' git-sync-done' : ''),
        type: 'button',
        disabled: phase === 'busy',
        onClick: run,
        title: phase === 'done' && !hoverAgain ? '同步完成，悬浮可再次同步' : '拉取该卡片关联仓库的 open MR 并刷新状态',
        onMouseEnter: () => setHoverAgain(true),
        onMouseLeave: () => setHoverAgain(false),
      },
        phase === 'done' && !hoverAgain
          ? React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none', xmlns: 'http://www.w3.org/2000/svg' },
              React.createElement('path', { d: 'M2.5 8.5l3.5 3.5 7.5-8', stroke: 'currentColor', strokeWidth: '1.8', strokeLinecap: 'round', strokeLinejoin: 'round' }),
            )
          : React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none', xmlns: 'http://www.w3.org/2000/svg' },
              React.createElement('path', { d: 'M13.5 8a5.5 5.5 0 1 1-1.6-3.9', stroke: 'currentColor', strokeWidth: '1.6', strokeLinecap: 'round' }),
              React.createElement('path', { d: 'M13.5 1.5v3h-3', stroke: 'currentColor', strokeWidth: '1.6', strokeLinecap: 'round', strokeLinejoin: 'round' }),
            ),
      ),
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