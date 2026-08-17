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
    if (name === 'credentials') return { resolve: async () => undefined }
    return undefined
  },
  provide: (name, value) => { provided[name] = value },
  effect: (cb) => cb() || (() => {}),
}
mod.apply(ctx)
console.log('host: 工具', registered.length, '| 路由', routes.length, '| 服务', Object.keys(provided).join(','))
if (registered.length !== 31) throw new Error('工具注册数错误: ' + registered.length)
for (const p of ['/kanban-api/load', '/kanban-api/save', '/kanban-api/set-data-dir', '/kanban-api/git-sync', '/kanban-api/gate-check']) {
  if (!routes.includes(p)) throw new Error('路由缺失: ' + p)
}
if (!provided['kanban'] || typeof provided['kanban'].getTicket !== 'function') throw new Error('kanban 服务未提供')

// ── client 半：真实执行测试（模拟 ModuleLoader 环境，防 "module is not defined" 类回归） ──
import { createRequire } from 'node:module'
const clientJs = readFileSync(join(root, 'lib/client.js'), 'utf8')
if (!clientJs.includes('window.__ModuleLoader__.load')) throw new Error('client.js 缺少 ModuleLoader banner')
// 捕获 factory
let capturedFactory = null
const prevWindow = globalThis.window
globalThis.window = { __ModuleLoader__: { load: (spec) => { capturedFactory = spec.factory } } }
try {
  // 在隔离函数里执行 bundle（顶层引用 window/module/exports）
  const fn = new Function(clientJs)
  fn()
} finally {
  if (prevWindow === undefined) delete globalThis.window
  else globalThis.window = prevWindow
}
if (typeof capturedFactory !== 'function') throw new Error('client.js 未注册 ModuleLoader factory')
// 执行 factory：require 从插件 node_modules 解析（react 等 external）
const req = createRequire(join(root, 'lib/client.js'))
const exported = capturedFactory((m) => req(m))
if (!exported || exported.name !== 'kanban') throw new Error('client factory 导出形状错误: ' + JSON.stringify(exported && exported.name))
if (typeof exported.apply !== 'function') throw new Error('client 未导出 apply')
if (!Array.isArray(exported.inject) || !exported.inject.includes('slots')) throw new Error('client inject 声明错误')
console.log('client: ModuleLoader 真实执行 OK（name=' + exported.name + ', inject=' + exported.inject.join(',') + '）')
console.log('ALL OK: kanban 正式形态产物验证通过')