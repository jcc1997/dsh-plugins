// Composer — 共享自适应输入组件(DESIGN.md v2 §三)
// 形态:统一边框容器;textarea 无自身边框、focus/hover 零高亮(光标即反馈,caret 品牌蓝与宿主一致);
// 操作按钮(取消/确认,icon 按钮)内嵌容器:
//   单行 → 按钮在输入右侧同行;文字增多自动增高变多行 → 输入横向撑满、按钮落到容器内最下面一行(右对齐)。
import React, { useEffect, useRef, useState } from 'react'

export function Composer(props: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  /** 内嵌的操作按钮(由调用方提供,如 取消/确认 icon 按钮) */
  actions?: React.ReactNode
  autoFocus?: boolean
  /** 输入区最大高度(px),超过后内部滚动;默认 160 */
  maxHeight?: number
  className?: string
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null)
  const [multiline, setMultiline] = useState(false)
  const grow = () => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    const max = props.maxHeight || 160
    el.style.height = Math.min(el.scrollHeight, max) + 'px'
    // 单行(行高 20 + 上下 padding 8 = 28)以下 = 单行模式;超出即多行
    setMultiline(el.scrollHeight > 30)
  }
  useEffect(() => { grow() }, [props.value])
  return (
    <div className={'cmp-composer' + (multiline ? ' cmp-composer-multi' : '') + (props.className ? ' ' + props.className : '')}>
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

/** Composer 样式(输入零高亮;caret 与宿主一致;由使用方注入,幂等) */
export const composerCss = `
.cmp-composer{display:flex;align-items:center;gap:8px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-base);padding:4px 12px;min-width:0}
.cmp-composer-input{flex:1;min-width:0;border:none;background:none;outline:none;resize:none;font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary);caret-color:var(--dsw-alias-state-business-primary);padding:4px 0;font-family:inherit;max-height:160px;overflow-y:auto}
.cmp-composer-input::placeholder{color:var(--dsw-alias-label-dimmed)}
.cmp-composer-actions{display:flex;align-items:center;gap:8px;flex:none}
/* 多行:输入横向撑满,按钮落到容器内最下面一行(右对齐) */
.cmp-composer-multi{flex-wrap:wrap;align-items:flex-end;padding:8px 12px}
.cmp-composer-multi .cmp-composer-input{flex:1 1 100%;padding:4px 0}
.cmp-composer-multi .cmp-composer-actions{width:100%;justify-content:flex-end;padding-top:2px}
`
