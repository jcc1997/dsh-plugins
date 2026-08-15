// 新建卡片弹窗：Notion 风格大标题（contentEditable）+ 一句话描述 + 标签 + 富文本内容（可选）
// v4：支持创建模板——选择模板预填描述/标签/内容/门禁，创建时随卡带入。
import React, { useRef, useState } from 'react'
import { Modal } from '@dsh-plugins/ui'
import { KanbanBlock, CardTemplate, CardGate } from '@dsh-plugins/ui'
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
  templates?: CardTemplate[]
  onCreate: (title: string, description: string, tags: string[], content: KanbanBlock[], gates?: CardGate[], templateName?: string) => void
  onClose: () => void
}) {
  const templates = props.templates || []
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tagsText, setTagsText] = useState('')
  const [content, setContent] = useState<KanbanBlock[]>([])
  const [tplId, setTplId] = useState('')
  const [gates, setGates] = useState<CardGate[]>([])
  const [tplName, setTplName] = useState<string | undefined>(undefined)

  /** 选择模板：预填描述/标签/内容/门禁（标题不预填） */
  function pickTemplate(id: string) {
    setTplId(id)
    const tpl = templates.find((t) => t.id === id)
    if (!tpl) { setDescription(''); setTagsText(''); setContent([]); setGates([]); setTplName(undefined); return }
    setDescription(tpl.description || '')
    setTagsText((tpl.tags || []).join(', '))
    setContent(Array.isArray(tpl.content) ? JSON.parse(JSON.stringify(tpl.content)) : [])
    setGates(Array.isArray(tpl.gates) ? JSON.parse(JSON.stringify(tpl.gates)) : [])
    setTplName(tpl.name)
  }
  function submit() {
    const t = plainText(title)
    if (!t) return
    const tags = tagsText.split(/[,，\s]+/).map((x) => x.trim()).filter((x) => x)
    props.onCreate(t, plainText(description), tags, content, gates, tplName)
    props.onClose()
  }
  return (
    <Modal title="新建卡片" width={560} onClose={props.onClose}>
      {templates.length > 0 ? (
        <div className="kbnb-field">
          <div className="kbnb-field-row">
            <span className="kbnb-field-label">模板</span>
            {tplName ? <span className="kbnb-field-label" style={{ color: 'var(--dsw-alias-state-business-primary)' }}>{tplName}（已预填，可修改）</span> : null}
          </div>
          <select className="kbnb-input" value={tplId} onChange={(e) => pickTemplate(e.target.value)}>
            <option value="">不使用模板</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}{t.gates && t.gates.length > 0 ? '（门禁 ' + t.gates.length + '）' : ''}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {gates.length > 0 ? (
        <div className="kbnb-field-row" style={{ marginBottom: 8 }}>
          <span className="kbnb-field-label">门禁（随卡带入）</span>
          <span style={{ fontSize: 12, color: 'var(--dsw-alias-label-secondary)' }}>
            {gates.map((g) => g.name || (g.checker ? g.checker.type : (g as any).kind)).join('、')}
          </span>
        </div>
      ) : null}
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
