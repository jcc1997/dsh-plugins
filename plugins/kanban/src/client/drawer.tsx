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
  onUpdateTags: (add: string[], remove: string[]) => void
  onMoveStatus: (targetColId: string) => void
  onAddRef: (ref: { kind: string; externalId: string; url?: string; display?: string }) => void
  onRemoveRef: (refId: string) => void
  actionHost?: (() => unknown) | null
}) {
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const [title, setTitle] = useState(props.card.title)
  const [description, setDescription] = useState(props.card.description || '')
  const [comment, setComment] = useState('')
  const [refKind, setRefKind] = useState('github-repo')
  const [refExt, setRefExt] = useState('')
  const [refDisplay, setRefDisplay] = useState('')
  const [refUrl, setRefUrl] = useState('')
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

          {/* 标签 */}
          <div className="kbnb-tag-row">
            <span className="kbnb-field-label">标签</span>
            {(props.card.tags || []).map((tg) => (
              <span key={tg} className="kbnb-tag kbnb-tag-removable" title={'移除标签 ' + tg} onClick={() => props.onUpdateTags([], [tg])}>
                {tg}
                <span className="kbnb-tag-x">×</span>
              </span>
            ))}
            <TagInput onAdd={(t) => props.onUpdateTags([t], [])} />
          </div>

          {/* 外部关联（数据模型 v2）：refs 列表 + 添加表单 */}
          <div className="kbnb-tag-row kbnb-refs-row">
            <span className="kbnb-field-label">关联 {(props.card.refs || []).length}</span>
            {(props.card.refs || []).length === 0 ? <span className="kbnb-refs-empty">暂无关联</span> : null}
            {(props.card.refs || []).map((r) => (
              <span key={r.id} className="kbnb-ref">
                {r.kind ? <span className="kbnb-ref-kind">{r.kind}</span> : null}
                {r.url ? (
                  <a className="kbnb-ref-link" href={r.url} target="_blank" rel="noreferrer">
                    {r.display || r.externalId}
                  </a>
                ) : (
                  <span className="kbnb-ref-text">{r.display || r.externalId}</span>
                )}
                <span className="kbnb-ref-x" title="移除关联" onClick={() => props.onRemoveRef(r.id)}>
                  ×
                </span>
              </span>
            ))}
            <div className="kbnb-ref-add">
              <select
                className="kbnb-input kbnb-ref-kind-select"
                value={refKind}
                onChange={(evt) => setRefKind(evt.target.value)}
              >
                {['github-repo', 'github-branch', 'github-mr', 'local-repo', 'jira-issue'].map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
              <input
                className="kbnb-input kbnb-ref-ext"
                value={refExt}
                onChange={(evt) => setRefExt(evt.target.value)}
                placeholder="external id（owner/repo、MR 号、路径…）"
              />
              <input
                className="kbnb-input kbnb-ref-display"
                value={refDisplay}
                onChange={(evt) => setRefDisplay(evt.target.value)}
                placeholder="展示文本（可选）"
              />
              <input
                className="kbnb-input kbnb-ref-url"
                value={refUrl}
                onChange={(evt) => setRefUrl(evt.target.value)}
                placeholder="链接（可选）"
              />
              <button
                className="kbnb-btn kbnb-primary"
                type="button"
                disabled={!refExt.trim()}
                onClick={() => {
                  if (!refExt.trim()) return
                  props.onAddRef({
                    kind: refKind,
                    externalId: refExt.trim(),
                    display: refDisplay.trim() || undefined,
                    url: refUrl.trim() || undefined,
                  })
                  setRefExt('')
                  setRefDisplay('')
                  setRefUrl('')
                }}
              >
                添加
              </button>
            </div>
          </div>

          {/* 卡片操作槽位宿主（M3）：git 插件注册的「同步」按钮渲染于此 */}
          {props.actionHost ? <div className="kbnb-card-actions-host">{props.actionHost()}</div> : null}

          {/* MR 状态展示（G7）：github-mr refs 渲染 state 徽标 + 最近同步时间 */}
          {(() => {
            const mrRefs = (props.card.refs || []).filter((ref: any) => ref.kind === 'github-mr')
            const syncEnv = props.card.meta && props.card.meta.sync && props.card.meta.sync.github ? props.card.meta.sync.github : null
            if (mrRefs.length === 0 && !syncEnv) return null
            return (
              <div className="kbnb-mr-row">
                <span className="kbnb-field-label">MR 状态</span>
                {mrRefs.map((ref: any) => (
                  <span key={ref.id} className={'kbnb-mr-badge kbnb-mr-' + ((ref.meta && ref.meta.state) || 'open')}>
                    <span className="kbnb-mr-number">#{ref.externalId}</span>
                    <span className="kbnb-mr-state">{(ref.meta && ref.meta.state) || 'open'}</span>
                  </span>
                ))}
                {syncEnv && syncEnv.lastSyncAt ? (
                  <span className="kbnb-mr-synced">同步于 {fmtTime(syncEnv.lastSyncAt)}</span>
                ) : null}
                {syncEnv && syncEnv.error ? <span className="kbnb-mr-error">上次同步失败：{syncEnv.error}</span> : null}
              </div>
            )
          })()}

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

/** 标签添加输入：回车/失焦确认 */
function TagInput(props: { onAdd: (tag: string) => void }) {
  const [v, setV] = useState('')
  function commit() {
    const t = v.trim()
    if (t) props.onAdd(t)
    setV('')
  }
  return (
    <input
      className="kbnb-input kbnb-tag-input"
      value={v}
      onChange={(evt) => setV(evt.target.value)}
      placeholder="+ 添加标签"
      onKeyDown={(evt) => {
        if (evt.key === 'Enter') commit()
      }}
      onBlur={commit}
    />
  )
}