// 正式形态验证：host 半 node 直接加载 + client 半 bundle 格式检查
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(fileURLToPath(import.meta.url)) + '/..'

// ── host 半：mock ctx 断言插件形状/工具注册/路由注册/服务 ──
const mod = await import(join(root, 'lib/index.js'))
if (typeof mod.apply !== 'function') throw new Error('lib/index.js 未导出 apply')

const registered = []
const routes = []
const provided = {}
const fsMock = {
  resolve: async (p) => ({ targetKey: p }),
  readText: async () => { throw new Error('ENOENT') },
  writeText: async () => ({}),
}
const ctx = {
  get: (name) => {
    if (name === 'fs') return fsMock
    if (name === 'tools') return { register: (def) => { registered.push(def && def.name); return () => {} } }
    if (name === 'webServer') return { register: (rr) => { routes.push(rr.path); return () => {} } }
    return undefined
  },
  provide: (name, value) => { provided[name] = value },
  effect: (cb) => cb() || (() => {}),
}
mod.apply(ctx)
console.log('host: 工具', registered.length, '| 路由', routes.length, '| 服务', Object.keys(provided).join(','))
if (registered.length !== 19) throw new Error('工具注册数错误: ' + registered.length)
for (const p of ['/api/kanban/load', '/api/kanban/save', '/api/kanban/set-data-dir', '/api/kanban/git-sync']) {
  if (!routes.includes(p)) throw new Error('路由缺失: ' + p)
}
if (!provided['kanban'] || typeof provided['kanban'].getCard !== 'function') throw new Error('kanban 服务未提供')

// ── client 半：bundle 格式（ModuleLoader banner） + 关键符号存在性 ──
const clientJs = readFileSync(join(root, 'lib/client.js'), 'utf8')
if (!clientJs.includes('window.__ModuleLoader__.load')) throw new Error('client.js 缺少 ModuleLoader banner')
for (const token of ['sidebar.footer.action', 'conversation.view', 'kanban.card.actions', '/api/kanban/', 'kbnb-rt-toolbar']) {
  if (!clientJs.includes(token)) throw new Error('client.js 缺少关键符号: ' + token)
}
console.log('client: ModuleLoader 格式 OK，关键符号齐全')
console.log('ALL OK: kanban 正式形态产物验证通过')