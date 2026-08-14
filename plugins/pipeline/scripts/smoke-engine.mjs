// 端到端冒烟：内存 fs mock → apply → 建 2 条 pipeline → 发布 → combined 引用 → 同步运行
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const root = dirname(fileURLToPath(import.meta.url)) + '/..'
const mod = await import(join(root, 'lib/index.js'))

// 内存 fs
const mem = new Map()
const fsMock = {
  resolve: async (p) => ({ targetKey: p, displayPath: p }),
  readText: async (t) => { if (!mem.has(t.targetKey)) throw new Error('ENOENT'); return mem.get(t.targetKey) },
  writeText: async (t, content) => { mem.set(t.targetKey, content) },
}
const registered = []
let pipelineSvc = null
const ctx = {
  get: (name) => {
    if (name === 'fs') return fsMock
    if (name === 'tools') return { register: (def) => { registered.push(def); return () => {} } }
    if (name === 'webServer') return { register: () => () => {} }
    return undefined
  },
  provide: (name, value) => { if (name === 'pipeline') pipelineSvc = value },
  effect: (cb) => cb() || (() => {}),
}
mod.apply(ctx)
console.log('tools:', registered.map((t) => t.name).join(', '))

// 1) 建 atomic：文字大写转换
let r = await (registered.find((t) => t.name === 'pipeline_create')).execute({ name: '文字大写', kind: 'atomic', description: '把输入文本转大写' })
console.log('create:', JSON.stringify(r))
const atomId = r.pipeline_id
// 更新节点：input → transform(大写) → output
const nodes = [
  { id: 'in', title: '输入', type: 'input', order: 0, inputs: [], config: { keys: ['text'] } },
  { id: 't1', title: '转大写', type: 'transform', order: 10, inputs: ['in'], config: { mappings: { upper: 'input.text' }, template: '{{up.in.text}}-DONE' } },
  { id: 'out', title: '输出', type: 'output', order: 100, inputs: ['t1'], config: {} },
]
r = await (registered.find((t) => t.name === 'pipeline_update')).execute({ pipeline_id: atomId, nodes })
console.log('update atomic:', JSON.stringify(r))

// 2) 发布 atomic
r = await (registered.find((t) => t.name === 'pipeline_publish_version')).execute({ pipeline_id: atomId, release: 'minor', changelog: '支持大写转换' })
console.log('publish atomic:', JSON.stringify(r))

// 3) 建 combined：引用 atomic
r = await (registered.find((t) => t.name === 'pipeline_create')).execute({ name: '文本清洗总结', kind: 'combined' })
const combId = r.pipeline_id
const combNodes = [
  { id: 'in', title: '输入', type: 'input', order: 0, inputs: [], config: { keys: ['text'] } },
  { id: 'sub', title: '调用大写单元', type: 'pipeline', order: 10, inputs: ['in'], config: { ref: atomId + '@latest', inputs: { text: 'input.text' } } },
  { id: 'out', title: '输出', type: 'output', order: 100, inputs: ['sub'], config: {} },
]
r = await (registered.find((t) => t.name === 'pipeline_update')).execute({ pipeline_id: combId, nodes: combNodes })
console.log('update combined:', JSON.stringify(r))
r = await (registered.find((t) => t.name === 'pipeline_publish_version')).execute({ pipeline_id: combId, release: 'patch', changelog: '组合' })
console.log('publish combined:', JSON.stringify(r))

// 4) 同步运行 combined（经跨插件服务 run）
const out = await pipelineSvc.run(combId, { text: 'hello pipeline' })
console.log('run combined output:', JSON.stringify(out))

// 5) 目录
const catalog = await pipelineSvc.catalog()
console.log('catalog:', JSON.stringify(catalog))

// 6) 版本列表
r = await (registered.find((t) => t.name === 'pipeline_get')).execute({ pipeline_id: atomId })
console.log('atom versions:', r.pipeline.versions.map((v) => v.version + (v.published ? '(pub)' : '(draft)')).join(', '))

const ok = out && out.output === 'hello pipeline-DONE' && out.upper === 'hello pipeline' && catalog.length === 2
console.log(ok ? 'SMOKE PASS' : 'SMOKE FAIL')
if (!ok) process.exit(1)
