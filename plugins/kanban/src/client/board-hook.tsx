// client/board-hook.tsx — useKanbanBoard：Kanban 数据 + Ticket/列/归档操作（KanbanPage 与会话 Task 面板共用）
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

export { normalizeContent, ticketRepoOf } from './board-util'

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
  // 按 id 找活动列中的Ticket
  function findTicketGlobal(ticketId: string): { col: any; ticket: any } | null {
    if (!board) return null
    for (const col of board.columns || []) {
      const ticket = (col.tickets || []).find((k: any) => k.id === ticketId)
      if (ticket) return { col, ticket }
    }
    return null
  }
  function hitOf(b: KanbanBoard, ticketId: string): { col: any; ticket: any } | null {
    for (const col of b.columns || []) {
      const ticket = (col.tickets || []).find((k: any) => k.id === ticketId)
      if (ticket) return { col, ticket }
    }
    return null
  }

  /* ── 门禁预检（v4）：动作前调 host gate-check，不通过则报错并拒绝 ── */
  async function gateCheck(ticketId: string, action: 'move' | 'tags' | 'archive', to?: string): Promise<boolean> {
    try {
      const r = await host.call('kanban/gate-check', { ticket_id: ticketId, action, to })
      if (r && r.ok) return true
      const reasons = r && Array.isArray(r.failed) && r.failed.length > 0
        ? r.failed.map((f: any) => (f.name || f.kind) + '：' + (f.reason || '')).join('；')
        : (r && r.error) || '未知原因'
      setError('门禁未通过，动作已拒绝：' + reasons)
      return false
    } catch (e) {
      setError('门禁检查失败: ' + String(e))
      return false
    }
  }

  /* ── Ticket操作（按 ticketId 定位，供Kanban页 / 会话面板 / 抽屉共用） ── */
  /** 保存标题/描述/富文本内容（无变化不写盘） */
  function saveTicket(ticketId: string, title: string, description: string, content?: KanbanBlock[]) {
    mutate((b) => {
      const hit = hitOf(b, ticketId)
      const ticket = hit && (hit as any).ticket
      if (!ticket) return
      const nextContent = content !== undefined ? content : ticket.content
      const sameContent = JSON.stringify(nextContent || []) === JSON.stringify(ticket.content || [])
      if (ticket.title === title && (ticket.description || '') === description && sameContent) return
      ticket.title = title
      ticket.description = description
      if (content !== undefined) ticket.content = nextContent
      ticket.updatedAt = safeNow()
      appendActivity(ticket, '更新Ticket')
    })
  }
  /** 跨列移动（记录状态变更日志；v4 先过 move 门禁） */
  async function moveTicketToStatus(ticketId: string, targetColId: string) {
    const toTitle = board && board.columns ? (board.columns.find((c) => c.id === targetColId) || ({} as any)).title : undefined
    if (!(await gateCheck(ticketId, 'move', toTitle))) return
    mutate((b) => {
      const hit = hitOf(b, ticketId)
      if (!hit) return
      const fromId = (hit as any).col.id
      const fromCol = b.columns.find((c) => c.id === fromId)
      const toCol = b.columns.find((c) => c.id === targetColId)
      if (!fromCol || !toCol || fromId === targetColId) return
      const idx = fromCol.tickets.findIndex((k) => k.id === ticketId)
      if (idx < 0) return
      const [ticket] = fromCol.tickets.splice(idx, 1)
      ticket.updatedAt = safeNow()
      appendActivity(ticket, '状态变更：' + fromCol.title + ' → ' + toCol.title)
      toCol.tickets.push(ticket)
    })
  }
  /** 删除活动列中的Ticket（不可恢复） */
  function deleteTicket(ticketId: string) {
    mutate((b) => {
      for (const col of b.columns) {
        const before = col.tickets.length
        col.tickets = col.tickets.filter((k) => k.id !== ticketId)
        if (col.tickets.length !== before) return
      }
    })
  }
  /* ── 归档操作（v3） ── */
  /** 归档：移出列 → board.archive（archivedFrom 记原列，恢复时回原列；v4 先过 archive 门禁） */
  async function archiveTicket(ticketId: string) {
    if (!(await gateCheck(ticketId, 'archive'))) return
    mutate((b) => {
      const hit = hitOf(b, ticketId)
      if (!hit) return
      const ticket = (hit as any).ticket
      ;(hit as any).col.tickets = (hit as any).col.tickets.filter((k: any) => k.id !== ticketId)
      ticket.archivedFrom = (hit as any).col.id
      ticket.archivedAt = safeNow()
      ticket.updatedAt = safeNow()
      appendActivity(ticket, '归档Ticket')
      b.archive = b.archive || []
      b.archive.push(ticket)
    })
  }
  /** 恢复归档：回原列（原列已删 → 第一列）或指定列 */
  function unarchiveTicket(ticketId: string, columnId?: string) {
    mutate((b) => {
      b.archive = b.archive || []
      const idx = b.archive.findIndex((k) => k.id === ticketId)
      if (idx < 0) return
      const [ticket] = b.archive.splice(idx, 1)
      const col =
        (columnId ? b.columns.find((c) => c.id === columnId) : null) ||
        (ticket.archivedFrom ? b.columns.find((c) => c.id === (ticket as any).archivedFrom) : null) ||
        b.columns[0]
      if (!col) return
      ticket.updatedAt = safeNow()
      appendActivity(ticket, '恢复Ticket（归档）')
      col.tickets.push(ticket)
    })
  }
  /** 永久删除归档Ticket */
  function deleteArchivedTicket(ticketId: string) {
    mutate((b) => {
      b.archive = b.archive || []
      b.archive = b.archive.filter((k) => k.id !== ticketId)
    })
  }
  /** 标签增减（写变更记录；v4 先过 tags 门禁） */
  async function updateTags(ticketId: string, add: string[], remove: string[]) {
    if (!(await gateCheck(ticketId, 'tags'))) return
    mutate((b) => {
      const hit = hitOf(b, ticketId)
      const target = hit && (hit as any).ticket
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
  function addTicketComment(ticketId: string, text: string) {
    mutate((b) => {
      const hit = hitOf(b, ticketId)
      const ticket = hit && (hit as any).ticket
      if (!ticket) return
      if (!ticket.comments) ticket.comments = []
      ticket.comments.push({ id: safeId('m'), text, createdAt: safeNow() })
      appendActivity(ticket, '添加评论')
    })
  }
  /** 添加外部关联（同 kind+externalId 重复拒绝） */
  function addRef(ticketId: string, ref: RefInput) {
    mutate((b) => {
      const hit = hitOf(b, ticketId)
      const target = hit && (hit as any).ticket
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
  function removeRef(ticketId: string, refId: string) {
    mutate((b) => {
      const hit = hitOf(b, ticketId)
      const target = hit && (hit as any).ticket
      if (!target || !Array.isArray(target.refs)) return
      const idx = target.refs.findIndex((r: any) => r.id === refId)
      if (idx < 0) return
      const [removed] = target.refs.splice(idx, 1)
      target.updatedAt = safeNow()
      appendActivity(target, '移除关联：' + (removed.kind || '') + ' ' + (removed.externalId || ''))
    })
  }

  /* ── 门禁管理（v6）：门禁库实体 + Ticket/模板按 id 勾选 ── */
  /** Ticket挂载门禁（按门禁库 id 勾选） */
  function attachGate(ticketId: string, gateId: string) {
    mutate((b) => {
      const hit = hitOf(b, ticketId)
      const ticket = hit && (hit as any).ticket
      if (!ticket) return
      if (!Array.isArray(ticket.gateIds)) ticket.gateIds = []
      if (ticket.gateIds.includes(gateId)) return
      ticket.gateIds.push(gateId)
      ticket.updatedAt = safeNow()
      const g = (b.gateLibrary || []).find((x: any) => x.id === gateId)
      appendActivity(ticket, '挂门禁：' + (g ? g.name : gateId))
    })
  }
  /** Ticket摘除门禁（按门禁库 id） */
  function removeGate(ticketId: string, gateId: string) {
    mutate((b) => {
      const hit = hitOf(b, ticketId)
      const ticket = hit && (hit as any).ticket
      if (!ticket) return
      if (!Array.isArray(ticket.gateIds)) ticket.gateIds = []
      const before = ticket.gateIds.includes(gateId)
      ticket.gateIds = ticket.gateIds.filter((id: string) => id !== gateId)
      if (!before) return
      ticket.updatedAt = safeNow()
      const g = (b.gateLibrary || []).find((x: any) => x.id === gateId)
      appendActivity(ticket, '移除门禁：' + (g ? g.name : gateId))
    })
  }
  /** 门禁库新增（独立实体；返回新门禁 id 供引用） */
  function createGate(gate: any): string | null {
    return mutate((b) => {
      if (!Array.isArray(b.gateLibrary)) b.gateLibrary = []
      const g = JSON.parse(JSON.stringify(gate))
      if (!g.id) g.id = safeId('g')
      b.gateLibrary.push(g)
      return g.id
    })
  }
  /** 门禁库删除（同时从所有Ticket/模板的 gateIds 摘除） */
  function deleteGate(gateId: string) {
    mutate((b) => {
      b.gateLibrary = (b.gateLibrary || []).filter((g: any) => g.id !== gateId)
      for (const col of b.columns || []) {
        for (const ticket of col.tickets || []) {
          if (Array.isArray(ticket.gateIds)) ticket.gateIds = ticket.gateIds.filter((id: string) => id !== gateId)
        }
      }
      for (const ticket of b.archive || []) {
        if (Array.isArray(ticket.gateIds)) ticket.gateIds = ticket.gateIds.filter((id: string) => id !== gateId)
      }
      for (const tpl of b.templates || []) {
        if (Array.isArray(tpl.gateIds)) tpl.gateIds = tpl.gateIds.filter((id: string) => id !== gateId)
      }
    })
  }
  /** 更新门禁库实体（字段局部覆盖） */
  function updateGate(gateId: string, patch: any) {
    mutate((b) => {
      const g = (b.gateLibrary || []).find((x: any) => x.id === gateId)
      if (!g) return
      Object.assign(g, patch)
    })
  }
  /** 模板勾选门禁（覆盖式） */
  function setTemplateGates(templateId: string, gateIds: string[]) {
    mutate((b) => {
      const tpl = (b.templates || []).find((t: any) => t.id === templateId)
      if (!tpl) return
      tpl.gateIds = gateIds.slice()
      tpl.updatedAt = safeNow()
    })
  }
  /** 更新模板（名称/描述/标签/门禁勾选，字段局部覆盖） */
  function updateTemplate(templateId: string, patch: { name?: string; description?: string; tags?: string[]; gateIds?: string[] }) {
    mutate((b) => {
      const tpl = (b.templates || []).find((t: any) => t.id === templateId)
      if (!tpl) return
      if (patch.name !== undefined && String(patch.name).trim() !== '') tpl.name = String(patch.name).trim()
      if (patch.description !== undefined) tpl.description = String(patch.description)
      if (patch.tags !== undefined) tpl.tags = patch.tags.slice()
      if (patch.gateIds !== undefined) tpl.gateIds = patch.gateIds.slice()
      tpl.updatedAt = safeNow()
    })
  }
  /** 新建模板（预置描述/标签/门禁勾选） */
  function createTemplate(name: string, description: string, tags: string[], gateIds: string[]) {
    mutate((b) => {
      if (!Array.isArray(b.templates)) b.templates = []
      b.templates.push({
        id: safeId('t'), name, description, tags, content: [], gateIds: gateIds.slice(),
        createdAt: safeNow(), updatedAt: safeNow(),
      })
    })
  }
  /** 删除模板 */
  function deleteTemplate(templateId: string) {
    mutate((b) => {
      b.templates = (b.templates || []).filter((t: any) => t.id !== templateId)
    })
  }

  /* ── 列操作 ── */
  function addColumn(title: string) {
    mutate((b) => b.columns.push({ id: safeId('c'), title, tickets: [], meta: {} }))
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

  /* ── 会话关联查询：refs 含 session 且 externalId 匹配的Ticket（按 updatedAt 倒序，最近在前） ── */
  function ticketsBySession(sessionId: string): Array<{ id: string; title: string; status: string; updatedAt: string }> {
    if (!board) return []
    const out: Array<{ id: string; title: string; status: string; updatedAt: string }> = []
    for (const col of board.columns || []) {
      for (const ticket of col.tickets || []) {
        const refs: any[] = ticket.refs || []
        if (refs.some((r) => r.kind === 'session' && String(r.externalId) === sessionId)) {
          out.push({ id: ticket.id, title: ticket.title, status: col.title, updatedAt: ticket.updatedAt || '' })
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
    findTicket: findTicketGlobal,
    saveTicket,
    moveTicketToStatus,
    deleteTicket,
    archiveTicket,
    unarchiveTicket,
    deleteArchivedTicket,
    updateTags,
    addTicketComment,
    addRef,
    removeRef,
    attachGate,
    removeGate,
    createGate,
    updateGate,
    deleteGate,
    setTemplateGates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    gateCheck,
    addColumn,
    renameColumn,
    deleteColumn,
    moveColumn,
    ticketsBySession,
  }
}
