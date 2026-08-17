// host/tools/archive.ts — 归档类 3 个 agent 工具：archive / unarchive / list_archived
// 归档 = 移出列隐藏到 board.archive（archivedFrom 记原列），恢复回原列或指定列。
// v4：archive 触发门禁检查。
import { FsLike, normalizeBoard } from '../board'
import { mutateBoard, readBoard, resolveDataDir, defaultBoard, resolveColumn, appendActivity, now } from '../board'
import { P, STR, outputOf } from './shared'
import { checkGates, GateCheckDeps } from '../gate'

export function archiveToolDefs(fs: FsLike, gateDeps: GateCheckDeps): any[] {
  return [
    {
      name: 'kanban_ticket_archive',
      description: '归档一张Ticket：从Kanban 列中移出（隐藏），可在侧边栏「归档」中找回。归档不删除数据。Ticket 挂有 archive 门禁（如 MR 必须合并）时，不通过则拒绝归档。',
      parameters: P({ ticket_id: STR('要归档的Ticket id') }, ['ticket_id']),
      execute: async (args: any) => {
        const dataDir = await resolveDataDir(fs)
        const board0 = normalizeBoard((await readBoard(fs, dataDir)) || defaultBoard())
        const hit0 = (() => {
          for (const col of board0.columns || []) {
            const ticket = (col.tickets || []).find((k: any) => k.id === String(args.ticket_id))
            if (ticket) return { col, ticket }
          }
          return null
        })()
        if (!hit0) return { ok: false, error: 'ticket not found（可能已归档）: ' + args.ticket_id }
        // 门禁（如「对应 MR 必须 merge 才能进入归档」）
        const gate = await checkGates(hit0.ticket, board0, 'archive', gateDeps)
        if (!gate.ok) return { ok: false, error: '门禁未通过：' + gate.failed.map((f) => f.reason).join('；') }
        return mutateBoard(fs, (board: any) => {
          const hit = (() => {
            for (const col of board.columns || []) {
              const ticket = (col.tickets || []).find((k: any) => k.id === String(args.ticket_id))
              if (ticket) return { col, ticket }
            }
            return null
          })()
          if (!hit) return null
          const { ticket, col } = hit
          col.tickets = col.tickets.filter((k: any) => k.id !== ticket.id)
          ticket.archivedFrom = col.id
          ticket.archivedAt = now()
          ticket.updatedAt = now()
          appendActivity(ticket, '归档Ticket')
          if (!Array.isArray(board.archive)) board.archive = []
          board.archive.push(ticket)
          return { ticket_id: ticket.id, from: col.title, archived: true }
        })
      },
      output: outputOf('归档结果'),
    },
    {
      name: 'kanban_ticket_unarchive',
      description: '从归档恢复Ticket到Kanban。status 传列名或列 id（可选，缺省回到归档前的列，原列已删则回第一列）。',
      parameters: P({ ticket_id: STR('归档中的Ticket id'), status: STR('目标列名或列 id（可选，缺省回到原列）') }, ['ticket_id']),
      execute: async (args: any) => {
        return mutateBoard(fs, (board: any) => {
          const idx = (board.archive || []).findIndex((k: any) => k.id === String(args.ticket_id))
          if (idx < 0) return null
          const [ticket] = board.archive.splice(idx, 1)
          let to = args.status ? resolveColumn(board, args.status) : null
          if (!to) to = resolveColumn(board, ticket.archivedFrom) || resolveColumn(board)
          if (!to) return { ok: false, error: 'no column available' }
          ticket.updatedAt = now()
          appendActivity(ticket, '恢复Ticket（归档）')
          to.tickets.push(ticket)
          return { ticket_id: ticket.id, column: to.title, restored: true }
        })
      },
      output: outputOf('恢复结果'),
    },
    {
      name: 'kanban_ticket_list_archived',
      description: '列出归档中的Ticket 概要（含原列与归档时间）。归档Ticket不在Kanban 列中，需本工具或 kanban_ticket_search(archived=true) 查询。',
      parameters: P({}),
      execute: async () => {
        const dataDir = await resolveDataDir(fs)
        const board = (await readBoard(fs, dataDir)) || defaultBoard()
        const out = (board.archive || []).map((ticket: any) => {
          const col = ticket.archivedFrom ? resolveColumn(board, ticket.archivedFrom) : null
          return {
            id: ticket.id, title: ticket.title, tags: ticket.tags || [],
            archivedFrom: col ? col.title : '', archivedAt: ticket.archivedAt || '', updatedAt: ticket.updatedAt,
          }
        })
        return { ok: true, total: out.length, tickets: out }
      },
      output: outputOf('归档列表'),
    },
  ]
}
