// host/tools/card.ts — 卡片类 10 个 agent 工具：查询（view/get_card/search/recent）+ 操作（create/move/update/tags/comment/delete）
// v4：move/tags 触发门禁检查（gateDeps 注入）；create 支持 template 预填。
import { FsLike, normalizeBoard } from '../board'
import {
  mutateBoard, readBoard, resolveDataDir, defaultBoard,
  findCardAny, findCardGlobal, resolveColumn, cardSummary,
  normalizeContent, contentText, cardRepo, appendActivity, safeId, now,
} from '../board'
import { P, STR, STRS, NUM, outputOf } from './shared'
import { checkGates, GateCheckDeps } from '../gate'

export function cardToolDefs(fs: FsLike, gateDeps: GateCheckDeps): any[] {
  return [
    {
      // 看板全览：平铺列或按 git 仓库分组（group_by=repo）
      name: 'kanban_view',
      description: '查看整个看板：所有列（状态）及其中的卡片概要。适合 agent 了解全局。group_by=repo 时按 git 仓库分组返回。',
      parameters: P({ group_by: STR('分组方式：none（默认，平铺列）或 repo（按 github-repo 关联分组）') }),
      execute: async (args: any) => {
        const dataDir = await resolveDataDir(fs)
        const board = (await readBoard(fs, dataDir)) || defaultBoard()
        const columns = (board.columns || []).map((col: any) => ({
          id: col.id, title: col.title, count: (col.cards || []).length,
          cards: (col.cards || []).map((k: any) => cardSummary(k, col)),
        }))
        if (args && args.group_by === 'repo') {
          const groups: any[] = []
          const map = new Map<string, any[]>()
          for (const col of board.columns || []) {
            for (const k of col.cards || []) {
              const key = cardRepo(k) || '__none__'
              if (!map.has(key)) map.set(key, [])
              map.get(key)!.push(cardSummary(k, col))
            }
          }
          for (const [key, cards] of map) {
            groups.push({ key: key === '__none__' ? '' : key, label: key === '__none__' ? '未关联' : key, count: cards.length, cards })
          }
          groups.sort((a, b) => (a.key === '' ? 1 : b.key === '' ? -1 : a.key < b.key ? -1 : 1))
          return { ok: true, group_by: 'repo', total: board.columns.reduce((n: number, c: any) => n + (c.cards || []).length, 0), groups }
        }
        return { ok: true, board: { columns } }
      },
      output: outputOf('看板全览'),
    },
    {
      // 单卡详情：含富文本内容块、评论、变更记录、关联；归档卡也可查（archived=true）
      name: 'kanban_get_card',
      description: '按卡片 id 获取单个卡片的完整详情：标题、描述、富文本内容、状态、标签、评论、变更记录。归档卡片也可查（输出带 archived=true）。',
      parameters: P({ card_id: STR('卡片 id（来自 kanban_view / kanban_search 的结果）') }, ['card_id']),
      execute: async (args: any) => {
        return mutateBoard(fs, (board: any) => {
          const hit = findCardAny(board, String(args.card_id))
          if (!hit) return null
          const { card } = hit
          return {
            card: {
              ...cardSummary(card, hit.col), archived: hit.archived,
              description: card.description || '', content: card.content || [], contentText: contentText(card),
              comments: card.comments || [], activity: card.activity || [], refs: card.refs || [], meta: card.meta || {},
              gate_ids: card.gateIds || [], gates: card.gates || [],
            },
            column: hit.col ? { id: hit.col.id, title: hit.col.title } : null,
          }
        })
      },
      output: outputOf('卡片详情'),
    },
    {
      // 条件查询：keyword/status/tags/repo/archived 组合
      name: 'kanban_search',
      description: '按条件查询卡片：keyword 匹配标题/描述/富文本内容；status 为列名或列 id；tags 要求卡片包含全部标签；repo 按 git 仓库（github-repo 关联，如 owner/repo）筛选；archived=true 时查询归档而非活动列。条件可组合，不传则返回全部。',
      parameters: P({
        keyword: STR('关键词，匹配标题/描述/内容（模糊，不区分大小写）'),
        status: STR('列名或列 id，如 "待办"、"进行中"、列 id'),
        tags: STRS('要求的标签列表，卡片需包含其中全部'),
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
          for (const card of board.archive || []) pools.push([null, card])
        } else {
          for (const col of board.columns || []) {
            if (args.status && col.id !== args.status && col.title !== args.status) continue
            for (const card of col.cards || []) pools.push([col, card])
          }
        }
        for (const [col, card] of pools) {
          if (kw) {
            const hay = ((card.title || '') + ' ' + (card.description || '') + ' ' + contentText(card)).toLowerCase()
            if (hay.indexOf(kw) < 0) continue
          }
          if (tagList.length > 0) {
            const cardTags: string[] = card.tags || []
            if (!tagList.every((t) => cardTags.includes(t))) continue
          }
          if (repoFilter && cardRepo(card) !== repoFilter) continue
          out.push(cardSummary(card, col))
        }
        return { ok: true, total: out.length, cards: out, archived: wantArchived }
      },
      output: outputOf('查询结果'),
    },
    {
      // 最近改动：列 + 归档统一按 updatedAt 倒序
      name: 'kanban_recent',
      description: '查询最近被改动的卡片（按 updatedAt 倒序，含归档），默认 10 张，可用于了解看板最新动态。',
      parameters: P({ limit: NUM('返回条数，默认 10，最大 50') }),
      execute: async (args: any) => {
        const dataDir = await resolveDataDir(fs)
        const board = (await readBoard(fs, dataDir)) || defaultBoard()
        const all: any[] = []
        for (const col of board.columns || []) {
          for (const card of col.cards || []) all.push({ card, col, archived: false })
        }
        for (const card of board.archive || []) all.push({ card, col: null, archived: true })
        const limit = Math.min(Math.max(parseInt(args.limit, 10) || 10, 1), 50)
        all.sort((a, b) => String(b.card.updatedAt || '').localeCompare(String(a.card.updatedAt || '')))
        return { ok: true, cards: all.slice(0, limit).map((x) => ({ ...cardSummary(x.card, x.col), archived: x.archived })) }
      },
      output: outputOf('最近改动'),
    },
    {
      // 新建卡片：title 必填；content 支持块数组或字符串
      name: 'kanban_create',
      description: '新建卡片。title 必填；status 为列名或列 id（缺省放入第一列）；可带 description、content（富文本块数组或 markdown 字符串）、tags；template 传创建模板名或 id（预填 description/tags/content/gates，显式传参覆盖模板）。自动关联创建者会话（refs 挂 kind=session，会话「任务」tab 可见）。仅当用户要求使用看板/工作流时调用；非 workflow 模式不要默认建卡。',
      parameters: P({
        title: STR('卡片标题（必填）'),
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
          const card: any = {
            id: safeId('k'), title: t,
            description: args.description !== undefined ? String(args.description) : (tpl && tpl.description ? String(tpl.description) : ''),
            content: args.content !== undefined ? normalizeContent(args.content) : (tpl && Array.isArray(tpl.content) ? JSON.parse(JSON.stringify(tpl.content)) : []),
            links: [], refs: [], meta: {}, comments: [], activity: [],
            tags: args.tags !== undefined ? args.tags.map((x: any) => String(x)) : (tpl && Array.isArray(tpl.tags) ? tpl.tags.map((x: any) => String(x)) : []),
            gateIds: tpl && Array.isArray(tpl.gateIds) ? [...tpl.gateIds] : [],
            createdAt: now(), updatedAt: now(),
          }
          // 自动关联当前会话（exec.agent 为调用方 agent；会话「任务」tab 按 refs session 过滤）
          const sessionId = exec && exec.agent && exec.agent.id ? String(exec.agent.id) : ''
          if (sessionId && !card.refs.some((r: any) => r.kind === 'session' && String(r.externalId) === sessionId)) {
            card.refs.push({ id: safeId('r'), kind: 'session', platform: 'dsh', externalId: sessionId, url: '', display: '本会话', meta: {}, createdAt: now() })
          }
          appendActivity(card, '创建卡片' + (tpl ? '（模板：' + tpl.name + '）' : '') + (sessionId ? '，关联本会话' : ''))
          col.cards.push(card)
          return { card_id: card.id, column: col.title, template: tpl ? tpl.name : null }
        })
      },
      output: outputOf('创建结果'),
    },
    {
      // 跨列移动（v4：触发 move 门禁检查）
      name: 'kanban_move',
      description: '移动卡片到目标状态（列）。status 传列名或列 id，如"进行中"。卡片挂有 move 门禁时，不通过则拒绝移动。',
      parameters: P({ card_id: STR('要移动的卡片 id'), status: STR('目标列名或列 id') }, ['card_id', 'status']),
      execute: async (args: any, exec: any) => {
        const dataDir = await resolveDataDir(fs)
        const board0 = normalizeBoard((await readBoard(fs, dataDir)) || defaultBoard())
        const hit0 = findCardGlobal(board0, String(args.card_id))
        if (!hit0) return { ok: false, error: 'card not found: ' + args.card_id }
        const to0 = resolveColumn(board0, args.status)
        if (!to0) return { ok: false, error: 'column not found: ' + String(args.status) }
        // 门禁（to 传目标列标题，config.to 可限定目标列）；execCtx 透传调用方 agent/signal（pipeline 门禁评审用）
        const gate = await checkGates(hit0.card, board0, 'move', gateDeps, { to: to0.title }, { agent: exec && exec.agent, signal: exec && exec.signal })
        if (!gate.ok) return { ok: false, error: '门禁未通过：' + gate.failed.map((f) => f.reason).join('；') }
        return mutateBoard(fs, (board: any) => {
          const hit = findCardGlobal(board, String(args.card_id))
          if (!hit) return null
          const to = resolveColumn(board, args.status)
          if (!to) return { ok: false, error: 'column not found: ' + String(args.status) }
          if (to.id === hit.col.id) return { ok: false, error: 'card already in column ' + to.title }
          hit.col.cards = hit.col.cards.filter((k: any) => k.id !== hit.card.id)
          hit.card.updatedAt = now()
          appendActivity(hit.card, '状态变更：' + hit.col.title + ' → ' + to.title)
          to.cards.push(hit.card)
          return { card_id: hit.card.id, from: hit.col.title, to: to.title }
        })
      },
      output: outputOf('移动结果'),
    },
    {
      // 更新标题/描述/富文本内容（内容实际变化才记日志）
      name: 'kanban_update',
      description: '更新卡片的标题、描述（一句话纯文本）或富文本内容（只更新传入的字段；内容实际变化才会记录变更日志）。',
      parameters: P({
        card_id: STR('卡片 id'),
        title: STR('新标题（可选）'),
        description: STR('新描述（可选，纯文本一句话）'),
        content: { type: 'array', items: { type: 'object', additionalProperties: true }, description: '新富文本块数组（可选）；也可传字符串自动转文本块' },
      }, ['card_id']),
      execute: async (args: any) => {
        return mutateBoard(fs, (board: any) => {
          const hit = findCardAny(board, String(args.card_id))
          if (!hit) return null
          const { card } = hit
          let changed = false
          if (args.title !== undefined && String(args.title).trim() !== '' && card.title !== String(args.title).trim()) { card.title = String(args.title).trim(); changed = true }
          if (args.description !== undefined && (card.description || '') !== String(args.description)) { card.description = String(args.description); changed = true }
          if (args.content !== undefined) {
            const next = normalizeContent(args.content)
            const cur = Array.isArray(card.content) ? card.content : []
            if (JSON.stringify(next) !== JSON.stringify(cur)) { card.content = next; changed = true }
          }
          if (changed) { card.updatedAt = now(); appendActivity(card, '更新卡片') }
          return { card_id: card.id, changed }
        })
      },
      output: outputOf('更新结果'),
    },
    {
      // 标签增减（v4：触发 tags 门禁检查）
      name: 'kanban_tags',
      description: '为卡片增减标签。add 与 remove 为标签名数组，可同时传；返回卡片当前标签列表。卡片挂有 tags 门禁时，不通过则拒绝。',
      parameters: P({ card_id: STR('卡片 id'), add: STRS('要添加的标签（可选）'), remove: STRS('要移除的标签（可选）') }, ['card_id']),
      execute: async (args: any) => {
        const dataDir = await resolveDataDir(fs)
        const board0 = normalizeBoard((await readBoard(fs, dataDir)) || defaultBoard())
        const hit0 = findCardAny(board0, String(args.card_id))
        if (!hit0) return { ok: false, error: 'card not found: ' + args.card_id }
        const gate = await checkGates(hit0.card, board0, 'tags', gateDeps)
        if (!gate.ok) return { ok: false, error: '门禁未通过：' + gate.failed.map((f) => f.reason).join('；') }
        return mutateBoard(fs, (board: any) => {
          const hit = findCardAny(board, String(args.card_id))
          if (!hit) return null
          const card = hit.card
          if (!Array.isArray(card.tags)) card.tags = []
          const adds: string[] = Array.isArray(args.add) ? args.add.map((x: any) => String(x).trim()).filter((x: string) => x) : []
          const rems: string[] = Array.isArray(args.remove) ? args.remove.map((x: any) => String(x).trim()).filter((x: string) => x) : []
          for (const t of adds) { if (!card.tags.includes(t)) { card.tags.push(t); appendActivity(card, '添加标签：' + t) } }
          for (const t of rems) { const i = card.tags.indexOf(t); if (i >= 0) { card.tags.splice(i, 1); appendActivity(card, '移除标签：' + t) } }
          if (adds.length > 0 || rems.length > 0) card.updatedAt = now()
          return { card_id: card.id, tags: card.tags }
        })
      },
      output: outputOf('标签结果'),
    },
    {
      // 评论
      name: 'kanban_comment',
      description: '给卡片添加一条评论。',
      parameters: P({ card_id: STR('卡片 id'), text: STR('评论内容') }, ['card_id', 'text']),
      execute: async (args: any) => {
        return mutateBoard(fs, (board: any) => {
          const hit = findCardAny(board, String(args.card_id))
          if (!hit) return null
          const text = String(args.text).trim()
          if (!text) return { ok: false, error: 'text is required' }
          const card = hit.card
          if (!Array.isArray(card.comments)) card.comments = []
          const cid = safeId('m')
          card.comments.push({ id: cid, text, createdAt: now() })
          card.updatedAt = now()
          appendActivity(card, '添加评论')
          return { card_id: card.id, comment_id: cid }
        })
      },
      output: outputOf('评论结果'),
    },
    {
      // 删除：活动列或归档均可（不可恢复）
      name: 'kanban_delete',
      description: '删除一张卡片（不可恢复）。归档卡片也可删除。',
      parameters: P({ card_id: STR('卡片 id') }, ['card_id']),
      execute: async (args: any) => {
        return mutateBoard(fs, (board: any) => {
          const hit = findCardAny(board, String(args.card_id))
          if (!hit) return null
          if (hit.archived) {
            board.archive = (board.archive || []).filter((k: any) => k.id !== hit.card.id)
          } else {
            hit.col.cards = hit.col.cards.filter((k: any) => k.id !== hit.card.id)
          }
          return { card_id: String(args.card_id), deleted: true, archived: hit.archived }
        })
      },
      output: outputOf('删除结果'),
    },
  ]
}
