// 卡片抽屉：仅编辑已存在卡片
// 布局：大标题 → 工具/状态栏(删除) → 描述 → (左右)评论｜变更记录；改动自动保存
import React, { useEffect, useRef, useState } from 'react'
import { IconCloseOutline16 } from '@dsh-plugins/ui'
import { mdToElements } from '@dsh-plugins/ui'
import { fmtTime } from '@dsh-plugins/ui'
import { KanbanCard, KanbanColumn } from '@dsh-plugins/ui'

export function CardDrawer(props: {
  card: KanbanCard
  columns: KanbanColumn[]
  onSave: (title: string, description: string) => void
  onDelete: () => void
  onClose: () => void
  onAddComment: (text: string) => void
  onMoveStatus: (targetColId: string) => void
}) {
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const [title, setTitle] = useState(props.card.title)
  const [description, setDescription] = useState(props.card.description || '')
  const [comment, setComment] = useState('')
  const first = useRef(true)

  // 切换卡片时同步本地状态
  useEffect(() => {
    setTitle(props.card.title)
    setDescription(props.card.description || '')
  }, [props.card.id])

  // 自动保存：title/description 变化后 600ms 防抖提交（首次渲染跳过）
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const timer = setTimeout(() => props.onSave(title.trim(), description), 600)
    return () => clearTimeout(timer)
  }, [title, description])

  const comments = props.card.comments || []
  const activity = props.card.activity || []
  const currentCol = props.columns.find((c) => c.cards.some((k) => k.id === props.card.id))

  return (
    <div className="kbnb-drawer-mask">
      <aside className="kbnb-drawer">
        <div className="kbnb-drawer-body">
          {/* 标题：Notion 风格，无边框大号输入 */}
          <div className="kbnb-title-row">
            <input
              className="kbnb-input-title"
              value={title}
              onChange={(evt) => setTitle(evt.target.value)}
              placeholder="卡片标题"
            />
            <button className="kbnb-icon-btn" type="button" title="关闭" onClick={props.onClose}>
              <IconCloseOutline16 />
            </button>
          </div>

          {/* 工具/状态栏：状态切换 + 删除 */}
          <div className="kbnb-toolbar">
            <label className="kbnb-status">
              <span className="kbnb-status-label">状态</span>
              <select
                className="kbnb-status-select"
                value={currentCol ? currentCol.id : ''}
                onChange={(evt) => {
                  const target = evt.target.value
                  if (target && currentCol && target !== currentCol.id) props.onMoveStatus(target)
                }}
              >
                {props.columns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </label>
            <span className="kbnb-spacer" />
            <button className="kbnb-btn kbnb-danger" type="button" onClick={props.onDelete}>
              删除
            </button>
          </div>

          {/* 描述 */}
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
                placeholder={'支持 **粗体**、*斜体*、\`代码\`、- 列表、[链接](url)、# 标题、空行分段'}
              />
            ) : (
              <div className="kbnb-preview kbnb-preview-scroll">{mdToElements(description)}</div>
            )}
          </div>

          {/* 左右双栏：评论 | 变更记录 */}
          <div className="kbnb-drawer-split">
            <section className="kbnb-section">
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
            </section>
            <section className="kbnb-section">
              <div className="kbnb-section-title">变更记录 {activity.length}</div>
              {activity.length === 0 ? <div className="kbnb-section-empty">暂无记录</div> : null}
              {activity.map((a) => (
                <div key={a.id} className="kbnb-activity">
                  <span className="kbnb-activity-time">{fmtTime(a.at)}</span>
                  {a.actor ? <span className="kbnb-activity-actor">{a.actor}</span> : null}
                  <span className="kbnb-activity-text">{a.text}</span>
                </div>
              ))}
            </section>
          </div>
        </div>
      </aside>
    </div>
  )
}
