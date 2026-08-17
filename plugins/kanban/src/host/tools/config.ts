// host/tools/config.ts — Kanban 配置导入/导出 2 个 agent 工具(v7)
// 导出:只带形态(列标题 + 门禁库 + 创建模板),门禁/模板用名字引用,不含任何Ticket/个人数据。
// 导入:整体替换配置层,旧Ticket全挪新板第一列,导入前自动备份 board.json。
import { FsLike, readBoard, writeBoard, resolveDataDir, defaultBoard, normalizeBoard, safeId, now, BOARD_FILE, WRITE_POLICY } from '../board'
import { migrateGate, validateGate } from '../gate'
import { P, OBJ, outputOf } from './shared'

export const CONFIG_SCHEMA_VERSION = 1

/** 导出整板配置:列标题 + 门禁库(名字引用)+ 模板(门禁按名引用)。不读任何Ticket数据。 */
function exportConfig(board: any): any {
  const lib: any[] = board.gateLibrary || []
  const gates = lib.map((g: any) => {
    const mg = migrateGate(g)
    const out: any = { name: mg.name, on: mg.on, checker: mg.checker }
    if (mg.to) out.to = mg.to
    return out
  })
  const templates = (board.templates || []).map((t: any) => ({
    name: t.name,
    description: t.description || '',
    tags: t.tags || [],
    gates: (t.gateIds || []).map((id: string) => {
      const g = lib.find((x: any) => x.id === id)
      return g ? g.name : null
    }).filter(Boolean),
  }))
  const firstTpl = templates[0]
  return {
    schemaVersion: CONFIG_SCHEMA_VERSION,
    name: firstTpl ? firstTpl.name + '-config' : 'kanban-config',
    description: '由 kanban_export_config 导出的Kanban 配置(列/门禁/模板)',
    kanban: {
      columns: (board.columns || []).map((c: any) => c.title),
      gates,
      templates,
    },
  }
}

export function configToolDefs(fs: FsLike): any[] {
  return [
    {
      name: 'kanban_export_config',
      description: '导出Kanban 配置(不含任何Ticket/个人数据):列标题 + 门禁库 + 创建模板。门禁与模板用名字引用,可直接交给他人 kanban_import_config 导入。',
      parameters: P({}),
      execute: async () => {
        const dataDir = await resolveDataDir(fs)
        const board = normalizeBoard((await readBoard(fs, dataDir)) || defaultBoard())
        return exportConfig(board)
      },
      output: outputOf('Kanban 配置(JSON,可保存为文件分享给他人导入)'),
    },
    {
      name: 'kanban_import_config',
      description: '导入Kanban 配置(整体替换配置层):列/门禁库/创建模板按配置重建,旧Ticket全部挪到新板第一列(不丢失,门禁挂载清除)。导入前自动备份 board.json。配置格式与 workflow-template 包一致(schemaVersion + kanban.columns/gates/templates)。',
      parameters: P({ config: OBJ('Kanban 配置对象:直接粘贴 JSON 文件内容', true) }, ['config']),
      execute: async (args: any) => {
        const cfg = args && args.config
        const c = cfg && cfg.kanban
        // ── 校验 ──
        if (!c || typeof c !== 'object') return { ok: false, error: 'config.kanban 必填' }
        if (cfg.schemaVersion !== undefined && Number(cfg.schemaVersion) > CONFIG_SCHEMA_VERSION) {
          return { ok: false, error: 'schemaVersion ' + cfg.schemaVersion + ' 高于当前支持的 ' + CONFIG_SCHEMA_VERSION + '(请升级 kanban 插件)' }
        }
        if (!Array.isArray(c.columns) || c.columns.length === 0) return { ok: false, error: 'kanban.columns 必填(非空数组)' }
        const cols: string[] = c.columns.map((x: any) => String(x).trim()).filter(Boolean)
        if (cols.length === 0) return { ok: false, error: 'kanban.columns 无有效列名' }
        if (new Set(cols).size !== cols.length) return { ok: false, error: 'kanban.columns 存在重复列名' }
        const gates = Array.isArray(c.gates) ? c.gates : []
        for (const g of gates) {
          const err = validateGate(migrateGate(g))
          if (err) return { ok: false, error: '门禁非法(' + String((g && g.name) || '?') + '): ' + err }
        }
        const templates = Array.isArray(c.templates) ? c.templates : []
        // ── 读板 + 备份 ──
        const dataDir = await resolveDataDir(fs)
        const board = normalizeBoard((await readBoard(fs, dataDir)) || defaultBoard())
        const bakName = BOARD_FILE + '.bak-' + now().replace(/[:.]/g, '-')
        try {
          const bakTarget = await fs.resolve(dataDir + '/' + bakName)
          await fs.writeText(bakTarget, JSON.stringify(board, null, 2), undefined, undefined, WRITE_POLICY)
        } catch (e) {
          return { ok: false, error: '备份失败: ' + String((e as Error).message || e) }
        }
        // ── 重建配置层 ──
        const newCols: any[] = cols.map((title: string) => ({ id: safeId('c'), title, tickets: [], meta: {} }))
        let moved = 0
        for (const col of board.columns || []) {
          for (const ticket of col.tickets || []) {
            if (Array.isArray(ticket.gateIds)) ticket.gateIds = []
            newCols[0].tickets.push(ticket)
            moved += 1
          }
        }
        board.columns = newCols
        board.gateLibrary = gates.map((g: any) => {
          const mg = migrateGate(g)
          return { id: safeId('g'), name: mg.name, on: mg.on, ...(mg.to ? { to: mg.to } : {}), checker: mg.checker }
        })
        board.templates = templates.map((t: any, i: number) => {
          const gateIds = (Array.isArray(t.gates) ? t.gates : []).map((name: any) => {
            const g = board.gateLibrary.find((x: any) => x.name === String(name))
            return g ? g.id : null
          }).filter(Boolean)
          return {
            id: safeId('t'),
            name: String((t && t.name) || '').trim() || 'template-' + (i + 1),
            description: t && t.description !== undefined ? String(t.description) : '',
            tags: Array.isArray(t && t.tags) ? t.tags.map((x: any) => String(x)) : [],
            content: [], gateIds,
            createdAt: now(), updatedAt: now(),
          }
        })
        await writeBoard(fs, dataDir, board)
        return {
          ok: true,
          columns: newCols.length,
          gates: board.gateLibrary.length,
          templates: board.templates.length,
          moved_tickets: moved,
          backup: bakName,
        }
      },
      output: outputOf('导入结果'),
    },
  ]
}
