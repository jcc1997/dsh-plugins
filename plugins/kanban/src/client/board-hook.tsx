// client/board-hook.tsx — useKanbanBoard：看板数据 + 卡片/列/归档操作（KanbanPage 与会话 Task 面板共用）
// 数据经 host RPC（kanban/load、kanban/save）读写 board.json；纯函数在 board-util.ts。
import { useEffect, useState } from 'react'
import { appendActivity, safeId, safeNow } from '@dsh-plugins/ui'
import { KanbanBoard, KanbanBlock } from '@dsh-plugins/ui'

export interface HostLike {
  call(method: string, args?: unknown): Promise<any>
}

export interface RefInput {
  kind: string
  externalId: string
  url?: string
  display?: string
}

export { normalizeContent, cardRepoOf } from './board-util'

export function useKanbanBoard(host: HostLike) {
  const [board, setBoard] = useState<KanbanBoard | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // 加载整板（含归档）；失败仅记录错误，不阻塞 UI
  function reload() {
    host
      .call('kanban/load', {})
      .then((r) => {
        const b = r.board || null
        if (b && !Array.isArray(b.archive)) b.archive = []
        setBoard(b)
      })
      .catch((e) => setError('加载失败: ' + String(e)))
  }

  useEffect(() => {
    reload()
  }, [host])

  // 保存：整板全量落盘（client 侧 mutate 后调用）
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
  // 深拷贝后应用变更再保存（避免直接改 state）
  function mutate<T>(fn: (b: KanbanBoard) => T): T | null {
    if (!board) return null
    const next = JSON.parse(JSON.stringify(board)) as KanbanBoard
    if (!Array.isArray(next.archive)) next.archive = []
    const result = fn(next)
    save(next)
    return result
  }
  // 按 id 找活动列中的卡片
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
  /** 保存标题/描述/富文本内容（无变化不写盘） */
  function saveCard(cardId: string, title: string, description: string, content?: KanbanBlock[]) {
    mutate((b) => {
      const hit = hitOf(b, cardId)
      const card = hit && (hit as any).card
      if (!card) return
      const nextContent = content !== undefined ? content : card.content
      const sameContent = JSON.stringify(nextContent || []) === JSON.stringify(card.content || [])
      if (card.title === title && (card.description || '') === description && sameContent) return
      card.title = title
      card.description = description
      if (content !== undefined) card.content = nextContent
      card.updatedAt = safeNow()
      appendActivity(card, '更新卡片')
    })
  }
  /** 跨列移动（记录状态变更日志） */
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
  /** 删除活动列中的卡片（不可恢复） */
  function deleteCard(cardId: string) {
    mutate((b) => {
      for (const col of b.columns) {
        const before = col.cards.length
        col.cards = col.cards.filter((k) => k.id !== cardId)
        if (col.cards.length !== before) return
      }
    })
  }
  /* ── 归档操作（v3） ── */
  /** 归档：移出列 → board.archive（archivedFrom 记原列，恢复时回原列） */
  function archiveCard(cardId: string) {
    mutate((b) => {
      const hit = hitOf(b, cardId)
      if (!hit) return
      const card = (hit as any).card
      ;(hit as any).col.cards = (hit as any).col.cards.filter((k: any) => k.id !== cardId)
      card.archivedFrom = (hit as any).col.id
      card.archivedAt = safeNow()
      card.updatedAt = safeNow()
      appendActivity(card, '归档卡片')
      b.archive = b.archive || []
      b.archive.push(card)
    })
  }
  /** 恢复归档：回原列（原列已删 → 第一列）或指定列 */
  function unarchiveCard(cardId: string, columnId?: string) {
    mutate((b) => {
      b.archive = b.archive || []
      const idx = b.archive.findIndex((k) => k.id === cardId)
      if (idx < 0) return
      const [card] = b.archive.splice(idx, 1)
      const col =
        (columnId ? b.columns.find((c) => c.id === columnId) : null) ||
        (card.archivedFrom ? b.columns.find((c) => c.id === (card as any).archivedFrom) : null) ||
        b.columns[0]
      if (!col) return
      card.updatedAt = safeNow()
      appendActivity(card, '恢复卡片（归档）')
      col.cards.push(card)
    })
  }
  /** 永久删除归档卡片 */
  function deleteArchivedCard(cardId: string) {
    mutate((b) => {
      b.archive = b.archive || []
      b.archive = b.archive.filter((k) => k.id !== cardId)
    })
  }
  /** 标签增减（写变更记录） */
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
  /** 添加评论 */
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
  /** 添加外部关联（同 kind+externalId 重复拒绝） */
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
  /** 移除外部关联 */
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
    archiveCard,
    unarchiveCard,
    deleteArchivedCard,
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
