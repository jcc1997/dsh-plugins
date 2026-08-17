// host/tools/ref.ts — 外部关联 2 个 agent 工具：link / unlink（refs：github-repo/branch/mr、local-repo、session…）
import { FsLike } from '../board'
import { mutateBoard, findCardAny, appendActivity, safeId, now } from '../board'
import { P, STR, outputOf } from './shared'

export function refToolDefs(fs: FsLike): any[] {
  return [
    {
      name: 'kanban_link',
      description: '给Ticket添加外部关联引用（refs）：github-repo / github-branch / github-mr / local-repo / jira-issue 等。kind 格式 <platform>-<type>；platform 缺省取 kind 前缀；重复（同 kind + external_id）拒绝。',
      parameters: P({
        card_id: STR('Ticket id'),
        kind: STR('引用类型：github-repo / github-branch / github-mr / local-repo / jira-issue 等'),
        external_id: STR('提供方侧 ID：repo 全名（owner/repo）、MR 号、jira key、本地路径等'),
        platform: STR('提供方键（github/jira 等），缺省从 kind 前缀推导'),
        url: STR('可点击链接（可选）'),
        display: STR('展示文本，如 branch 名 / MR 标题（可选）'),
        meta: { type: 'object', additionalProperties: true, description: '提供方自有轻量信息（可选）' },
      }, ['card_id', 'kind', 'external_id']),
      execute: async (args: any) => {
        return mutateBoard(fs, (board: any) => {
          const hit = findCardAny(board, String(args.card_id))
          if (!hit) return null
          const kind = String(args.kind).trim()
          const ext = String(args.external_id).trim()
          if (!kind) return { ok: false, error: 'kind is required' }
          if (!ext) return { ok: false, error: 'external_id is required' }
          const card = hit.card
          if (!Array.isArray(card.refs)) card.refs = []
          if (card.refs.some((r: any) => r.kind === kind && r.externalId === ext)) {
            return { ok: false, error: 'ref already exists: ' + kind + ' ' + ext }
          }
          const ref: any = {
            id: safeId('r'),
            kind,
            platform: args.platform !== undefined && String(args.platform).trim() ? String(args.platform).trim() : kind.split('-')[0],
            externalId: ext,
            url: args.url !== undefined && String(args.url).trim() ? String(args.url).trim() : '',
            display: args.display !== undefined && String(args.display).trim() ? String(args.display).trim() : '',
            meta: args.meta && typeof args.meta === 'object' ? args.meta : {},
            createdAt: now(),
          }
          card.refs.push(ref)
          card.updatedAt = now()
          appendActivity(card, '添加关联：' + ref.kind + ' ' + ext)
          return { card_id: card.id, ref_id: ref.id, refs: card.refs.length }
        })
      },
      output: outputOf('关联结果'),
    },
    {
      name: 'kanban_unlink',
      description: '移除Ticket的某个外部关联引用（refs）。ref_id 来自 kanban_get_card / kanban_link 结果。',
      parameters: P({ card_id: STR('Ticket id'), ref_id: STR('要移除的 ref id') }, ['card_id', 'ref_id']),
      execute: async (args: any) => {
        return mutateBoard(fs, (board: any) => {
          const hit = findCardAny(board, String(args.card_id))
          if (!hit) return null
          const card = hit.card
          if (!Array.isArray(card.refs)) card.refs = []
          const idx = card.refs.findIndex((r: any) => r.id === String(args.ref_id))
          if (idx < 0) return { ok: false, error: 'ref not found: ' + String(args.ref_id) }
          const [removed] = card.refs.splice(idx, 1)
          card.updatedAt = now()
          appendActivity(card, '移除关联：' + (removed.kind || 'ref') + ' ' + (removed.externalId || ''))
          return { card_id: card.id, removed: removed.id, refs: card.refs.length }
        })
      },
      output: outputOf('移除结果'),
    },
  ]
}
