// kanban 门禁/模板端到端冒烟(v5 checker 模型):模板建卡 → tag-required 拦截 → code checker → pipeline checker → 放行
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
  get: (name) => {
    if (name === 'fs') return fsMock
    if (name === 'tools') return { register: (d) => { registered.push(d); return () => {} } }
    if (name === 'webServer') return { register: () => () => {} }
    if (name === 'credentials') return { resolve: async () => undefined }
    if (name === 'shell') return { run: async (spec) => ({ exitCode: 0, stdout: { text: JSON.stringify({ ok: true, reason: '' }), truncated: false } }) }
    if (name === 'pipeline') return { run: async () => ({ output: 'pass' }) }
    return undefined
  },
  provide: () => {},
  effect: (cb) => cb() || (() => {}),
}
mod.apply(ctx)
const tool = (n) => registered.find((t) => t.name === n)

// 1) 模板(checker 模型:tag-required)
let r = await tool('kanban_template_create').execute({
  name: '需评审标签v5', description: 'v5 模板', tags: ['pre'],
  gates: [{ on: 'archive', name: '归档需 done 标签', checker: { type: 'tag-required', config: { tags: ['done'] } } }],
})
console.log('1 模板:', JSON.stringify(r))

// 2) 模板建卡
r = await tool('kanban_create').execute({ title: 'v5 卡', template: '需评审标签v5' })
console.log('2 建卡:', JSON.stringify(r))
const cardId = r.card_id

// 3) 归档被 tag-required 拦截
r = await tool('kanban_archive').execute({ card_id: cardId })
console.log('3 拦截:', JSON.stringify(r))
if (r.ok) throw new Error('FAIL: 门禁未拦截')

// 4) code checker 门禁(挂 + 预检,通过 mock shell)
r = await tool('kanban_gate_add').execute({
  card_id: cardId, checker_type: 'code', on: 'move', name: '代码检查标题',
  config: { code: "console.log(JSON.stringify({ok:true}))" },
})
console.log('4 挂 code 门禁:', JSON.stringify(r))
r = await tool('kanban_gate_check').execute({ card_id: cardId, action: 'move', to: '完成' })
console.log('5 code 预检:', JSON.stringify(r))
if (!r.ok) throw new Error('FAIL: code checker 应通过')

// 6) pipeline checker 门禁(两条并行,全过)
r = await tool('kanban_gate_add').execute({
  card_id: cardId, checker_type: 'pipeline', on: 'tags', name: '双 pipeline',
  config: { pipelines: ['p1', 'p2'] },
})
console.log('6 挂 pipeline 门禁:', JSON.stringify(r))
r = await tool('kanban_gate_check').execute({ card_id: cardId, action: 'tags' })
console.log('7 pipeline 预检:', JSON.stringify(r))
if (!r.ok) throw new Error('FAIL: pipeline checker 应通过')

// 8) 加 done 标签 → 归档放行
r = await tool('kanban_tags').execute({ card_id: cardId, add: ['done'] })
if (!r.ok) throw new Error('FAIL: 加标签应放行(mock pipeline ok)')
r = await tool('kanban_archive').execute({ card_id: cardId })
console.log('8 归档放行:', JSON.stringify(r))
if (!r.ok) throw new Error('FAIL: 归档应通过')

console.log('KANBAN-GATE-V5 SMOKE PASS')
