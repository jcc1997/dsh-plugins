// host/tools/template.ts — 创建模板类 4 个 agent 工具：list / create / update / delete
// 模板预置 description / tags / content / 门禁勾选（v6 门禁库 gateIds 引用，兼容内联自动入库）。
import { FsLike } from '../board'
import { mutateBoard, readBoard, resolveDataDir, defaultBoard, normalizeContent, safeId, now } from '../board'
import { P, STR, STRS, OBJ, outputOf } from './shared'
import { validateGate } from '../gate'

/** 模板校验：内联 gates 逐个 validateGate；返回错误串或 null */
function validateTemplate(t: any): string | null {
  if (!t.name || !String(t.name).trim()) return 'name is required'
  for (const g of Array.isArray(t.gates) ? t.gates : []) {
    const err = validateGate(g)
    if (err) return 'gate 非法（' + (g.name || g.kind) + '）：' + err
  }
  return null
}

/** 把 gate_ids 或内联 gates 解析成库引用（内联自动入库，去重） */
function resolveGateIds(board: any, gateIdsIn: any, inlineGates: any): { ok: boolean; ids?: string[]; error?: string } {
  if (!Array.isArray(board.gateLibrary)) board.gateLibrary = []
  const ids: string[] = []
  if (Array.isArray(gateIdsIn)) {
    for (const id of gateIdsIn.map(String)) {
      if (!board.gateLibrary.some((g: any) => g.id === id)) return { ok: false, error: 'gate not found in library: ' + id }
      if (!ids.includes(id)) ids.push(id)
    }
  }
  if (Array.isArray(inlineGates)) {
    for (const g of inlineGates) {
      if (!g.id) g.id = safeId('g')
      const type = g.checker ? g.checker.type : g.kind
      const exists = board.gateLibrary.find((x: any) => x.name === g.name && (x.checker ? x.checker.type : x.kind) === type && x.on === g.on)
      if (exists) { if (!ids.includes(exists.id)) ids.push(exists.id); continue }
      board.gateLibrary.push(g)
      if (!ids.includes(g.id)) ids.push(g.id)
    }
  }
  return { ok: true, ids }
}

export function templateToolDefs(fs: FsLike): any[] {
  return [
    {
      name: 'kanban_template_list',
      description: '列出创建模板（含预置的 description/tags/content 与勾选的门禁），创建卡片时可引用。',
      parameters: P({}),
      execute: async () => {
        const dataDir = await resolveDataDir(fs)
        const board = (await readBoard(fs, dataDir)) || defaultBoard()
        const lib = board.gateLibrary || []
        const out = (board.templates || []).map((t: any) => {
          const gateIds: string[] = t.gateIds || []
          const gates = gateIds.map((id: string) => lib.find((g: any) => g.id === id)).filter(Boolean)
          return {
            id: t.id, name: t.name, description: t.description || '',
            tags: t.tags || [], gate_count: gates.length, gate_ids: gateIds, gates,
            content_block_count: (t.content || []).length,
            createdAt: t.createdAt, updatedAt: t.updatedAt,
          }
        })
        return { ok: true, total: out.length, templates: out }
      },
      output: outputOf('模板列表'),
    },
    {
      name: 'kanban_template_create',
      description: '新建创建模板：预置 description（一句话纯文本）、tags、content（富文本块数组或字符串）、门禁勾选（gate_ids 引用门禁库；兼容内联 gates 自动入库）。',
      parameters: P({
        name: STR('模板名（必填，唯一）', true),
        description: STR('预置描述（可选）'),
        tags: STRS('预置标签（可选）'),
        content: OBJ('预置内容（可选）：富文本块数组或字符串'),
        gate_ids: STRS('勾选的门禁库 id 列表（可选，来自 kanban_gate_list）'),
        gates: { type: 'array', items: { type: 'object', additionalProperties: true }, description: '兼容旧格式：内联门禁数组（自动迁入门禁库）' },
      }, ['name']),
      execute: async (args: any) => {
        return mutateBoard(fs, (board: any) => {
          if (!Array.isArray(board.templates)) board.templates = []
          if (board.templates.some((t: any) => t.name === String(args.name).trim())) {
            return { ok: false, error: 'duplicate name: ' + args.name }
          }
          const resolved = resolveGateIds(board, args.gate_ids, args.gates)
          if (!resolved.ok) return resolved
          const tpl: any = {
            id: safeId('t'), name: String(args.name).trim(),
            description: args.description || '',
            tags: Array.isArray(args.tags) ? args.tags.map((x: any) => String(x)) : [],
            content: normalizeContent(args.content),
            gateIds: resolved.ids || [],
            gates: Array.isArray(args.gates) ? args.gates : [],
            createdAt: now(), updatedAt: now(),
          }
          const err = validateTemplate(tpl)
          if (err) return { ok: false, error: err }
          board.templates.push(tpl)
          return { template_id: tpl.id, name: tpl.name, gate_ids: tpl.gateIds }
        })
      },
      output: outputOf('创建模板结果'),
    },
    {
      name: 'kanban_template_update',
      description: '更新创建模板：name / description / tags / content / gate_ids（门禁勾选覆盖；兼容内联 gates 自动入库）。',
      parameters: P({
        template_id: STR('模板 id（或名）', true),
        name: STR('新名称（可选）'),
        description: STR('新预置描述（可选）'),
        tags: STRS('新预置标签（可选，覆盖）'),
        content: OBJ('新预置内容（可选）'),
        gate_ids: STRS('勾选的门禁库 id 列表（可选，覆盖）'),
        gates: { type: 'array', items: { type: 'object', additionalProperties: true }, description: '兼容旧格式：内联门禁（自动入库）' },
      }, ['template_id']),
      execute: async (args: any) => {
        return mutateBoard(fs, (board: any) => {
          if (!Array.isArray(board.templates)) board.templates = []
          const tpl = board.templates.find((t: any) => t.id === String(args.template_id) || t.name === String(args.template_id))
          if (!tpl) return { ok: false, error: 'template not found: ' + args.template_id }
          if (args.name !== undefined && String(args.name).trim() !== '') {
            const nm = String(args.name).trim()
            if (board.templates.some((t: any) => t.id !== tpl.id && t.name === nm)) return { ok: false, error: 'duplicate name: ' + nm }
            tpl.name = nm
          }
          if (args.description !== undefined) tpl.description = String(args.description)
          if (args.tags !== undefined) tpl.tags = args.tags.map((x: any) => String(x))
          if (args.content !== undefined) tpl.content = normalizeContent(args.content)
          if (args.gate_ids !== undefined || args.gates !== undefined) {
            const resolved = resolveGateIds(board, args.gate_ids, args.gates)
            if (!resolved.ok) return resolved
            tpl.gateIds = resolved.ids || []
            if (args.gates !== undefined) tpl.gates = args.gates
          }
          const err = validateTemplate(tpl)
          if (err) return { ok: false, error: err }
          tpl.updatedAt = now()
          return { template_id: tpl.id, name: tpl.name }
        })
      },
      output: outputOf('更新模板结果'),
    },
    {
      name: 'kanban_template_delete',
      description: '删除创建模板（不影响已用该模板创建的卡片）。',
      parameters: P({ template_id: STR('模板 id（或名）', true) }, ['template_id']),
      execute: async (args: any) => {
        return mutateBoard(fs, (board: any) => {
          if (!Array.isArray(board.templates)) board.templates = []
          const i = board.templates.findIndex((t: any) => t.id === String(args.template_id) || t.name === String(args.template_id))
          if (i < 0) return { ok: false, error: 'template not found: ' + args.template_id }
          const [removed] = board.templates.splice(i, 1)
          return { template_id: removed.id, deleted: true }
        })
      },
      output: outputOf('删除模板结果'),
    },
  ]
}
