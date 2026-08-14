// client/rich-text.tsx — Notion 式块富文本编辑器主组件（自研轻量版，零外部依赖）
// 受限动态 client 环境：无 import/require、无 timer 全局、fetch 被拒；
// document/FileReader 等浏览器全局可用 → contentEditable + execCommand + FileReader(dataURL 图片)。
// 数据模型：KanbanBlock[]（packages/ui types）；text 存内联 HTML 片段；块渲染在 rt-blocks.tsx。
import React, { useRef, useState } from 'react'
import { safeId } from '@dsh-plugins/ui'
import { KanbanBlock } from '@dsh-plugins/ui'
import { BlockRow, ToolBtn } from './rt-blocks'

const BLOCK_TYPES = ['text', 'h1', 'h2', 'h3', 'bullet', 'ordered', 'check', 'quote', 'code', 'divider', 'image']

/** content 归一化：数组清洗；字符串转单文本块（与 host 侧语义一致） */
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

/** 块数组 → 纯文本（搜索兜底展示） */
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

/** 结构性操作后的焦点请求（由 BlockRow 消费，聚焦 + 光标定位） */
export interface PendingFocus {
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
  /** 定位块；找不到返回 null（插入时 append 到末尾） */
  function blockAt(id: string): { block: KanbanBlock; index: number } | null {
    const index = blocks.findIndex((b) => b.id === id)
    if (index < 0) return null
    return { block: blocks[index], index }
  }
  /** 在 id 之后插入块（id 不存在 → 末尾），并聚焦新块 */
  function insertAfter(id: string, block: KanbanBlock, focus: 'start' | 'end' = 'start') {
    const hit = blockAt(id)
    const next = blocks.slice()
    const at = hit ? hit.index + 1 : blocks.length
    next.splice(at, 0, block)
    commit(next)
    setPendingFocus({ id: block.id, where: focus })
    setActiveId(block.id)
  }
  /** 删除块；focusPrev 时焦点回上一块末尾 */
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
  /** 块类型切换（列表/标题/引用/代码…） */
  function setType(id: string, type: string) {
    if (!activeId) return
    commit(blocks.map((b) => (b.id === id ? { ...b, type } : b)))
  }
  /** 待办勾选 */
  function toggleCheck(id: string) {
    commit(blocks.map((b) => (b.id === id ? { ...b, checked: !b.checked } : b)))
  }

  // Enter：列表类（bullet/ordered/check）继承类型，其余回 text；新块聚焦开头
  function handleEnter(id: string) {
    const hit = blockAt(id)
    if (!hit) return
    const inherit = hit.block.type === 'bullet' || hit.block.type === 'ordered' || hit.block.type === 'check'
    const type = inherit ? hit.block.type : 'text'
    const nb: KanbanBlock = { id: safeId('blk'), type, text: '' }
    if (hit.block.type === 'check') nb.checked = false
    insertAfter(id, nb, 'start')
  }
  // Backspace：空块或行首（非首块）→ 合并到上一块（焦点回上一块末尾）；首块仅空时删除
  function handleBackspace(id: string) {
    const hit = blockAt(id)
    if (!hit) return
    if (hit.index === 0) {
      const empty = (hit.block.text || '').replace(/<[^>]+>/g, '').trim() === ''
      if (empty && blocks.length > 1) {
        commit(blocks.filter((b) => b.id !== id))
        setPendingFocus({ id: blocks[1].id, where: 'start' })
        setActiveId(blocks[1].id)
      }
      return
    }
    const prev = blocks[hit.index - 1]
    const next = blocks.slice()
    next[hit.index - 1] = { ...prev, text: (prev.text || '') + (hit.block.text || '') }
    next.splice(hit.index, 1)
    commit(next)
    setPendingFocus({ id: prev.id, where: 'end' })
    setActiveId(prev.id)
  }

  /** 内联格式：execCommand（作用于当前选区，工具栏按钮已 preventDefault 保住选区） */
  function exec(cmd: string) {
    try {
      document.execCommand(cmd, false)
    } catch {
      /* 忽略 execCommand 异常 */
    }
  }
  /** 行内包裹（如 <code>）：读取选区文本后 insertHTML */
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

  /** 图片块：dataURL（粘贴或文件选择 → FileReader），插到当前块之后 */
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
  /** 粘贴图片：剪贴板文件 → dataURL 插入（文本粘贴走默认行为） */
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

  // 有序列表编号：连续 ordered 块递增，遇其他类型重置
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
      {/* 工具栏：内联格式 + 块类型 + 分割线 + 图片；onMouseDown preventDefault 保选区 */}
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
        <ToolBtn
          label="—"
          title="分割线"
          onAction={() => activeId ? insertAfter(activeId, { id: safeId('blk'), type: 'divider' }, 'start') : blocks.length > 0 ? insertAfter(blocks[blocks.length - 1].id, { id: safeId('blk'), type: 'divider' }, 'start') : commit([{ id: safeId('blk'), type: 'divider' }])}
          disabled={blocks.length === 0 && !activeId}
        />
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
