// Host 入口：组装 host 插件（构建产物供 cordis_define 的 code.host 加载）
interface FsLike {
  resolve(path: string, opts?: { cwd?: string; signal?: unknown }): Promise<{ targetKey: string; displayPath: string }>
  readText(target: { targetKey: string }, signal?: unknown): Promise<string>
  writeText(
    target: { targetKey: string },
    content: string,
    expected?: unknown,
    signal?: unknown,
    sandboxPolicy?: { mode: string },
  ): Promise<unknown>
}

interface HarnessLike {
  handle(method: string, handler: (args: unknown) => unknown): void
}

/** 受限环境注入的全局 */
declare const harness: HarnessLike

export default function makePlugin() {
  return {
    name: 'kanban',
    apply(ctx: { get(name: string): unknown }) {
      const fs = ctx.get('fs') as FsLike | undefined
      if (!fs) return

      const DEFAULT_DIR = '/Users/jinchao.chen/.dsh/kanban'
      const CONFIG_FILE = 'config.json'
      const BOARD_FILE = 'board.json'
      const WRITE_POLICY = { mode: 'danger-full-access' }

      function defaultBoard() {
        const cols = ['待办', '进行中', '完成']
        return {
          version: 1,
          columns: cols.map((title) => ({
            id: 'c' + Math.random().toString(36).slice(2, 10),
            title,
            cards: [],
            meta: {},
          })),
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

      harness.handle('kanban/load', async () => {
        const dataDir = await resolveDataDir()
        const board = await readBoard(dataDir)
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
    },
  }
}
