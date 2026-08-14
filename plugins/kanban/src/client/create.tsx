// 新建卡片弹窗：Notion 风格大标题 + 描述 + 创建（创建走弹窗，编辑才走 drawer）
import React, { useState } from 'react'
import { Modal } from '@dsh-plugins/ui'

export function CreateCardModal(props: {
  onCreate: (title: string, description: string, tags: string[]) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tagsText, setTagsText] = useState('')
  function submit() {
    const t = title.trim()
    if (!t) return
    const tags = tagsText.split(/[,，\s]+/).map((x) => x.trim()).filter((x) => x)
    props.onCreate(t, description, tags)
    props.onClose()
  }
  return (
    <Modal title="新建卡片" width={520} onClose={props.onClose}>
      <input
        className="kbnb-input-title"
        value={title}
        onChange={(evt) => setTitle(evt.target.value)}
        placeholder="卡片标题"
        autoFocus
        onKeyDown={(evt) => {
          if (evt.key === 'Enter' && !evt.shiftKey) submit()
        }}
      />
      <input
        className="kbnb-input"
        value={tagsText}
        onChange={(evt) => setTagsText(evt.target.value)}
        placeholder="标签（可选，逗号分隔）"
      />
      <textarea
        className="kbnb-textarea"
        value={description}
        onChange={(evt) => setDescription(evt.target.value)}
        placeholder={'描述（支持 Markdown：**粗体**、# 标题、- 列表、[链接](url)…）'}
      />
      <div className="kbnb-modal-foot">
        <button className="kbnb-btn" type="button" onClick={props.onClose}>
          取消
        </button>
        <button className="kbnb-btn kbnb-primary" type="button" onClick={submit} disabled={!title.trim()}>
          创建
        </button>
      </div>
    </Modal>
  )
}