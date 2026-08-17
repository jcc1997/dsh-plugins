// client/drawer.tsx — Ticket抽屉：左列主内容（标题+描述+富文本内容+评论）+ 右侧栏（drawer-side.tsx）
// 标题/描述用 contentEditable（Notion 式，无 input 边框）；内容用块富文本编辑器（含图片）
// 蒙层点击自动关闭；改动自动保存（无防抖，切换Ticket首帧跳过）
import React, { useEffect, useRef, useState } from 'react'
import { IconCloseOutline16, fmtTime, useEscClose } from '@dsh-plugins/ui'
import { KanbanTicket, KanbanColumn, KanbanBlock } from '@dsh-plugins/ui'
import { RichTextEditor } from './rich-text'
import { DrawerSide } from './drawer-side'
import { TicketGate } from '@dsh-plugins/ui'

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
  // 外部值回写：仅当未聚焦且 DOM 与期望不一致时（聚焦中由用户输入为准）
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

export function TicketDetail(props: {
  ticket: KanbanTicket
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
  gateLibrary?: TicketGate[]
  onAddGate?: (gateId: string) => void
  onRemoveGate?: (gateId: string) => void
  onOpenGatesView?: () => void
  actionHost?: (() => React.ReactNode) | null
}) {
  const [title, setTitle] = useState(props.ticket.title)
  const [description, setDescription] = useState(props.ticket.description || '')
  const [content, setContent] = useState<KanbanBlock[]>(Array.isArray(props.ticket.content) ? props.ticket.content : [])
  const [comment, setComment] = useState('')

  // 切换Ticket时同步本地状态（抽屉按 ticketId key 重建，此处兜底会话面板场景）
  useEffect(() => {
    setTitle(props.ticket.title)
    setDescription(props.ticket.description || '')
    setContent(Array.isArray(props.ticket.content) ? props.ticket.content : [])
  }, [props.ticket.id])

  // 自动保存：内容变更立即提交（动态 client 半无 setTimeout，不做防抖；
  // 切换Ticket时首帧跳过，避免把上一张卡的内容写回新卡）
  const skipSave = useRef(true)
  useEffect(() => {
    skipSave.current = true
  }, [props.ticket.id])
  useEffect(() => {
    if (skipSave.current) {
      skipSave.current = false
      return
    }
    props.onSave(title.trim(), description, content)
  }, [title, description, content, props.ticket.id])

  const comments = props.ticket.comments || []

  return (
    <div className="kbnb-ticket-detail kbnb-drawer-grid">
      {/* ══ 左列：标题 + 描述 + 内容 + 评论 ══ */}
      <div className="kbnb-drawer-main">
        {/* 标题：Notion 风格，contentEditable 大标题（无 input 边框） */}
        <div className="kbnb-title-row">
          <EditableLine className="kbnb-input-title-editable" value={title} placeholder="Ticket标题" onInput={setTitle} />
          {typeof props.onClose === 'function' ? (
            <button className="kbnb-icon-btn" type="button" title="关闭" onClick={props.onClose}>
              <IconCloseOutline16 />
            </button>
          ) : null}
        </div>

        {/* 描述：一句话纯文本（单行，无小标题，placeholder 即提示） */}
        <div className="kbnb-field">
          <EditableLine
            className="kbnb-input-desc-editable"
            value={description}
            placeholder="描述（一句话）"
            singleLine
            onInput={setDescription}
          />
        </div>

        {/* 内容：块富文本（Notion 式无边框，支持图片粘贴/上传；placeholder 即提示） */}
        <div className="kbnb-field">
          <RichTextEditor value={content} onChange={setContent} placeholder="内容…" />
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

      {/* ══ 右列（drawer-side.tsx）：状态 + 标签 + 关联Ticket + 门禁 + 变更记录 ══ */}
      <DrawerSide
        ticket={props.ticket}
        columns={props.columns}
        onMoveStatus={props.onMoveStatus}
        onDelete={props.onDelete || (() => {})}
        onArchive={props.onArchive}
        onUpdateTags={props.onUpdateTags}
        onAddRef={props.onAddRef}
        onRemoveRef={props.onRemoveRef}
        onOpenSession={props.onOpenSession}
        gateLibrary={props.gateLibrary}
        onAddGate={props.onAddGate}
        onRemoveGate={props.onRemoveGate}
        onOpenGatesView={props.onOpenGatesView}
        actionHost={props.actionHost}
      />
    </div>
  )
}

/** 抽屉外壳：蒙层点击关闭 + 加宽；内容复用 TicketDetail */
export function TicketDrawer(props: {
  ticket: KanbanTicket
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
  gateLibrary?: TicketGate[]
  onAddGate?: (gateId: string) => void
  onRemoveGate?: (gateId: string) => void
  onOpenGatesView?: () => void
  actionHost?: (() => React.ReactNode) | null
}) {
  useEscClose(true, props.onClose)
  return (
    <div className="kbnb-drawer-mask">
      <aside className="kbnb-drawer">
        <TicketDetail
          ticket={props.ticket}
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
          gateLibrary={props.gateLibrary}
          onAddGate={props.onAddGate}
          onRemoveGate={props.onRemoveGate}
          onOpenGatesView={props.onOpenGatesView}
          actionHost={props.actionHost}
        />
      </aside>
    </div>
  )
}
