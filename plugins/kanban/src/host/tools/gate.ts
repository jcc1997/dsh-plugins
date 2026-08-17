// host/tools/gate.ts — 门禁类 6 个 agent 工具（v6 门禁库模型）
// 门禁是独立可复用实体：先 kanban_gate_create 入库，再 kanban_gate_add 把库门禁挂到Ticket；
// 模板用 kanban_template_update(gate_ids) 勾选。动作触发时按Ticket gateIds → 库解析检查。
import { FsLike, normalizeBoard } from '../board'
import { mutateBoard, readBoard, resolveDataDir, defaultBoard, findTicketAny, safeId, now } from '../board'
import { P, STR, OBJ, outputOf } from './shared'
import { checkGates, validateGate, checkerDefaults, migrateGate, GateCheckDeps } from '../gate'

export function gateToolDefs(fs: FsLike, gateDeps: GateCheckDeps): any[] {
  return [
    {
      // 门禁库：新建独立门禁实体
      name: 'kanban_gate_create',
      description: '在门禁库中新建一条门禁（独立可复用实体）。checker_type：tag-required / field-nonempty / mr-linked / branch-linked / mr-merged / code（沙箱代码，config.code 或 config.script）/ pipeline（config.pipelines 现场跑并等全部成功）。on：move（可配 to 限目标列）/ tags / archive。创建后用 kanban_gate_add 挂到Ticket，或在模板 gates 里引用。',
      parameters: P({
        name: STR('门禁名（必填，唯一展示名）', true),
        checker_type: STR('检查器类型：tag-required / field-nonempty / mr-linked / branch-linked / mr-merged / code / pipeline', true),
        on: STR('触发行为：move / tags / archive', true),
        to: STR('仅 move：限定目标列名（可选）'),
        config: OBJ('检查器配置：tag-required {tags:[...]}；field-nonempty {field}；code {code|script, timeoutMs?}；pipeline {pipelines:[...]}'),
      }, ['name', 'checker_type', 'on']),
      execute: async (args: any) => {
        const gate: any = {
          id: safeId('g'), name: String(args.name).trim(), on: args.on,
          ...(args.to ? { to: String(args.to) } : {}),
          checker: { type: String(args.checker_type), config: args.config !== undefined ? args.config : checkerDefaults(String(args.checker_type)) },
        }
        const err = validateGate(gate)
        if (err) return { ok: false, error: err }
        return mutateBoard(fs, (board: any) => {
          if (!Array.isArray(board.gateLibrary)) board.gateLibrary = []
          if (board.gateLibrary.some((g: any) => g.name === gate.name)) return { ok: false, error: 'duplicate gate name: ' + gate.name }
          board.gateLibrary.push(gate)
          return { gate_id: gate.id, name: gate.name }
        })
      },
      output: outputOf('门禁入库结果'),
    },
    {
      // 门禁库：删除门禁实体
      name: 'kanban_gate_delete',
      description: '从门禁库删除一条门禁（同时从所有Ticket/模板的引用中摘除）。',
      parameters: P({ gate_id: STR('门禁 id（来自 kanban_gate_list）', true) }, ['gate_id']),
      execute: async (args: any) => {
        return mutateBoard(fs, (board: any) => {
          if (!Array.isArray(board.gateLibrary)) board.gateLibrary = []
          const i = board.gateLibrary.findIndex((g: any) => g.id === String(args.gate_id))
          if (i < 0) return { ok: false, error: 'gate not found: ' + args.gate_id }
          const [removed] = board.gateLibrary.splice(i, 1)
          // 摘除所有引用
          const strip = (h: any) => { if (h && Array.isArray(h.gateIds)) h.gateIds = h.gateIds.filter((x: any) => x !== removed.id) }
          for (const col of board.columns || []) for (const c of col.tickets || []) strip(c)
          for (const c of board.archive || []) strip(c)
          for (const t of board.templates || []) strip(t)
          return { gate_id: removed.id, removed: true, name: removed.name }
        })
      },
      output: outputOf('删除门禁结果'),
    },
    {
      // 挂载：Ticket勾选库门禁
      name: 'kanban_gate_add',
      description: '把门禁库中的一条门禁挂到Ticket（Ticket勾选引用）。gate_id 来自 kanban_gate_list 的门禁库。',
      parameters: P({ ticket_id: STR('Ticket id', true), gate_id: STR('门禁库中的门禁 id', true) }, ['ticket_id', 'gate_id']),
      execute: async (args: any) => {
        return mutateBoard(fs, (board: any) => {
          const hit = findTicketAny(board, String(args.ticket_id))
          if (!hit) return { ok: false, error: 'ticket not found: ' + args.ticket_id }
          if (!Array.isArray(board.gateLibrary)) board.gateLibrary = []
          const g = board.gateLibrary.find((x: any) => x.id === String(args.gate_id))
          if (!g) return { ok: false, error: 'gate not found in library: ' + args.gate_id }
          const ticket = hit.ticket
          if (!Array.isArray(ticket.gateIds)) ticket.gateIds = []
          if (ticket.gateIds.includes(g.id)) return { ok: false, error: 'gate already attached: ' + g.name }
          ticket.gateIds.push(g.id)
          ticket.updatedAt = now()
          return { ticket_id: ticket.id, gate_id: g.id, gate_name: g.name }
        })
      },
      output: outputOf('挂门禁结果'),
    },
    {
      name: 'kanban_gate_remove',
      description: '从Ticket摘除一条门禁引用（gate_id 来自 kanban_gate_list）。',
      parameters: P({ ticket_id: STR('Ticket id', true), gate_id: STR('门禁 id', true) }, ['ticket_id', 'gate_id']),
      execute: async (args: any) => {
        return mutateBoard(fs, (board: any) => {
          const hit = findTicketAny(board, String(args.ticket_id))
          if (!hit) return { ok: false, error: 'ticket not found: ' + args.ticket_id }
          const ticket = hit.ticket
          const before = (ticket.gateIds || []).length
          ticket.gateIds = (ticket.gateIds || []).filter((x: any) => x !== String(args.gate_id))
          if (ticket.gateIds.length === before) return { ok: false, error: 'gate not attached: ' + args.gate_id }
          ticket.updatedAt = now()
          return { ticket_id: ticket.id, removed: true }
        })
      },
      output: outputOf('摘除门禁结果'),
    },
    {
      name: 'kanban_gate_list',
      description: '列出门禁库全部门禁（独立实体）与指定Ticket已挂的门禁。',
      parameters: P({ ticket_id: STR('Ticket id（可选：同时返回该卡已挂门禁）') }),
      execute: async (args: any) => {
        const dataDir = await resolveDataDir(fs)
        const board = normalizeBoard((await readBoard(fs, dataDir)) || defaultBoard())
        const lib = (board.gateLibrary || []).map((g: any) => ({ ...g }))
        let ticketGates: any[] = []
        if (args.ticket_id) {
          const hit = findTicketAny(board, String(args.ticket_id))
          if (!hit) return { ok: false, error: 'ticket not found: ' + args.ticket_id }
          const ids: string[] = hit.ticket.gateIds || []
          ticketGates = ids.map((id) => migrateGate(lib.find((g: any) => g.id === id))).filter(Boolean)
        }
        return { ok: true, total: lib.length, gate_library: lib, ticket_id: args.ticket_id || null, ticket_gates: ticketGates }
      },
      output: outputOf('门禁列表'),
    },
    {
      name: 'kanban_gate_check',
      description: '手动预检Ticket上某行为的门禁（不执行动作）：返回是否通过与失败原因。action 为 move（可带 to 目标列名）/ tags / archive。',
      parameters: P({
        ticket_id: STR('Ticket id', true),
        action: STR('动作：move / tags / archive', true),
        to: STR('move 时的目标列名（可选）'),
      }, ['ticket_id', 'action']),
      execute: async (args: any) => {
        const dataDir = await resolveDataDir(fs)
        const board = normalizeBoard((await readBoard(fs, dataDir)) || defaultBoard())
        const hit = findTicketAny(board, String(args.ticket_id))
        if (!hit) return { ok: false, error: 'ticket not found: ' + args.ticket_id }
        const action = String(args.action)
        if (!['move', 'tags', 'archive'].includes(action)) return { ok: false, error: 'unknown action: ' + action }
        const res = await checkGates(hit.ticket, board, action as any, gateDeps, { to: args.to ? String(args.to) : undefined })
        return { ok: res.ok, action, failed: res.failed }
      },
      output: outputOf('门禁预检结果'),
    },
  ]
}
