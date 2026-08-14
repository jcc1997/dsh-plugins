// useKanbanBoard：看板数据 + 卡片/列操作（KanbanPage 与会话 Task 面板共用）
import { useEffect, useState } from 'react'
import { appendActivity, safeId, safeNow } from '@dsh-plugins/ui'
import { KanbanBoard } from '@dsh-plugins/ui'

export interface HostLike {
  call(method: string, args?: unknown): Promise<any>
}

export interface RefInput {
  kind: string
  externalId: string
  url?: string
  display?: string
}

export function useKanbanBoard(host: HostLike) {
  const [board, setBoard] = useState<KanbanBoard | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function reload() {
    host
      .call('kanban/load', {})
      .then((r) => setBoard(r.board))
      .catch((e) => setError('加载失败: ' + String(e)))
  }

  useEffect(() => {
    reload()
  }, [host])

  function save(next: KanbanBoard) {
    setBoard(next)
    setSaving(true)
    host
      .call('kanban/save', { board: next })
      .then(() => setSaving(false))
      .catch((e) => {
        setSaving(false)
        setError('保存失败: ' + String(e))
      })
  }
  function mutate<T>(fn: (b: KanbanBoard) => T): T | null {
    if (!board) return null
    const next = JSON.parse(JSON.stringify(board)) as KanbanBoard
    const result = fn(next)
    save(next)
    return result
  }
  function findCardGlobal(cardId: string): { col: any; card: any } | null {
    if (!board) return null
    for (const col of board.columns || []) {
      const card = (col.cards || []).find((k: any) => k.id === cardId)
      if (card) return { col, card }
    }
    return null
  }
  function hitOf(b: KanbanBoard, cardId: string): { col: any; card: any } | null {
    for (const col of b.columns || []) {
      const card = (col.cards || []).find((k: any) => k.id === cardId)
      if (card) return { col, card }
    }
    return null
  }

  /* ── 卡片操作（按 cardId 定位，供看板页 / 会话面板 / 抽屉共用） ── */
  function saveCard(cardId: string, title: string, description: string) {
    mutate((b) => {
      const hit = hitOf(b, cardId)
      const card = hit && (hit as any).card
      if (!card) return
      if (card.title === title && (card.description || '') === description) return
      card.title = title
      card.description = description
      card.updatedAt = safeNow()
      appendActivity(card, '更新卡片')
    })
  }
  function moveCardToStatus(cardId: string, targetColId: string) {
    mutate((b) => {
      const hit = hitOf(b, cardId)
      if (!hit) return
      const fromId = (hit as any).col.id
      const fromCol = b.columns.find((c) => c.id === fromId)
      const toCol = b.columns.find((c) => c.id === targetColId)
      if (!fromCol || !toCol || fromId === targetColId) return
      const idx = fromCol.cards.findIndex((k) => k.id === cardId)
      if (idx < 0) return
      const [card] = fromCol.cards.splice(idx, 1)
      card.updatedAt = safeNow()
      appendActivity(card, '状态变更：' + fromCol.title + ' → ' + toCol.title)
      toCol.cards.push(card)
    })
  }
  function deleteCard(cardId: string) {
    mutate((b) => {
      for (const col of b.columns) {
        const before = col.cards.length
        col.cards = col.cards.filter((k) => k.id !== cardId)
        if (col.cards.length !== before) return
      }
    })
  }
  function updateTags(cardId: string, add: string[], remove: string[]) {
    mutate((b) => {
      const hit = hitOf(b, cardId)
      const target = hit && (hit as any).card
      if (!target) return
      if (!Array.isArray(target.tags)) target.tags = []
      for (const tg of add) {
        if (tg && !target.tags.includes(tg)) { target.tags.push(tg); appendActivity(target, '添加标签：' + tg) }
      }
      for (const tg of remove) {
        const i = target.tags.indexOf(tg)
        if (i >= 0) { target.tags.splice(i, 1); appendActivity(target, '移除标签：' + tg) }
      }
      if (add.length > 0 || remove.length > 0) target.updatedAt = safeNow()
    })
  }
  function addComment(cardId: string, text: string) {
    mutate((b) => {
      const hit = hitOf(b, cardId)
      const card = hit && (hit as any).card
      if (!card) return
      if (!card.comments) card.comments = []
      card.comments.push({ id: safeId('m'), text, createdAt: safeNow() })
      appendActivity(card, '添加评论')
    })
  }
  function addRef(cardId: string, ref: RefInput) {
    mutate((b) => {
      const hit = hitOf(b, cardId)
      const target = hit && (hit as any).card
      if (!target) return
      if (!Array.isArray(target.refs)) target.refs = []
      if (target.refs.some((r: any) => r.kind === ref.kind && r.externalId === ref.externalId)) return
      const platform = ref.kind === 'session' ? 'dsh' : ref.kind.split('-')[0]
      target.refs.push({
        id: safeId('r'),
        kind: ref.kind,
        platform,
        externalId: ref.externalId,
        url: ref.url || '',
        display: ref.display || '',
        meta: {},
        createdAt: safeNow(),
      })
      target.updatedAt = safeNow()
      appendActivity(target, '添加关联：' + ref.kind + ' ' + ref.externalId)
    })
  }
  function removeRef(cardId: string, refId: string) {
    mutate((b) => {
      const hit = hitOf(b, cardId)
      const target = hit && (hit as any).card
      if (!target || !Array.isArray(target.refs)) return
      const idx = target.refs.findIndex((r: any) => r.id === refId)
      if (idx < 0) return
      const [removed] = target.refs.splice(idx, 1)
      target.updatedAt = safeNow()
      appendActivity(target, '移除关联：' + (removed.kind || '') + ' ' + (removed.externalId || ''))
    })
  }

  /* ── 列操作 ── */
  function addColumn(title: string) {
    mutate((b) => b.columns.push({ id: safeId('c'), title, cards: [], meta: {} }))
  }
  function renameColumn(colId: string, title: string) {
    mutate((b) => {
      const col = b.columns.find((c) => c.id === colId)
      if (col) col.title = title
    })
  }
  function deleteColumn(colId: string) {
    mutate((b) => {
      b.columns = b.columns.filter((c) => c.id !== colId)
    })
  }
  function moveColumn(colId: string, dir: number) {
    mutate((b) => {
      const idx = b.columns.findIndex((c) => c.id === colId)
      const to = idx + dir
      if (idx < 0 || to < 0 || to >= b.columns.length) return
      const [col] = b.columns.splice(idx, 1)
      b.columns.splice(to, 0, col)
    })
  }

  /* ── 会话关联查询：refs 含 session 且 externalId 匹配的卡片（按 updatedAt 倒序，最近在前） ── */
  function cardsBySession(sessionId: string): Array<{ id: string; title: string; status: string; updatedAt: string }> {
    if (!board) return []
    const out: Array<{ id: string; title: string; status: string; updatedAt: string }> = []
    for (const col of board.columns || []) {
      for (const card of col.cards || []) {
        const refs: any[] = card.refs || []
        if (refs.some((r) => r.kind === 'session' && String(r.externalId) === sessionId)) {
          out.push({ id: card.id, title: card.title, status: col.title, updatedAt: card.updatedAt || '' })
        }
      }
    }
    out.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    return out
  }

  return {
    board,
    error,
    saving,
    reload,
    mutate,
    findCard: findCardGlobal,
    saveCard,
    moveCardToStatus,
    deleteCard,
    updateTags,
    addComment,
    addRef,
    removeRef,
    addColumn,
    renameColumn,
    deleteColumn,
    moveColumn,
    cardsBySession,
  }
}
