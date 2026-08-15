// kanban 门禁/模板端到端冒烟：内存 fs → apply → 模板建卡 → 门禁拦截 → 移除门禁 → 动作放行
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
    return undefined
  },
  provide: () => {},
  effect: (cb) => cb() || (() => {}),
}
mod.apply(ctx)
const tool = (n) => registered.find((t) => t.name === n)

// 1) 建模板（带 tag-required 门禁）
let r = await tool('kanban_template_create').execute({
  name: '需评审标签', description: '模板预置描述', tags: ['pre'],
  gates: [{ kind: 'tag-required', on: 'archive', name: '归档需 done 标签', config: { tags: ['done'] } }],
})
console.log('1 模板创建:', JSON.stringify(r))

// 2) 用模板建卡（不显式传 tags → 模板预填 pre）
r = await tool('kanban_create').execute({ title: '模板卡', template: '需评审标签' })
console.log('2 模板建卡:', JSON.stringify(r))
const cardId = r.card_id

// 3) 验证卡片带模板字段 + 门禁
r = await tool('kanban_get_card').execute({ card_id: cardId })
console.log('3 卡片字段: desc=', JSON.stringify(r.card.description), 'tags=', JSON.stringify(r.card.tags), 'gates=', JSON.stringify(r.card.gates))

// 4) 归档被门禁拦截（缺 done 标签）
r = await tool('kanban_archive').execute({ card_id: cardId })
console.log('4 归档拦截:', JSON.stringify(r))
if (r.ok) throw new Error('FAIL: 门禁未拦截归档')

// 5) gate_check 预检
r = await tool('kanban_gate_check').execute({ card_id: cardId, action: 'archive' })
console.log('5 预检:', JSON.stringify(r))
if (r.ok) throw new Error('FAIL: 预检应不通过')

// 6) 加 done 标签（tags 动作无 tags 门禁，放行）
r = await tool('kanban_tags').execute({ card_id: cardId, add: ['done'] })
console.log('6 加标签:', JSON.stringify(r))
if (!r.ok) throw new Error('FAIL: 加标签应放行')

// 7) 再归档 → 通过
r = await tool('kanban_archive').execute({ card_id: cardId })
console.log('7 归档放行:', JSON.stringify(r))
if (!r.ok) throw new Error('FAIL: 满足门禁后归档应通过')

// 8) 显式传参覆盖模板：description 覆盖
r = await tool('kanban_create').execute({ title: '覆盖卡', template: '需评审标签', description: '显式描述', tags: ['x'] })
console.log('8 覆盖建卡:', JSON.stringify(r))
r = await tool('kanban_get_card').execute({ card_id: r.card_id })
if (r.card.description !== '显式描述' || r.card.tags.join(',') !== 'x') throw new Error('FAIL: 显式传参未覆盖模板')
console.log('9 覆盖验证: desc=', r.card.description, 'tags=', JSON.stringify(r.card.tags))

console.log('KANBAN-GATE SMOKE PASS')