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
  const registrations = []
  const slotsMock = {
    inject: (name, fn) => { fn() },
    register: (options, component) => { registrations.push({ options, component }); return () => {} },
  }
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
    ctx: { get: (name) => (name === 'slots' ? slotsMock : undefined) },
  }
  const ctx = vm.createContext(sandbox)
  const result = await vm.runInContext('(async () => {' + src + '\n})()', ctx)
  const plugin = await result
  if (!plugin || plugin.name !== 'kanban') throw new Error('client plugin shape wrong: ' + JSON.stringify(plugin && plugin.name))
  if (typeof plugin.apply !== 'function') throw new Error('client apply missing')
  const ret = plugin.apply(sandbox.ctx)
  if (ret !== undefined) throw new Error('apply should return undefined, got ' + ret)
  // M3：sidebar 条目必须声明 kanban.card.actions 子槽位
  const side = registrations.find((r) => r.options && r.options.name === 'sidebar.footer.action' && r.options.id === 'kanban')
  if (!side) throw new Error('sidebar.footer.action kanban entry missing')
  if (!side.options.children || !side.options.children['kanban.card.actions']) {
    throw new Error('kanban.card.actions child slot not declared: ' + JSON.stringify(side.options.children))
  }
  console.log('client.js: OK (plugin=' + plugin.name + ', apply exists, child slot kanban.card.actions declared)')
}

async function loadHost() {
  const src = await readFile(join(root, 'dist', 'host.js'), 'utf8')
  const handlers = {}
  const registered = []
  const sandbox = {
    console,
    harness: {
      handle: (m, fn) => { handlers[m] = fn },
      defineTool: (def) => def,
      registerTool: (_ctx, def) => { registered.push(def && def.name); return () => {} },
    },
    ctx: { get: (name) => (name === 'fs' ? fsMock : undefined), effect: (cb) => cb() || (() => {}) },
  }
  const fsMock = {
    resolve: async (p) => ({ targetKey: p }),
    readText: async () => { throw new Error('ENOENT') },
    writeText: async () => ({}),
  }
  const ctx = vm.createContext(sandbox)
  const result = await vm.runInContext('(async () => {' + src + '\n})()', ctx)
  const plugin = await result
  if (!plugin || plugin.name !== 'kanban') throw new Error('host plugin shape wrong')
  const provided = {}
  const mockCtx = {
    get: (name) => (name === 'fs' ? fsMock : undefined),
    effect: (cb) => cb() || (() => {}),
    provide: (name, value) => { provided[name] = value },
  }
  plugin.apply(mockCtx)
  const keys = Object.keys(handlers)
  if (!keys.includes('kanban/load') || !keys.includes('kanban/save') || !keys.includes('kanban/set-data-dir')) {
    throw new Error('host handlers missing: ' + keys.join(','))
  }
  const loaded = await handlers['kanban/load']()
  if (!loaded.board || loaded.board.columns.length !== 3) throw new Error('load default board wrong')
  const expectTools = ['kanban_view','kanban_get_card','kanban_search','kanban_recent','kanban_create','kanban_move','kanban_update','kanban_tags','kanban_comment','kanban_delete','kanban_add_column','kanban_rename_column','kanban_delete_column','kanban_move_column','kanban_link','kanban_unlink']
  const missing = expectTools.filter((t) => !registered.includes(t))
  if (missing.length > 0) throw new Error('tools missing: ' + missing.join(','))
  if (!provided['kanban'] || typeof provided['kanban'].getCard !== 'function' || typeof provided['kanban'].updateCard !== 'function' || typeof provided['kanban'].listCards !== 'function') {
    throw new Error('kanban service not provided correctly')
  }
  console.log('host.js: OK (handlers=' + keys.join(',') + ', tools=' + registered.length + ', service=kanban, default board 3 columns)')
}

await loadClient()
await loadHost()
console.log('ALL OK: dist 产物可在受限环境加载')