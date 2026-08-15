// Composer — 共享自适应输入组件(DESIGN.md v2 §三)
// 形态:统一边框容器;textarea 无自身边框、focus/hover 零高亮(光标即反馈);
// 操作按钮(取消/确认等)内嵌容器:单行时位于输入右侧,输入自动增高后落右下角。
import React, { useEffect, useRef } from 'react'

export function Composer(props: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  /** 内嵌的操作按钮(由调用方提供,如 取消/确认;样式由调用方按钮类决定) */
  actions?: React.ReactNode
  autoFocus?: boolean
  /** 输入区最大高度(px),超过后内部滚动;默认 160 */
  maxHeight?: number
  className?: string
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null)
  const grow = () => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    const max = props.maxHeight || 160
    el.style.height = Math.min(el.scrollHeight, max) + 'px'
  }
  // 外部改值时也自适应(如重置/回填)
  useEffect(() => { grow() }, [props.value])
  return (
    <div className={'cmp-composer' + (props.className ? ' ' + props.className : '')}>
      <textarea
        ref={ref}
        className="cmp-composer-input"
        value={props.value}
        placeholder={props.placeholder}
        rows={1}
        autoFocus={props.autoFocus}
        onChange={(e) => {
          props.onChange(e.target.value)
          grow()
        }}
      />
      {props.actions ? <div className="cmp-composer-actions">{props.actions}</div> : null}
    </div>
  )
}

/** Composer 样式(零高亮:输入区无 focus ring、无边框变色;由使用方注入,幂等) */
export const composerCss = `
.cmp-composer{display:flex;align-items:flex-end;gap:8px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-base);padding:8px;min-width:0}
.cmp-composer-input{flex:1;min-width:0;border:none;background:none;outline:none;resize:none;font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary);padding:2px 0;font-family:inherit;max-height:160px;overflow-y:auto}
.cmp-composer-input::placeholder{color:var(--dsw-alias-label-dimmed)}
.cmp-composer-actions{display:flex;align-items:center;gap:8px;flex:none}
`
