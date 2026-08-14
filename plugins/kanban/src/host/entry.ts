// Host 入口：装配层 —— RPC（client↔host 私有）+ kanban 跨插件服务 + 19 个 agent 工具注册
// 数据操作在 host/board.ts（纯函数），工具定义在 host/tools.ts；本文件只做接线。
// 受限环境全局：harness（handle/defineTool/registerTool）、ctx（get/provide/effect）。
import { FsLike, findCardAny, mutateBoard, readBoard, resolveDataDir, defaultBoard, appendActivity, now } from './board'
import { buildToolDefs } from './tools'

interface HarnessLike {
  handle(method: string, handler: (args: unknown) => unknown): void
  defineTool(definition: unknown): unknown
  registerTool(ctx: unknown, tool: unknown): () => void
}

interface CtxLike {
  get(name: string): unknown
  provide(name: string, value: unknown): unknown
  effect(cb: () => unknown): unknown
}

/** 受限环境注入的全局 */
declare const harness: HarnessLike

function makePlugin() {
  return {
    name: 'kanban',
    apply(ctx: CtxLike) {
      // fs 是硬依赖：缺失直接不启动（inject 语义由宿主守卫保证）
      const fs = ctx.get('fs') as FsLike
      if (!fs) return

      /* ── Package-private RPC（client UI 用）：数据全部经 board.ts ── */
      // 加载整板（含归档）与数据目录
      harness.handle('kanban/load', async () => {
        const dataDir = await resolveDataDir(fs)
        const board = await readBoard(fs, dataDir)
        if (board && !Array.isArray(board.archive)) board.archive = []
        return { board: board || defaultBoard(), dataDir }
      })
      // 整板保存（client 侧 mutate 后全量落盘；归档/富文本随板）
      harness.handle('kanban/save', async (args: unknown) => {
        const board = (args as { board?: unknown } | null)?.board
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
      harness.handle('kanban/set-data-dir', async (args: unknown) => {
        const dir = (args as { dir?: string } | null)?.dir
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
      // getCard/updateCard 覆盖归档卡片；listCards 带 archived 标记
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

      /* ── 动态模型工具（agent 用）：注册进当前 fiber，stop/update 自动移除 ── */
      for (const d of buildToolDefs(fs)) {
        ctx.effect(() => harness.registerTool(ctx, harness.defineTool(d)))
      }
    },
  }
}

export default makePlugin()