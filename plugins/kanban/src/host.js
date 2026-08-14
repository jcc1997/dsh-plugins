// 动态插件 Host 半源码（cordis_define code.host 的函数体，纯 JS）
// 当前运行版本：kbnb-2/pkg-7（run-6）
// 说明：动态插件代码在 DSH 进程内存中运行，此文件是大仓归档副本。
// 使用方式：会话中 cordis_define 时粘贴此函数体。
return {
  name: 'kanban',
  apply(ctx) {
    const fs = ctx.get('fs')
    if (fs === undefined) return

    const DEFAULT_DIR = '/Users/jinchao.chen/.dsh/kanban'
    const CONFIG_FILE = 'config.json'
    const BOARD_FILE = 'board.json'
    const WRITE_POLICY = { mode: 'danger-full-access' }

    function defaultBoard() {
      const cols = ['待办', '进行中', '完成']
      return {
        version: 1,
        columns: cols.map((title) => ({ id: 'c' + Math.random().toString(36).slice(2, 10), title, cards: [], meta: {} })),
        meta: {},
      }
    }

    async function resolveDataDir() {
      try {
        const cfgTarget = await fs.resolve(DEFAULT_DIR + '/' + CONFIG_FILE)
        const text = await fs.readText(cfgTarget)
        const cfg = JSON.parse(text)
        if (cfg && typeof cfg.dataDir === 'string' && cfg.dataDir.length > 0) return cfg.dataDir
      } catch (e) { /* 缺失/损坏 → 默认目录 */ }
      return DEFAULT_DIR
    }

    async function readBoard(dataDir) {
      try {
        const target = await fs.resolve(dataDir + '/' + BOARD_FILE)
        const text = await fs.readText(target)
        return JSON.parse(text)
      } catch (e) {
        return null
      }
    }

    async function writeBoard(dataDir, board) {
      const target = await fs.resolve(dataDir + '/' + BOARD_FILE)
      await fs.writeText(target, JSON.stringify(board, null, 2), undefined, undefined, WRITE_POLICY)
    }

    harness.handle('kanban/load', async () => {
      const dataDir = await resolveDataDir()
      const board = await readBoard(dataDir)
      return { board: board || defaultBoard(), dataDir }
    })

    harness.handle('kanban/save', async (args) => {
      const board = args && args.board
      if (!board || typeof board !== 'object') return { ok: false, error: 'missing board' }
      try {
        const dataDir = await resolveDataDir()
        await writeBoard(dataDir, board)
        return { ok: true }
      } catch (e) {
        return { ok: false, error: String(e && e.message ? e.message : e) }
      }
    })

    harness.handle('kanban/set-data-dir', async (args) => {
      const dir = args && args.dir
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
        return { ok: false, error: String(e && e.message ? e.message : e) }
      }
    })
  },
}
