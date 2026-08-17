// host/engine.ts — pipeline 运行时引擎：DAG 拓扑执行 + 节点 runner 注册表 + 运行队列
// 面向 agent：
//   1. 可在对话上下文调 runPipeline（同步阻塞直到结束或失败）
//   2. 可查运行进度 / 队列（runRegistry）
// 节点 runner 分内置（exec/fetch/transform/input/output）与可插入（llm——沙箱子 agent 延后实现，留桩）。
// 沙箱/LLM 延后：engine 不依赖宿主 sandbox/subagents 服务，llm 节点通过注入的 resolver 回调执行。

import {
  Pipeline, PipelineNode, PipelineRun, NodeRunState, RunStatus,
  safeId, now,
} from './models'
import { FsLike, readDoc, writeDoc, upsertRun, enqueueRun, dequeueRun, findRun } from './store'

/** 单节点执行上下文：可读上游输出、读入参、引用子 pipeline */
export interface NodeExecContext {
  inputs: Record<string, unknown>
  /** 上游节点输出（按 nodeId） */
  up: Record<string, Record<string, unknown>>
  /** fs 注入（exec/transform 文件类操作） */
  fs: FsLike
  /** 宿主 shell 服务（沙箱进程），可选 */
  shell?: ShellLike
  /** 子 pipeline 解析器（combined 引用） */
  resolvePipeline: (pipelineId: string, version: string) => Promise<{ pipeline: Pipeline; nodes: PipelineNode[] } | null>
  /** 递归运行子 pipeline */
  runSub: (pipelineId: string, version: string, inputs: Record<string, unknown>) => Promise<Record<string, unknown>>
  /** llm 节点解析器（宿主 subagents 服务，调用方注入） */
  runLlm?: (prompt: string, up: Record<string, Record<string, unknown>>, conf: Record<string, unknown>) => Promise<string>
  /** 调用方 agent（llm 节点 spawn 子 agent 的 parent 上下文，由工具链路注入） */
  parentAgent?: unknown
  /** 调用方取消信号（透传工具 exec.signal） */
  externalSignal?: AbortSignal | undefined
  /** 节点状态上报（进度） */
  report: (nodeId: string, patch: Partial<NodeRunState>) => void
  signal?: { aborted: boolean }
}

export interface ShellLike {
  run(spec: { command: string; workdir?: string; timeoutMs?: number; stdoutMaxBytes?: number; env?: Record<string, string>; sandboxPolicy?: { mode: string } }): Promise<{ exitCode: number | null; stdout: { text: string; truncated: boolean } }>
}

/** 节点 runner 签名 */
export type NodeRunner = (node: PipelineNode, ctx: NodeExecContext) => Promise<Record<string, unknown>>

/** 内置 runner 注册表（type → runner）；llm/pipeline 由引擎内处理 */
const builtinRunners: Record<string, NodeRunner> = {}

/** 内置：input 节点（透传入参，按 config.keys 挑选） */
builtinRunners['input'] = async (node, ctx) => {
  const keys = Array.isArray(node.config.keys) ? (node.config.keys as string[]).map(String) : []
  if (keys.length === 0) return { ...ctx.inputs }
  const out: Record<string, unknown> = {}
  for (const k of keys) out[k] = ctx.inputs[k]
  return out
}

/** 内置：output 节点（合并所有声明 input 的上游输出；无声明则合并全部） */
builtinRunners['output'] = async (node, ctx) => {
  const deps = (node.inputs && node.inputs.length) ? node.inputs : Object.keys(ctx.up)
  const out: Record<string, unknown> = {}
  for (const d of deps) {
    if (ctx.up[d]) Object.assign(out, ctx.up[d])
  }
  // 若声明了 pick 字段则只取
  if (Array.isArray(node.config.pick)) {
    const pick = (node.config.pick as string[]).map(String)
    const filtered: Record<string, unknown> = {}
    for (const k of pick) if (k in out) filtered[k] = out[k]
    return filtered
  }
  return out
}

/** 内置：exec 节点（shell 命令，沙箱执行器；command 支持 {input.xxx} 占位符） */
builtinRunners['exec'] = async (node, ctx) => {
  const shell = ctx.shell
  if (!shell) return { error: 'shell 服务不可用（沙箱执行器未挂载）' }
  let command = typeof node.config.command === 'string' ? node.config.command : ''
  command = interpolate(command, ctx)
  const workdir = typeof node.config.workdir === 'string' ? node.config.workdir : undefined
  const timeoutMs = typeof node.config.timeoutMs === 'number' ? node.config.timeoutMs : 60000
  try {
    const res = await shell.run({ command, workdir, timeoutMs, stdoutMaxBytes: 1 << 20, sandboxPolicy: { mode: 'danger-full-access' } })
    const text = res.stdout ? res.stdout.text : ''
    return { exitCode: res.exitCode, stdout: text, output: text.trim() }
  } catch (e) {
    return { error: String(e && (e as Error).message ? (e as Error).message : e) }
  }
}

/** 内置：fetch 节点（node 原生 fetch；url 支持占位符） */
builtinRunners['fetch'] = async (node, ctx) => {
  let url = typeof node.config.url === 'string' ? node.config.url : ''
  url = interpolate(url, ctx)
  if (!url) return { error: 'fetch 节点缺少 url' }
  const method = typeof node.config.method === 'string' ? node.config.method : 'GET'
  try {
    const headers: Record<string, string> = {}
    if (node.config.headers && typeof node.config.headers === 'object') {
      for (const [k, v] of Object.entries(node.config.headers as Record<string, unknown>)) headers[k] = interpolate(String(v), ctx)
    }
    let body: string | undefined
    if (node.config.body !== undefined) body = typeof node.config.body === 'string' ? interpolate(node.config.body, ctx) : JSON.stringify(node.config.body)
    const res = await fetch(url, { method, headers, body })
    const text = await res.text()
    let json: unknown = null
    try { json = text ? JSON.parse(text) : null } catch { json = null }
    return { status: res.status, ok: res.ok, body: text, json }
  } catch (e) {
    return { error: String(e && (e as Error).message ? (e as Error).message : e) }
  }
}

/** 内置：transform 节点（轻量 JSON 变换：config.template 或 config.mappings） */
builtinRunners['transform'] = async (node, ctx) => {
  // 简单字段映射 { outField: 'up.<nodeId>.<field>' 或 'input.<field>' }
  const mappings = (node.config.mappings || {}) as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const [outKey, src] of Object.entries(mappings)) {
    out[outKey] = resolvePath(String(src), ctx)
  }
  // 支持 config.template 字符串（{{ path }} 占位）
  if (typeof node.config.template === 'string') {
    out.output = interpolate(node.config.template, ctx)
  }
  return out
}

/** 占位符插值：{input.xxx} / {up.<nodeId>.<field>} 以及 {{路径}} */
function interpolate(s: string, ctx: NodeExecContext): string {
  return s.replace(/\{\{?\s*(input\.\w+[\w.]*|up\.[\w]+[\w.]*)\s*\}\}?/g, (m0, path: string) => {
    const v = resolvePath(path, ctx)
    return v === undefined ? m0 : String(v)
  })
}

/** 解析路径值：input.xxx / up.<nodeId>.<field> / 字面量 */
function resolvePath(path: string, ctx: NodeExecContext): unknown {
  const p = path.trim()
  if (p.startsWith('input.')) {
    return deepGet(ctx.inputs, p.slice('input.'.length))
  }
  if (p.startsWith('up.')) {
    const rest = p.slice('up.'.length)
    const dot = rest.indexOf('.')
    if (dot < 0) return deepGet(ctx.up, rest)
    const nodeId = rest.slice(0, dot)
    const field = rest.slice(dot + 1)
    const nodeOut = ctx.up[nodeId]
    if (field === '' || field === '*') return nodeOut
    return deepGet(nodeOut, field)
  }
  // 字面量
  return p
}

function deepGet(obj: unknown, path: string): unknown {
  if (obj == null) return undefined
  let cur: any = obj
  for (const seg of path.split('.')) {
    if (seg === '' || cur == null) break
    cur = cur[seg]
  }
  return cur
}

/* ── 拓扑排序（节点 inputs 声明的依赖前置） ── */
export function topologicalOrder(nodes: PipelineNode[]): { ok: boolean; order?: string[]; error?: string } {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const inNodes = new Map<string, string[]>()
  const indeg = new Map<string, number>()
  for (const n of nodes) {
    inNodes.set(n.id, [])
    indeg.set(n.id, 0)
    // 隐式：上一 order 节点 → 下一节点（串联默认）
  }
  // 依赖 = 显式 inputs + 默认顺序（前一个更小 order 且无显式 inputs 声明时的串联）
  const sorted = [...nodes].sort((a, b) => a.order - b.order)
  const deps = new Map<string, string[]>()
  let prevId: string | null = null
  for (const n of sorted) {
    const d: string[] = (n.inputs && n.inputs.length ? n.inputs.slice() : (prevId ? [prevId] : []))
    // 去重 + 过滤不存在的引用
    const clean: string[] = []
    for (const x of d) { if (byId.has(x) && !clean.includes(x)) clean.push(x) }
    deps.set(n.id, clean)
    for (const x of clean) indeg.set(x, (indeg.get(x) || 0))
    prevId = n.id
  }
  // Kahn
  const inCount = new Map<string, number>()
  const outgoing = new Map<string, string[]>()
  for (const n of nodes) { inCount.set(n.id, (deps.get(n.id) || []).length); outgoing.set(n.id, []) }
  for (const n of nodes) {
    for (const d of deps.get(n.id) || []) outgoing.get(d)!.push(n.id)
  }
  const queue = sorted.filter((n) => (inCount.get(n.id) || 0) === 0).map((n) => n.id)
  const orderOut: string[] = []
  const q = [...queue]
  while (q.length) {
    const id = q.shift()!
    orderOut.push(id)
    for (const nx of outgoing.get(id) || []) {
      inCount.set(nx, (inCount.get(nx) || 1) - 1)
      if (inCount.get(nx) === 0) q.push(nx)
    }
  }
  if (orderOut.length !== nodes.length) {
    return { ok: false, error: '节点依赖存在环：' + nodes.filter((n) => inCount.get(n.id) !== 0).map((n) => n.title).join(', ') }
  }
  return { ok: true, order: orderOut }
}

/* ── 执行一条 pipeline（同步阻塞，返回最终输出） ── */
export interface EngineDeps {
  fs: FsLike
  shell?: ShellLike
  onRunUpdate: (run: PipelineRun) => void
  /** llm 节点处理器（宿主 subagents 服务接线；缺省 fail-closed） */
  runLlm?: (prompt: string, up: Record<string, Record<string, unknown>>, conf: Record<string, unknown>) => Promise<string>
  /** 调用方 agent（透传至 llm 节点） */
  parentAgent?: unknown
  /** 调用方取消信号（透传至 llm 节点） */
  externalSignal?: AbortSignal | undefined
}

export async function executePipeline(
  deps: EngineDeps,
  pipeline: Pipeline,
  version: string,
  inputs: Record<string, unknown>,
  runId: string,
): Promise<Record<string, unknown>> {
  const verObj = pipeline.versions.find((v) => v.version === version) || pipeline.versions[pipeline.versions.length - 1]
  const nodes = verObj.nodes
  const topo = topologicalOrder(nodes)
  const states = new Map<string, NodeRunState>()
  for (const n of nodes) states.set(n.id, { nodeId: n.id, status: 'pending' })

  const run: PipelineRun = {
    id: runId, pipelineId: pipeline.id, version: version, inputs,
    status: 'running', nodes: nodes.map((n) => states.get(n.id)!),
    createdAt: now(), startedAt: now(), source: 'engine',
  }
  deps.onRunUpdate(run)

  if (!topo.ok) {
    run.status = 'failed'
    run.error = topo.error
    run.finishedAt = now()
    deps.onRunUpdate(run)
    return { error: topo.error }
  }

  const up: Record<string, Record<string, unknown>> = {}
  const report = (nodeId: string, patch: Partial<NodeRunState>) => {
    const s = states.get(nodeId)
    if (s) { Object.assign(s, patch); deps.onRunUpdate({ ...run, nodes: [...nodes.map((n) => ({ ...states.get(n.id)! }))] }) }
  }

  /** 递归运行子 pipeline（combined 引用） */
  const runSub = async (pipelineId: string, ver: string, subInputs: Record<string, unknown>): Promise<Record<string, unknown>> => {
    const doc = await readDoc(deps.fs)
    const sub = doc.pipelines.find((p) => p.id === pipelineId)
    if (!sub) return { error: '子流水线不存在：' + pipelineId }
    const targetVer = ver === 'latest' || !sub.versions.some((v) => v.version === ver) ? (sub.publishedVersion || sub.latestVersion) : ver
    const subRunId = safeId('r')
    return executePipeline(deps, sub, targetVer, subInputs, subRunId)
  }

  for (const id of topo.order!) {
    const node = nodes.find((n) => n.id === id)!
    // abort 检查
    report(id, { status: 'running', startedAt: now() })
    const ctx: NodeExecContext = {
      inputs, up, fs: deps.fs, shell: deps.shell,
      parentAgent: deps.parentAgent, externalSignal: deps.externalSignal,
      resolvePipeline: async (pid, ver) => {
        const doc = await readDoc(deps.fs)
        const p = doc.pipelines.find((x) => x.id === pid)
        if (!p) return null
        const v = ver === 'latest' ? (p.publishedVersion || p.latestVersion) : ver
        const vo = p.versions.find((x) => x.version === v)
        return vo ? { pipeline: p, nodes: vo.nodes } : null
      },
      runSub,
      runLlm: deps.runLlm,
      report,
    }
    let result: Record<string, unknown>
    try {
      if (node.type === 'pipeline') {
        const ref = resolveNodeRefObj(node.config)
        if (!ref) throw new Error('pipeline 节点缺少 ref 配置')
        result = await runSub(ref.pipelineId, ref.version, buildSubInputs(node, ctx))
      } else if (node.type === 'llm') {
        result = await runLlmNode(node, ctx)
      } else {
        const runner = builtinRunners[node.type]
        if (!runner) throw new Error('未知节点类型：' + node.type)
        result = await runner(node, ctx)
      }
      if (result && result.error && !isSoftError(node, result)) {
        throw new Error(String(result.error))
      }
      up[id] = result
      report(id, { status: 'success', finishedAt: now(), outputPreview: truncate(JSON.stringify(result)) })
    } catch (e) {
      const msg = String(e && (e as Error).message ? (e as Error).message : e)
      report(id, { status: 'failed', finishedAt: now(), error: msg })
      run.status = 'failed'
      run.error = '节点「' + node.title + '」失败：' + msg
      run.finishedAt = now()
      deps.onRunUpdate(run)
      return { error: run.error }
    }
  }

  // 汇总输出：取 output 节点（若有）否则合并所有末端
  const outNode = nodes.find((n) => n.type === 'output')
  let output: Record<string, unknown>
  if (outNode && up[outNode.id]) output = up[outNode.id]
  else output = Object.values(up).reduce<Record<string, unknown>>((acc, o) => Object.assign(acc, o), {})
  run.status = 'success'
  run.output = output
  run.finishedAt = now()
  deps.onRunUpdate(run)
  return output
}

function buildSubInputs(node: PipelineNode, ctx: NodeExecContext): Record<string, unknown> {
  const mapping = (node.config.inputs || {}) as Record<string, unknown>
  if (Object.keys(mapping).length === 0) return ctx.inputs
  const out: Record<string, unknown> = {}
  for (const [k, src] of Object.entries(mapping)) out[k] = resolvePath(String(src), ctx)
  return out
}

function resolveNodeRefObj(conf: Record<string, unknown>): { pipelineId: string; version: string } | null {
  const ref = conf.ref
  if (!ref || typeof ref !== 'string') return null
  const at = ref.lastIndexOf('@')
  if (at < 0) return { pipelineId: ref, version: 'latest' }
  return { pipelineId: ref.slice(0, at), version: ref.slice(at + 1) }
}

/** llm 节点：通过注入的 runLlm（宿主 agent 服务）执行；未注入时 fail-closed（拒绝而非占位成功） */
async function runLlmNode(node: PipelineNode, ctx: NodeExecContext): Promise<Record<string, unknown>> {
  const prompt = typeof node.config.prompt === 'string' ? interpolate(node.config.prompt, ctx) : truncate(JSON.stringify(ctx.up))
  // 调用上下文透传（spawn 子 agent 需要 parent/signal）
  const conf: Record<string, unknown> = { ...node.config }
  // 续评上下文：ticketId 用于注入上轮评审意见（runLlm 接线侧消费）
  if (typeof node.config.ticketIdPath === 'string' && node.config.ticketIdPath.trim()) {
    conf.ticketId = interpolate(node.config.ticketIdPath, ctx)
  }
  conf.parentAgent = ctx.parentAgent
  conf.externalSignal = ctx.externalSignal
  const ticket = (ctx.inputs && (ctx.inputs as any).ticket) || null
  if (ticket && typeof ticket.id === 'string') conf.ticketId = ticket.id
  if (!ctx.runLlm) {
    throw new Error('LLM 节点未接入 agent 服务（runLlm 未注入，fail-closed：宁可失败不可假放行）')
  }
  const text = await ctx.runLlm(prompt, ctx.up, conf)
  const verdict = parseVerdict(text)
  if (verdict && verdict.ok === true) return { output: text, verdict }
  const issues = verdict && Array.isArray(verdict.issues) ? verdict.issues : []
  const summary = issues.slice(0, 20).map((i: any) => String((i && i.file) || '') + ((i && i.location) ? ':' + i.location : '') + ' ' + String((i && i.message) || '')).join('；').trim()
  const detail = summary || ('verdict 解析失败（输出未以 REVIEW_VERDICT:{"ok":true|false,"issues":[...]} 结尾）：' + text.slice(-200))
  return { output: text, ...(verdict ? { verdict } : {}), error: '评审未通过：' + detail }
}

/** 解析 agent 输出尾行 verdict：REVIEW_VERDICT:{"ok":true|false,"issues":[...]} */
function parseVerdict(text: unknown): { ok: boolean; issues?: unknown[] } | null {
  if (typeof text !== 'string') return null
  const m = text.match(/REVIEW_VERDICT:\s*(\{[\s\S]*\})\s*$/)
  if (!m) return null
  try {
    const v = JSON.parse(m[1])
    if (v && typeof v === 'object' && typeof (v as any).ok === 'boolean') {
      return { ok: (v as any).ok, issues: Array.isArray((v as any).issues) ? (v as any).issues : [] }
    }
  } catch { /* 非法 JSON → null（fail-closed） */ }
  return null
}

function isSoftError(node: PipelineNode, result: Record<string, unknown>): boolean {
  // fetch 节点 http 非 2xx 视为失败；其余以 result.error 字段为准
  return false
}

function truncate(s: string, n = 500): string {
  return s.length > n ? s.slice(0, n) + '…' : s
}

/* ── 运行注册表 + 队列（面向 agent 查进度/队列） ── */
export class RunQueue {
  private fs: FsLike
  private deps: EngineDeps
  private running = false
  private tickTimer: ReturnType<typeof setInterval> | null = null

  constructor(fs: FsLike, deps: EngineDeps) {
    this.fs = fs
    this.deps = deps
  }

  /** 运行级调用上下文（llm 节点 spawn 子 agent 用） */
  private runOpts = new Map<string, { parentAgent?: unknown; externalSignal?: AbortSignal | undefined }>()

  /** 提交一个运行（异步入队），返回 run id；同步执行器由 submitSync 提供 */
  async submit(pipelineId: string, version: string, inputs: Record<string, unknown>, source: string, opts?: { parentAgent?: unknown; externalSignal?: AbortSignal | undefined }): Promise<{ runId: string; run: PipelineRun }> {
    const doc = await readDoc(this.fs)
    const pipeline = doc.pipelines.find((p) => p.id === pipelineId)
    if (!pipeline) throw new Error('pipeline not found: ' + pipelineId)
    const runId = safeId('r')
    const targetVer = version === 'latest' ? (pipeline.publishedVersion || pipeline.latestVersion) : version
    const run: PipelineRun = {
      id: runId, pipelineId, version: targetVer, inputs, status: 'queued',
      nodes: [], createdAt: now(), source,
    }
    if (opts) this.runOpts.set(runId, opts)
    enqueueRun(doc, run)
    await writeDoc(this.fs, doc)
    this.startTick()
    return { runId, run }
  }

  /** 同步执行（阻塞直到结束；不进入队列，直接 running） */
  async submitSync(pipelineId: string, version: string, inputs: Record<string, unknown>, source: string, opts?: { parentAgent?: unknown; externalSignal?: AbortSignal | undefined }): Promise<Record<string, unknown>> {
    const doc = await readDoc(this.fs)
    const pipeline = doc.pipelines.find((p) => p.id === pipelineId)
    if (!pipeline) return { error: 'pipeline not found: ' + pipelineId }
    const targetVer = version === 'latest' ? (pipeline.publishedVersion || pipeline.latestVersion) : version
    const runId = safeId('r')
    // 占位记录
    const run: PipelineRun = { id: runId, pipelineId, version: targetVer, inputs, status: 'running', nodes: [], createdAt: now(), startedAt: now(), source }
    if (opts) this.runOpts.set(runId, opts)
    upsertRun(doc, run)
    await writeDoc(this.fs, doc)
    const writer = this.makeUpdateWriter()
    const result = await executePipeline({ ...this.deps, onRunUpdate: writer.update, ...(opts || {}) }, pipeline, targetVer, inputs, runId)
    await writer.drain()
    this.runOpts.delete(runId)
    return result
  }

  /**
   * onRunUpdate 串行写盘工厂：executePipeline 会在节点状态变化时高频回调 onRunUpdate，
   * 而 read-modify-write 是异步的——并发写盘会「旧状态覆盖新状态」（最终 success 被中途快照覆盖）。
   * 修复：①每次回调先做 JSON 快照（脱离对象引用后续变化）；②快照排进单条写链串行落盘；
   * ③执行结束后 drain() 等写链排空，保证最终状态最后落盘。
   */
  private makeUpdateWriter(): { update: (r: PipelineRun) => void; drain: () => Promise<void> } {
    let chain: Promise<void> = Promise.resolve()
    return {
      update: (r: PipelineRun) => {
        let snap: PipelineRun
        try { snap = JSON.parse(JSON.stringify(r)) } catch { snap = r }
        chain = chain.then(async () => {
          const d = await readDoc(this.fs)
          upsertRun(d, snap)
          await writeDoc(this.fs, d)
        }).catch(() => {})
      },
      drain: () => chain,
    }
  }

  private startTick() {
    if (this.tickTimer) return
    this.tickTimer = setInterval(() => { this.tick().catch(() => {}) }, 500)
  }

  /** 队列消费：串行执行队首 */
  private async tick() {
    if (this.running) return
    const doc = await readDoc(this.fs)
    if (doc.queue.length === 0) return
    this.running = true
    try {
      const runId = doc.queue[0]
      const pipeline = doc.pipelines.find((p) => p.id === (doc.runs.find((r) => r.id === runId)?.pipelineId))
      const runRec = doc.runs.find((r) => r.id === runId)
      if (!runRec || !pipeline) {
        dequeueRun(doc, runId)
        await writeDoc(this.fs, doc)
        return
      }
      runRec.status = 'running'
      runRec.startedAt = now()
      upsertRun(doc, runRec)
      await writeDoc(this.fs, doc)
      const writer = this.makeUpdateWriter()
      const opts = this.runOpts.get(runId)
      await executePipeline({ ...this.deps, onRunUpdate: writer.update, ...(opts || {}) }, pipeline, runRec.version, runRec.inputs, runId)
      await writer.drain()
      this.runOpts.delete(runId)
      const finDoc = await readDoc(this.fs)
      dequeueRun(finDoc, runId)
      await writeDoc(this.fs, finDoc)
    } finally {
      this.running = false
    }
  }

  stop() {
    if (this.tickTimer) { clearInterval(this.tickTimer); this.tickTimer = null }
  }
}

/** 判断一个原子 pipeline 是否可被引用（published 且非 combined 也可，但通常 atomic） */
export function isReferencable(p: Pipeline): boolean {
  return !!p.publishedVersion
}
