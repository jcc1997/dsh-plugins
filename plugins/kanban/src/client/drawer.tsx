// 卡片抽屉：左右分栏布局（左：标题+描述+评论；右：状态+标签+关联卡片+变更记录）
// 蒙层点击自动关闭；改动自动保存
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
  const [refKind, setRefKind] = useState('github-branch')
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
    <div
      className="kbnb-drawer-mask"
      onClick={(evt) => {
        // 点击蒙层（非抽屉内部）自动关闭
        if (evt.target === evt.currentTarget) props.onClose()
      }}
    >
      <aside className="kbnb-drawer">
        <div className="kbnb-drawer-body kbnb-drawer-grid">
          {/* ══ 左列：标题 + 描述 + 评论 ══ */}
          <div className="kbnb-drawer-main">
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
                  placeholder={'支持 **粗体**、*斜体*、`代码`、- 列表、[链接](url)、# 标题、空行分段'}
                />
              ) : (
                <div className="kbnb-preview kbnb-preview-scroll">{mdToElements(description)}</div>
              )}
            </div>

            {/* 评论 */}
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
          </div>

          {/* ══ 右列：状态 + 标签 + 关联卡片 + 变更记录 ══ */}
          <div className="kbnb-drawer-side">
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

            {/* Git 关联卡片（G6/G7）：repo + MR 列表 + 状态徽标 + 同步时间 + 同步按钮（槽位） */}
            <GitCard
              card={props.card}
              onRemoveRef={props.onRemoveRef}
              actionHost={props.actionHost ? () => props.actionHost!() : null}
            />

            {/* 外部关联卡片（数据模型 v2）：非 git 的 refs + 添加表单 */}
            <RefsCard
              refs={props.card.refs || []}
              refKind={refKind}
              refExt={refExt}
              refDisplay={refDisplay}
              refUrl={refUrl}
              onRefKind={setRefKind}
              onRefExt={setRefExt}
              onRefDisplay={setRefDisplay}
              onRefUrl={setRefUrl}
              onAddRef={props.onAddRef}
              onRemoveRef={props.onRemoveRef}
            />

            {/* 变更记录 */}
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

/** Git 关联卡片：repo + MR 列表 + 状态徽标 + 同步时间 + 同步按钮（git 插件槽位注入） */
function GitCard(props: {
  card: KanbanCard
  onRemoveRef: (refId: string) => void
  actionHost?: (() => unknown) | null
}) {
  const refs: any[] = (props.card as any).refs || []
  const meta: any = (props.card as any).meta || {}
  const syncEnv = meta.sync && meta.sync.github ? meta.sync.github : null
  const repoRef = refs.find((r) => r.kind === 'github-repo')
  const mrRefs = refs.filter((r) => r.kind === 'github-mr')
  // MR 列表优先用同步快照（含 title/state/url/updatedAt），fallback 到 refs
  const snapshotMrs: any[] = syncEnv && syncEnv.snapshot && Array.isArray(syncEnv.snapshot.mrs) ? syncEnv.snapshot.mrs : []
  const hasAny = repoRef || mrRefs.length > 0 || snapshotMrs.length > 0 || syncEnv
  if (!hasAny) {
    return (
      <section className="kbnb-card kbnb-git-card">
        <header className="kbnb-card-sec-head">
          <span className="kbnb-card-sec-title">Git 关联</span>
          {props.actionHost ? <span className="kbnb-card-actions">{props.actionHost()}</span> : null}
        </header>
        <div className="kbnb-git-empty">暂无 Git 关联：可关联 github-repo 后同步 MR 状态（agent 工具 git_link / git_sync）</div>
      </section>
    )
  }
  return (
    <section className="kbnb-card kbnb-git-card">
      <header className="kbnb-card-sec-head">
        <span className="kbnb-card-sec-title">Git 关联</span>
        {props.actionHost ? <span className="kbnb-card-actions">{props.actionHost()}</span> : null}
      </header>

      {/* 仓库 */}
      {repoRef ? (
        <div className="kbnb-git-repo">
          <span className="kbnb-git-repo-label">仓库</span>
          {repoRef.url ? (
            <a className="kbnb-git-repo-name" href={repoRef.url} target="_blank" rel="noreferrer">
              {repoRef.externalId}
            </a>
          ) : (
            <span className="kbnb-git-repo-name">{repoRef.externalId}</span>
          )}
          <span className="kbnb-ref-x" title="移除仓库关联" onClick={() => props.onRemoveRef(repoRef.id)}>
            ×
          </span>
        </div>
      ) : (
        <div className="kbnb-git-repo">
          <span className="kbnb-git-repo-label">仓库</span>
          <span className="kbnb-git-repo-missing">未关联（agent: git_link github-repo）</span>
        </div>
      )}

      {/* MR 列表：同步快照优先 */}
      {snapshotMrs.length > 0 ? (
        <div className="kbnb-git-mrs">
          <div className="kbnb-git-mrs-label">MR {snapshotMrs.length}</div>
          {snapshotMrs.map((m, i) => {
            const state = m.state || 'open'
            const linkedRef = mrRefs.find((r) => r.externalId === String(m.number))
            return (
              <div key={i} className="kbnb-git-mr">
                <span className={'kbnb-mr-badge kbnb-mr-' + state}>
                  <span className="kbnb-mr-number">#{m.number}</span>
                  <span className="kbnb-mr-state">{state}</span>
                </span>
                {m.url ? (
                  <a className="kbnb-git-mr-title" href={m.url} target="_blank" rel="noreferrer">
                    {m.title}
                  </a>
                ) : (
                  <span className="kbnb-git-mr-title">{m.title}</span>
                )}
                {m.updatedAt ? <span className="kbnb-git-mr-updated">{fmtTime(m.updatedAt)}</span> : null}
                {linkedRef ? (
                  <span className="kbnb-ref-x" title="移除 MR 关联" onClick={() => props.onRemoveRef(linkedRef.id)}>
                    ×
                  </span>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="kbnb-git-empty">尚未同步 MR（点右上「同步」或 agent 工具 git_sync）</div>
      )}

      {/* 同步状态 */}
      <div className="kbnb-git-status">
        {syncEnv && syncEnv.lastSyncAt ? (
          <span className="kbnb-mr-synced">同步于 {fmtTime(syncEnv.lastSyncAt)}</span>
        ) : (
          <span className="kbnb-git-status-muted">未同步过</span>
        )}
        {syncEnv && syncEnv.error ? <span className="kbnb-mr-error">上次同步失败：{syncEnv.error}</span> : null}
        {syncEnv && syncEnv.snapshot && syncEnv.snapshot.repo && syncEnv.snapshot.repo.branch ? (
          <span className="kbnb-git-status-branch">分支 {syncEnv.snapshot.repo.branch}</span>
        ) : null}
      </div>
    </section>
  )
}

/** 外部关联卡片：非 git 的 refs（github-branch / local-repo / jira-issue …）+ 添加表单 */
function RefsCard(props: {
  refs: any[]
  refKind: string
  refExt: string
  refDisplay: string
  refUrl: string
  onRefKind: (v: string) => void
  onRefExt: (v: string) => void
  onRefDisplay: (v: string) => void
  onRefUrl: (v: string) => void
  onAddRef: (ref: { kind: string; externalId: string; url?: string; display?: string }) => void
  onRemoveRef: (refId: string) => void
}) {
  const otherRefs = props.refs.filter((r) => r.kind !== 'github-repo' && r.kind !== 'github-mr')
  const KINDS = ['github-branch', 'local-repo', 'jira-issue']
  return (
    <section className="kbnb-card kbnb-refs-card">
      <header className="kbnb-card-sec-head">
        <span className="kbnb-card-sec-title">外部关联 {otherRefs.length}</span>
      </header>
      {otherRefs.length === 0 ? <div className="kbnb-refs-empty">暂无其他关联</div> : null}
      {otherRefs.map((r) => (
        <div key={r.id} className="kbnb-ref-row">
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
        </div>
      ))}
      <div className="kbnb-ref-add">
        <select className="kbnb-input kbnb-ref-kind-select" value={props.refKind} onChange={(evt) => props.onRefKind(evt.target.value)}>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <input
          className="kbnb-input kbnb-ref-ext"
          value={props.refExt}
          onChange={(evt) => props.onRefExt(evt.target.value)}
          placeholder="external id（branch 名、路径、jira key…）"
        />
        <input
          className="kbnb-input kbnb-ref-display"
          value={props.refDisplay}
          onChange={(evt) => props.onRefDisplay(evt.target.value)}
          placeholder="展示文本（可选）"
        />
        <input
          className="kbnb-input kbnb-ref-url"
          value={props.refUrl}
          onChange={(evt) => props.onRefUrl(evt.target.value)}
          placeholder="链接（可选）"
        />
        <button
          className="kbnb-btn kbnb-primary"
          type="button"
          disabled={!props.refExt.trim()}
          onClick={() => {
            if (!props.refExt.trim()) return
            props.onAddRef({
              kind: props.refKind,
              externalId: props.refExt.trim(),
              display: props.refDisplay.trim() || undefined,
              url: props.refUrl.trim() || undefined,
            })
            props.onRefExt('')
            props.onRefDisplay('')
            props.onRefUrl('')
          }}
        >
          添加
        </button>
      </div>
    </section>
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
