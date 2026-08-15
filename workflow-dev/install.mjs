#!/usr/bin/env node
// install.mjs — 把 workflow.json 合并进 dsh-kanban 看板数据(幂等,自动备份)
// 用法:node install.mjs [workflow.json 路径] [看板数据目录]
// 默认:本目录 workflow.json;数据目录取 ~/.dsh/kanban/config.json 的 dataDir,缺省 ~/.dsh/kanban
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'

const here = dirname(fileURLToPath(import.meta.url))
const wfPath = process.argv[2] || join(here, 'workflow.json')
const DEFAULT_DIR = join(homedir(), '.dsh', 'kanban')

const wf = JSON.parse(readFileSync(wfPath, 'utf8'))
const cfg = wf.kanban
if (!cfg || !Array.isArray(cfg.columns) || !Array.isArray(cfg.gates)) {
  console.error('workflow.json 缺少 kanban.columns / kanban.gates'); process.exit(1)
}

// ── 数据目录:config.json dataDir > 默认目录 ──
let dataDir = DEFAULT_DIR
try {
  const cfgRaw = JSON.parse(readFileSync(join(DEFAULT_DIR, 'config.json'), 'utf8'))
  if (cfgRaw.dataDir && typeof cfgRaw.dataDir === 'string') dataDir = cfgRaw.dataDir
} catch { /* 无 config 走默认 */ }
if (process.argv[3]) dataDir = process.argv[3]

const boardPath = join(dataDir, 'board.json')
if (!existsSync(boardPath)) {
  console.error('找不到看板数据:' + boardPath + '(先安装并打开一次 dsh-kanban)')
  process.exit(1)
}

// ── 备份 ──
const ts = new Date().toISOString().replace(/[:.]/g, '-')
const bak = boardPath + '.bak-' + ts
copyFileSync(boardPath, bak)
console.log('已备份:', bak)

const board = JSON.parse(readFileSync(boardPath, 'utf8'))
if (!Array.isArray(board.columns)) board.columns = []
if (!Array.isArray(board.archive)) board.archive = []
if (!Array.isArray(board.templates)) board.templates = []
if (!Array.isArray(board.gateLibrary)) board.gateLibrary = []

const sig = (g) => [g.name, g.on, String(g.to || ''), (g.checker ? g.checker.type : g.kind)].join('\u0001')
const cfgOf = (g) => (g.checker ? g.checker.config : g.config) || {}

// ── 列:按 workflow 顺序补缺(插入在下一个已存在列的左侧;全缺则追加);1st Review 旧名迁移 ──
let colNotes = []
for (const title of cfg.columns) {
  if (board.columns.some((c) => c.title === title)) continue
  let idx = board.columns.findIndex((c) => {
    const order = cfg.columns.indexOf(c.title)
    return order >= 0 && order > cfg.columns.indexOf(title)
  })
  const col = { id: 'c' + Math.random().toString(36).slice(2, 10), title, cards: [], meta: {} }
  if (idx < 0) board.columns.push(col); else board.columns.splice(idx, 0, col)
  colNotes.push('+ 列 ' + title)
}
const legacy = board.columns.find((c) => c.title === '1st Review')
if (legacy && !board.columns.some((c) => c.title === 'review') && cfg.columns.includes('review')) {
  legacy.title = 'review'
  colNotes.push('~ 列 1st Review → review')
}

// ── 门禁库:按 name+type+on+to 去重,缺则入库 ──
let gateNotes = []
for (const g of cfg.gates) {
  if (board.gateLibrary.some((x) => sig(x) === sig(g))) continue
  board.gateLibrary.push({ id: 'g' + Math.random().toString(36).slice(2, 10), ...g })
  gateNotes.push('+ 门禁 ' + g.name + '（' + g.on + (g.to ? ' → ' + g.to : '') + '）')
}

// ── 模板:按名 upsert;gateIds 引用库内对应门禁;同时写内联 gates(兼容旧版宿主) ──
const tplCfg = cfg.template || { name: 'workflow' }
let tpl = board.templates.find((t) => t.name === tplCfg.name)
if (!tpl) {
  tpl = { id: 't' + Math.random().toString(36).slice(2, 10), name: tplCfg.name, content: [], createdAt: new Date().toISOString() }
  board.templates.push(tpl)
}
const resolvedGates = cfg.gates.map((g) => board.gateLibrary.find((x) => sig(x) === sig(g))).filter(Boolean)
tpl.gateIds = resolvedGates.map((g) => g.id)
tpl.gates = resolvedGates.map((g) => ({ id: g.id, name: g.name, on: g.on, ...(g.to ? { to: g.to } : {}), checker: { type: g.checker.type, config: cfgOf(g) } }))
if (tplCfg.description !== undefined) tpl.description = tplCfg.description
if (Array.isArray(tplCfg.tags)) tpl.tags = tplCfg.tags.slice()
if (!tpl.tags) tpl.tags = []
tpl.updatedAt = new Date().toISOString()

writeFileSync(boardPath, JSON.stringify(board, null, 2))
console.log('列变更:', colNotes.length ? colNotes.join('; ') : '无(已存在)')
console.log('门禁变更:', gateNotes.length ? gateNotes.join('; ') : '无(已存在)')
console.log('模板:', tpl.name, '(', resolvedGates.length, '条门禁已勾选 )')
console.log('完成。刷新看板页面即可看到新列/门禁/模板。')
