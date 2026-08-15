// 验证工具输出 lossless：queue 提交后立即查 status（output/error 为 undefined 的中间态）+ 完成后查
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const root = dirname(fileURLToPath(import.meta.url)) + '/..'
const mod = await import(join(root, 'lib/index.js'))

const mem = new Map()
const fsMock = {
  resolve: async (p) => ({ targetKey: p, displayPath: p }),
  readText: async (t) => { if (!mem.has(t.targetKey)) throw new Error('ENOENT'); return mem.get(t.targetKey) },
  writeText: async (t, content) => { mem.set(t.targetKey, content) },
}
const registered = []
const ctx = {
  get: (name) => (name === 'fs' ? fsMock : name === 'tools' ? { register: (d) => { registered.push(d); return () => {} } } : name === 'webServer' ? { register: () => () => {} } : undefined),
  provide: () => {},
  effect: (cb) => cb() || (() => {}),
}
mod.apply(ctx)

const isLossless = (v) => { try { const s = JSON.stringify(v); JSON.parse(s); return s !== undefined } catch { return false } }

// 建 + 发布
let r = await registered.find((t) => t.name === 'pipeline_create').execute({ name: 'L1', kind: 'atomic' })
const pid = r.pipeline_id
await registered.find((t) => t.name === 'pipeline_update').execute({ pipeline_id: pid, nodes: [
  { id: 'in', title: '输入', type: 'input', order: 0, inputs: [], config: {} },
  { id: 't', title: '加工', type: 'transform', order: 10, inputs: ['in'], config: { template: 'x-{{up.in.text}}' } },
  { id: 'out', title: '输出', type: 'output', order: 100, inputs: ['t'], config: {} },
]})
await registered.find((t) => t.name === 'pipeline_publish_version').execute({ pipeline_id: pid, release: 'patch' })

// 入队 + 立即查 status（此时 run 无 output/error）
const runRes = await registered.find((t) => t.name === 'pipeline_run').execute({ pipeline_id: pid, inputs: { text: 'hello' } })
const st1 = await registered.find((t) => t.name === 'pipeline_run_status').execute({ run_id: runRes.run_id })
if (!isLossless(st1)) { console.log('FAIL: queued 态非 lossless:', JSON.stringify(st1)); process.exit(1) }
console.log('queued 态 lossless OK:', JSON.stringify(st1).slice(0, 160))

// 等队列消费
await new Promise((res) => setTimeout(res, 2500))
const st2 = await registered.find((t) => t.name === 'pipeline_run_status').execute({ run_id: runRes.run_id })
if (!isLossless(st2)) { console.log('FAIL: done 态非 lossless:', JSON.stringify(st2)); process.exit(1) }
console.log('done 态 lossless OK:', JSON.stringify(st2).slice(0, 260))

// runs 列表也查
const rr = await registered.find((t) => t.name === 'pipeline_runs').execute({})
if (!isLossless(rr)) { console.log('FAIL: runs 非 lossless'); process.exit(1) }
console.log('runs lossless OK, total =', rr.total)

const ok = st2.run.status === 'success' && st2.run.output && st2.run.output.output === 'x-hello'
console.log(ok ? 'SMOKE-LOSSLESS PASS' : 'FAIL: 输出错误 ' + JSON.stringify(st2.run.output))
if (!ok) process.exit(1)
