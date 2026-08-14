// 受限环境模拟验证：确认 dist/client.js / dist/host.js 在动态插件语义下可加载
// 用法：node scripts/verify-dist.mjs
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(fileURLToPath(import.meta.url)) + '/..'

async function loadClient() {
  const src = await readFile(join(root, 'dist', 'client.js'), 'utf8')
  const React = await import('react')
  const calls = []
  const sandbox = {
    React,
    console,
    styles: { insert: () => () => {} },
    host: {
      call: async (method, args) => {
        calls.push([method, args])
        if (method === 'kanban/load') return { board: { version: 1, columns: [] }, dataDir: '/tmp/kb' }
        return { ok: true }
      },
    },
    ctx: { get: () => undefined },
  }
  const ctx = vm.createContext(sandbox)
  const result = await vm.runInContext('(async () => {' + src + '\n})()', ctx)
  const factory = await result
  const plugin = factory()
  if (!plugin || plugin.name !== 'kanban') throw new Error('client plugin shape wrong: ' + JSON.stringify(plugin && plugin.name))
  if (typeof plugin.apply !== 'function') throw new Error('client apply missing')
  // 模拟 apply（slots 未提供 → 直接返回）
  const ret = plugin.apply({ get: () => undefined })
  if (ret !== undefined) throw new Error('apply with no slots should return undefined, got ' + ret)
  console.log('client.js: OK (plugin=' + plugin.name + ', apply exists)')
}

async function loadHost() {
  const src = await readFile(join(root, 'dist', 'host.js'), 'utf8')
  const handlers = {}
  const sandbox = {
    console,
    harness: { handle: (m, fn) => { handlers[m] = fn } },
    ctx: { get: (name) => (name === 'fs' ? fsMock : undefined) },
  }
  const fsMock = {
    resolve: async (p) => ({ targetKey: p }),
    readText: async () => { throw new Error('ENOENT') },
    writeText: async () => ({}),
  }
  const ctx = vm.createContext(sandbox)
  const result = await vm.runInContext('(async () => {' + src + '\n})()', ctx)
  const factory = await result
  const plugin = factory()
  if (!plugin || plugin.name !== 'kanban') throw new Error('host plugin shape wrong')
  plugin.apply({ get: (name) => (name === 'fs' ? fsMock : undefined) })
  const keys = Object.keys(handlers)
  if (!keys.includes('kanban/load') || !keys.includes('kanban/save') || !keys.includes('kanban/set-data-dir')) {
    throw new Error('host handlers missing: ' + keys.join(','))
  }
  const loaded = await handlers['kanban/load']()
  if (!loaded.board || loaded.board.columns.length !== 3) throw new Error('load default board wrong')
  console.log('host.js: OK (handlers=' + keys.join(',') + ', default board 3 columns)')
}

await loadClient()
await loadHost()
console.log('ALL OK: dist 产物可在受限环境加载')
