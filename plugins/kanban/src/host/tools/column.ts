// host/tools/column.ts — 列管理 4 个 agent 工具：add/rename/delete/move_column
import { FsLike } from '../board'
import { mutateBoard, resolveColumn, safeId } from '../board'
import { P, STR, NUM, outputOf } from './shared'

export function columnToolDefs(fs: FsLike): any[] {
  return [
    {
      name: 'kanban_add_column',
      description: '新建一列（状态）。title 必填；index 为插入位置（0 起，缺省追加到末尾）。',
      parameters: P({ title: STR('列标题（必填）'), index: NUM('插入位置（0 起，缺省末尾）') }, ['title']),
      execute: async (args: any) => {
        return mutateBoard(fs, (board: any) => {
          const title = String(args.title).trim()
          if (!title) return { ok: false, error: 'title is required' }
          const col: any = { id: safeId('c'), title, tickets: [], meta: {} }
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
        return mutateBoard(fs, (board: any) => {
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
      description: '删除一列（状态）。column_id 传列名或列 id；列内有Ticket时默认拒绝，force=true 可连Ticket一起删除（不可恢复）。',
      parameters: P({ column_id: STR('列名或列 id'), force: { type: 'boolean', description: '列内有Ticket时是否强制删除（默认 false）' } }, ['column_id']),
      execute: async (args: any) => {
        return mutateBoard(fs, (board: any) => {
          const colIdx = board.columns.findIndex((col: any) => col.id === args.column_id || col.title === args.column_id)
          if (colIdx < 0) return { ok: false, error: 'column not found: ' + String(args.column_id) }
          const col = board.columns[colIdx]
          const count = (col.tickets || []).length
          if (count > 0 && args.force !== true) {
            return { ok: false, error: 'column not empty (' + count + ' tickets), pass force: true to delete anyway' }
          }
          board.columns.splice(colIdx, 1)
          return { column_id: col.id, title: col.title, deleted_tickets: count }
        })
      },
      output: outputOf('删除列结果'),
    },
    {
      name: 'kanban_move_column',
      description: '调整列（状态）顺序。column_id 传列名或列 id；to_index 为目标位置（0 起）。',
      parameters: P({ column_id: STR('列名或列 id'), to_index: NUM('目标位置（0 起）') }, ['column_id', 'to_index']),
      execute: async (args: any) => {
        return mutateBoard(fs, (board: any) => {
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
  ]
}
