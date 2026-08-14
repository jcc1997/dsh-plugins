// Host 入口：Package-private RPC（client） + 动态模型工具（agent 查询/操作看板）
interface FsLike {
  resolve(path: string, opts?: { cwd?: string; signal?: unknown }): Promise<{ targetKey: string; displayPath: string }>
  readText(target: { targetKey: string }, signal?: unknown): Promise<string>
  writeText(target: { targetKey: string }, content: string, expected?: unknown, signal?: unknown, sandboxPolicy?: { mode: string }): Promise<unknown>
}

interface HarnessLike {
  handle(method: string, handler: (args: unknown) => unknown): void
  defineTool(definition: unknown): unknown
  registerTool(ctx: unknown, tool: unknown): () => void
}

/** 受限环境注入的全局 */
declare const harness: HarnessLike

function makePlugin() {
  return {
    name: 'kanban',
    apply(ctx: { get(name: string): unknown; effect(cb: () => unknown): unknown }) {
      const fs = ctx.get('fs') as FsLike | undefined
      if (!fs) return

      const DEFAULT_DIR = '/Users/jinchao.chen/.dsh/kanban'
      const CONFIG_FILE = 'config.json'
      const BOARD_FILE = 'board.json'
      const WRITE_POLICY = { mode: 'danger-full-access' }
      const ACTOR_AGENT = 'agent'

      function defaultBoard() {
        const cols = ['待办', '进行中', '完成']
        return {
          version: 2,
          columns: cols.map((title) => ({ id: 'c' + Math.random().toString(36).slice(2, 10), title, cards: [], meta: {} })),
          archive: [],
          meta: {},
        }
      }

      async function resolveDataDir(): Promise<string> {
        try {
          const cfgTarget = await fs.resolve(DEFAULT_DIR + '/' + CONFIG_FILE)
          const text = await fs.readText(cfgTarget)
          const cfg = JSON.parse(text)
          if (cfg && typeof cfg.dataDir === 'string' && cfg.dataDir.length > 0) return cfg.dataDir
        } catch {
          /* 缺失/损坏 → 默认目录 */
        }
        return DEFAULT_DIR
      }

      async function readBoard(dataDir: string) {
        try {
          const target = await fs.resolve(dataDir + '/' + BOARD_FILE)
          const text = await fs.readText(target)
          return JSON.parse(text)
        } catch {
          return null
        }
      }

      async function writeBoard(dataDir: string, board: unknown) {
        const target = await fs.resolve(dataDir + '/' + BOARD_FILE)
        await fs.writeText(target, JSON.stringify(board, null, 2), undefined, undefined, WRITE_POLICY)
      }

      function now(): string {
        try { return new Date().toISOString() } catch { return '' }
      }
      function safeId(prefix: string): string {
        try { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8) } catch { return prefix + Math.floor(Math.random() * 1e9).toString(36) }
      }
      function appendActivity(card: any, text: string): void {
        if (!card.activity) card.activity = []
        card.activity.push({ id: safeId('a'), text, at: now(), actor: ACTOR_AGENT })
      }

      /** 读-改-写原子操作：fn 返回 null 表示失败（如卡片不存在） */
      async function mutateBoard(fn: (board: any) => any): Promise<any> {
        try {
          const dataDir = await resolveDataDir()
          const board = (await readBoard(dataDir)) || defaultBoard()
          if (!Array.isArray(board.archive)) board.archive = []
          const result = fn(board)
          if (result === null) return { ok: false, error: 'not found' }
          await writeBoard(dataDir, board)
          return { ok: true, ...(result || {}) }
        } catch (e) {
          return { ok: false, error: String(e && (e as Error).message ? (e as Error).message : e) }
        }
      }

      /** 全局按 id 找卡片（仅活动列） */
      function findCardGlobal(board: any, cardId: string): { col: any; card: any } | null {
        for (const col of board.columns || []) {
          const card = (col.cards || []).find((k: any) => k.id === cardId)
          if (card) return { col, card }
        }
        return null
      }
      /** 全局按 id 找卡片（含归档） */
      function findCardAny(board: any, cardId: string): { col: any; card: any; archived: boolean } | null {
        const hit = findCardGlobal(board, cardId)
        if (hit) return { col: hit.col, card: hit.card, archived: false }
        const card = (board.archive || []).find((k: any) => k.id === cardId)
        if (card) return { col: null, card, archived: true }
        return null
      }
      /** 按列名或列 id 解析列 */
      function resolveColumn(board: any, status?: string): any {
        if (!status) return (board.columns || [])[0]
        return (board.columns || []).find((c: any) => c.id === status || c.title === status) || null
      }
      function cardSummary(card: any, col: any): any {
        return { id: card.id, title: card.title, status: col ? col.title : '归档', column_id: col ? col.id : null, tags: card.tags || [], updatedAt: card.updatedAt, createdAt: card.createdAt }
      }

      /** 卡片 content 归一化：数组 → 清洗后的块数组；字符串 → 单文本块；其他 → 空 */
      function normalizeContent(raw: any): any[] {
        if (Array.isArray(raw)) {
          const out: any[] = []
          for (const b of raw) {
            if (b && typeof b === 'object' && typeof b.type === 'string') {
              out.push({
                id: typeof b.id === 'string' && b.id ? b.id : safeId('blk'),
                type: b.type,
                text: typeof b.text === 'string' ? b.text : '',
                ...(typeof b.url === 'string' ? { url: b.url } : {}),
                ...(typeof b.checked === 'boolean' ? { checked: b.checked } : {}),
              })
            }
          }
          return out
        }
        if (typeof raw === 'string' && raw.trim()) return [{ id: safeId('blk'), type: 'text', text: raw }]
        return []
      }
      /** 块数组 → 纯文本（搜索匹配 / agent 展示） */
      function contentText(card: any): string {
        const blocks = Array.isArray(card.content) ? card.content : []
        return blocks
          .map((b: any) => {
            if (b.type === 'image') return b.url ? '[图片]' : ''
            if (b.type === 'divider') return '---'
            const t = typeof b.text === 'string' ? b.text.replace(/<[^>]+>/g, ' ').trim() : ''
            return (b.type === 'check' ? (b.checked ? '[x] ' : '[ ] ') : '') + t
          })
          .filter((s: string) => s)
          .join('\n')
      }
      /** 卡片的 git 仓库（github-repo ref），无则空串 */
      function cardRepo(card: any): string {
        const refs: any[] = Array.isArray(card.refs) ? card.refs : []
        const r = refs.find((x) => x.kind === 'github-repo')
        return r && r.externalId ? String(r.externalId) : ''
      }

      /* ── Package-private RPC（client UI 用） ── */
      harness.handle('kanban/load', async () => {
        const dataDir = await resolveDataDir()
        const board = await readBoard(dataDir)
        if (board && !Array.isArray(board.archive)) board.archive = []
        return { board: board || defaultBoard(), dataDir }
      })
      harness.handle('kanban/save', async (args: unknown) => {
        const board = (args as { board?: unknown } | null)?.board
        if (!board || typeof board !== 'object') return { ok: false, error: 'missing board' }
        try {
          const dataDir = await resolveDataDir()
          await writeBoard(dataDir, board)
          return { ok: true }
        } catch (e) {
          return { ok: false, error: String(e && (e as Error).message ? (e as Error).message : e) }
        }
      })
      harness.handle('kanban/set-data-dir', async (args: unknown) => {
        const dir = (args as { dir?: string } | null)?.dir
        if (typeof dir !== 'string' || dir.trim().length === 0) return { ok: false, error: 'invalid dir' }
        const next = dir.trim()
        try {
          const oldDir = await resolveDataDir()
          if (oldDir !== next) {
            const board = await readBoard(oldDir)
            if (board) await writeBoard(next, board)
          }
          const cfgTarget = await fs.resolve(DEFAULT_DIR + '/' + CONFIG_FILE)
          await fs.writeText(cfgTarget, JSON.stringify({ dataDir: next }, null, 2), undefined, undefined, WRITE_POLICY)
          return { ok: true, dataDir: next }
        } catch (e) {
          return { ok: false, error: String(e && (e as Error).message ? (e as Error).message : e) }
        }
      })

      /* ── 会话「任务」tab 同步桥接（M3+）：槽位渲染授权仅限 sidebar 条目，
          会话 tab 内走跨插件服务通道 —— ctx.get('git').sync(cardId) ── */
      harness.handle('kanban/git-sync', async (args: unknown) => {
        const a = (args || {}) as { cardId?: string }
        if (!a.cardId) return { ok: false, error: 'cardId required' }
        const git = ctx.get('git') as any
        if (!git || typeof git.sync !== 'function') return { ok: false, error: 'git 插件未激活（无法同步）' }
        try {
          return await git.sync(String(a.cardId))
        } catch (e) {
          return { ok: false, error: String(e && (e as Error).message ? (e as Error).message : e) }
        }
      })

      /* ── 跨插件服务（数据模型 v2）：其他插件（如 git）经 ctx.get('kanban') 读写卡片 ── */
      const kanbanService = {
        getCard: async (cardId: string) => {
          const dataDir = await resolveDataDir()
          const board = (await readBoard(dataDir)) || defaultBoard()
          const hit = findCardAny(board, String(cardId))
          return hit ? hit.card : null
        },
        updateCard: async (cardId: string, patch: any) => {
          const p = patch || {}
          return mutateBoard((board: any) => {
            const hit = findCardAny(board, String(cardId))
            if (!hit) return null
            const card = hit.card
            if (Array.isArray(p.refs)) {
              card.refs = p.refs
              card.updatedAt = now()
              appendActivity(card, '更新外部关联')
            }
            if (p.meta && typeof p.meta === 'object') {
              if (!card.meta || typeof card.meta !== 'object') card.meta = {}
              for (const key of Object.keys(p.meta)) card.meta[key] = (p.meta as any)[key]
              card.updatedAt = now()
              if (typeof p.activity === 'string' && p.activity) appendActivity(card, p.activity)
            }
            return { ok: true, card_id: card.id }
          })
        },
        listCards: async () => {
          const dataDir = await resolveDataDir()
          const board = (await readBoard(dataDir)) || defaultBoard()
          const out: any[] = []
          for (const col of board.columns || []) {
            for (const card of col.cards || []) {
              const taskId = card.meta && typeof card.meta === 'object' ? (card.meta as any).taskId : null
              out.push({ id: card.id, title: card.title, taskId: taskId || null, status: col.title, archived: false, updatedAt: card.updatedAt })
            }
          }
          for (const card of board.archive || []) {
            const taskId = card.meta && typeof card.meta === 'object' ? (card.meta as any).taskId : null
            out.push({ id: card.id, title: card.title, taskId: taskId || null, status: '归档', archived: true, updatedAt: card.updatedAt })
          }
          return out
        },
      }
      ctx.provide('kanban', kanbanService)
      /* ── 动态模型工具（agent 用）：注册进当前 fiber，stop/update 自动移除 ── */
      const P = (properties: any, required: string[] = []) => ({ type: 'object', properties, required })
      const STR = (description: string) => ({ type: 'string', description })
      const STRS = (description: string) => ({ type: 'array', items: { type: 'string' }, description })
      const NUM = (description: string) => ({ type: 'number', description })
      const outputOf = (description: string) => ({ schema: { type: 'object', additionalProperties: true }, render: (args: unknown, value: unknown) => [{ type: 'text', text: description + '\n' + JSON.stringify(value, null, 2) }] })

      const defs: any[] = [
        {
          name: 'kanban_view',
          description: '查看整个看板：所有列（状态）及其中的卡片概要。适合 agent 了解全局。group_by=repo 时按 git 仓库分组返回。',
          parameters: P({
            group_by: STR('分组方式：none（默认，平铺列）或 repo（按 github-repo 关联分组）'),
          }),
          execute: async (args: any) => {
            const dataDir = await resolveDataDir()
            const board = (await readBoard(dataDir)) || defaultBoard()
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
                groups.push({
                  key: key === '__none__' ? '' : key,
                  label: key === '__none__' ? '未关联' : key,
                  count: cards.length,
                  cards,
                })
              }
              groups.sort((a, b) => (a.key === '' ? 1 : b.key === '' ? -1 : a.key < b.key ? -1 : 1))
              return { ok: true, group_by: 'repo', total: board.columns.reduce((n: number, c: any) => n + (c.cards || []).length, 0), groups }
            }
            return { ok: true, board: { columns } }
          },
          output: outputOf('看板全览'),
        },
        {
          name: 'kanban_get_card',
          description: '按卡片 id 获取单个卡片的完整详情：标题、描述、富文本内容、状态、标签、评论、变更记录。归档卡片也可查（输出带 archived=true）。',
          parameters: P({ card_id: STR('卡片 id（来自 kanban_view / kanban_search 的结果）') }, ['card_id']),
          execute: async (args: any) => {
            return mutateBoard((board: any) => {
              const hit = findCardAny(board, String(args.card_id))
              if (!hit) return null
              const { card } = hit
              return { card: { ...cardSummary(card, hit.col), archived: hit.archived, description: card.description || '', content: card.content || [], contentText: contentText(card), comments: card.comments || [], activity: card.activity || [], refs: card.refs || [], meta: card.meta || {} }, column: hit.col ? { id: hit.col.id, title: hit.col.title } : null }
            })
          },
          output: outputOf('卡片详情'),
        },
        {
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
            const dataDir = await resolveDataDir()
            const board = (await readBoard(dataDir)) || defaultBoard()
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
          name: 'kanban_recent',
          description: '查询最近被改动的卡片（按 updatedAt 倒序，含归档），默认 10 张，可用于了解看板最新动态。',
          parameters: P({ limit: NUM('返回条数，默认 10，最大 50') }),
          execute: async (args: any) => {
            const dataDir = await resolveDataDir()
            const board = (await readBoard(dataDir)) || defaultBoard()
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
          name: 'kanban_create',
          description: '新建卡片。title 必填；status 为列名或列 id（缺省放入第一列）；可带 description（一句话纯文本）、content（富文本块数组或 markdown 字符串）与 tags。',
          parameters: P({
            title: STR('卡片标题（必填）'),
            status: STR('目标列名或列 id，缺省第一列'),
            description: STR('一句话纯文本描述'),
            content: { type: 'array', items: { type: 'object', additionalProperties: true }, description: '富文本块数组：[{ type: "text|h1|h2|h3|bullet|ordered|check|quote|code|divider|image", text?, url?, checked? }]；也可传字符串自动转文本块' },
            tags: STRS('初始标签列表'),
          }, ['title']),
          execute: async (args: any) => {
            return mutateBoard((board: any) => {
              const col = resolveColumn(board, args.status)
              if (!col) return { ok: false, error: 'column not found: ' + String(args.status) }
              const t = String(args.title).trim()
              if (!t) return { ok: false, error: 'title is required' }
              const card: any = {
                id: safeId('k'), title: t, description: args.description || '', content: normalizeContent(args.content), links: [], refs: [], meta: {},
                comments: [], activity: [], tags: Array.isArray(args.tags) ? args.tags.map((x: any) => String(x)) : [],
                createdAt: now(), updatedAt: now(),
              }
              appendActivity(card, '创建卡片')
              col.cards.push(card)
              return { card_id: card.id, column: col.title }
            })
          },
          output: outputOf('创建结果'),
        },
        {
          name: 'kanban_move',
          description: '移动卡片到目标状态（列）。status 传列名或列 id，如"进行中"。',
          parameters: P({ card_id: STR('要移动的卡片 id'), status: STR('目标列名或列 id') }, ['card_id', 'status']),
          execute: async (args: any) => {
            return mutateBoard((board: any) => {
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
          name: 'kanban_update',
          description: '更新卡片的标题、描述（一句话纯文本）或富文本内容（只更新传入的字段；内容实际变化才会记录变更日志）。',
          parameters: P({
            card_id: STR('卡片 id'),
            title: STR('新标题（可选）'),
            description: STR('新描述（可选，纯文本一句话）'),
            content: { type: 'array', items: { type: 'object', additionalProperties: true }, description: '新富文本块数组（可选）；也可传字符串自动转文本块' },
          }, ['card_id']),
          execute: async (args: any) => {
            return mutateBoard((board: any) => {
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
          name: 'kanban_tags',
          description: '为卡片增减标签。add 与 remove 为标签名数组，可同时传；返回卡片当前标签列表。',
          parameters: P({
            card_id: STR('卡片 id'),
            add: STRS('要添加的标签（可选）'),
            remove: STRS('要移除的标签（可选）'),
          }, ['card_id']),
          execute: async (args: any) => {
            return mutateBoard((board: any) => {
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
          name: 'kanban_comment',
          description: '给卡片添加一条评论。',
          parameters: P({ card_id: STR('卡片 id'), text: STR('评论内容') }, ['card_id', 'text']),
          execute: async (args: any) => {
            return mutateBoard((board: any) => {
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
          name: 'kanban_archive',
          description: '归档一张卡片：从看板列中移出（隐藏），可在侧边栏「归档」中找回。归档不删除数据。',
          parameters: P({ card_id: STR('要归档的卡片 id') }, ['card_id']),
          execute: async (args: any) => {
            return mutateBoard((board: any) => {
              const hit = findCardGlobal(board, String(args.card_id))
              if (!hit) return null
              const { card, col } = hit
              col.cards = col.cards.filter((k: any) => k.id !== card.id)
              card.archivedFrom = col.id
              card.archivedAt = now()
              card.updatedAt = now()
              appendActivity(card, '归档卡片')
              if (!Array.isArray(board.archive)) board.archive = []
              board.archive.push(card)
              return { card_id: card.id, from: col.title, archived: true }
            })
          },
          output: outputOf('归档结果'),
        },
        {
          name: 'kanban_unarchive',
          description: '从归档恢复卡片到看板。status 传列名或列 id（可选，缺省回到归档前的列，原列已删则回第一列）。',
          parameters: P({ card_id: STR('归档中的卡片 id'), status: STR('目标列名或列 id（可选，缺省回到原列）') }, ['card_id']),
          execute: async (args: any) => {
            return mutateBoard((board: any) => {
              const idx = (board.archive || []).findIndex((k: any) => k.id === String(args.card_id))
              if (idx < 0) return null
              const [card] = board.archive.splice(idx, 1)
              let to = args.status ? resolveColumn(board, args.status) : null
              if (!to) to = resolveColumn(board, card.archivedFrom) || resolveColumn(board)
              if (!to) return { ok: false, error: 'no column available' }
              card.updatedAt = now()
              appendActivity(card, '恢复卡片（归档）')
              to.cards.push(card)
              return { card_id: card.id, column: to.title, restored: true }
            })
          },
          output: outputOf('恢复结果'),
        },
        {
          name: 'kanban_list_archived',
          description: '列出归档中的卡片概要（含原列与归档时间）。归档卡片不在看板列中，需本工具或 kanban_search(archived=true) 查询。',
          parameters: P({}),
          execute: async () => {
            const dataDir = await resolveDataDir()
            const board = (await readBoard(dataDir)) || defaultBoard()
            const out = (board.archive || []).map((card: any) => {
              const col = card.archivedFrom ? resolveColumn(board, card.archivedFrom) : null
              return { id: card.id, title: card.title, tags: card.tags || [], archivedFrom: col ? col.title : '', archivedAt: card.archivedAt || '', updatedAt: card.updatedAt }
            })
            return { ok: true, total: out.length, cards: out }
          },
          output: outputOf('归档列表'),
        },
        {
          name: 'kanban_delete',
          description: '删除一张卡片（不可恢复）。归档卡片也可删除。',
          parameters: P({ card_id: STR('卡片 id') }, ['card_id']),
          execute: async (args: any) => {
            return mutateBoard((board: any) => {
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
        {
          name: 'kanban_add_column',
          description: '新建一列（状态）。title 必填；index 为插入位置（0 起，缺省追加到末尾）。',
          parameters: P({ title: STR('列标题（必填）'), index: NUM('插入位置（0 起，缺省末尾）') }, ['title']),
          execute: async (args: any) => {
            return mutateBoard((board: any) => {
              const title = String(args.title).trim()
              if (!title) return { ok: false, error: 'title is required' }
              const col: any = { id: safeId('c'), title, cards: [], meta: {} }
              const index = parseInt(args.index, 10)
              if (Number.isInteger(index) && index >= 0 && index < board.columns.length) board.columns.splice(index, 0, col)
              else board.columns.push(col)
              return { column_id: col.id, title, index: board.columns.indexOf(col) }
            })
          },
          output: outputOf('新建列结果'),
        },
        {
          name: 'kanban_rename_column',
          description: '重命名列（状态）。column_id 传列名或列 id；title 为新名称。',
          parameters: P({ column_id: STR('列名或列 id'), title: STR('新列名（必填）') }, ['column_id', 'title']),
          execute: async (args: any) => {
            return mutateBoard((board: any) => {
              const col = resolveColumn(board, args.column_id)
              if (!col) return { ok: false, error: 'column not found: ' + String(args.column_id) }
              const title = String(args.title).trim()
              if (!title) return { ok: false, error: 'title is required' }
              const from = col.title
              if (from === title) return { ok: true, column_id: col.id, changed: false }
              col.title = title
              return { column_id: col.id, from, to: title, changed: true }
            })
          },
          output: outputOf('重命名结果'),
        },
        {
          name: 'kanban_delete_column',
          description: '删除一列（状态）。column_id 传列名或列 id；列内有卡片时默认拒绝，force=true 可连卡片一起删除（不可恢复）。',
          parameters: P({ column_id: STR('列名或列 id'), force: { type: 'boolean', description: '列内有卡片时是否强制删除（默认 false）' } }, ['column_id']),
          execute: async (args: any) => {
            return mutateBoard((board: any) => {
              const colIdx = board.columns.findIndex((col: any) => col.id === args.column_id || col.title === args.column_id)
              if (colIdx < 0) return { ok: false, error: 'column not found: ' + String(args.column_id) }
              const col = board.columns[colIdx]
              const count = (col.cards || []).length
              if (count > 0 && args.force !== true) {
                return { ok: false, error: 'column not empty (' + count + ' cards), pass force: true to delete anyway' }
              }
              board.columns.splice(colIdx, 1)
              return { column_id: col.id, title: col.title, deleted_cards: count }
            })
          },
          output: outputOf('删除列结果'),
        },
        {
          name: 'kanban_move_column',
          description: '调整列（状态）顺序。column_id 传列名或列 id；to_index 为目标位置（0 起）。',
          parameters: P({ column_id: STR('列名或列 id'), to_index: NUM('目标位置（0 起）') }, ['column_id', 'to_index']),
          execute: async (args: any) => {
            return mutateBoard((board: any) => {
              const from = board.columns.findIndex((col: any) => col.id === args.column_id || col.title === args.column_id)
              if (from < 0) return { ok: false, error: 'column not found: ' + String(args.column_id) }
              const to = parseInt(args.to_index, 10)
              if (!Number.isInteger(to) || to < 0 || to >= board.columns.length) {
                return { ok: false, error: 'to_index out of range (0..' + (board.columns.length - 1) + ')' }
              }
              if (from === to) return { ok: true, column_id: board.columns[from].id, from, to, changed: false }
              const [col] = board.columns.splice(from, 1)
              board.columns.splice(to, 0, col)
              return { column_id: col.id, title: col.title, from, to, changed: true }
            })
          },
          output: outputOf('移动列结果'),
        },
        {
          name: 'kanban_link',
          description: '给卡片添加外部关联引用（refs）：github-repo / github-branch / github-mr / local-repo / jira-issue 等。kind 格式 <platform>-<type>；platform 缺省取 kind 前缀；重复（同 kind + external_id）拒绝。',
          parameters: P({
            card_id: STR('卡片 id'),
            kind: STR('引用类型：github-repo / github-branch / github-mr / local-repo / jira-issue 等'),
            external_id: STR('提供方侧 ID：repo 全名（owner/repo）、MR 号、jira key、本地路径等'),
            platform: STR('提供方键（github/jira 等），缺省从 kind 前缀推导'),
            url: STR('可点击链接（可选）'),
            display: STR('展示文本，如 branch 名 / MR 标题（可选）'),
            meta: { type: 'object', additionalProperties: true, description: '提供方自有轻量信息（可选）' },
          }, ['card_id', 'kind', 'external_id']),
          execute: async (args: any) => {
            return mutateBoard((board: any) => {
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
          description: '移除卡片的某个外部关联引用（refs）。ref_id 来自 kanban_get_card / kanban_link 结果。',
          parameters: P({ card_id: STR('卡片 id'), ref_id: STR('要移除的 ref id') }, ['card_id', 'ref_id']),
          execute: async (args: any) => {
            return mutateBoard((board: any) => {
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
      for (const d of defs) {
        ctx.effect(() => harness.registerTool(ctx, harness.defineTool(d)))
      }
    },
  }
}

export default makePlugin()
