// client/md.tsx — 极简 markdown 渲染器(自实现,无第三方依赖,不产生 dangerouslySetInnerHTML)
// 支持:h1-h6、粗体/斜体/删除线、行内代码、代码块、引用、无序/有序列表(两层嵌套)、分隔线、表格、链接、段落。
import React from 'react'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** 行内解析:**bold** *italic* `code` ~~strike~~ [text](url);单层递归(粗体内可再解析行内) */
function renderInline(text: string, keyPrefix: string, depth = 0): React.ReactNode[] {
  const out: React.ReactNode[] = []
  const re = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|~~[^~]+~~|\[[^\]]+\]\([^)]+\))/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(esc(text.slice(last, m.index)))
    const tok = m[0]
    const key = keyPrefix + '-i' + i++
    if (tok.startsWith('`')) {
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

/** 列表块解析:按缩进构建两层嵌套列表 */
function renderList(lines: string[], start: number): { nodes: React.ReactNode; next: number } {
  const items: Array<{ text: string; ordered: boolean; indent: number }> = []
  let i = start
  while (i < lines.length) {
    const line = lines[i]
    const um = /^(\s*)[-*]\s+(.*)$/.exec(line)
    const om = /^(\s*)\d+[.)]\s+(.*)$/.exec(line)
    if (um) items.push({ text: um[2], ordered: false, indent: um[1].length })
    else if (om) items.push({ text: om[2], ordered: true, indent: om[1].length })
    else break
    i += 1
  }
  const build = (list: typeof items): React.ReactNode[] => {
    const out: React.ReactNode[] = []
    let idx = 0
    while (idx < list.length) {
      const item = list[idx]
      const children: typeof items = []
      let j = idx + 1
      while (j < list.length && list[j].indent > item.indent) { children.push(list[j]); j += 1 }
      const content: React.ReactNode[] = renderInline(item.text, 'li' + idx)
      if (children.length > 0) content.push(build(children))
      out.push(<li key={idx} className="mdr-li">{content}</li>)
      idx = j
    }
    return out
  }
  const ordered = items.length > 0 && items[0].ordered
  return { nodes: ordered ? <ol className="mdr-ol">{build(items)}</ol> : <ul className="mdr-ul">{build(items)}</ul>, next: i }
}

/** 表格解析(首个 | 行 + 分隔行) */
function tryTable(lines: string[], i: number): { node: React.ReactNode; next: number } | null {
  const first = lines[i]
  if (!first || first.indexOf('|') < 0 || i + 1 >= lines.length) return null
  const sep = lines[i + 1]
  if (!/^\s*\|?[\s:|-]+\|?\s*$/.test(sep) || sep.indexOf('-') < 0) return null
  const cells = (row: string) => row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim())
  const head = cells(first)
  const rows: string[][] = []
  let j = i + 2
  while (j < lines.length && lines[j].trim().startsWith('|')) { rows.push(cells(lines[j])); j += 1 }
  return {
    node: (
      <table className="mdr-table">
        <thead><tr>{head.map((h, k) => <th key={k} className="mdr-th">{renderInline(h, 'th' + k)}</th>)}</tr></thead>
        <tbody>{rows.map((r, ri) => <tr key={ri}>{r.map((c, ci) => <td key={ci} className="mdr-td">{renderInline(c, 'td' + ri + '-' + ci)}</td>)}</tr>)}</tbody>
      </table>
    ),
    next: j,
  }
}

/** markdown → React 节点 */
export function renderMarkdown(md: string): React.ReactNode[] {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const out: React.ReactNode[] = []
  let i = 0
  let key = 0
  let para: string[] = []
  const flushPara = () => {
    if (para.length > 0) {
      const text = para.join(' ')
      out.push(<p key={'p' + key++} className="mdr-p">{renderInline(text, 'p' + key)}</p>)
      para = []
    }
  }
  while (i < lines.length) {
    const line = lines[i]
    // 代码块
    if (line.trimStart().startsWith('```')) {
      flushPara()
      const lang = line.trimStart().slice(3).trim()
      const buf: string[] = []
      i += 1
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) { buf.push(lines[i]); i += 1 }
      i += 1
      if (lang) {
        out.push(<pre key={'pre' + key++} className="mdr-pre"><div className="mdr-pre-lang">{esc(lang)}</div><code>{buf.join('\n')}</code></pre>)
      } else {
        out.push(<pre key={'pre' + key++} className="mdr-pre"><code>{buf.join('\n')}</code></pre>)
      }
      continue
    }
    // 标题
    const hm = /^(#{1,6})\s+(.*)$/.exec(line)
    if (hm) {
      flushPara()
      const level = hm[1].length
      const Tag = ('h' + level) as 'h1'
      out.push(<Tag key={'h' + key++} className={'mdr-h mdr-h' + level}>{renderInline(hm[2], 'h' + key)}</Tag>)
      i += 1
      continue
    }
    // 分隔线
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { flushPara(); out.push(<hr key={'hr' + key++} className="mdr-hr" />); i += 1; continue }
    // 引用
    if (/^\s*>/.test(line)) {
      flushPara()
      const buf: string[] = []
      while (i < lines.length && /^\s*>/.test(lines[i])) { buf.push(lines[i].replace(/^\s*>\s?/, '')); i += 1 }
      out.push(<blockquote key={'q' + key++} className="mdr-quote">{renderInline(buf.join(' '), 'q' + key)}</blockquote>)
      continue
    }
    // 表格
    const tbl = tryTable(lines, i)
    if (tbl) { flushPara(); out.push(<div key={'tbl' + key++} className="mdr-table-wrap">{tbl.node}</div>); i = tbl.next; continue }
    // 列表
    if (/^\s*([-*]\s+|\d+[.)]\s+)/.test(line)) {
      flushPara()
      const lst = renderList(lines, i)
      out.push(<div key={'l' + key++} className="mdr-list">{lst.nodes}</div>)
      i = lst.next
      continue
    }
    // 空行 → 段落结束
    if (line.trim() === '') { flushPara(); i += 1; continue }
    // 普通文本行 → 段落
    para.push(line.trim())
    i += 1
  }
  flushPara()
  return out
}
