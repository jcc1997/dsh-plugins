// host/tools/template.ts — 创建模板类 4 个 agent 工具：list / create / update / delete
// 模板预置 description / tags / content / gates；kanban_create(template=) 或 UI 创建弹窗引用。
import { FsLike } from '../board'
import { mutateBoard, readBoard, resolveDataDir, defaultBoard, normalizeContent, safeId, now } from '../board'
import { P, STR, STRS, OBJ, outputOf } from './shared'
import { validateGate } from '../gate'

/** 模板校验：gates 逐个 validateGate；返回错误串或 null */
function validateTemplate(t: any): string | null {
  if (!t.name || !String(t.name).trim()) return 'name is required'
  for (const g of Array.isArray(t.gates) ? t.gates : []) {
    const err = validateGate(g)
    if (err) return 'gate 非法（' + (g.name || g.kind) + '）：' + err
  }
  return null
}

export function templateToolDefs(fs: FsLike): any[] {
  return [
    {
      name: 'kanban_template_list',
      description: '列出创建模板（含预置的 description/tags/content/gates），创建卡片时可引用。',
      parameters: P({}),
      execute: async () => {
        const dataDir = await resolveDataDir(fs)
        const board = (await readBoard(fs, dataDir)) || defaultBoard()
        const out = (board.templates || []).map((t: any) => ({
          id: t.id, name: t.name, description: t.description || '',
          tags: t.tags || [], gate_count: (t.gates || []).length, gates: t.gates || [],
          content_block_count: (t.content || []).length,
          createdAt: t.createdAt, updatedAt: t.updatedAt,
        }))
        return { ok: true, total: out.length, templates: out }
      },
      output: outputOf('模板列表'),
    },
    {
      name: 'kanban_template_create',
      description: '新建创建模板：预置 description（一句话纯文本）、tags、content（富文本块数组或字符串）、gates（门禁数组 [{kind,on,config?,name?}]）。agent 与手动创建卡片都可用。',
      parameters: P({
        name: STR('模板名（必填，唯一）', true),
        description: STR('预置描述（可选）'),
        tags: STRS('预置标签（可选）'),
        content: OBJ('预置内容（可选）：富文本块数组或字符串'),
        gates: { type: 'array', items: { type: 'object', additionalProperties: true }, description: '预置门禁数组（可选）：[{kind:"mr-merged"|"tag-required"|"field-nonempty", on:"move"|"tags"|"archive", config?, name?}]' },
      }, ['name']),
      execute: async (args: any) => {
        return mutateBoard(fs, (board: any) => {
          if (!Array.isArray(board.templates)) board.templates = []
          if (board.templates.some((t: any) => t.name === String(args.name).trim())) {
            return { ok: false, error: 'duplicate name: ' + args.name }
          }
          const tpl: any = {
            id: safeId('t'), name: String(args.name).trim(),
            description: args.description || '',
            tags: Array.isArray(args.tags) ? args.tags.map((x: any) => String(x)) : [],
            content: normalizeContent(args.content),
            gates: Array.isArray(args.gates) ? args.gates : [],
            createdAt: now(), updatedAt: now(),
          }
          const err = validateTemplate(tpl)
          if (err) return { ok: false, error: err }
          board.templates.push(tpl)
          return { template_id: tpl.id, name: tpl.name }
        })
      },
      output: outputOf('创建模板结果'),
    },
    {
      name: 'kanban_template_update',
      description: '更新创建模板：name / description / tags / content / gates（只更新传入字段）。',
      parameters: P({
        template_id: STR('模板 id（或名）', true),
        name: STR('新名称（可选）'),
        description: STR('新预置描述（可选）'),
        tags: STRS('新预置标签（可选，覆盖）'),
        content: OBJ('新预置内容（可选）'),
        gates: { type: 'array', items: { type: 'object', additionalProperties: true }, description: '新预置门禁（可选，覆盖）' },
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
          if (args.gates !== undefined) tpl.gates = args.gates
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
