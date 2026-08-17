import { KanbanBoard, KanbanTicket, KanbanColumn } from './types'

export function safeId(prefix: string): string {
  try {
    return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  } catch {
    return prefix + Math.floor(Math.random() * 1e9).toString(36)
  }
}

export function safeNow(): string | undefined {
  try {
    return new Date().toISOString()
  } catch {
    return undefined
  }
}

export function fmtTime(iso?: string): string {
  try {
    const d = new Date(iso || '')
    const p = (n: number) => (n < 10 ? '0' + n : String(n))
    return p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes())
  } catch {
    return ''
  }
}

export const ACTOR_UI = '手动调整'
export const ACTOR_AGENT = 'agent'

export function appendActivity(ticket: KanbanTicket, text: string, actor?: string): void {
  if (!ticket.activity) ticket.activity = []
  ticket.activity.push({ id: safeId('a'), text, at: safeNow(), actor: actor || ACTOR_UI })
}

export function findTicket(board: KanbanBoard, colId: string, ticketId: string): KanbanTicket | null {
  const col = board.columns.find((c) => c.id === colId)
  if (!col) return null
  return col.tickets.find((k) => k.id === ticketId) || null
}

export function colTitle(board: KanbanBoard, colId: string): string {
  const col = board.columns.find((c) => c.id === colId)
  return col ? col.title : ''
}