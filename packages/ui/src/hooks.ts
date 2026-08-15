// hooks.ts — 共享 React hooks(docs/ui-design 交互契约落地)
import { useEffect } from 'react'

/** 浮层 Esc 关闭(components.md §九-2):active 时监听 Esc 触发 onClose;滚动/点外关闭由调用方自理 */
export function useEscClose(active: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, onClose])
}
