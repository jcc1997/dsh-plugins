// 新建卡片弹窗：Notion 风格大标题（contentEditable）+ 一句话描述 + 标签 + 富文本内容（可选）
import React, { useRef, useState } from 'react'
import { Modal } from '@dsh-plugins/ui'
import { KanbanBlock } from '@dsh-plugins/ui'
import { RichTextEditor } from './rich-text'

/** contentEditable 文本：单行 Enter 失焦或提交 */
function EditableLine(props: {
  className: string
  value: string
  placeholder: string
  singleLine?: boolean
  onSubmit?: () => void
  onInput: (v: string) => void
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  return React.createElement('div', {
    ref,
    className: props.className,
    contentEditable: true,
    suppressContentEditableWarning: true,
    spellCheck: false,
    'data-placeholder': props.placeholder,
    onInput: (e: React.FormEvent<HTMLDivElement>) => {
      e.currentTarget.classList.toggle('kbnb-editable-empty', (e.currentTarget.innerText || '').trim() === '')
      props.onInput(e.currentTarget.innerHTML)
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key !== 'Enter') return
      e.preventDefault()
      if (props.onSubmit) props.onSubmit()
      else if (props.singleLine) (e.currentTarget as HTMLElement).blur()
    },
    onBlur: (e: React.FocusEvent<HTMLDivElement>) => {
      e.currentTarget.classList.toggle('kbnb-editable-empty', (e.currentTarget.innerText || '').trim() === '')
      props.onInput(e.currentTarget.innerHTML)
    },
  })
}

function plainText(html: string): string {
  return String(html).replace(/<[^>]+>/g, '').trim()
}

export function CreateCardModal(props: {
  onCreate: (title: string, description: string, tags: string[], content: KanbanBlock[]) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tagsText, setTagsText] = useState('')
  const [content, setContent] = useState<KanbanBlock[]>([])
  function submit() {
    const t = plainText(title)
    if (!t) return
    const tags = tagsText.split(/[,，\s]+/).map((x) => x.trim()).filter((x) => x)
    props.onCreate(t, plainText(description), tags, content)
    props.onClose()
  }
  return (
    <Modal title="新建卡片" width={560} onClose={props.onClose}>
      <div className="kbnb-title-row">
        <EditableLine
          className="kbnb-input-title-editable"
          value={title}
          placeholder="卡片标题"
          onSubmit={submit}
          onInput={setTitle}
        />
      </div>
      <div className="kbnb-field">
        <div className="kbnb-field-row">
          <span className="kbnb-field-label">描述</span>
        </div>
        <EditableLine
          className="kbnb-input-desc-editable"
          value={description}
          placeholder="一句话描述（纯文本）"
          singleLine
          onInput={setDescription}
        />
      </div>
      <div className="kbnb-field">
        <div className="kbnb-field-row">
          <span className="kbnb-field-label">标签</span>
        </div>
        <input
          className="kbnb-input"
          value={tagsText}
          onChange={(evt) => setTagsText(evt.target.value)}
          placeholder="标签（可选，逗号分隔）"
        />
      </div>
      <div className="kbnb-field">
        <div className="kbnb-field-row">
          <span className="kbnb-field-label">内容（可选）</span>
        </div>
        <RichTextEditor value={content} onChange={setContent} placeholder="输入内容或粘贴图片…" />
      </div>
      <div className="kbnb-modal-foot">
        <button className="kbnb-btn" type="button" onClick={props.onClose}>
          取消
        </button>
        <button className="kbnb-btn kbnb-primary" type="button" onClick={submit} disabled={!plainText(title)}>
          创建
        </button>
      </div>
    </Modal>
  )
}
