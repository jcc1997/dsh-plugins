// client/md.tsx — 极简 markdown 渲染器(自实现;mermaid 用官方库渲染)
// 支持:h1-h6、粗体/斜体/删除线、行内代码、代码块、引用、无序/有序列表(两层嵌套)、分隔线、表格、链接、段落、mermaid 图。
// 块模型:每个可锚定块带 data-mdr-block/data-mdr-key,供划词批注「嵌入对应段落下方」。
import React, { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** 行内解析:**bold** *italic* `code` ~~strike~~ [text](url);单层递归(粗体内可再解析行内) */
function renderInline(text: string, keyPrefix: string, depth = 0): React.ReactNode[] {
  const out: React.ReactNode[] = []
  const re = /(!\[[^\]]+\]\([^)]+\)|`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|~~[^~]+~~|\[[^\]]+\]\([^)]+\))/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(esc(text.slice(last, m.index)))
    const tok = m[0]
    const key = keyPrefix + '-i' + i++
    if (tok.startsWith('![')) {
      const im = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(tok)
      if (im) {
        out.push(<img key={key} className="mdr-img" src={esc(im[2])} alt={esc(im[1] || 'image')} loading="lazy" />)
      } else {
        out.push(esc(tok))
      }
    } else if (tok.startsWith('`')) {
      out.push(<code key={key} className="mdr-inline-code">{esc(tok.slice(1, -1))}</code>)
    } else if (tok.startsWith('**') || tok.startsWith('__')) {
      const inner = tok.slice(2, -2)
      out.push(depth < 2 ? <strong key={key} className="mdr-b">{renderInline(inner, key, depth + 1)}</strong> : <strong key={key}>{esc(inner)}</strong>)
    } else if (tok.startsWith('*')) {
      const inner = tok.slice(1, -1)
      out.push(depth < 2 ? <em key={key} className="mdr-i">{renderInline(inner, key, depth + 1)}</em> : <em key={key}>{esc(inner)}</em>)
    } else if (tok.startsWith('~~')) {
      out.push(<del key={key} className="mdr-del">{esc(tok.slice(2, -2))}</del>)
    } else {
      const lm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok)
      if (lm) {
        out.push(<a key={key} className="mdr-a" href={esc(lm[2])} target="_blank" rel="noreferrer">{esc(lm[1])}</a>)
      } else {
        out.push(esc(tok))
      }
    }
    last = m.index + tok.length
  }
  if (last < text.length) out.push(esc(text.slice(last)))
  return out
}

export interface ListItem { text: string; ordered: boolean; indent: number }
export interface MdBlock {
  key: string
  kind: 'p' | 'h' | 'pre' | 'quote' | 'list' | 'table' | 'hr' | 'mermaid'
  text?: string
  level?: number
  lang?: string
  code?: string
  items?: ListItem[]
  head?: string[]
  rows?: string[][]
}

/** markdown → 块序列(可锚定块 key 为 'b<index>') */
export function parseMarkdownBlocks(md: string): MdBlock[] {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const out: MdBlock[] = []
  let i = 0
  let idx = 0
  let para: string[] = []
  const flushPara = () => {
    if (para.length > 0) {
      out.push({ key: 'b' + idx++, kind: 'p', text: para.join(' ') })
      para = []
    }
  }
  const cellsOf = (row: string) => row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim())
  while (i < lines.length) {
    const line = lines[i]
    // 代码块(含 mermaid)
    if (line.trimStart().startsWith('```')) {
      flushPara()
      const lang = line.trimStart().slice(3).trim().toLowerCase()
      const buf: string[] = []
      i += 1
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) { buf.push(lines[i]); i += 1 }
      i += 1
      if (lang === 'mermaid') out.push({ key: 'b' + idx++, kind: 'mermaid', code: buf.join('\n') })
      else out.push({ key: 'b' + idx++, kind: 'pre', lang, code: buf.join('\n') })
      continue
    }
    // 标题
    const hm = /^(#{1,6})\s+(.*)$/.exec(line)
    if (hm) { flushPara(); out.push({ key: 'b' + idx++, kind: 'h', level: hm[1].length, text: hm[2] }); i += 1; continue }
    // 分隔线
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { flushPara(); out.push({ key: 'b' + idx++, kind: 'hr' }); i += 1; continue }
    // 引用
    if (/^\s*>/.test(line)) {
      flushPara()
      const buf: string[] = []
      while (i < lines.length && /^\s*>/.test(lines[i])) { buf.push(lines[i].replace(/^\s*>\s?/, '')); i += 1 }
      out.push({ key: 'b' + idx++, kind: 'quote', text: buf.join(' ') })
      continue
    }
    // 表格
    if (line.indexOf('|') >= 0 && i + 1 < lines.length) {
      const sep = lines[i + 1]
      if (/^\s*\|?[\s:|-]+\|?\s*$/.test(sep) && sep.indexOf('-') >= 0) {
        flushPara()
        const head = cellsOf(line)
        const rows: string[][] = []
        let j = i + 2
        while (j < lines.length && lines[j].trim().startsWith('|')) { rows.push(cellsOf(lines[j])); j += 1 }
        out.push({ key: 'b' + idx++, kind: 'table', head, rows })
        i = j
        continue
      }
    }
    // 列表
    if (/^\s*([-*]\s+|\d+[.)]\s+)/.test(line)) {
      flushPara()
      const items: ListItem[] = []
      while (i < lines.length) {
        const um = /^(\s*)[-*]\s+(.*)$/.exec(lines[i])
        const om = /^(\s*)\d+[.)]\s+(.*)$/.exec(lines[i])
        if (um) items.push({ text: um[2], ordered: false, indent: um[1].length })
        else if (om) items.push({ text: om[2], ordered: true, indent: om[1].length })
        else break
        i += 1
      }
      out.push({ key: 'b' + idx++, kind: 'list', items })
      continue
    }
    // 空行 → 段落结束
    if (line.trim() === '') { flushPara(); i += 1; continue }
    para.push(line.trim())
    i += 1
  }
  flushPara()
  return out
}

/** mermaid 代码块:官方库渲染,失败降级为原文 + 错误提示 */
function MermaidBlock(props: { code: string }) {
  const [svg, setSvg] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    let stopped = false
    const dark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    const id = 'mdr-mmd-' + Math.random().toString(36).slice(2, 10)
    try {
      mermaid.initialize({ startOnLoad: false, theme: dark ? 'dark' : 'default', securityLevel: 'strict' })
      mermaid.render(id, props.code).then((res) => {
        if (stopped) return
        setSvg(res.svg)
        setError('')
      }).catch((e) => {
        if (stopped) return
        setError(String(e && e.message ? e.message : e))
      })
    } catch (e) {
      if (!stopped) setError(String((e as Error).message || e))
    }
    return () => { stopped = true }
  }, [props.code])
  return (
    <div className="mdr-mermaid" data-mdr-noselect>
      <div className="mdr-pre-lang">mermaid</div>
      {svg ? <div className="mdr-mermaid-svg" dangerouslySetInnerHTML={{ __html: svg }} /> : null}
      {error ? (
        <div className="mdr-mermaid-err">
          <div className="mdr-card-error">mermaid 渲染失败:{error}</div>
          <pre className="mdr-pre"><code>{props.code}</code></pre>
        </div>
      ) : null}
      {!svg && !error ? <div className="mdr-card-muted">渲染图中…</div> : null}
    </div>
  )
}

/** 块 → React 节点;extra 按块 key 在对应块下方注入节点(划词批注输入框) */
export function renderBlocks(blocks: MdBlock[], extra?: Map<string, React.ReactNode>): React.ReactNode[] {
  const out: React.ReactNode[] = []
  let liSeq = 0
  const renderItems = (items: ListItem[], blockKey: string): React.ReactNode[] => {
    const result: React.ReactNode[] = []
    let idx = 0
    while (idx < items.length) {
      const item = items[idx]
      const liKey = blockKey + '-li' + liSeq++
      const children: ListItem[] = []
      let j = idx + 1
      while (j < items.length && items[j].indent > item.indent) { children.push(items[j]); j += 1 }
      const content: React.ReactNode[] = renderInline(item.text, liKey)
      if (children.length > 0) content.push(renderItems(children, blockKey))
      result.push(<li key={liKey} className="mdr-li" data-mdr-block data-mdr-key={liKey}>{content}</li>)
      const ex = extra && extra.get(liKey)
      if (ex) result.push(<div key={liKey + '-ex'} className="mdr-editor-slot">{ex}</div>)
      idx = j
    }
    return result
  }
  for (const b of blocks) {
    let node: React.ReactNode = null
    if (b.kind === 'p') {
      node = <p key={b.key} className="mdr-p" data-mdr-block data-mdr-key={b.key}>{renderInline(b.text || '', b.key)}</p>
    } else if (b.kind === 'h') {
      const Tag = ('h' + (b.level || 1)) as 'h1'
      node = <Tag key={b.key} className={'mdr-h mdr-h' + (b.level || 1)} data-mdr-block data-mdr-key={b.key}>{renderInline(b.text || '', b.key)}</Tag>
    } else if (b.kind === 'pre') {
      node = (
        <pre key={b.key} className="mdr-pre" data-mdr-block data-mdr-key={b.key}>
          {b.lang ? <div className="mdr-pre-lang">{esc(b.lang)}</div> : null}
          <code>{b.code || ''}</code>
        </pre>
      )
    } else if (b.kind === 'quote') {
      node = <blockquote key={b.key} className="mdr-quote" data-mdr-block data-mdr-key={b.key}>{renderInline(b.text || '', b.key)}</blockquote>
    } else if (b.kind === 'list') {
      const ordered = (b.items || []).length > 0 && b.items![0].ordered
      node = ordered
        ? <ol key={b.key} className="mdr-ol">{renderItems(b.items || [], b.key)}</ol>
        : <ul key={b.key} className="mdr-ul">{renderItems(b.items || [], b.key)}</ul>
    } else if (b.kind === 'table') {
      node = (
        <div key={b.key} className="mdr-table-wrap" data-mdr-block data-mdr-key={b.key}>
          <table className="mdr-table">
            <thead><tr>{(b.head || []).map((h, k) => <th key={k} className="mdr-th">{renderInline(h, 'th' + k)}</th>)}</tr></thead>
            <tbody>{(b.rows || []).map((r, ri) => <tr key={ri}>{r.map((c, ci) => <td key={ci} className="mdr-td">{renderInline(c, 'td' + ri + '-' + ci)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )
    } else if (b.kind === 'hr') {
      node = <hr key={b.key} className="mdr-hr" />
    } else if (b.kind === 'mermaid') {
      node = <MermaidBlock key={b.key} code={b.code || ''} />
    }
    if (node) {
      out.push(node)
      const ex = extra && extra.get(b.key)
      if (ex) out.push(<div key={b.key + '-ex'} className="mdr-editor-slot">{ex}</div>)
    }
  }
  return out
}
