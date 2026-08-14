// Markdown 极简渲染
import React from 'react'

function inlineMd(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  const push = (k: string, v: string) => nodes.push(React.createElement(k, { key: nodes.length }, v))
  let rest = text
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\))/
  while (rest.length > 0) {
    const m = rest.match(re)
    if (!m) {
      nodes.push(rest)
      break
    }
    if (m.index! > 0) nodes.push(rest.slice(0, m.index))
    if (m[2] !== undefined) push('strong', m[2])
    else if (m[3] !== undefined) push('em', m[3])
    else if (m[4] !== undefined) push('code', m[4])
    else
      nodes.push(
        React.createElement('a', { key: nodes.length, href: m[6], target: '_blank', rel: 'noreferrer' }, m[5]),
      )
    rest = rest.slice(m.index! + m[0].length)
  }
  return nodes
}

export function mdToElements(text: string | undefined): React.ReactNode[] {
  const out: React.ReactNode[] = []
  const blocks = String(text || '').split(/\n{2,}/)
  for (const block of blocks) {
    const trimmed = block.trim()
    if (!trimmed) continue
    if (trimmed.startsWith('### ')) out.push(<h3 key={out.length}>{inlineMd(trimmed.slice(4))}</h3>)
    else if (trimmed.startsWith('## ')) out.push(<h2 key={out.length}>{inlineMd(trimmed.slice(3))}</h2>)
    else if (trimmed.startsWith('# ')) out.push(<h1 key={out.length}>{inlineMd(trimmed.slice(2))}</h1>)
    else if (/^[-*] /.test(trimmed)) {
      const items = trimmed.split(/\n(?=[-*] )/).map((line) => line.replace(/^[-*] /, ''))
      out.push(
        <ul key={out.length}>
          {items.map((it, i) => (
            <li key={i}>{inlineMd(it)}</li>
          ))}
        </ul>,
      )
    } else {
      out.push(<p key={out.length}>{inlineMd(trimmed)}</p>)
    }
  }
  return out
}
