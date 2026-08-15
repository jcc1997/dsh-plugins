// 正式形态验证:host 半 node 直接加载 + client 半 bundle 格式检查(markdown-review)
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(fileURLToPath(import.meta.url)) + '/..'

// ── host 半:mock ctx 断言工具注册/路由注册 ──
const mod = await import(join(root, 'lib/index.js'))
if (typeof mod.apply !== 'function') throw new Error('lib/index.js 未导出 apply')

const registered = []
const routes = []
const ctx = {
  get: (name) => {
    if (name === 'tools') return { register: (def) => { registered.push(def && def.name); return () => {} } }
    if (name === 'webServer') return { register: (rr) => { routes.push(rr.path); return () => {} } }
    return undefined
  },
  provide: () => {},
  effect: (cb) => cb() || (() => {}),
}
mod.apply(ctx)
console.log('host: 工具', registered.length, '| 路由', routes.length)
if (registered.length !== 1 || registered[0] !== 'md_doc_open') throw new Error('工具注册错误: ' + registered.join(','))
for (const p of ['/md-api/read', '/md-api/submit']) {
  if (!routes.includes(p)) throw new Error('路由缺失: ' + p)
}

// ── client 半:ModuleLoader 真实执行 ──
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
if (!exported || exported.name !== 'markdown-review') throw new Error('client factory 导出形状错误: ' + JSON.stringify(exported && exported.name))
if (typeof exported.apply !== 'function') throw new Error('client 未导出 apply')
if (!Array.isArray(exported.inject) || !exported.inject.includes('slots')) throw new Error('client inject 声明错误')
console.log('client: ModuleLoader 真实执行 OK(name=' + exported.name + ', inject=' + exported.inject.join(',') + ')')
console.log('ALL OK: markdown-review 正式形态产物验证通过')
