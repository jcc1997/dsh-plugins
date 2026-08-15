// 引擎级测试入口（UC A 组）：mock runLlm 直跑 executePipeline + importPipelines + sessionKey 插值
// 经 esbuild 打包后 node 执行（见同目录 run-engine-test.mjs）
import { executePipeline, topologicalOrder } from '../src/host/engine'
import { defaultDoc, mutateDoc, readDoc, importPipelines, findPipeline, DEFAULT_DIR, DOC_FILE } from '../src/host/store'
import { FsLike } from '../src/host/store'
import { PipelineDoc } from '../src/host/models'

let passed = 0
let failed = 0
function assert(cond: boolean, name: string, detail?: unknown): void {
  if (cond) { passed++; console.log('PASS ' + name) }
  else { failed++; console.log('FAIL ' + name + (detail !== undefined ? ' :: ' + JSON.stringify(detail).slice(0, 300) : '')) }
}

// ── 内存 fs mock ──
const mem = new Map<string, string>()
const fs: FsLike = {
  resolve: async (p: string) => ({ targetKey: p, displayPath: p }),
  readText: async (t: { targetKey: string }) => { const v = mem.get(t.targetKey); if (v === undefined) throw new Error('ENOENT'); return v },
  writeText: async (t: { targetKey: string }, content: string) => { mem.set(t.targetKey, content); return {} },
}
const DIR = DEFAULT_DIR + '/' + DOC_FILE

async function setupDoc(nodes: any[]): Promise<void> {
  const doc = defaultDoc()
  const p: any = {
    id: 'p-test-llm',
    name: '测试评审',
    description: '',
    kind: 'atomic',
    tags: [],
    versions: [{
      version: '0.1.0', nodes, inputSchema: { type: 'object', properties: {}, additionalProperties: true },
      changelog: '', published: false, createdAt: new Date().toISOString(),
    }],
    latestVersion: '0.1.0', publishedVersion: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  }
  doc.pipelines.push(p)
  mem.set(DIR, JSON.stringify(doc))
}

function llmNodes(prompt: string, extra?: any) {
  return [
    { id: 'in', title: '输入', type: 'input', order: 0, inputs: [], config: {} },
    { id: 'review', title: '评审', type: 'llm', order: 10, inputs: ['in'], config: Object.assign({ prompt }, extra || {}) },
    { id: 'out', title: '输出', type: 'output', order: 100, inputs: ['review'], config: {} },
  ]
}

async function runPipeline(runLlm: any, nodes: any[], inputs: Record<string, unknown> = { card: { id: 'k1', title: 'T' } }): Promise<any> {
  await setupDoc(nodes)
  const doc = await readDoc(fs)
  const deps: any = { fs, shell: undefined, onRunUpdate: () => {} }
  if (runLlm !== undefined) deps.runLlm = runLlm
  return executePipeline(deps, doc.pipelines[0], '0.1.0', inputs, 'r-test-1')
}

// A-1 fail-closed：无 runLlm
{
  const out = await runPipeline(undefined, llmNodes('prompt'))
  assert(!!out.error && String(out.error).includes('runLlm 未注入'), 'A-1 无 runLlm → pipeline failed (fail-closed)', out)
}

// A-2 verdict ok:false → failed + issues 摘要
{
  const text = '发现问题：\n- a.ts L10 越界\nREVIEW_VERDICT:{"ok":false,"issues":[{"file":"a.ts","location":"L10","severity":"high","message":"越界"}]}'
  const out = await runPipeline(async () => text, llmNodes('prompt'))
  assert(!!out.error && String(out.error).includes('评审未通过') && String(out.error).includes('a.ts:L10'), 'A-2 ok:false → failed + issues 摘要', out)
}

// A-3 verdict ok:true → success + verdict
{
  const text = '无问题。\nREVIEW_VERDICT:{"ok":true,"issues":[]}'
  const out = await runPipeline(async () => text, llmNodes('prompt'))
  assert(!out.error && out.verdict && out.verdict.ok === true, 'A-3 ok:true → success + verdict', out)
}

// A-4 verdict 格式非法 → fail-closed
{
  const out = await runPipeline(async () => '我看了代码，还行。', llmNodes('prompt'))
  assert(!!out.error && String(out.error).includes('verdict 解析失败'), 'A-4 无 verdict 尾行 → failed（fail-closed）', out)
}

// A-6 cardIdPath 插值 + config 传递
{
  let capturedConf: any = null
  const out = await runPipeline(
    async (_p: string, _up: any, conf: any) => { capturedConf = conf; return 'REVIEW_VERDICT:{"ok":true,"issues":[]}' },
    llmNodes('prompt', { cardIdPath: '{input.card.id}' }),
    { card: { id: 'k9', title: 'T' } },
  )
  assert(capturedConf && capturedConf.cardId === 'k9', 'A-6 cardIdPath 插值（k9）', capturedConf)
  assert(!out.error, 'A-6 插值后正常通过', out)
}

// A-5 pipeline_import_config 幂等（store 层 importPipelines）
{
  const defs: any = [
    {
      id: 'p-workflow-review', name: '代码评审', kind: 'atomic', description: 'd', tags: ['workflow'],
      published: true,
      nodes: [
        { id: 'in', title: '输入', type: 'input', order: 0, inputs: [], config: {} },
        { id: 'review', title: 'Agent 评审', type: 'llm', order: 10, inputs: ['in'], config: { prompt: 'p1', sessionKey: 'review-{input.card.id}', timeoutMs: 600000, agentPreset: 'review' } },
        { id: 'out', title: '输出', type: 'output', order: 100, inputs: ['review'], config: {} },
      ],
    },
  ]
  const r1 = await mutateDoc(fs, (doc: any) => importPipelines(doc, defs))
  const doc1 = await readDoc(fs)
  const p1 = findPipeline(doc1, 'p-workflow-review')
  assert(!!r1.ok && r1.imported && r1.imported[0].status === 'created', 'A-5a 首次导入 created', r1)
  assert(!!p1 && p1.publishedVersion === '0.1.0', 'A-5b 导入后稳定 id 可查且已发布', p1 && p1.publishedVersion)
  const llmNode = p1 && p1.versions.find((v) => v.version === p1.latestVersion)!.nodes.find((n: any) => n.type === 'llm')
  assert(!!llmNode && llmNode.config.sessionKey === 'review-{input.card.id}' && llmNode.config.agentPreset === 'review', 'A-5c llm 节点 config 完整', llmNode && llmNode.config)
  const r2 = await mutateDoc(fs, (doc: any) => importPipelines(doc, defs))
  const doc2 = await readDoc(fs)
  const p2 = findPipeline(doc2, 'p-workflow-review')
  assert(!!r2.ok && r2.imported[0].status === 'updated', 'A-5d 重复导入 updated', r2)
  assert(!!p2 && p2.publishedVersion === '0.1.0' && p2.versions.length === 1, 'A-5e 幂等：不 bump 版本、不产生新版本', { publishedVersion: p2 && p2.publishedVersion, versions: p2 && p2.versions.length })
  const l2 = p2 && p2.versions[0].nodes.find((n: any) => n.type === 'llm')
  assert(!!l2 && l2.config.prompt === 'p1', 'A-5f 节点内容与首次一致', l2 && l2.config)
}

// 拓扑排序不回归
{
  const t = topologicalOrder(llmNodes('p'))
  assert(!!t.ok && t.order && t.order.length === 3, '拓扑排序正常', t)
}

console.log('---')
console.log('引擎级测试: ' + passed + ' passed, ' + failed + ' failed')
if (failed > 0) process.exit(1)
