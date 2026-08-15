// host/gate.ts — 门禁引擎（v5 抽象）：门禁 = 统一检查单元（checker）
// checker 类型：
//   tag-required   内置条件：卡片必须含指定标签
//   field-nonempty 内置条件：字段非空
//   mr-linked      内置条件：已关联仓库 + MR
//   mr-merged      内置条件：关联 MR 已合并（GitHub API）
//   code           一段代码：沙箱 node 执行，载荷写临时文件，exit 0 且 stdout {ok:true} 通过
//   pipeline       一条/多条 pipeline：现场启动并等待全部成功（GitHub CI 门禁语义）
// 门禁挂在 card.gates（或经创建模板带入）；move/tags/archive 触发前检查，任一失败拒绝动作。
import { CardGate } from '@dsh-plugins/ui'

export type GateAction = 'move' | 'tags' | 'archive'

export interface ShellLike {
  run(spec: { command: string; workdir?: string; timeoutMs?: number; stdoutMaxBytes?: number; env?: Record<string, string>; sandboxPolicy?: { mode: string } }): Promise<{ exitCode: number | null; stdout: { text: string; truncated: boolean } }>
}

export interface PipelineSvcLike {
  run(pipelineId: string, inputs: Record<string, unknown>, version?: string): Promise<Record<string, unknown>>
}

export interface GateCheckDeps {
  /** 解析 GITHUB_TOKEN（mr-* checker 用） */
  getToken(): Promise<string | undefined>
  /** 沙箱执行器（code checker 用） */
  shell?: ShellLike
  /** pipeline 服务（pipeline checker 用，懒解析） */
  getPipelineService?(): PipelineSvcLike | undefined
  /** 写临时文件（code checker 用；由宿主 fs 注入，避免 node:fs 依赖） */
  writeTempFile?(path: string, content: string): Promise<void>
}

export interface GateFailure {
  name: string
  type: string
  reason: string
}

/** v4 → v5 迁移：旧平铺 {kind, on, config:{to,...}} → 新 {on, to?, checker:{type, config}} */
export function migrateGate(g: any): CardGate {
  if (!g || typeof g !== 'object') return g
  if (g.checker && typeof g.checker === 'object' && typeof g.checker.type === 'string') return g as CardGate
  const config = { ...(g.config || {}) }
  const to = typeof config.to === 'string' ? (config.to as string) : undefined
  delete config.to
  const type = String(g.kind || 'tag-required')
  return { id: g.id, name: g.name || type, on: g.on || 'move', ...(to ? { to } : {}), checker: { type: type as any, config } }
}

/** 匹配某动作应触发的门禁（on 相等；move 可限目标列 gate.to） */
export function gatesFor(card: any, action: GateAction, extra?: { to?: string }): CardGate[] {
  const gates: CardGate[] = Array.isArray(card && card.gates) ? card.gates.map(migrateGate) : []
  return gates.filter((g) => {
    if (g.on !== action) return false
    if (action === 'move' && g.to) {
      return String(g.to) === String(extra && extra.to)
    }
    return true
  })
}

export type CheckerFn = (card: any, gate: CardGate, cfg: Record<string, unknown>, deps: GateCheckDeps) => Promise<GateFailure | null>

/** 检查器注册表：type → 实现。 */
export const checkerRegistry: Record<string, CheckerFn> = {}

checkerRegistry['tag-required'] = async (card, gate, cfg) => {
  const required: string[] = (Array.isArray(cfg.tags) ? cfg.tags : []).map(String)
  const have: string[] = Array.isArray(card.tags) ? card.tags : []
  const missing = required.filter((t) => t && !have.includes(t))
  if (missing.length > 0) return { name: gate.name || 'tag-required', type: 'tag-required', reason: '缺少必需标签：' + missing.join(', ') }
  return null
}

checkerRegistry['field-nonempty'] = async (card, gate, cfg) => {
  const field = String(cfg.field || 'description')
  const val = card[field]
  if (typeof val !== 'string' || val.trim() === '') return { name: gate.name || 'field-nonempty', type: 'field-nonempty', reason: '字段「' + field + '」为空' }
  return null
}

checkerRegistry['mr-linked'] = async (card, gate) => {
  const refs: any[] = Array.isArray(card.refs) ? card.refs : []
  const repoRef = refs.find((r) => r.kind === 'github-repo')
  const mrRefs = refs.filter((r) => r.kind === 'github-mr' && r.externalId)
  const snap = card.meta && card.meta.sync && card.meta.sync.github && card.meta.sync.github.snapshot
  const snapMrs = snap && Array.isArray(snap.mrs) ? snap.mrs : []
  if (!repoRef || !repoRef.externalId) return { name: gate.name || 'mr-linked', type: 'mr-linked', reason: '卡片未关联 GitHub 仓库（github-repo）' }
  if (mrRefs.length === 0 && snapMrs.length === 0) return { name: gate.name || 'mr-linked', type: 'mr-linked', reason: '卡片未关联 MR（github-mr）' }
  return null
}

checkerRegistry['mr-merged'] = async (card, gate, _cfg, deps) => {
  const refs: any[] = Array.isArray(card.refs) ? card.refs : []
  const repoRef = refs.find((r) => r.kind === 'github-repo')
  const mrRefs = refs.filter((r) => r.kind === 'github-mr' && r.externalId)
  if (!repoRef || !repoRef.externalId) return { name: gate.name || 'mr-merged', type: 'mr-merged', reason: '卡片未关联 GitHub 仓库' }
  if (mrRefs.length === 0) return { name: gate.name || 'mr-merged', type: 'mr-merged', reason: '卡片未关联 MR' }
  const repo = String(repoRef.externalId)
  const token = await deps.getToken().catch(() => undefined)
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' }
  if (token) headers.Authorization = 'Bearer ' + token
  const unmerged: string[] = []
  for (const mr of mrRefs) {
    const n = String(mr.externalId).replace('#', '').trim()
    try {
      const res = await fetch('https://api.github.com/repos/' + encodeURIComponent(repo.split('/')[0]) + '/' + encodeURIComponent(repo.split('/')[1] || '') + '/pulls/' + encodeURIComponent(n), { headers })
      if (res.status === 404) { unmerged.push('#' + n + '（不存在）'); continue }
      const body: any = await res.json().catch(() => null)
      if (!body || body.merged !== true) unmerged.push('#' + n + '（未合并）')
    } catch (e) {
      unmerged.push('#' + n + '（查询失败）')
    }
  }
  if (unmerged.length > 0) return { name: gate.name || 'mr-merged', type: 'mr-merged', reason: 'MR 未全部合并：' + unmerged.join(', ') }
  return null
}

checkerRegistry['code'] = async (card, gate, cfg, deps) => {
  const shell = deps.shell
  if (!shell) return { name: gate.name || 'code', type: 'code', reason: '沙箱执行器不可用（code checker 需要 shell）' }
  const code = typeof cfg.code === 'string' && cfg.code.trim() ? cfg.code : null
  const script = typeof cfg.script === 'string' && cfg.script.trim() ? cfg.script : null
  if (!code && !script) return { name: gate.name || 'code', type: 'code', reason: 'code checker 缺少 code 或 script 配置' }
  const payload = JSON.stringify({ card, gate: { id: gate.id, name: gate.name, on: gate.on, checker: gate.checker } })
  const codePath = '/tmp/dsh-gate-' + gate.id + '.mjs'
  const payloadPath = '/tmp/dsh-gate-' + gate.id + '.json'
  if (!deps.writeTempFile) return { name: gate.name || 'code', type: 'code', reason: 'code checker 需要 writeTempFile 依赖' }
  try {
    if (code) await deps.writeTempFile(codePath, code)
    await deps.writeTempFile(payloadPath, payload)
  } catch (e) {
    return { name: gate.name || 'code', type: 'code', reason: '写临时文件失败：' + String(e) }
  }
  const command = code ? ('node ' + codePath + ' ' + payloadPath) : ('node ' + script + ' ' + payloadPath)
  const timeoutMs = typeof cfg.timeoutMs === 'number' ? cfg.timeoutMs : 30000
  try {
    const res = await shell.run({ command, timeoutMs, stdoutMaxBytes: 1 << 16, sandboxPolicy: { mode: 'danger-full-access' } })
    if (res.exitCode !== 0) return { name: gate.name || 'code', type: 'code', reason: 'code checker 退出码 ' + res.exitCode + '：' + String(res.stdout ? res.stdout.text.slice(-300) : '') }
    const text = (res.stdout && res.stdout.text || '').trim()
    let verdict: any = null
    try { verdict = text ? JSON.parse(text) : null } catch { /* 非 JSON 也接受纯文本 */ }
    if (verdict && typeof verdict === 'object' && verdict.ok === true) return null
    if (verdict && typeof verdict === 'object' && verdict.ok === false) return { name: gate.name || 'code', type: 'code', reason: String(verdict.reason || '未通过') }
    if (text === 'ok' || text === 'true') return null
    return { name: gate.name || 'code', type: 'code', reason: '未通过（stdout: ' + text.slice(-200) + '）' }
  } catch (e) {
    return { name: gate.name || 'code', type: 'code', reason: '执行失败：' + String((e as Error).message) }
  }
}

checkerRegistry['pipeline'] = async (card, gate, cfg, deps) => {
  const svc = deps.getPipelineService ? deps.getPipelineService() : undefined
  if (!svc || typeof svc.run !== 'function') return { name: gate.name || 'pipeline', type: 'pipeline', reason: 'pipeline 插件未激活' }
  let ids: string[] = Array.isArray(cfg.pipelines) ? cfg.pipelines.map(String).filter(Boolean) : []
  if (ids.length === 0 && cfg.pipelineId) ids = [String(cfg.pipelineId)]
  if (ids.length === 0) return { name: gate.name || 'pipeline', type: 'pipeline', reason: 'pipeline checker 缺少 pipelines 配置' }
  const inputs: Record<string, unknown> = { card }
  // 现场启动并等待：全部成功才通过（GitHub CI 门禁语义）
  const results = await Promise.all(ids.map(async (pid) => {
    try {
      const out = await svc.run(pid, inputs)
      return { pid, ok: !(out && out.error), out }
    } catch (e) {
      return { pid, ok: false, out: { error: String((e as Error).message) } }
    }
  }))
  const failed = results.filter((r) => !r.ok)
  if (failed.length > 0) {
    return { name: gate.name || 'pipeline', type: 'pipeline', reason: failed.map((f) => 'pipeline ' + f.pid + ' 失败：' + String(f.out && f.out.error ? f.out.error : 'unknown')).join('；') }
  }
  return null
}

/** 检查卡片上匹配 action 的全部门禁；任一失败即拒绝 */
export async function checkGates(
  card: any,
  action: GateAction,
  deps: GateCheckDeps,
  extra?: { to?: string },
): Promise<{ ok: boolean; failed: GateFailure[] }> {
  const gates = gatesFor(card, action, extra)
  if (gates.length === 0) return { ok: true, failed: [] }
  const failed: GateFailure[] = []
  for (const g of gates) {
    const cfg = (g.checker && g.checker.config) || {}
    const fn = checkerRegistry[g.checker.type]
    let f: GateFailure | null
    if (!fn) f = { name: g.name || g.checker.type, type: g.checker.type, reason: '未知检查器类型：' + g.checker.type }
    else f = await fn(card, g, cfg, deps)
    if (f) failed.push(f)
  }
  return { ok: failed.length === 0, failed }
}

/** 校验门禁定义（新增时输入合法性） */
export function validateGate(gate: any): string | null {
  if (!gate || typeof gate !== 'object') return '门禁定义缺失'
  const c = gate.checker
  if (!c || typeof c !== 'object' || typeof c.type !== 'string') return '缺少 checker（checker: { type, config? }）'
  if (!['tag-required', 'field-nonempty', 'mr-linked', 'mr-merged', 'code', 'pipeline'].includes(c.type)) return '未知检查器类型：' + c.type
  if (!['move', 'tags', 'archive'].includes(gate.on)) return '未知触发行为：' + gate.on
  const cfg = c.config || {}
  if (c.type === 'tag-required' && (!Array.isArray(cfg.tags) || cfg.tags.length === 0)) return 'tag-required 需要 config.tags 数组'
  if (c.type === 'field-nonempty' && !cfg.field) return 'field-nonempty 需要 config.field'
  if (c.type === 'code' && !cfg.code && !cfg.script) return 'code 需要 config.code（内联 JS）或 config.script（脚本路径）'
  if (c.type === 'pipeline' && !(Array.isArray(cfg.pipelines) && cfg.pipelines.length > 0) && !cfg.pipelineId) return 'pipeline 需要 config.pipelines 数组（或 pipelineId）'
  return null
}

/** 检查器默认配置（按 type） */
export function checkerDefaults(type: string): Record<string, unknown> {
  if (type === 'tag-required') return { tags: [] }
  if (type === 'field-nonempty') return { field: 'description' }
  if (type === 'code') return { code: "const fs = await import('node:fs/promises');\nconst { card } = JSON.parse(await fs.readFile(process.argv[2], 'utf8'));\n// 示例:标题长度必须 > 5\nconsole.log(JSON.stringify({ ok: String(card.title || '').length > 5, reason: 'title too short' }))" }
  if (type === 'pipeline') return { pipelines: [] }
  return {}
}
