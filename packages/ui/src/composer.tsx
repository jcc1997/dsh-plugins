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
  /** Enter 提交(Shift+Enter 换行);不传则 Enter 为普通换行。交互契约见 docs/ui-design/components.md §九 */
  onSubmit?: () => void
  /** 紧凑规格(批注/内嵌小输入):padding/圆角/字号/间距收小,单行时按钮贴右。docs/ui-design/components.md §四 ADR-10 */
  compact?: boolean
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null)
  const [multiline, setMultiline] = useState(false)
  const grow = () => {
    const el = ref.current
    if (!el) return
    const cs = getComputedStyle(el)
    const single = parseFloat(cs.lineHeight) + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom)
    el.style.height = 'auto'
    const max = props.maxHeight || 160
    // 单行 = 精确 lineHeight+padding(内容顶部对齐无余量,视觉对称);超出即多行按内容增高
    el.style.height = el.scrollHeight <= single + 2 ? single + 'px' : Math.min(el.scrollHeight, max) + 'px'
    setMultiline(el.scrollHeight > single + 2)
  }
  useEffect(() => { grow() }, [props.value])
  return (
    <div className={'cmp-composer' + (multiline ? ' cmp-composer-multi' : '') + (props.compact ? ' cmp-composer-compact' : '') + (props.className ? ' ' + props.className : '')}>
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
        onKeyDown={(e) => {
          if (!props.onSubmit) return
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            props.onSubmit()
          }
        }}
      />
      {props.actions ? <div className="cmp-composer-actions">{props.actions}</div> : null}
    </div>
  )
}

/** Composer 样式(输入零高亮;caret 与宿主一致;由使用方注入,幂等) */
export const composerCss = `
.cmp-composer{box-sizing:border-box;display:flex;align-items:center;gap:8px;border:1px solid var(--dsw-alias-border-l2-darkmode-thin, var(--dsw-alias-border-l2));border-radius:22px;background:var(--dsw-specific-input-major, var(--dsw-alias-bg-base));padding:4px 16px;min-width:0}
.cmp-composer-input{flex:1;min-width:0;border:none;background:none;outline:none;resize:none;font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary);caret-color:var(--dsw-alias-state-business-primary);padding:4px 0;font-family:inherit;max-height:160px;overflow-y:auto}
.cmp-composer-input::placeholder{color:var(--dsw-alias-label-dimmed)}
.cmp-composer-actions{display:flex;align-items:center;gap:8px;flex:none}
/* 多行:输入横向撑满,按钮落到容器内最下面一行(右对齐) */
.cmp-composer-multi{flex-wrap:wrap;align-items:flex-end;padding:10px 16px}
.cmp-composer-multi .cmp-composer-input{flex:1 1 100%;padding:4px 0}
.cmp-composer-multi .cmp-composer-actions{width:100%;justify-content:flex-end;padding-top:4px}
/* 紧凑规格(ADR-10):批注等内嵌小输入,克制尺寸 */
.cmp-composer-compact{border-radius:10px;padding:2px 10px;gap:4px}
.cmp-composer-compact .cmp-composer-input{font-size:12px;line-height:18px;padding:3px 0;max-height:72px}
.cmp-composer-compact.cmp-composer-multi{padding:6px 10px 8px}
.cmp-composer-compact.cmp-composer-multi .cmp-composer-input{flex:1 1 100%;padding:3px 0}
.cmp-composer-compact.cmp-composer-multi .cmp-composer-actions{padding-top:2px}
`
