// host/tools/archive.ts — 归档类 3 个 agent 工具：archive / unarchive / list_archived
// 归档 = 移出列隐藏到 board.archive（archivedFrom 记原列），恢复回原列或指定列。
import { FsLike } from '../board'
import { mutateBoard, readBoard, resolveDataDir, defaultBoard, resolveColumn, appendActivity, now } from '../board'
import { P, STR, outputOf } from './shared'

export function archiveToolDefs(fs: FsLike): any[] {
  return [
    {
      name: 'kanban_archive',
      description: '归档一张卡片：从看板列中移出（隐藏），可在侧边栏「归档」中找回。归档不删除数据。',
      parameters: P({ card_id: STR('要归档的卡片 id') }, ['card_id']),
      execute: async (args: any) => {
        return mutateBoard(fs, (board: any) => {
          const hit = (() => {
            for (const col of board.columns || []) {
              const card = (col.cards || []).find((k: any) => k.id === String(args.card_id))
              if (card) return { col, card }
            }
            return null
          })()
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
        return mutateBoard(fs, (board: any) => {
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
        const dataDir = await resolveDataDir(fs)
        const board = (await readBoard(fs, dataDir)) || defaultBoard()
        const out = (board.archive || []).map((card: any) => {
          const col = card.archivedFrom ? resolveColumn(board, card.archivedFrom) : null
          return {
            id: card.id, title: card.title, tags: card.tags || [],
            archivedFrom: col ? col.title : '', archivedAt: card.archivedAt || '', updatedAt: card.updatedAt,
          }
        })
        return { ok: true, total: out.length, cards: out }
      },
      output: outputOf('归档列表'),
    },
  ]
}
