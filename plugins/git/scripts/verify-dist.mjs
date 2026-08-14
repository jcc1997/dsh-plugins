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
if (!routes.includes('/api/git/sync')) throw new Error('git/sync 路由未注册')
if (!provided['git'] || typeof provided['git'].sync !== 'function') throw new Error('git 服务未提供')
console.log('ALL OK: lib/index.js 可在正式形态加载（工具/路由/服务齐备）')
