// client/card.tsx — dsh-markdown-review 客户端(整体重写,结构分层)
// 分层:
//   §1 类型与工具函数(块参数解析 / 引用项 / 文档信息)
//   §2 MdDocCard — 对话流中的工具卡(打开按钮 + 提交摘要)
//   §3 MdViewer — 大浮窗:左栏(md 内容上 / 总评输入下)+ 右栏(审批内容清单)
//   §4 AnnotationEditor — 划词后内嵌在对应块下方的批注框(引用文字#行号 + compact 输入)
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Composer, IconBranchOutline16, IconCheckOutline16, IconCloseOutline16, IconEditOutline16 } from '@dsh-plugins/ui'
import { parseMarkdownBlocks, renderBlocks } from './md'

/* ═══════════ §1 类型与工具函数 ═══════════ */

/** 宿主 owner props 形状(tool.call.toolview keyed 槽位;与 dsh-client-ui-tool 契约一致) */
export interface ToolViewProps {
  callId: string
  toolName: string
  block: any
  cwd?: string
  openFile?: (path: string) => void
  inspect?: () => void
  t?: (key: string, params?: Record<string, unknown>) => string
}

interface QuoteItem { id: string; key: string; text: string; note: string; line?: number; lineEnd?: number }
interface DocInfo { ok: boolean; docId?: string; path?: string; title?: string; markdown?: string; error?: string }

/** 从 block 提取工具入参(running: block.argsRaw;settled: block.call.argsRaw) */
function parseArgs(block: any): any {
  const settled = block && typeof block === 'object' && 'kind' in block
  const raw = settled ? (block.call && block.call.argsRaw) : block.argsRaw
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) } catch { return {} }
  }
  return {}
}

async function postJson(url: string, body: unknown): Promise<any> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

/** 行号展示:L11 或 L11-13(单行只显示起始;agent 定位用) */
export function fmtLine(s?: number, e?: number): string {
  if (!s) return ''
  return e && e > s ? 'L' + s + '-' + e : 'L' + s
}

/* ═══════════ §2 对话流工具卡 ═══════════ */

export function MdDocCard(props: ToolViewProps) {
  const { block } = props
  const settled = block && typeof block === 'object' && 'kind' in block
  const args = useMemo(() => parseArgs(block), [block])
  const path = args && typeof args.path === 'string' ? args.path : ''
  const context = args && typeof args.context === 'string' ? args.context : ''
  const [open, setOpen] = useState(false)
  const [doc, setDoc] = useState<DocInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState<{ quotes: QuoteItem[]; comment: string } | null>(null)

  async function openDoc() {
    setLoading(true)
    setError('')
    try {
      const data = await postJson('/md-api/read', { path, title: args.title })
      if (data && data.ok) { setDoc(data); setOpen(true) } else { setError((data && data.error) || '读取失败') }
    } catch { setError('网络错误:无法读取文档') }
    setLoading(false)
  }

  /** 浮窗提交:成功关浮窗并在卡片展示摘要;失败返回原因(浮窗内就地显示) */
  async function submit(payload: { quotes: QuoteItem[]; comment: string }): Promise<{ ok: boolean; error?: string }> {
    if (!doc || !doc.docId) return { ok: false, error: '文档尚未加载完成' }
    setLoading(true)
    setError('')
    try {
      const data = await postJson('/md-api/submit', { docId: doc.docId, quotes: payload.quotes, comment: payload.comment })
      if (data && data.ok) {
        setSubmitted(payload)
        setOpen(false)
        return { ok: true }
      }
      const msg = (data && data.error) || '提交失败(可能已超时,让 agent 重新打开文档)'
      setError(msg)
      return { ok: false, error: msg }
    } catch {
      const msg = '网络错误:提交失败'
      setError(msg)
      return { ok: false, error: msg }
    } finally {
      setLoading(false)
    }
  }

  const title = (args && args.title) || (doc && doc.title) || path.split('/').pop() || '文档'

  return (
    <div className="mdr-card">
      <div className="mdr-card-head">
        <svg width={16} height={16} viewBox="0 0 16 16" fill="none" className="mdr-card-icon">
          <path d="M4 1.5h6.5L13.5 4.5v10H4c-1.1 0-2-.9-2-2v-9c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10 1.5v3h3M6 8h4M6 10.5h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="mdr-card-title">文档审阅</span>
        <span className="mdr-card-file" title={path}>{title}</span>
        <span className="mdr-card-status">{settled || submitted ? '已提交' : '待审阅'}</span>
      </div>
      {context ? <div className="mdr-card-context">{context}</div> : null}
      {error ? <div className="mdr-card-error">{error}</div> : null}
      {submitted ? (
        <div className="mdr-card-summary">
          {submitted.quotes.length > 0 ? submitted.quotes.map((q) => (
            <div key={q.id} className="mdr-card-quote">
              {q.line ? <div className="mdr-card-quote-line">{fmtLine(q.line, q.lineEnd)}</div> : null}
              <div className="mdr-card-quote-text">{q.text}</div>
              {q.note ? <div className="mdr-card-quote-note">{q.note}</div> : null}
            </div>
          )) : <div className="mdr-card-muted">无划词批注</div>}
          {submitted.comment ? <div className="mdr-card-comment">总评:{submitted.comment}</div> : null}
        </div>
      ) : !settled ? (
        <button className="mdr-btn mdr-btn-primary" type="button" disabled={loading} onClick={openDoc}>
          {loading ? '打开中…' : '打开文档'}
        </button>
      ) : <div className="mdr-card-muted">审阅已结束(结果见工具返回)</div>}
      {open && doc && doc.ok ? (
        <MdViewer doc={doc} onClose={() => setOpen(false)} onSubmit={submit} />
      ) : null}
    </div>
  )
}

/* ═══════════ §3 大浮窗 ═══════════ */

/** 布局:左栏 = md 内容(上,滚动)+ 总评输入(下,固定);右栏 = 审批内容(引用+批注清单)。蒙层点击不关闭。 */
export function MdViewer(props: { doc: DocInfo; onClose: () => void; onSubmit: (p: { quotes: QuoteItem[]; comment: string }) => Promise<{ ok: boolean; error?: string }> }) {
  const [quotes, setQuotes] = useState<QuoteItem[]>([])
  const [comment, setComment] = useState('')
  const [anchor, setAnchor] = useState<{ key: string; text: string; line?: number; lineEnd?: number } | null>(null)
  const [note, setNote] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [hint, setHint] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const blocks = useMemo(() => parseMarkdownBlocks(props.doc.markdown || ''), [props.doc])

  /** 定位原文块:滚动到可见 + 高亮闪烁(右侧标注点击/编辑用) */
  const locateBlock = (key: string) => {
    const el = contentRef.current?.querySelector('[data-mdr-key="' + key + '"]')
    if (!el) return
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    el.classList.add('mdr-block-flash')
    window.setTimeout(() => el.classList.remove('mdr-block-flash'), 1600)
  }

  /** 编辑已有标注:定位原文 + 打开批注框预填 */
  const startEdit = (q: QuoteItem) => {
    setAnchor({ key: q.key, text: q.text, line: q.line, lineEnd: q.lineEnd })
    setNote(q.note)
    setEditingId(q.id)
    locateBlock(q.key)
  }

  const cancelEdit = () => {
    setAnchor(null)
    setNote('')
    setEditingId(null)
  }

  /* ── Esc 关闭浮层(components.md §九-2) ── */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') props.onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [props.onClose])

  /* ── 划词:单块内选区 → 在该块下方嵌入批注框;跨块/mermaid 区域拒绝 ── */
  function onMouseUp(e: React.MouseEvent) {
    const target = e.target as HTMLElement
    if (target && target.closest && target.closest('[data-mdr-editor]')) return
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed) return
    const range = sel.getRangeAt(0)
    const el = contentRef.current
    if (!el || !el.contains(range.startContainer)) return
    const noselect = (n: Node): boolean => {
      const e2 = n.nodeType === 1 ? (n as HTMLElement) : n.parentElement
      return !!(e2 && e2.closest && e2.closest('[data-mdr-noselect]'))
    }
    if (noselect(range.startContainer) || noselect(range.endContainer)) return
    const nodeOf = (n: Node): HTMLElement | null => {
      const e2 = n.nodeType === 1 ? (n as HTMLElement) : n.parentElement
      return e2 && e2.closest ? e2.closest('[data-mdr-block]') : null
    }
    const startBlock = nodeOf(range.startContainer)
    const endBlock = nodeOf(range.endContainer)
    if (!startBlock || !endBlock) { setAnchor(null); return }
    if (startBlock !== endBlock) {
      setAnchor(null)
      setHint('划词请保持在同一段落内(不能跨段落/跨块/跨表格)')
      return
    }
    const text = sel.toString().trim()
    if (!text) return
    const lineNum = Number(startBlock.getAttribute('data-mdr-line') || 0) || undefined
    const lineEndNum = Number(startBlock.getAttribute('data-mdr-line-end') || 0) || undefined
    cancelEdit()
    setAnchor({ key: String(startBlock.getAttribute('data-mdr-key') || ''), text: text.slice(0, 400), line: lineNum, lineEnd: lineEndNum })
    setNote('')
    setHint('')
    sel.removeAllRanges()
  }

  function addQuote() {
    if (!anchor) return
    const next = { text: anchor.text, note: note.trim(), line: anchor.line, lineEnd: anchor.lineEnd }
    if (editingId) {
      setQuotes((prev) => prev.map((x) => (x.id === editingId ? { ...x, ...next } : x)))
    } else {
      const id = 'q' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
      setQuotes((prev) => [...prev, { id, key: anchor.key, ...next }])
    }
    setAnchor(null)
    setNote('')
    setEditingId(null)
  }

  async function doSubmit() {
    if (submitting) return
    if (quotes.length === 0 && !comment.trim()) return
    setSubmitting(true)
    setSubmitError('')
    const r = await props.onSubmit({ quotes, comment: comment.trim() })
    if (r && !r.ok) setSubmitError(r.error || '提交失败')
    setSubmitting(false)
  }

  const extra = useMemo(() => {
    const m = new Map<string, React.ReactNode>()
    if (anchor) {
      m.set(anchor.key, <AnnotationEditor text={anchor.text} line={anchor.line} lineEnd={anchor.lineEnd} note={note} editing={!!editingId} onNote={setNote} onAdd={addQuote} onCancel={cancelEdit} />)
    }
    return m
  }, [anchor, note, editingId])

  const canSubmit = !submitting && (quotes.length > 0 || comment.trim() !== '')

  return (
    <div className="mdr-mask">
      <div className="mdr-viewer">
        <header className="mdr-viewer-head">
          <span className="mdr-viewer-title">{props.doc.title || '文档'}</span>
          <span className="mdr-viewer-path" title={props.doc.path || ''}>{props.doc.path || ''}</span>
          <span className="mdr-viewer-hint">选中正文即可划词批注</span>
          <button className="mdr-icon-btn" type="button" title="关闭" aria-label="关闭" onClick={props.onClose}>
            <IconCloseOutline16 />
          </button>
        </header>
        {hint ? <div className="mdr-hint">{hint}</div> : null}
        {submitError ? <div className="mdr-hint mdr-submit-error">{submitError}</div> : null}
        <div className="mdr-viewer-body">
          {/* 左栏:上 md 内容 / 下 总评输入 */}
          <div className="mdr-main">
            <div className="mdr-content" ref={contentRef} onMouseUp={onMouseUp}>
              {renderBlocks(blocks, extra)}
            </div>
            <div className="mdr-main-input">
              <Composer
                value={comment}
                onChange={setComment}
                placeholder="总评(可选):整体意见…"
                onSubmit={doSubmit}
                actions={
                  <>
                    <button className="mdr-icon-btn" type="button" title="取消" aria-label="取消" onClick={props.onClose}>
                      <IconCloseOutline16 />
                    </button>
                    <button className="mdr-icon-btn mdr-icon-confirm" type="button" title="提交" aria-label="提交" disabled={!canSubmit} onClick={doSubmit}>
                      <IconCheckOutline16 />
                    </button>
                  </>
                }
              />
            </div>
          </div>
          {/* 右栏:审批内容 */}
          <aside className="mdr-quotes">
            <div className="mdr-quotes-title">审批内容 {quotes.length}</div>
            {quotes.length === 0 ? <div className="mdr-card-muted">划词后批注会累积到这里</div> : null}
            {quotes.map((q) => (
              <div key={q.id} className="mdr-quote-item">
                <div className="mdr-quote-line">
                  {q.line ? fmtLine(q.line, q.lineEnd) : null}
                  <span className="mdr-quote-ops">
                    <button className="mdr-icon-btn mdr-quote-op" type="button" title="定位到原文" aria-label="定位到原文" onClick={() => locateBlock(q.key)}>
                      <IconBranchOutline16 />
                    </button>
                    <button className="mdr-icon-btn mdr-quote-op" type="button" title="编辑这条批注" aria-label="编辑这条批注" onClick={() => startEdit(q)}>
                      <IconEditOutline16 />
                    </button>
                    <button className="mdr-icon-btn mdr-quote-op" type="button" title="删除这条引用" aria-label="删除这条引用" onClick={() => setQuotes((prev) => prev.filter((x) => x.id !== q.id))}>
                      <IconCloseOutline16 />
                    </button>
                  </span>
                </div>
                <div className="mdr-quote-text">{q.text}</div>
                {q.note ? <div className="mdr-quote-note">{q.note}</div> : <div className="mdr-card-muted">(无批注)</div>}
              </div>
            ))}
          </aside>
        </div>
      </div>
    </div>
  )
}

/* ═══════════ §4 划词批注框(嵌段落下方;左:选中原文 / 右:批注输入+icon 按钮) ═══════════ */

/** 批注框:内嵌在对应块下方(文档流,无层级/遮挡问题);灰底 bluish-50 + 行号纯文字 + compact 输入 */
function AnnotationEditor(props: { text: string; line?: number; lineEnd?: number; note: string; editing?: boolean; onNote: (v: string) => void; onAdd: () => void; onCancel: () => void }) {
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (ref.current) ref.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [])
  const lineLabel = props.line ? (props.lineEnd && props.lineEnd > props.line ? 'L' + props.line + '-' + props.lineEnd : 'L' + props.line) : ''
  return (
    <div className="mdr-editor" data-mdr-editor ref={ref}>
      <div className="mdr-editor-quote">
        {props.text}
        {lineLabel ? <span className="mdr-editor-line">#{lineLabel}</span> : null}
      </div>
      <Composer
        value={props.note}
        onChange={props.onNote}
        placeholder="对这段的批注…"
        autoFocus
        compact
        onSubmit={props.onAdd}
        actions={
          <>
            <button className="mdr-icon-btn" type="button" title="取消" aria-label="取消" onClick={props.onCancel}>
              <IconCloseOutline16 />
            </button>
            <button className="mdr-icon-btn mdr-icon-confirm" type="button" title={props.editing ? '保存修改' : '添加批注'} aria-label={props.editing ? '保存修改' : '添加批注'} onClick={props.onAdd}>
              <IconCheckOutline16 />
            </button>
          </>
        }
      />
    </div>
  )
}
