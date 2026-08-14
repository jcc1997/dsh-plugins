// kanban 插件宿主半（正式 bundle 形态）：RPC 路由 + kanban 跨插件服务 + 19 个 agent 工具
// 数据层在 host/board.ts（纯函数），工具定义在 host/tools/（按类别拆分）；
// 接入点（正式形态）：ctx.webServer.register 暴露 /api/kanban/*（client UI 数据通道）；
//       ctx.tools.register(defineTool(...)) 注册 agent 工具；ctx.provide('kanban') 跨插件服务。
// 由动态形态迁移而来：业务逻辑零改动，仅 harness.handle/registerTool 换成正式服务。
import { FsLike, findCardAny, mutateBoard, readBoard, resolveDataDir, defaultBoard, appendActivity, now } from './host/board'
import { buildToolDefs } from './host/tools'
import { defineTool } from '@deepseek-ai/dsh-tools'

interface KanbanCtx {
  get(name: string): unknown
  provide(name: string, value: unknown): unknown
  effect(cb: () => unknown): unknown
}

type WebRouteRegistrar = { register(r: { kind: 'exact' | 'prefix'; path: string; handler: (req: any, res: any) => void | Promise<void> }): () => void }

// 声明服务依赖：cordis 等待全部就绪后才激活 apply（宿主 include 是并发 apply，
// webServer 等 web-app 层服务可能晚于本插件；不 inject 会拿到 undefined 导致路由静默缺失）
export const inject = ['fs', 'webServer', 'tools']

export function apply(ctx: KanbanCtx) {
  // fs 是硬依赖：缺失直接不启动
  const fs = ctx.get('fs') as FsLike
  if (!fs) return
  const webServer = ctx.get('webServer') as WebRouteRegistrar | undefined
  const tools = ctx.get('tools') as { register(def: unknown): () => void } | undefined

  /* ── HTTP 路由：client UI 数据通道（POST /api/kanban/*，body JSON） ── */
  function route(path: string, handler: (args: any) => Promise<any>) {
    if (webServer && typeof webServer.register === 'function') {
      ctx.effect(() => webServer.register({
        kind: 'exact',
        path,
        handler: async (req: any, res: any) => {
          try {
            let body = ''
            for await (const chunk of req) body += chunk
            const args = body ? JSON.parse(body) : {}
            const result = await handler(args)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(result))
          } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: false, error: String(e && (e as Error).message ? (e as Error).message : e) }))
          }
        },
      }))
    }
  }

  // 加载整板（含归档）与数据目录
  route('/kanban-api/load', async () => {
    const dataDir = await resolveDataDir(fs)
    const board = await readBoard(fs, dataDir)
    if (board && !Array.isArray(board.archive)) board.archive = []
    return { board: board || defaultBoard(), dataDir }
  })
  // 整板保存（client 侧 mutate 后全量落盘；归档/富文本随板）
  route('/kanban-api/save', async (args: any) => {
    const board = args && args.board
    if (!board || typeof board !== 'object') return { ok: false, error: 'missing board' }
    try {
      const dataDir = await resolveDataDir(fs)
      const target = await fs.resolve(dataDir + '/board.json')
      await fs.writeText(target, JSON.stringify(board, null, 2), undefined, undefined, { mode: 'danger-full-access' })
      return { ok: true }
    } catch (e) {
      return { ok: false, error: String(e && (e as Error).message ? (e as Error).message : e) }
    }
  })
  // 设置页：迁移数据目录
  route('/kanban-api/set-data-dir', async (args: any) => {
    const dir = args && args.dir
    if (typeof dir !== 'string' || dir.trim().length === 0) return { ok: false, error: 'invalid dir' }
    const next = dir.trim()
    try {
      const oldDir = await resolveDataDir(fs)
      if (oldDir !== next) {
        const board = await readBoard(fs, oldDir)
        if (board) {
          const target = await fs.resolve(next + '/board.json')
          await fs.writeText(target, JSON.stringify(board, null, 2), undefined, undefined, { mode: 'danger-full-access' })
        }
      }
      const cfgTarget = await fs.resolve('/Users/jinchao.chen/.dsh/kanban/config.json')
      await fs.writeText(cfgTarget, JSON.stringify({ dataDir: next }, null, 2), undefined, undefined, { mode: 'danger-full-access' })
      return { ok: true, dataDir: next }
    } catch (e) {
      return { ok: false, error: String(e && (e as Error).message ? (e as Error).message : e) }
    }
  })
  // 会话「任务」tab 同步桥接：槽位渲染授权仅限 sidebar 条目，会话 tab 内走跨插件服务通道
  route('/kanban-api/git-sync', async (args: any) => {
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
      const dataDir = await resolveDataDir(fs)
      const board = (await readBoard(fs, dataDir)) || defaultBoard()
      const hit = findCardAny(board, String(cardId))
      return hit ? hit.card : null
    },
    updateCard: async (cardId: string, patch: any) => {
      const p = patch || {}
      return mutateBoard(fs, (board: any) => {
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
      const dataDir = await resolveDataDir(fs)
      const board = (await readBoard(fs, dataDir)) || defaultBoard()
      const out: any[] = []
      const push = (card: any, status: string, archived: boolean) => {
        const taskId = card.meta && typeof card.meta === 'object' ? (card.meta as any).taskId : null
        out.push({ id: card.id, title: card.title, taskId: taskId || null, status, archived, updatedAt: card.updatedAt })
      }
      for (const col of board.columns || []) {
        for (const card of col.cards || []) push(card, col.title, false)
      }
      for (const card of board.archive || []) push(card, '归档', true)
      return out
    },
  }
  ctx.provide('kanban', kanbanService)

  /* ── agent 工具注册（19 个）：defineTool 需 dsh-tools 的 parameters 形状 ── */
  if (tools && typeof tools.register === 'function') {
    // DSL 适配：动态形态 parameters 是 { type, properties, required } 包装；
    // dsh-tools 的 ParameterSchemaSpec 是直接属性映射（required 为属性级注解）
    const toToolParameters = (parameters: any): any => {
      const props = (parameters && parameters.properties) || {}
      const required: string[] = (parameters && parameters.required) || []
      const out: any = {}
      for (const key of Object.keys(props)) {
        out[key] = { ...props[key], ...(required.includes(key) ? { required: true } : {}) }
      }
      return out
    }
    for (const d of buildToolDefs(fs)) {
      ctx.effect(() => tools.register(defineTool({ ...d, parameters: toToolParameters(d.parameters) })))
    }
  } else {
    throw new Error('tools service unavailable（正式形态需 @deepseek-ai/dsh-tools）')
  }
}