// Notion 式块富文本编辑器（自研轻量版，无外部依赖）
// 受限动态 client 环境：无 import/require、无 timer 全局、fetch 被拒；
// document/FileReader 等浏览器全局可用 → contentEditable + execCommand + FileReader(dataURL 图片)。
// 数据模型：KanbanBlock[]（见 packages/ui types），text 存内联 HTML 片段。
import React, { useEffect, useRef, useState } from 'react'
import { safeId } from '@dsh-plugins/ui'
import { KanbanBlock } from '@dsh-plugins/ui'

const BLOCK_TYPES = ['text', 'h1', 'h2', 'h3', 'bullet', 'ordered', 'check', 'quote', 'code', 'divider', 'image']

export function normalizeBlocks(raw: unknown): KanbanBlock[] {
  if (Array.isArray(raw)) {
    const out: KanbanBlock[] = []
    for (const b of raw) {
      if (b && typeof b === 'object' && typeof (b as any).type === 'string' && BLOCK_TYPES.includes((b as any).type)) {
        out.push({
          id: typeof (b as any).id === 'string' && (b as any).id ? (b as any).id : safeId('blk'),
          type: (b as any).type,
          text: typeof (b as any).text === 'string' ? (b as any).text : '',
          ...(typeof (b as any).url === 'string' ? { url: (b as any).url } : {}),
          ...(typeof (b as any).checked === 'boolean' ? { checked: (b as any).checked } : {}),
        })
      }
    }
    return out
  }
  if (typeof raw === 'string' && raw.trim()) return [{ id: safeId('blk'), type: 'text', text: raw }]
  return []
}

/** 块数组 → 纯文本（评论/搜索兜底展示） */
export function blocksToText(blocks: KanbanBlock[]): string {
  return (blocks || [])
    .map((b) => {
      if (b.type === 'image') return b.url ? '[图片]' : ''
      if (b.type === 'divider') return '---'
      const t = (b.text || '').replace(/<[^>]+>/g, ' ').trim()
      return (b.type === 'check' ? (b.checked ? '[x] ' : '[ ] ') : '') + t
    })
    .filter((s) => s)
    .join('\n')
}

interface PendingFocus {
  id: string
  where: 'start' | 'end'
}

export function RichTextEditor(props: {
  value: KanbanBlock[]
  onChange: (blocks: KanbanBlock[]) => void
  placeholder?: string
}) {
  const blocks = props.value || []
  const [activeId, setActiveId] = useState<string | null>(null)
  const [pendingFocus, setPendingFocus] = useState<PendingFocus | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  function commit(next: KanbanBlock[]) {
    props.onChange(next)
  }
  function blockAt(id: string): { block: KanbanBlock; index: number } | null {
    const index = blocks.findIndex((b) => b.id === id)
    if (index < 0) return null
    return { block: blocks[index], index }
  }
  function insertAfter(id: string, block: KanbanBlock, focus: 'start' | 'end' = 'start') {
    const hit = blockAt(id)
    const next = blocks.slice()
    const at = hit ? hit.index + 1 : blocks.length
    next.splice(at, 0, block)
    commit(next)
    setPendingFocus({ id: block.id, where: focus })
    setActiveId(block.id)
  }
  function removeBlock(id: string, focusPrev: boolean) {
    const hit = blockAt(id)
    if (!hit) return
    const next = blocks.filter((b) => b.id !== id)
    commit(next)
    if (focusPrev && hit.index > 0) {
      setPendingFocus({ id: next[hit.index - 1].id, where: 'end' })
      setActiveId(next[hit.index - 1].id)
    } else if (hit.index < next.length) {
      setPendingFocus({ id: next[hit.index].id, where: 'start' })
      setActiveId(next[hit.index].id)
    } else if (next.length > 0) {
      setPendingFocus({ id: next[next.length - 1].id, where: 'end' })
      setActiveId(next[next.length - 1].id)
    } else {
      setActiveId(null)
    }
  }
  function setType(id: string, type: string) {
    if (!activeId) return
    commit(blocks.map((b) => (b.id === id ? { ...b, type } : b)))
  }
  function toggleCheck(id: string) {
    commit(blocks.map((b) => (b.id === id ? { ...b, checked: !b.checked } : b)))
  }

  function handleEnter(id: string) {
    const hit = blockAt(id)
    if (!hit) return
    const inherit = hit.block.type === 'bullet' || hit.block.type === 'ordered' || hit.block.type === 'check'
    const type = inherit ? hit.block.type : 'text'
    const nb: KanbanBlock = { id: safeId('blk'), type, text: '' }
    if (hit.block.type === 'check') nb.checked = false
    insertAfter(id, nb, 'start')
  }
  function handleBackspace(id: string) {
    const hit = blockAt(id)
    if (!hit) return
    if (hit.index === 0) {
      // 首块：仅在内容为空时删除（否则保留，让浏览器默认删除字符）
      const empty = (hit.block.text || '').replace(/<[^>]+>/g, '').trim() === ''
      if (empty && blocks.length > 1) {
        commit(blocks.filter((b) => b.id !== id))
        setPendingFocus({ id: blocks[1].id, where: 'start' })
        setActiveId(blocks[1].id)
      }
      return
    }
    // 合并到上一块
    const prev = blocks[hit.index - 1]
    const next = blocks.slice()
    next[hit.index - 1] = { ...prev, text: (prev.text || '') + (hit.block.text || '') }
    next.splice(hit.index, 1)
    commit(next)
    setPendingFocus({ id: prev.id, where: 'end' })
    setActiveId(prev.id)
  }

  function exec(cmd: string) {
    try {
      document.execCommand(cmd, false)
    } catch {
      /* 忽略 execCommand 异常 */
    }
  }
  function wrapInline(tag: string) {
    try {
      const sel = document.getSelection()
      const text = sel ? sel.toString() : ''
      if (!text) return
      document.execCommand('insertHTML', false, '<' + tag + '>' + escapeHtml(text) + '</' + tag + '>')
    } catch {
      /* ignore */
    }
  }
  function escapeHtml(s: string): string {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  function addImage(url: string, afterId: string | null) {
    const nb: KanbanBlock = { id: safeId('blk'), type: 'image', url }
    if (afterId && blockAt(afterId)) insertAfter(afterId, nb, 'start')
    else if (blocks.length > 0) insertAfter(blocks[blocks.length - 1].id, nb, 'start')
    else commit([nb])
  }
  function handleFileInput(evt: React.ChangeEvent<HTMLInputElement>) {
    const f = evt.target.files && evt.target.files[0]
    evt.target.value = ''
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => {
      addImage(String(reader.result || ''), activeId)
    }
    reader.readAsDataURL(f)
  }
  function handlePaste(evt: React.ClipboardEvent) {
    const files = evt.clipboardData && evt.clipboardData.files
    if (files && files.length > 0) {
      const img = Array.from(files).find((f) => f.type && f.type.indexOf('image/') === 0)
      if (img) {
        evt.preventDefault()
        const reader = new FileReader()
        reader.onload = () => {
          addImage(String(reader.result || ''), activeId)
        }
        reader.readAsDataURL(img)
      }
    }
  }

  // 有序列表编号
  let orderedRun = 0
  const orderedNo = blocks.map((b) => {
    if (b.type === 'ordered') {
      orderedRun += 1
      return orderedRun
    }
    orderedRun = 0
    return 0
  })

  const active = activeId ? blockAt(activeId) : null
  const activeType = active ? active.block.type : null
  const activeIsTextish = activeType === 'text' || activeType === 'h1' || activeType === 'h2' || activeType === 'h3' || activeType === 'bullet' || activeType === 'ordered' || activeType === 'check' || activeType === 'quote'

  return (
    <div className="kbnb-rt" onPaste={handlePaste}>
      <div className="kbnb-rt-toolbar" onMouseDown={(e) => e.preventDefault()}>
        <ToolBtn label="B" title="粗体" onAction={() => exec('bold')} bold />
        <ToolBtn label="I" title="斜体" onAction={() => exec('italic')} italic />
        <ToolBtn label="S" title="删除线" onAction={() => exec('strikeThrough')} strike />
        <ToolBtn label="<>" title="行内代码" onAction={() => wrapInline('code')} code />
        <span className="kbnb-rt-sep" />
        <ToolBtn label="H1" title="一级标题" onAction={() => activeId && setType(activeId, 'h1')} disabled={!activeId} />
        <ToolBtn label="H2" title="二级标题" onAction={() => activeId && setType(activeId, 'h2')} disabled={!activeId} />
        <ToolBtn label="H3" title="三级标题" onAction={() => activeId && setType(activeId, 'h3')} disabled={!activeId} />
        <span className="kbnb-rt-sep" />
        <ToolBtn label="•" title="无序列表" onAction={() => activeId && setType(activeId, 'bullet')} disabled={!activeId} />
        <ToolBtn label="1." title="有序列表" onAction={() => activeId && setType(activeId, 'ordered')} disabled={!activeId} />
        <ToolBtn label="待办" title="待办清单" onAction={() => activeId && setType(activeId, 'check')} disabled={!activeId} />
        <ToolBtn label="引用" title="引用" onAction={() => activeId && setType(activeId, 'quote')} disabled={!activeId} />
        <ToolBtn label="代码" title="代码块" onAction={() => activeId && setType(activeId, 'code')} disabled={!activeId} />
        <ToolBtn label="—" title="分割线" onAction={() => activeId ? insertAfter(activeId, { id: safeId('blk'), type: 'divider' }, 'start') : blocks.length > 0 ? insertAfter(blocks[blocks.length - 1].id, { id: safeId('blk'), type: 'divider' }, 'start') : commit([{ id: safeId('blk'), type: 'divider' }])} disabled={blocks.length === 0 && !activeId} />
        <ToolBtn label="图片" title="插入图片（粘贴或选择文件）" onAction={() => fileRef.current && fileRef.current.click()} />
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileInput} />
        <span className="kbnb-rt-hint">{activeIsTextish ? '支持加粗/斜体/删除线/行内代码' : activeType === 'code' ? '代码块内 Enter 换行' : '选中文字后点工具按钮'}</span>
      </div>
      {blocks.length === 0 ? (
        <div
          className="kbnb-rt-empty"
          onClick={() => {
            const nb = { id: safeId('blk'), type: 'text', text: '' }
            commit([nb])
            setPendingFocus({ id: nb.id, where: 'start' })
            setActiveId(nb.id)
          }}
        >
          {props.placeholder || '点击输入内容，支持粘贴图片'}
        </div>
      ) : null}
      {blocks.map((b, i) => (
        <BlockRow
          key={b.id}
          block={b}
          index={i}
          orderedNo={b.type === 'ordered' ? orderedNo[i] : 0}
          active={activeId === b.id}
          pendingFocus={pendingFocus}
          onFocus={() => setActiveId(b.id)}
          onFocusHandled={(id) => {
            if (pendingFocus && pendingFocus.id === id) setPendingFocus(null)
          }}
          onText={(id, html) => commit(blocks.map((x) => (x.id === id ? { ...x, text: html } : x)))}
          onEnter={handleEnter}
          onBackspaceAtStart={handleBackspace}
          onRemove={(id) => removeBlock(id, true)}
          onToggleCheck={toggleCheck}
        />
      ))}
    </div>
  )
}

function ToolBtn(props: {
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

/** 光标是否在元素开头 */
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

function BlockRow(props: {
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

  // 结构性操作后的焦点请求
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
          if (block.type === 'code') return
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
