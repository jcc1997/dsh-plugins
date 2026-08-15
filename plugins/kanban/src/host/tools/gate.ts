// host/tools/gate.ts — 门禁类 4 个 agent 工具：add / remove / list / check
// 门禁挂在 card.gates；动作（move/tags/archive）触发时由工具层检查（见 card.ts/archive.ts）。
import { FsLike, normalizeBoard } from '../board'
import { mutateBoard, readBoard, resolveDataDir, defaultBoard, findCardAny, safeId, now } from '../board'
import { P, STR, OBJ, outputOf } from './shared'
import { checkGates, validateGate, gateDefaults, GateCheckDeps } from '../gate'

export function gateToolDefs(fs: FsLike, gateDeps: GateCheckDeps): any[] {
  return [
    {
      name: 'kanban_gate_add',
      description: '给卡片挂一个门禁：指定行为（move 移动状态 / tags 增减标签 / archive 归档）触发时检查，不通过则拒绝动作。kind：mr-merged（关联 MR 已合并才能动作）/ mr-linked（必须已关联 MR）/ tag-required（必须含指定标签）/ field-nonempty（字段非空）。move 可配 config.to 限定目标列名。',
      parameters: P({
        card_id: STR('卡片 id', true),
        kind: STR('门禁类型：mr-merged / mr-linked / tag-required / field-nonempty', true),
        on: STR('触发行为：move / tags / archive', true),
        name: STR('门禁名（可选，展示用）'),
        config: OBJ('条件配置：tag-required 需 {tags:[...]}；field-nonempty 需 {field:"description"}；move 可带 {to:"列名"}'),
      }, ['card_id', 'kind', 'on']),
      execute: async (args: any) => {
        const gate: any = {
          id: safeId('g'), name: args.name || String(args.kind), kind: args.kind, on: args.on,
          config: args.config !== undefined ? args.config : gateDefaults(args.kind),
        }
        const err = validateGate(gate)
        if (err) return { ok: false, error: err }
        return mutateBoard(fs, (board: any) => {
          const hit = findCardAny(board, String(args.card_id))
          if (!hit) return { ok: false, error: 'card not found: ' + args.card_id }
          const card = hit.card
          if (!Array.isArray(card.gates)) card.gates = []
          // 同 kind+on 去重（幂等）
          if (card.gates.some((g: any) => g.kind === gate.kind && g.on === gate.on)) {
            return { ok: false, error: 'duplicate gate: ' + gate.kind + ' on ' + gate.on }
          }
          card.gates.push(gate)
          card.updatedAt = now()
          return { card_id: card.id, gate_id: gate.id }
        })
      },
      output: outputOf('挂门禁结果'),
    },
    {
      name: 'kanban_gate_remove',
      description: '移除卡片上的一个门禁（gate_id 来自 kanban_gate_list）。',
      parameters: P({ card_id: STR('卡片 id', true), gate_id: STR('门禁 id', true) }, ['card_id', 'gate_id']),
      execute: async (args: any) => {
        return mutateBoard(fs, (board: any) => {
          const hit = findCardAny(board, String(args.card_id))
          if (!hit) return { ok: false, error: 'card not found: ' + args.card_id }
          const card = hit.card
          const before = (card.gates || []).length
          card.gates = (card.gates || []).filter((g: any) => g.id !== String(args.gate_id))
          if (card.gates.length === before) return { ok: false, error: 'gate not found: ' + args.gate_id }
          card.updatedAt = now()
          return { card_id: card.id, removed: true }
        })
      },
      output: outputOf('移除门禁结果'),
    },
    {
      name: 'kanban_gate_list',
      description: '列出卡片上挂的门禁（kind/on/config），配合 kanban_gate_check 预检。',
      parameters: P({ card_id: STR('卡片 id', true) }, ['card_id']),
      execute: async (args: any) => {
        const dataDir = await resolveDataDir(fs)
        const board = normalizeBoard((await readBoard(fs, dataDir)) || defaultBoard())
        const hit = findCardAny(board, String(args.card_id))
        if (!hit) return { ok: false, error: 'card not found: ' + args.card_id }
        return { ok: true, total: (hit.card.gates || []).length, gates: hit.card.gates || [] }
      },
      output: outputOf('门禁列表'),
    },
    {
      name: 'kanban_gate_check',
      description: '手动预检卡片上某行为的门禁（不执行动作）：返回是否通过与失败原因。action 为 move（可带 to 目标列名）/ tags / archive。',
      parameters: P({
        card_id: STR('卡片 id', true),
        action: STR('动作：move / tags / archive', true),
        to: STR('move 时的目标列名（可选）'),
      }, ['card_id', 'action']),
      execute: async (args: any) => {
        const dataDir = await resolveDataDir(fs)
        const board = normalizeBoard((await readBoard(fs, dataDir)) || defaultBoard())
        const hit = findCardAny(board, String(args.card_id))
        if (!hit) return { ok: false, error: 'card not found: ' + args.card_id }
        const action = String(args.action)
        if (!['move', 'tags', 'archive'].includes(action)) return { ok: false, error: 'unknown action: ' + action }
        const res = await checkGates(hit.card, action as any, gateDeps, { to: args.to ? String(args.to) : undefined })
        return { ok: res.ok, action, failed: res.failed }
      },
      output: outputOf('门禁预检结果'),
    },
  ]
}
