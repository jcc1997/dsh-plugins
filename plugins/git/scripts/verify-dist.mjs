// 正式形态验证：node 直接加载 lib/index.js，用 mock ctx 断言插件形状/工具注册/路由注册
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(fileURLToPath(import.meta.url)) + '/..'
const mod = await import(join(root, 'lib/index.js'))
if (typeof mod.apply !== 'function') throw new Error('lib/index.js 未导出 apply（正式形态要求标准 cordis 插件）')

// mock 宿主服务
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
console.log('工具注册数:', registered.length, '| 路由:', routes.join(', '), '| 服务:', Object.keys(provided).join(', '))
if (registered.length < 7) throw new Error('工具注册不足: ' + registered.join(','))
if (!routes.includes('/git-api/sync')) throw new Error('git/sync 路由未注册')
if (!provided['git'] || typeof provided['git'].sync !== 'function') throw new Error('git 服务未提供')

// ── client 半：真实执行测试（模拟 ModuleLoader 环境） ──
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
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
if (!exported || exported.name !== 'git' || typeof exported.apply !== 'function') throw new Error('client factory 导出形状错误')
console.log('client: ModuleLoader 真实执行 OK（name=' + exported.name + '）')
console.log('ALL OK: git 正式形态产物验证通过（工具/路由/服务/client 全链路）')