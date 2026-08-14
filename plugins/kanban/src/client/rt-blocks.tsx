// client/rt-blocks.tsx — 富文本块渲染层：BlockRow（各块类型 + contentEditable 同步）+ ToolBtn + 光标工具
// DOM 同步策略：聚焦中的块不回写（避免光标跳动）；失焦后按最新值回写（内联 HTML 或代码纯文本）
import React, { useEffect, useRef } from 'react'
import { KanbanBlock } from '@dsh-plugins/ui'
import { PendingFocus } from './rich-text'

/** 工具栏按钮：onMouseDown preventDefault 保住编辑器选区，onClick 执行动作 */
export function ToolBtn(props: {
  label: string
  title: string
  onAction: () => void
  disabled?: boolean
  bold?: boolean
  italic?: boolean
  strike?: boolean
  code?: boolean
}) {
  const cls = 'kbnb-rt-btn' + (props.bold ? ' kbnb-rt-b' : '') + (props.italic ? ' kbnb-rt-i' : '') + (props.strike ? ' kbnb-rt-s' : '') + (props.code ? ' kbnb-rt-c' : '')
  return (
    <button
      type="button"
      className={cls}
      title={props.title}
      disabled={props.disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => props.onAction()}
    >
      {props.label}
    </button>
  )
}

/** 光标是否在元素开头（合并块判定用） */
function caretAtStart(el: HTMLElement): boolean {
  try {
    const sel = document.getSelection()
    if (!sel || sel.rangeCount === 0 || !el.contains(sel.anchorNode)) return false
    const range = sel.getRangeAt(0)
    if (range.startContainer === el) return range.startOffset === 0
    const pre = document.createRange()
    pre.selectNodeContents(el)
    pre.setEnd(range.startContainer, range.startOffset)
    return pre.toString().length === 0
  } catch {
    return false
  }
}

export function BlockRow(props: {
  block: KanbanBlock
  index: number
  orderedNo: number
  active: boolean
  pendingFocus: PendingFocus | null
  onFocus: () => void
  onFocusHandled: (id: string) => void
  onText: (id: string, html: string) => void
  onEnter: (id: string) => void
  onBackspaceAtStart: (id: string) => void
  onRemove: (id: string) => void
  onToggleCheck: (id: string) => void
}) {
  const { block } = props
  const ref = useRef<HTMLDivElement | null>(null)
  const domText = useRef<string | null>(null)

  // DOM 同步：聚焦中的块不回写（避免光标跳动）；失焦后按最新值回写
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (document.activeElement === el) {
      domText.current = el.innerHTML
      return
    }
    const want = block.text || ''
    if (block.type === 'code') {
      // 代码块存纯文本：textContent 写入（自动转义），读取 innerText
      if (domText.current !== 'code:' + want) {
        el.textContent = want
        domText.current = 'code:' + want
      }
      return
    }
    if (domText.current !== want) {
      el.innerHTML = want
      domText.current = want
    }
  }, [block.text, block.type])

  // 结构性操作后的焦点请求（Enter/Backspace/插入后）：聚焦 + 光标定位
  useEffect(() => {
    const el = ref.current
    if (!el || !props.pendingFocus || props.pendingFocus.id !== block.id) return
    el.focus()
    try {
      const sel = document.getSelection()
      const range = document.createRange()
      range.selectNodeContents(el)
      range.collapse(props.pendingFocus.where === 'start')
      if (sel) {
        sel.removeAllRanges()
        sel.addRange(range)
      }
    } catch {
      /* ignore */
    }
    props.onFocusHandled(block.id)
  }, [props.pendingFocus])

  /* ── 特殊块：分割线 / 图片（不可编辑，悬停显示删除按钮） ── */
  if (block.type === 'divider') {
    return (
      <div className={'kbnb-rt-block kbnb-rt-divider-wrap' + (props.active ? ' kbnb-rt-on' : '')} onClick={() => props.onFocus()}>
        <hr className="kbnb-rt-divider" />
        <button type="button" className="kbnb-rt-remove" title="删除分割线" onClick={() => props.onRemove(block.id)}>
          ×
        </button>
      </div>
    )
  }
  if (block.type === 'image') {
    return (
      <div className={'kbnb-rt-block kbnb-rt-imgwrap' + (props.active ? ' kbnb-rt-on' : '')} onClick={() => props.onFocus()}>
        {block.url ? <img className="kbnb-rt-img" src={block.url} alt="粘贴或上传的图片" /> : <span className="kbnb-rt-img-missing">图片缺失</span>}
        <button type="button" className="kbnb-rt-remove" title="删除图片" onClick={() => props.onRemove(block.id)}>
          ×
        </button>
      </div>
    )
  }

  /* ── 待办块：复选框 + 可编辑文本 ── */
  if (block.type === 'check') {
    return (
      <div className={'kbnb-rt-block kbnb-rt-check' + (props.active ? ' kbnb-rt-on' : '')}>
        <span
          className={'kbnb-rt-checkbox' + (block.checked ? ' kbnb-rt-checked' : '')}
          onClick={() => props.onToggleCheck(block.id)}
          title={block.checked ? '取消完成' : '标记完成'}
        />
        <Editable
          ref={ref}
          className={'kbnb-rt-editable' + (block.checked ? ' kbnb-rt-done' : '')}
          html={block.text || ''}
          domText={domText}
          placeholder="待办事项"
          onInput={(html) => props.onText(block.id, html)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              props.onEnter(block.id)
            } else if (e.key === 'Backspace') {
              const el = ref.current
              if (!el) return
              const empty = (el.textContent || '').trim() === ''
              if (empty || (caretAtStart(el) && props.index > 0)) {
                e.preventDefault()
                props.onBackspaceAtStart(block.id)
              }
            }
          }}
          onFocus={props.onFocus}
        />
      </div>
    )
  }

  /* ── 文本类块：标题/段落/列表/引用/代码 ── */
  const clsByType: Record<string, string> = {
    text: 'kbnb-rt-text',
    h1: 'kbnb-rt-h1',
    h2: 'kbnb-rt-h2',
    h3: 'kbnb-rt-h3',
    bullet: 'kbnb-rt-bullet',
    ordered: 'kbnb-rt-ordered',
    quote: 'kbnb-rt-quote',
    code: 'kbnb-rt-code',
  }
  const marker = block.type === 'bullet' ? (
    <span className="kbnb-rt-marker">•</span>
  ) : block.type === 'ordered' ? (
    <span className="kbnb-rt-marker">{props.orderedNo}.</span>
  ) : null

  const placeholder =
    block.type === 'h1' ? '标题 1' : block.type === 'h2' ? '标题 2' : block.type === 'h3' ? '标题 3' : block.type === 'quote' ? '引用' : block.type === 'code' ? '代码…' : '输入文字…'

  return (
    <div className={'kbnb-rt-block' + (props.active ? ' kbnb-rt-on' : '')} onClick={() => props.onFocus()}>
      {marker}
      <Editable
        ref={ref}
        className={'kbnb-rt-editable ' + (clsByType[block.type] || 'kbnb-rt-text')}
        html={block.text || ''}
        domText={domText}
        pre={block.type === 'code'}
        placeholder={placeholder}
        onInput={(html) => props.onText(block.id, html)}
        onKeyDown={(e) => {
          if (block.type === 'code') return // 代码块：Enter 换行走默认，不切块
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            props.onEnter(block.id)
          } else if (e.key === 'Backspace') {
            const el = ref.current
            if (!el) return
            const empty = (el.textContent || '').trim() === ''
            if (empty || (caretAtStart(el) && props.index > 0)) {
              e.preventDefault()
              props.onBackspaceAtStart(block.id)
            }
          }
        }}
        onFocus={props.onFocus}
      />
    </div>
  )
}

/** contentEditable 组件：非受控 DOM + 外部同步；html 仅在其与 DOM 不同且未聚焦时回写 */
const Editable = React.forwardRef(function Editable(
  props: {
    className: string
    html: string
    domText: React.MutableRefObject<string | null>
    pre?: boolean
    placeholder?: string
    onInput: (html: string) => void
    onKeyDown: (e: React.KeyboardEvent) => void
    onFocus: () => void
  },
  ref: React.ForwardedRef<HTMLDivElement>,
) {
  return React.createElement('div', {
    ref,
    className: props.className,
    contentEditable: true,
    suppressContentEditableWarning: true,
    spellCheck: false,
    'data-placeholder': props.placeholder || '',
    onInput: (e: React.FormEvent<HTMLDivElement>) => {
      const el = e.currentTarget
      el.classList.toggle('kbnb-editable-empty', (el.innerText || '').trim() === '')
      props.onInput(props.pre ? el.innerText || '' : el.innerHTML)
    },
    onKeyDown: props.onKeyDown,
    onFocus: props.onFocus,
    onBlur: () => {
      const el = ref as React.MutableRefObject<HTMLDivElement | null>
      if (el.current) {
        el.current.classList.toggle('kbnb-editable-empty', (el.current.innerText || '').trim() === '')
        props.onInput(props.pre ? el.current.innerText || '' : el.current.innerHTML)
      }
    },
  })
})
