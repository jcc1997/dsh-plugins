// client/card.tsx — 对话流中的 markdown 文档审阅卡片(tool.call.toolview keyed 槽位)
// 运行中:显示「打开文档」按钮;点开 → 大浮窗渲染 markdown(含 mermaid);
// 划词 → 批注输入框嵌入对应段落下方;右侧引用清单;底部总评;提交/取消。
// 提交:POST /md-api/submit → 宿主 resolve 挂起的 md_doc_open 工具执行 → agent 自动继续;卡片就地展示提交内容。
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { parseMarkdownBlocks, renderBlocks } from './md'

/** 宿主 owner props 形状(与 dsh-client-ui-tool 契约一致,同 pipeline 工具卡) */
export interface ToolViewProps {
  callId: string
  toolName: string
  block: any
  cwd?: string
  openFile?: (path: string) => void
  inspect?: () => void
  t?: (key: string, params?: Record<string, unknown>) => string
}

function parseArgs(block: any): any {
  const settled = block && typeof block === 'object' && 'kind' in block
  const raw = settled ? (block.call && block.call.argsRaw) : block.argsRaw
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) } catch { return {} }
  }
  return {}
}

interface QuoteItem { id: string; text: string; note: string }
interface DocInfo { ok: boolean; docId?: string; path?: string; title?: string; markdown?: string; error?: string }

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
      const res = await fetch('/md-api/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, title: args.title }),
      })
      const data = await res.json()
      if (data && data.ok) { setDoc(data); setOpen(true) } else { setError((data && data.error) || '读取失败') }
    } catch { setError('网络错误:无法读取文档') }
    setLoading(false)
  }

  async function submit(payload: { quotes: QuoteItem[]; comment: string }) {
    if (!doc || !doc.docId) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/md-api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docId: doc.docId, quotes: payload.quotes, comment: payload.comment }),
      })
      const data = await res.json()
      if (data && data.ok) {
        setSubmitted(payload)
        setOpen(false)
      } else {
        setError((data && data.error) || '提交失败(可能已超时,让 agent 重新打开文档)')
      }
    } catch { setError('网络错误:提交失败') }
    setLoading(false)
  }

  const title = (args && args.title) || (doc && doc.title) || path.split('/').pop() || '文档'

  return (
    <div className="mdr-card">
      <div className="mdr-card-head">
        <svg width={14} height={14} viewBox="0 0 16 16" fill="none" className="mdr-card-icon">
          <path d="M4 1.5h6.5L13.5 4.5v10H4c-1.1 0-2-.9-2-2v-9c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M10 1.5v3h3M6 8h4M6 10.5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
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
              <div className="mdr-card-quote-text">{q.text}</div>
              {q.note ? <div className="mdr-card-quote-note">{q.note}</div> : null}
            </div>
          )) : <div className="mdr-card-muted">无划词批注</div>}
          {submitted.comment ? <div className="mdr-card-comment">总评:{submitted.comment}</div> : null}
        </div>
      ) : !settled ? (
        <button className="mdr-btn mdr-btn-primary" type="button" disabled={loading} onClick={openDoc}>
          {loading ? '打开中…' : '打开文档'}{' '}
        </button>
      ) : <div className="mdr-card-muted">审阅已结束(结果见工具返回)</div>}
      {open && doc && doc.ok ? (
        <MdViewer doc={doc} onClose={() => setOpen(false)} onSubmit={submit} />
      ) : null}
    </div>
  )
}

/** 嵌入段落下方的批注输入框(划词锚定块之后) */
function AnnotationEditor(props: { text: string; note: string; onNote: (v: string) => void; onAdd: () => void; onCancel: () => void }) {
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (ref.current) ref.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [])
  return (
    <div className="mdr-editor" data-mdr-editor ref={ref}>
      <div className="mdr-editor-quote">{props.text}</div>
      <textarea
        className="mdr-editor-input"
        value={props.note}
        onChange={(e) => props.onNote(e.target.value)}
        placeholder="对这段的批注…"
        rows={2}
        autoFocus
      />
      <div className="mdr-editor-btns">
        <button className="mdr-btn" type="button" onClick={props.onCancel}>取消</button>
        <button className="mdr-btn mdr-btn-primary" type="button" onClick={props.onAdd}>添加批注</button>
      </div>
    </div>
  )
}

/** 大浮窗:左正文(划词 → 段落下方批注)+ 右引用清单 + 底部总评/提交 */
function MdViewer(props: { doc: DocInfo; onClose: () => void; onSubmit: (p: { quotes: QuoteItem[]; comment: string }) => void }) {
  const [quotes, setQuotes] = useState<QuoteItem[]>([])
  const [comment, setComment] = useState('')
  const [anchor, setAnchor] = useState<{ key: string; text: string } | null>(null)
  const [note, setNote] = useState('')
  const [hint, setHint] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const blocks = useMemo(() => parseMarkdownBlocks(props.doc.markdown || ''), [props.doc])

  function onMouseUp(e: React.MouseEvent) {
    const target = e.target as HTMLElement
    if (target && target.closest && target.closest('[data-mdr-editor]')) return
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed) return
    const range = sel.getRangeAt(0)
    const el = contentRef.current
    if (!el || !el.contains(range.startContainer)) return
    // 选区不得落在不可引用的区域(mermaid 图等)
    if (range.startContainer.nodeType === 1 && (range.startContainer as HTMLElement).closest && (range.startContainer as HTMLElement).closest('[data-mdr-noselect]')) return
    if (range.endContainer.nodeType === 1 && (range.endContainer as HTMLElement).closest && (range.endContainer as HTMLElement).closest('[data-mdr-noselect]')) return
    const nodeOf = (n: Node): HTMLElement | null => {
      const e = n.nodeType === 1 ? (n as HTMLElement) : n.parentElement
      return e && e.closest ? e.closest('[data-mdr-block]') : null
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
    setAnchor({ key: String(startBlock.getAttribute('data-mdr-key') || ''), text: text.slice(0, 400) })
    setNote('')
    setHint('')
    sel.removeAllRanges()
  }

  function addQuote() {
    if (!anchor) return
    setQuotes((prev) => [...prev, { id: 'q' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), text: anchor.text, note: note.trim() }])
    setAnchor(null)
    setNote('')
  }

  async function doSubmit() {
    if (submitting) return
    if (quotes.length === 0 && !comment.trim()) return
    setSubmitting(true)
    await props.onSubmit({ quotes, comment: comment.trim() })
    setSubmitting(false)
  }

  const extra = useMemo(() => {
    const m = new Map<string, React.ReactNode>()
    if (anchor) {
      m.set(anchor.key, <AnnotationEditor text={anchor.text} note={note} onNote={setNote} onAdd={addQuote} onCancel={() => setAnchor(null)} />)
    }
    return m
  }, [anchor, note])

  return (
    <div className="mdr-mask" onClick={(e) => { if (e.target === e.currentTarget) props.onClose() }}>
      <div className="mdr-viewer">
        <header className="mdr-viewer-head">
          <span className="mdr-viewer-title">{props.doc.title || '文档'}</span>
          <span className="mdr-viewer-path" title={props.doc.path || ''}>{props.doc.path || ''}</span>
          <span className="mdr-viewer-hint">选中正文即可划词批注</span>
          <button className="mdr-icon-btn" type="button" title="关闭" onClick={props.onClose}>×</button>
        </header>
        {hint ? <div className="mdr-hint">{hint}</div> : null}
        <div className="mdr-viewer-body">
          <div className="mdr-content" ref={contentRef} onMouseUp={onMouseUp}>
            {renderBlocks(blocks, extra)}
          </div>
          <aside className="mdr-quotes">
            <div className="mdr-quotes-title">引用批注 {quotes.length}</div>
            {quotes.length === 0 ? <div className="mdr-card-muted">划词后在此累积引用</div> : null}
            {quotes.map((q) => (
              <div key={q.id} className="mdr-quote-item">
                <div className="mdr-quote-text">{q.text}</div>
                {q.note ? <div className="mdr-quote-note">{q.note}</div> : <div className="mdr-card-muted">(无批注)</div>}
                <button className="mdr-icon-btn mdr-quote-x" type="button" title="删除这条引用" onClick={() => setQuotes((prev) => prev.filter((x) => x.id !== q.id))}>×</button>
              </div>
            ))}
          </aside>
        </div>
        <footer className="mdr-viewer-foot">
          <textarea className="mdr-comment-input" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="总评(可选):整体意见…" rows={2} />
          <button className="mdr-btn" type="button" onClick={props.onClose}>取消</button>
          <button className="mdr-btn mdr-btn-primary" type="button" disabled={submitting || (quotes.length === 0 && !comment.trim())} onClick={doSubmit}>
            {submitting ? '提交中…' : '提交'}{' '}
          </button>
        </footer>
      </div>
    </div>
  )
}
