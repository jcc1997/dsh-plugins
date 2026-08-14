// 卡片抽屉：右侧宽面板（编辑/预览 switch、评论、更新日志、删除）
import React, { useState } from 'react'
import { IconCloseOutline16 } from '@dsh-plugins/ui'
import { mdToElements } from '@dsh-plugins/ui'
import { fmtTime } from '@dsh-plugins/ui'
import { KanbanCard } from '@dsh-plugins/ui'

export function CardDrawer(props: {
  card: KanbanCard | null
  isNew: boolean
  onSave: (title: string, description: string) => void
  onDelete: () => void
  onClose: () => void
  onAddComment: (text: string) => void
}) {
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const [title, setTitle] = useState(props.card ? props.card.title : '')
  const [description, setDescription] = useState(props.card ? props.card.description || '' : '')
  const [comment, setComment] = useState('')

  function submit() {
    const t = title.trim()
    if (!t) return
    props.onSave(t, description)
    if (props.isNew) {
      setTitle('')
      setDescription('')
      setMode('edit')
    }
  }
  const comments = (props.card && props.card.comments) || []
  const activity = (props.card && props.card.activity) || []

  return (
    <div className="kbnb-drawer-mask">
      <aside className="kbnb-drawer">
        <div className="kbnb-drawer-head">
          <span className="kbnb-drawer-title">{props.isNew ? '新建卡片' : props.card ? props.card.title : '卡片'}</span>
          <button className="kbnb-icon-btn" type="button" title="关闭" onClick={props.onClose}>
            <IconCloseOutline16 />
          </button>
        </div>
        <div className="kbnb-drawer-body">
          <label className="kbnb-field">
            标题
            <input
              className="kbnb-input"
              value={title}
              onChange={(evt) => setTitle(evt.target.value)}
              placeholder="卡片标题（必填）"
            />
          </label>
          <div className="kbnb-field">
            <div className="kbnb-field-row">
              <span className="kbnb-field-label">描述</span>
              <div className="kbnb-switch" role="tablist">
                <button type="button" className={mode === 'edit' ? 'kbnb-switch-on' : ''} onClick={() => setMode('edit')}>
                  编辑
                </button>
                <button type="button" className={mode === 'preview' ? 'kbnb-switch-on' : ''} onClick={() => setMode('preview')}>
                  预览
                </button>
              </div>
            </div>
            {mode === 'edit' ? (
              <textarea
                className="kbnb-textarea"
                value={description}
                onChange={(evt) => setDescription(evt.target.value)}
                placeholder="支持 **粗体**、*斜体*、`代码`、- 列表、[链接](url)、# 标题、空行分段"
              />
            ) : (
              <div className="kbnb-preview kbnb-preview-scroll">{mdToElements(description)}</div>
            )}
          </div>
          <div className="kbnb-drawer-actions">
            {props.card && !props.isNew ? (
              <button className="kbnb-btn kbnb-danger" type="button" onClick={props.onDelete}>
                删除
              </button>
            ) : null}
            <span className="kbnb-spacer" />
            <button className="kbnb-btn kbnb-primary" type="button" onClick={submit} disabled={!title.trim()}>
              {props.isNew ? '创建' : '保存'}
            </button>
          </div>
          {/* 评论 */}
          <div className="kbnb-section">
            <div className="kbnb-section-title">评论 {comments.length}</div>
            {comments.length === 0 ? <div className="kbnb-section-empty">暂无评论</div> : null}
            {comments.map((m) => (
              <div key={m.id} className="kbnb-comment">
                <div className="kbnb-comment-text">{m.text}</div>
                <div className="kbnb-comment-time">{fmtTime(m.createdAt)}</div>
              </div>
            ))}
            <div className="kbnb-comment-input">
              <input
                className="kbnb-input"
                value={comment}
                onChange={(evt) => setComment(evt.target.value)}
                placeholder="写评论…"
                onKeyDown={(evt) => {
                  if (evt.key === 'Enter' && comment.trim()) {
                    props.onAddComment(comment.trim())
                    setComment('')
                  }
                }}
              />
              <button
                className="kbnb-btn kbnb-primary"
                type="button"
                disabled={!comment.trim()}
                onClick={() => {
                  if (comment.trim()) {
                    props.onAddComment(comment.trim())
                    setComment('')
                  }
                }}
              >
                发送
              </button>
            </div>
          </div>
          {/* 更新日志 */}
          <div className="kbnb-section">
            <div className="kbnb-section-title">更新日志 {activity.length}</div>
            {activity.length === 0 ? <div className="kbnb-section-empty">暂无记录</div> : null}
            {activity.map((a) => (
              <div key={a.id} className="kbnb-activity">
                <span className="kbnb-activity-time">{fmtTime(a.at)}</span>
                <span className="kbnb-activity-text">{a.text}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  )
}
