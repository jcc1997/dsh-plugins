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
  resolve: async (p) => ({ targetKey: p, displayPath: p }),
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
if (registered.length !== 11) throw new Error('工具注册数错误: ' + registered.length)
for (const p of ['/pipeline-api/load', '/pipeline-api/create', '/pipeline-api/update', '/pipeline-api/publish', '/pipeline-api/delete', '/pipeline-api/run', '/pipeline-api/run-status', '/pipeline-api/get']) {
  if (!routes.includes(p)) throw new Error('路由缺失: ' + p)
}
if (!provided['pipeline'] || typeof provided['pipeline'].run !== 'function') throw new Error('pipeline 服务未提供')

// ── client 半：真实执行测试（模拟 ModuleLoader 环境，防 "module is not defined" 类回归） ──
import { createRequire } from 'node:module'
const clientJs = readFileSync(join(root, 'lib/client.js'), 'utf8')
if (!clientJs.includes('window.__ModuleLoader__.load')) throw new Error('client.js 缺少 ModuleLoader banner')
let capturedFactory = null
const prevWindow = globalThis.window
globalThis.window = { __ModuleLoader__: { load: (spec) => { capturedFactory = spec.factory } } }
try {
  const fn = new Function(clientJs)
  fn()
} finally {
  if (prevWindow === undefined) delete globalThis.window
  else globalThis.window = prevWindow
}
if (typeof capturedFactory !== 'function') throw new Error('client.js 未注册 ModuleLoader factory')
const req = createRequire(join(root, 'lib/client.js'))
const exported = capturedFactory((m) => req(m))
if (!exported || exported.name !== 'pipeline') throw new Error('client factory 导出形状错误: ' + JSON.stringify(exported && exported.name))
if (typeof exported.apply !== 'function') throw new Error('client 未导出 apply')
if (!Array.isArray(exported.inject) || !exported.inject.includes('slots')) throw new Error('client inject 声明错误')
console.log('client: ModuleLoader 真实执行 OK（name=' + exported.name + ', inject=' + exported.inject.join(',') + '）')

// ── client apply 真实执行：slots mock 断言槽位注册形状（防真实环境注册抛错） ──
const slotRegs = []
const slotsMock = {
  inject: (name, fn) => { const r = fn(); slotRegs.push({ slot: name, options: r && r.options, hasComponent: typeof (r && r.component) === 'function' }); return r },
  register: (options, component) => ({ options, component }),
}
let domHead = null
try {
  domHead = { children: [], appendChild(c) { this.children.push(c) } }
  globalThis.document = {
    querySelector: () => null,
    createElement: () => ({ dataset: {}, set textContent(v) { this._text = v }, get textContent() { return this._text } }),
    head: domHead,
  }
  exported.apply({ get: (name) => (name === 'slots' ? slotsMock : undefined) })
} finally {
  delete globalThis.document
}
console.log('client apply: 槽位注册', slotRegs.map((s) => s.slot + (s.options && s.options.key ? '[' + s.options.key + ']' : '[' + (s.options && s.options.id) + ']')).join(', '))
const footer = slotRegs.find((s) => s.slot === 'sidebar.footer.action' && s.options && s.options.id === 'pipeline')
if (!footer || !footer.hasComponent) throw new Error('sidebar.footer.action 槽位注册缺失')
const dock = slotRegs.find((s) => s.slot === 'conversation.input.dock' && s.options && s.options.id === 'pipeline')
if (!dock || !dock.hasComponent) throw new Error('conversation.input.dock 槽位注册缺失')
console.log('client apply: conversation.input.dock OK')
console.log('ALL OK: pipeline 正式形态产物验证通过')
