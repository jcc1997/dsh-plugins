// host/tools/ref.ts — 外部关联 2 个 agent 工具：link / unlink（refs：github-repo/branch/mr、local-repo、session…）
import { FsLike } from '../board'
import { mutateBoard, findTicketAny, appendActivity, safeId, now } from '../board'
import { P, STR, outputOf } from './shared'

export function refToolDefs(fs: FsLike): any[] {
  return [
    {
      name: 'kanban_ticket_link',
      description: '给Ticket添加外部关联引用（refs）：github-repo / github-branch / github-mr / local-repo / jira-issue 等。kind 格式 <platform>-<type>；platform 缺省取 kind 前缀；重复（同 kind + external_id）拒绝。',
      parameters: P({
        ticket_id: STR('Ticket id'),
        kind: STR('引用类型：github-repo / github-branch / github-mr / local-repo / jira-issue 等'),
        external_id: STR('提供方侧 ID：repo 全名（owner/repo）、MR 号、jira key、本地路径等'),
        platform: STR('提供方键（github/jira 等），缺省从 kind 前缀推导'),
        url: STR('可点击链接（可选）'),
        display: STR('展示文本，如 branch 名 / MR 标题（可选）'),
        meta: { type: 'object', additionalProperties: true, description: '提供方自有轻量信息（可选）' },
      }, ['ticket_id', 'kind', 'external_id']),
      execute: async (args: any) => {
        return mutateBoard(fs, (board: any) => {
          const hit = findTicketAny(board, String(args.ticket_id))
          if (!hit) return null
          const kind = String(args.kind).trim()
          const ext = String(args.external_id).trim()
          if (!kind) return { ok: false, error: 'kind is required' }
          if (!ext) return { ok: false, error: 'external_id is required' }
          const ticket = hit.ticket
          if (!Array.isArray(ticket.refs)) ticket.refs = []
          if (ticket.refs.some((r: any) => r.kind === kind && r.externalId === ext)) {
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
          ticket.refs.push(ref)
          ticket.updatedAt = now()
          appendActivity(ticket, '添加关联：' + ref.kind + ' ' + ext)
          return { ticket_id: ticket.id, ref_id: ref.id, refs: ticket.refs.length }
        })
      },
      output: outputOf('关联结果'),
    },
    {
      name: 'kanban_ticket_unlink',
      description: '移除Ticket的某个外部关联引用（refs）。ref_id 来自 kanban_ticket_get / kanban_ticket_link 结果。',
      parameters: P({ ticket_id: STR('Ticket id'), ref_id: STR('要移除的 ref id') }, ['ticket_id', 'ref_id']),
      execute: async (args: any) => {
        return mutateBoard(fs, (board: any) => {
          const hit = findTicketAny(board, String(args.ticket_id))
          if (!hit) return null
          const ticket = hit.ticket
          if (!Array.isArray(ticket.refs)) ticket.refs = []
          const idx = ticket.refs.findIndex((r: any) => r.id === String(args.ref_id))
          if (idx < 0) return { ok: false, error: 'ref not found: ' + String(args.ref_id) }
          const [removed] = ticket.refs.splice(idx, 1)
          ticket.updatedAt = now()
          appendActivity(ticket, '移除关联：' + (removed.kind || 'ref') + ' ' + (removed.externalId || ''))
          return { ticket_id: ticket.id, removed: removed.id, refs: ticket.refs.length }
        })
      },
      output: outputOf('移除结果'),
    },
  ]
}
