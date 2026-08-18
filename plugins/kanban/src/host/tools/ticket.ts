// host/tools/ticket.ts — Ticket类 10 个 agent 工具：查询（view/get_ticket/search/recent）+ 操作（create/move/update/tags/comment/delete）
// v4：move/tags 触发门禁检查（gateDeps 注入）；create 支持 template 预填。
import { FsLike, normalizeBoard } from '../board'
import {
  mutateBoard, readBoard, resolveDataDir, defaultBoard,
  findTicketAny, findTicketGlobal, resolveColumn, ticketSummary,
  normalizeContent, contentText, ticketRepo, appendActivity, safeId, now,
  sessionTitleMap, decorateSessionRefs,
} from '../board'
import { P, STR, STRS, NUM, outputOf } from './shared'
import { checkGates, GateCheckDeps } from '../gate'

export function ticketToolDefs(fs: FsLike, gateDeps: GateCheckDeps): any[] {
  return [
    {
      // Kanban 全览：平铺列或按 git 仓库分组（group_by=repo）
      name: 'kanban_ticket_view',
      description: '查看整个Kanban：所有列（状态）及其中的Ticket 概要。适合 agent 了解全局。group_by=repo 时按 git 仓库分组返回。',
      parameters: P({ group_by: STR('分组方式：none（默认，平铺列）或 repo（按 github-repo 关联分组）') }),
      execute: async (args: any) => {
        const dataDir = await resolveDataDir(fs)
        const board = (await readBoard(fs, dataDir)) || defaultBoard()
        const columns = (board.columns || []).map((col: any) => ({
          id: col.id, title: col.title, count: (col.tickets || []).length,
          tickets: (col.tickets || []).map((k: any) => ticketSummary(k, col)),
        }))
        if (args && args.group_by === 'repo') {
          const groups: any[] = []
          const map = new Map<string, any[]>()
          for (const col of board.columns || []) {
            for (const k of col.tickets || []) {
              const key = ticketRepo(k) || '__none__'
              if (!map.has(key)) map.set(key, [])
              map.get(key)!.push(ticketSummary(k, col))
            }
          }
          for (const [key, tickets] of map) {
            groups.push({ key: key === '__none__' ? '' : key, label: key === '__none__' ? '未关联' : key, count: tickets.length, tickets })
          }
          groups.sort((a, b) => (a.key === '' ? 1 : b.key === '' ? -1 : a.key < b.key ? -1 : 1))
          return { ok: true, group_by: 'repo', total: board.columns.reduce((n: number, c: any) => n + (c.tickets || []).length, 0), groups }
        }
        return { ok: true, board: { columns } }
      },
      output: outputOf('Kanban 全览'),
    },
    {
      // 单卡详情：含富文本内容块、评论、变更记录、关联；归档卡也可查（archived=true）
      name: 'kanban_ticket_get',
      description: '按Ticket id 获取单个Ticket的完整详情：标题、描述、富文本内容、状态、标签、评论、变更记录。归档Ticket也可查（输出带 archived=true）。',
      parameters: P({ ticket_id: STR('Ticket id（来自 kanban_ticket_view / kanban_ticket_search 的结果）') }, ['ticket_id']),
      execute: async (args: any) => {
        // 会话关联 ref 补真实会话名（占位「本会话」→ 会话标题）；读宿主缓存失败不影响查询
        const titles = await sessionTitleMap(fs)
        return mutateBoard(fs, (board: any) => {
          const hit = findTicketAny(board, String(args.ticket_id))
          if (!hit) return null
          const { ticket } = hit
          decorateSessionRefs(ticket, titles)
          return {
            ticket: {
              ...ticketSummary(ticket, hit.col), archived: hit.archived,
              description: ticket.description || '', content: ticket.content || [], contentText: contentText(ticket),
              comments: ticket.comments || [], activity: ticket.activity || [], refs: ticket.refs || [], meta: ticket.meta || {},
              gate_ids: ticket.gateIds || [], gates: ticket.gates || [],
            },
            column: hit.col ? { id: hit.col.id, title: hit.col.title } : null,
          }
        })
      },
      output: outputOf('Ticket 详情'),
    },
    {
      // 条件查询：keyword/status/tags/repo/archived 组合
      name: 'kanban_ticket_search',
      description: '按条件查询Ticket：keyword 匹配标题/描述/富文本内容；status 为列名或列 id；tags 要求Ticket包含全部标签；repo 按 git 仓库（github-repo 关联，如 owner/repo）筛选；archived=true 时查询归档而非活动列。条件可组合，不传则返回全部。',
      parameters: P({
        keyword: STR('关键词，匹配标题/描述/内容（模糊，不区分大小写）'),
        status: STR('列名或列 id，如 "待办"、"进行中"、列 id'),
        tags: STRS('要求的标签列表，Ticket需包含其中全部'),
        repo: STR('git 仓库（github-repo 关联的 externalId，如 jcc1997/dsh-plugins）'),
        archived: { type: 'boolean', description: 'true 时在归档中查询（默认 false 查询活动列）' },
      }),
      execute: async (args: any) => {
        const dataDir = await resolveDataDir(fs)
        const board = (await readBoard(fs, dataDir)) || defaultBoard()
        const kw = args.keyword ? String(args.keyword).toLowerCase() : ''
        const tagList: string[] = Array.isArray(args.tags) ? args.tags.map((t: any) => String(t)) : []
        const repoFilter = args.repo ? String(args.repo) : ''
        const wantArchived = args.archived === true
        const out: any[] = []
        const pools: Array<[any, any]> = []
        if (wantArchived) {
          for (const ticket of board.archive || []) pools.push([null, ticket])
        } else {
          for (const col of board.columns || []) {
            if (args.status && col.id !== args.status && col.title !== args.status) continue
            for (const ticket of col.tickets || []) pools.push([col, ticket])
          }
        }
        for (const [col, ticket] of pools) {
          if (kw) {
            const hay = ((ticket.title || '') + ' ' + (ticket.description || '') + ' ' + contentText(ticket)).toLowerCase()
            if (hay.indexOf(kw) < 0) continue
          }
          if (tagList.length > 0) {
            const ticketTags: string[] = ticket.tags || []
            if (!tagList.every((t) => ticketTags.includes(t))) continue
          }
          if (repoFilter && ticketRepo(ticket) !== repoFilter) continue
          out.push(ticketSummary(ticket, col))
        }
        return { ok: true, total: out.length, tickets: out, archived: wantArchived }
      },
      output: outputOf('查询结果'),
    },
    {
      // 最近改动：列 + 归档统一按 updatedAt 倒序
      name: 'kanban_ticket_recent',
      description: '查询最近被改动的Ticket（按 updatedAt 倒序，含归档），默认 10 张，可用于了解Kanban 最新动态。',
      parameters: P({ limit: NUM('返回条数，默认 10，最大 50') }),
      execute: async (args: any) => {
        const dataDir = await resolveDataDir(fs)
        const board = (await readBoard(fs, dataDir)) || defaultBoard()
        const all: any[] = []
        for (const col of board.columns || []) {
          for (const ticket of col.tickets || []) all.push({ ticket, col, archived: false })
        }
        for (const ticket of board.archive || []) all.push({ ticket, col: null, archived: true })
        const limit = Math.min(Math.max(parseInt(args.limit, 10) || 10, 1), 50)
        all.sort((a, b) => String(b.ticket.updatedAt || '').localeCompare(String(a.ticket.updatedAt || '')))
        return { ok: true, tickets: all.slice(0, limit).map((x) => ({ ...ticketSummary(x.ticket, x.col), archived: x.archived })) }
      },
      output: outputOf('最近改动'),
    },
    {
      // 新建Ticket：title 必填；content 支持块数组或字符串
      name: 'kanban_ticket_create',
      description: '新建Ticket。title 必填；status 为列名或列 id（缺省放入第一列）；可带 description、content（富文本块数组或 markdown 字符串）、tags；template 传创建模板名或 id（预填 description/tags/content/gates，显式传参覆盖模板）。自动关联创建者会话（refs 挂 kind=session，会话「Ticket」tab 可见）。仅当用户要求使用Kanban/工作流时调用；非 workflow 模式不要默认建卡，创建前先用 ask_user_question 与用户确认。',
      parameters: P({
        title: STR('Ticket 标题（必填）'),
        status: STR('目标列名或列 id，缺省第一列'),
        description: STR('一句话纯文本描述'),
        content: { type: 'array', items: { type: 'object', additionalProperties: true }, description: '富文本块数组：[{ type: "text|h1|h2|h3|bullet|ordered|check|quote|code|divider|image", text?, url?, checked? }]；也可传字符串自动转文本块' },
        tags: STRS('初始标签列表'),
        template: STR('创建模板名或 id（可选）：预填 description/tags/content/gates；显式传参覆盖模板值'),
      }, ['title']),
      execute: async (args: any, exec: any) => {
        return mutateBoard(fs, (board: any) => {
          const col = resolveColumn(board, args.status)
          if (!col) return { ok: false, error: 'column not found: ' + String(args.status) }
          const t = String(args.title).trim()
          if (!t) return { ok: false, error: 'title is required' }
          // 模板解析（按名或 id）
          let tpl: any = null
          if (args.template) {
            const ts = String(args.template)
            tpl = (board.templates || []).find((x: any) => x.id === ts || x.name === ts) || null
            if (!tpl) return { ok: false, error: 'template not found: ' + ts }
          }
          const ticket: any = {
            id: safeId('k'), title: t,
            description: args.description !== undefined ? String(args.description) : (tpl && tpl.description ? String(tpl.description) : ''),
            content: args.content !== undefined ? normalizeContent(args.content) : (tpl && Array.isArray(tpl.content) ? JSON.parse(JSON.stringify(tpl.content)) : []),
            links: [], refs: [], meta: {}, comments: [], activity: [],
            tags: args.tags !== undefined ? args.tags.map((x: any) => String(x)) : (tpl && Array.isArray(tpl.tags) ? tpl.tags.map((x: any) => String(x)) : []),
            gateIds: tpl && Array.isArray(tpl.gateIds) ? [...tpl.gateIds] : [],
            createdAt: now(), updatedAt: now(),
          }
          // 自动关联当前会话（exec.agent 为调用方 agent；会话「Ticket」tab 按 refs session 过滤）
          const sessionId = exec && exec.agent && exec.agent.id ? String(exec.agent.id) : ''
          if (sessionId && !ticket.refs.some((r: any) => r.kind === 'session' && String(r.externalId) === sessionId)) {
            ticket.refs.push({ id: safeId('r'), kind: 'session', platform: 'dsh', externalId: sessionId, url: '', display: '本会话', meta: {}, createdAt: now() })
          }
          appendActivity(ticket, '创建Ticket' + (tpl ? '（模板：' + tpl.name + '）' : '') + (sessionId ? '，关联本会话' : ''))
          col.tickets.push(ticket)
          return { ticket_id: ticket.id, column: col.title, template: tpl ? tpl.name : null }
        })
      },
      output: outputOf('创建结果'),
    },
    {
      // 跨列移动（v4：触发 move 门禁检查）
      name: 'kanban_ticket_move',
      description: '移动Ticket到目标状态（列）。status 传列名或列 id，如"进行中"。Ticket 挂有 move 门禁时，不通过则拒绝移动。',
      parameters: P({ ticket_id: STR('要移动的Ticket id'), status: STR('目标列名或列 id') }, ['ticket_id', 'status']),
      execute: async (args: any, exec: any) => {
        const dataDir = await resolveDataDir(fs)
        const board0 = normalizeBoard((await readBoard(fs, dataDir)) || defaultBoard())
        const hit0 = findTicketGlobal(board0, String(args.ticket_id))
        if (!hit0) return { ok: false, error: 'ticket not found: ' + args.ticket_id }
        const to0 = resolveColumn(board0, args.status)
        if (!to0) return { ok: false, error: 'column not found: ' + String(args.status) }
        // 门禁（to 传目标列标题，config.to 可限定目标列）；execCtx 透传调用方 agent/signal（pipeline 门禁评审用）
        const gate = await checkGates(hit0.ticket, board0, 'move', gateDeps, { to: to0.title }, { agent: exec && exec.agent, signal: exec && exec.signal })
        if (!gate.ok) return { ok: false, error: '门禁未通过：' + gate.failed.map((f) => f.reason).join('；') }
        return mutateBoard(fs, (board: any) => {
          const hit = findTicketGlobal(board, String(args.ticket_id))
          if (!hit) return null
          const to = resolveColumn(board, args.status)
          if (!to) return { ok: false, error: 'column not found: ' + String(args.status) }
          if (to.id === hit.col.id) return { ok: false, error: 'ticket already in column ' + to.title }
          hit.col.tickets = hit.col.tickets.filter((k: any) => k.id !== hit.ticket.id)
          hit.ticket.updatedAt = now()
          appendActivity(hit.ticket, '状态变更：' + hit.col.title + ' → ' + to.title)
          to.tickets.push(hit.ticket)
          return { ticket_id: hit.ticket.id, from: hit.col.title, to: to.title }
        })
      },
      output: outputOf('移动结果'),
    },
    {
      // 更新标题/描述/富文本内容（内容实际变化才记日志）
      name: 'kanban_ticket_update',
      description: '更新Ticket的标题、描述（一句话纯文本）或富文本内容（只更新传入的字段；内容实际变化才会记录变更日志）。',
      parameters: P({
        ticket_id: STR('Ticket id'),
        title: STR('新标题（可选）'),
        description: STR('新描述（可选，纯文本一句话）'),
        content: { type: 'array', items: { type: 'object', additionalProperties: true }, description: '新富文本块数组（可选）；也可传字符串自动转文本块' },
      }, ['ticket_id']),
      execute: async (args: any) => {
        return mutateBoard(fs, (board: any) => {
          const hit = findTicketAny(board, String(args.ticket_id))
          if (!hit) return null
          const { ticket } = hit
          let changed = false
          if (args.title !== undefined && String(args.title).trim() !== '' && ticket.title !== String(args.title).trim()) { ticket.title = String(args.title).trim(); changed = true }
          if (args.description !== undefined && (ticket.description || '') !== String(args.description)) { ticket.description = String(args.description); changed = true }
          if (args.content !== undefined) {
            const next = normalizeContent(args.content)
            const cur = Array.isArray(ticket.content) ? ticket.content : []
            if (JSON.stringify(next) !== JSON.stringify(cur)) { ticket.content = next; changed = true }
          }
          if (changed) { ticket.updatedAt = now(); appendActivity(ticket, '更新Ticket') }
          return { ticket_id: ticket.id, changed }
        })
      },
      output: outputOf('更新结果'),
    },
    {
      // 标签增减（v4：触发 tags 门禁检查）
      name: 'kanban_ticket_tags',
      description: '为Ticket增减标签。add 与 remove 为标签名数组，可同时传；返回Ticket 当前标签列表。Ticket 挂有 tags 门禁时，不通过则拒绝。',
      parameters: P({ ticket_id: STR('Ticket id'), add: STRS('要添加的标签（可选）'), remove: STRS('要移除的标签（可选）') }, ['ticket_id']),
      execute: async (args: any) => {
        const dataDir = await resolveDataDir(fs)
        const board0 = normalizeBoard((await readBoard(fs, dataDir)) || defaultBoard())
        const hit0 = findTicketAny(board0, String(args.ticket_id))
        if (!hit0) return { ok: false, error: 'ticket not found: ' + args.ticket_id }
        const gate = await checkGates(hit0.ticket, board0, 'tags', gateDeps)
        if (!gate.ok) return { ok: false, error: '门禁未通过：' + gate.failed.map((f) => f.reason).join('；') }
        return mutateBoard(fs, (board: any) => {
          const hit = findTicketAny(board, String(args.ticket_id))
          if (!hit) return null
          const ticket = hit.ticket
          if (!Array.isArray(ticket.tags)) ticket.tags = []
          const adds: string[] = Array.isArray(args.add) ? args.add.map((x: any) => String(x).trim()).filter((x: string) => x) : []
          const rems: string[] = Array.isArray(args.remove) ? args.remove.map((x: any) => String(x).trim()).filter((x: string) => x) : []
          for (const t of adds) { if (!ticket.tags.includes(t)) { ticket.tags.push(t); appendActivity(ticket, '添加标签：' + t) } }
          for (const t of rems) { const i = ticket.tags.indexOf(t); if (i >= 0) { ticket.tags.splice(i, 1); appendActivity(ticket, '移除标签：' + t) } }
          if (adds.length > 0 || rems.length > 0) ticket.updatedAt = now()
          return { ticket_id: ticket.id, tags: ticket.tags }
        })
      },
      output: outputOf('标签结果'),
    },
    {
      // 评论
      name: 'kanban_ticket_comment',
      description: '给Ticket添加一条评论。',
      parameters: P({ ticket_id: STR('Ticket id'), text: STR('评论内容') }, ['ticket_id', 'text']),
      execute: async (args: any) => {
        return mutateBoard(fs, (board: any) => {
          const hit = findTicketAny(board, String(args.ticket_id))
          if (!hit) return null
          const text = String(args.text).trim()
          if (!text) return { ok: false, error: 'text is required' }
          const ticket = hit.ticket
          if (!Array.isArray(ticket.comments)) ticket.comments = []
          const cid = safeId('m')
          ticket.comments.push({ id: cid, text, createdAt: now() })
          ticket.updatedAt = now()
          appendActivity(ticket, '添加评论')
          return { ticket_id: ticket.id, comment_id: cid }
        })
      },
      output: outputOf('评论结果'),
    },
    {
      // 删除：活动列或归档均可（不可恢复）
      name: 'kanban_ticket_delete',
      description: '删除一张Ticket（不可恢复）。归档Ticket也可删除。',
      parameters: P({ ticket_id: STR('Ticket id') }, ['ticket_id']),
      execute: async (args: any) => {
        return mutateBoard(fs, (board: any) => {
          const hit = findTicketAny(board, String(args.ticket_id))
          if (!hit) return null
          if (hit.archived) {
            board.archive = (board.archive || []).filter((k: any) => k.id !== hit.ticket.id)
          } else {
            hit.col.tickets = hit.col.tickets.filter((k: any) => k.id !== hit.ticket.id)
          }
          return { ticket_id: String(args.ticket_id), deleted: true, archived: hit.archived }
        })
      },
      output: outputOf('删除结果'),
    },
  ]
}
