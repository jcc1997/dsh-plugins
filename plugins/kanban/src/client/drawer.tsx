// 卡片抽屉：左右分栏布局（左：标题+描述+富文本内容+评论；右：状态+标签+关联+变更记录）
// 标题/描述用 contentEditable（Notion 式，无边框输入框）；内容用块富文本编辑器（含图片）
// 蒙层点击自动关闭；改动自动保存
import React, { useEffect, useRef, useState } from 'react'
import { IconCloseOutline16 } from '@dsh-plugins/ui'
import { fmtTime } from '@dsh-plugins/ui'
import { KanbanCard, KanbanColumn, KanbanBlock } from '@dsh-plugins/ui'
import { RichTextEditor } from './rich-text'

/** 关联类型定义（新增/展示按类型；git 关联 + 会话关联） */
export const REF_KINDS: { kind: string; label: string }[] = [
  { kind: 'github-repo', label: 'GitHub 仓库' },
  { kind: 'github-branch', label: 'GitHub 分支' },
  { kind: 'github-mr', label: 'GitHub MR' },
  { kind: 'local-repo', label: '本地仓库' },
  { kind: 'session', label: '会话' },
]

/** contentEditable 单行/多行文本（非受控 DOM，聚焦不回写避免光标跳动；单行 Enter 失焦） */
function EditableLine(props: {
  className: string
  value: string
  placeholder: string
  singleLine?: boolean
  onInput: (v: string) => void
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const dom = useRef<string | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (document.activeElement === el) {
      dom.current = el.innerHTML
      return
    }
    const want = props.value
    if (dom.current !== want) {
      el.innerHTML = want
      dom.current = want
    }
  }, [props.value])
  return React.createElement('div', {
    ref,
    className: props.className,
    contentEditable: true,
    suppressContentEditableWarning: true,
    spellCheck: false,
    'data-placeholder': props.placeholder,
    onInput: (e: React.FormEvent<HTMLDivElement>) => {
      dom.current = e.currentTarget.innerHTML
      e.currentTarget.classList.toggle('kbnb-editable-empty', (e.currentTarget.innerText || '').trim() === '')
      props.onInput(e.currentTarget.innerHTML)
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (props.singleLine && e.key === 'Enter') {
        e.preventDefault()
        ;(e.currentTarget as HTMLElement).blur()
      }
    },
    onBlur: (e: React.FocusEvent<HTMLDivElement>) => {
      dom.current = e.currentTarget.innerHTML
      e.currentTarget.classList.toggle('kbnb-editable-empty', (e.currentTarget.innerText || '').trim() === '')
      props.onInput(e.currentTarget.innerHTML)
    },
  })
}

export function CardDetail(props: {
  card: KanbanCard
  columns: KanbanColumn[]
  onSave: (title: string, description: string, content: KanbanBlock[]) => void
  onDelete?: () => void
  onArchive?: () => void
  onClose?: () => void
  onAddComment: (text: string) => void
  onUpdateTags: (add: string[], remove: string[]) => void
  onMoveStatus: (targetColId: string) => void
  onAddRef: (ref: { kind: string; externalId: string; url?: string; display?: string }) => void
  onRemoveRef: (refId: string) => void
  onOpenSession: (sessionId: string) => void
  actionHost?: (() => unknown) | null
}) {
  const [title, setTitle] = useState(props.card.title)
  const [description, setDescription] = useState(props.card.description || '')
  const [content, setContent] = useState<KanbanBlock[]>(Array.isArray(props.card.content) ? props.card.content : [])
  const [comment, setComment] = useState('')
  const [refKind, setRefKind] = useState('github-repo')
  const [refExt, setRefExt] = useState('')
  const [refDisplay, setRefDisplay] = useState('')
  const [refUrl, setRefUrl] = useState('')
  const [addingRef, setAddingRef] = useState(false)

  // 切换卡片时同步本地状态
  useEffect(() => {
    setTitle(props.card.title)
    setDescription(props.card.description || '')
    setContent(Array.isArray(props.card.content) ? props.card.content : [])
  }, [props.card.id])

  // 自动保存：内容变更立即提交（动态 client 半无 setTimeout，不做防抖；
  // 切换卡片时首帧跳过，避免把上一张卡的内容写回新卡）
  const skipSave = useRef(true)
  useEffect(() => {
    skipSave.current = true
  }, [props.card.id])
  useEffect(() => {
    if (skipSave.current) {
      skipSave.current = false
      return
    }
    props.onSave(title.trim(), description, content)
  }, [title, description, content, props.card.id])

  const comments = props.card.comments || []
  const activity = props.card.activity || []
  const currentCol = props.columns.find((c) => c.cards.some((k) => k.id === props.card.id))
  const refs: any[] = props.card.refs || []
  const meta: any = props.card.meta || {}

  function submitRef() {
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
    setAddingRef(false)
  }

  return (
    <div className="kbnb-card-detail kbnb-drawer-grid">
      {/* ══ 左列：标题 + 描述 + 内容 + 评论 ══ */}
      <div className="kbnb-drawer-main">
        {/* 标题：Notion 风格，contentEditable 大标题（无 input 边框） */}
        <div className="kbnb-title-row">
          <EditableLine
            className="kbnb-input-title-editable"
            value={title}
            placeholder="卡片标题"
            onInput={setTitle}
          />
          {typeof props.onClose === 'function' ? (
            <button className="kbnb-icon-btn" type="button" title="关闭" onClick={props.onClose}>
              <IconCloseOutline16 />
            </button>
          ) : null}
        </div>

        {/* 描述：一句话纯文本（单行，不支持预览） */}
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

        {/* 内容：块富文本（Notion 式，支持图片粘贴/上传） */}
        <div className="kbnb-field">
          <div className="kbnb-field-row">
            <span className="kbnb-field-label">内容</span>
          </div>
          <RichTextEditor value={content} onChange={setContent} placeholder="输入内容或粘贴图片…" />
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
        {/* 工具/状态栏：状态切换 + 归档 + 删除 */}
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
          {typeof props.onArchive === 'function' ? (
            <button className="kbnb-btn" type="button" title="移出看板，可在侧边栏归档中找回" onClick={props.onArchive}>
              归档
            </button>
          ) : null}
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

        {/* 关联卡片（按类型管理）：git 分支/本地仓库/会话 + 新增折叠表单 + 删除 */}
        <section className="kbnb-card kbnb-refs-card">
          <header className="kbnb-card-sec-head">
            <span className="kbnb-card-sec-title">关联 {refs.length}</span>
            <button
              className="kbnb-btn kbnb-ref-add-btn"
              type="button"
              onClick={() => setAddingRef(!addingRef)}
            >
              {addingRef ? '收起' : '+ 新增'}
            </button>
          </header>

          {refs.length === 0 ? <div className="kbnb-refs-empty">暂无关联</div> : null}
          {refs.map((r) => (
            <div key={r.id} className="kbnb-ref-row">
              <span className="kbnb-ref-kind">{r.kind}</span>
              {r.kind === 'session' ? (
                <button
                  className="kbnb-ref-link kbnb-ref-session"
                  type="button"
                  title={'打开会话 ' + r.externalId}
                  onClick={() => props.onOpenSession(String(r.externalId))}
                >
                  {r.display || r.externalId}
                </button>
              ) : r.url ? (
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

          {addingRef ? (
            <div className="kbnb-ref-add">
              <select
                className="kbnb-input kbnb-ref-kind-select"
                value={refKind}
                onChange={(evt) => setRefKind(evt.target.value)}
              >
                {REF_KINDS.map((k) => (
                  <option key={k.kind} value={k.kind}>
                    {k.label}
                  </option>
                ))}
              </select>
              <input
                className="kbnb-input kbnb-ref-ext"
                value={refExt}
                onChange={(evt) => setRefExt(evt.target.value)}
                placeholder={refKind === 'session' ? '会话 id（打开会话后可从会话页复制）' : 'external id（owner/repo、MR 号、路径…）'}
              />
              <input
                className="kbnb-input kbnb-ref-display"
                value={refDisplay}
                onChange={(evt) => setRefDisplay(evt.target.value)}
                placeholder={refKind === 'session' ? '展示文本（会话标题，可选）' : '展示文本（可选）'}
              />
              {refKind !== 'session' ? (
                <input
                  className="kbnb-input kbnb-ref-url"
                  value={refUrl}
                  onChange={(evt) => setRefUrl(evt.target.value)}
                  placeholder="链接（可选）"
                />
              ) : null}
              <button className="kbnb-btn kbnb-primary" type="button" disabled={!refExt.trim()} onClick={submitRef}>
                添加
              </button>
            </div>
          ) : null}
        </section>

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
  )
}

/** 抽屉外壳：蒙层点击关闭 + 加宽；内容复用 CardDetail */
export function CardDrawer(props: {
  card: KanbanCard
  columns: KanbanColumn[]
  onSave: (title: string, description: string, content: KanbanBlock[]) => void
  onDelete: () => void
  onArchive: () => void
  onClose: () => void
  onAddComment: (text: string) => void
  onUpdateTags: (add: string[], remove: string[]) => void
  onMoveStatus: (targetColId: string) => void
  onAddRef: (ref: { kind: string; externalId: string; url?: string; display?: string }) => void
  onRemoveRef: (refId: string) => void
  onOpenSession: (sessionId: string) => void
  actionHost?: (() => unknown) | null
}) {
  return (
    <div
      className="kbnb-drawer-mask"
      onClick={(evt) => {
        // 点击蒙层（非抽屉内部）自动关闭
        if (evt.target === evt.currentTarget) props.onClose()
      }}
    >
      <aside className="kbnb-drawer">
        <CardDetail
          card={props.card}
          columns={props.columns}
          onSave={props.onSave}
          onDelete={props.onDelete}
          onArchive={props.onArchive}
          onClose={props.onClose}
          onAddComment={props.onAddComment}
          onUpdateTags={props.onUpdateTags}
          onMoveStatus={props.onMoveStatus}
          onAddRef={props.onAddRef}
          onRemoveRef={props.onRemoveRef}
          onOpenSession={props.onOpenSession}
          actionHost={props.actionHost}
        />
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
