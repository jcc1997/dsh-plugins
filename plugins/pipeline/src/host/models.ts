// host/models.ts — pipeline 数据模型与纯函数工具（semver、版本、节点、运行）
// 供 store.ts（持久化 CRUD）与 engine.ts（执行）与 tools.ts（agent 工具）共用；不依赖 ctx。

export type PipelineKind = 'atomic' | 'combined'

/** 节点类型：input 输入 / output 输出 / exec shell 命令 / fetch http 请求 /
 *  transform 内置转换 / llm 大模型分析（沙箱子 agent，延后实现） / pipeline 引用子流水线 */
export type NodeType = 'input' | 'output' | 'exec' | 'fetch' | 'transform' | 'llm' | 'pipeline'

/** 单个节点的配置（JSON 兼容） */
export interface PipelineNode {
  id: string
  /** 展示名 */
  title: string
  type: NodeType
  /** 执行顺序（越小越先）；同名 group 内按 order 排列 */
  order: number
  /** 依赖的节点 id 列表（决定 DAG 拓扑与数据依赖） */
  inputs?: string[]
  /** 节点类型相关的配置 */
  config: Record<string, unknown>
  /** 展示坐标（client 编辑器用，执行无关） */
  position?: { x: number; y: number }
}

/** 一个不可变版本快照 */
export interface PipelineVersion {
  version: string
  nodes: PipelineNode[]
  /** 输入 schema（JSON Schema 片段，描述入参） */
  inputSchema?: Record<string, unknown>
  /** 变更说明 */
  changelog?: string
  published: boolean
  publishedAt?: string
  createdAt: string
}

/** 一个 pipeline（含 no-dependency atomic 与 combined 两种） */
export interface Pipeline {
  id: string
  name: string
  description: string
  kind: PipelineKind
  tags: string[]
  /** 全部版本（按 semver 降序） */
  versions: PipelineVersion[]
  /** 最新版本号（含未发布草稿） */
  latestVersion: string
  /** 当前已发布（供外部调用/作为依赖）的版本号，无发布则 null */
  publishedVersion: string | null
  createdAt: string
  updatedAt: string
}

/** 运行状态 */
export type RunStatus = 'queued' | 'running' | 'success' | 'failed' | 'cancelled'

/** 单节点运行态 */
export interface NodeRunState {
  nodeId: string
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped'
  startedAt?: string
  finishedAt?: string
  error?: string
  /** 输出摘要（截断） */
  outputPreview?: string
}

/** 一次运行 */
export interface PipelineRun {
  id: string
  pipelineId: string
  version: string
  /** 入参（JSON） */
  inputs: Record<string, unknown>
  status: RunStatus
  nodes: NodeRunState[]
  /** 最终输出汇总 */
  output?: Record<string, unknown>
  error?: string
  createdAt: string
  startedAt?: string
  finishedAt?: string
  /** 触发来源：agent / ui / plugin */
  source: string
}

export interface PipelineDoc {
  version: number
  pipelines: Pipeline[]
  /** 运行记录（含队列中/进行中/历史，裁剪上限见 store） */
  runs: PipelineRun[]
  /** 运行队列（run id 有序列表） */
  queue: string[]
  meta: { updatedAt: string }
}

/* ── semver（npm 风格 major.minor.patch） ── */

export const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/

export interface SemVer { major: number; minor: number; patch: number }

export function parseSemver(v: string): SemVer | null {
  const m = SEMVER_RE.exec(String(v).trim())
  if (!m) return null
  return { major: parseInt(m[1], 10), minor: parseInt(m[2], 10), patch: parseInt(m[3], 10) }
}

export function isValidSemver(v: string): boolean { return parseSemver(v) !== null }

/** a > b → 1；a === b → 0；a < b → -1 */
export function compareSemver(a: string, b: string): number {
  const x = parseSemver(a)
  const y = parseSemver(b)
  if (!x || !y) return 0
  if (x.major !== y.major) return x.major > y.major ? 1 : -1
  if (x.minor !== y.minor) return x.minor > y.minor ? 1 : -1
  if (x.patch !== y.patch) return x.patch > y.patch ? 1 : -1
  return 0
}

export function sortVersionsDesc(versions: string[]): string[] {
  return [...versions].sort((a, b) => compareSemver(b, a))
}

/** 基于当前版本 bump 生成下一版本（默认 patch +1）；release 可选 major/minor/patch */
export function bumpVersion(current: string | null, release: 'major' | 'minor' | 'patch' = 'patch'): string {
  const cur = current && parseSemver(current) ? parseSemver(current)! : { major: 0, minor: 0, patch: 0 }
  if (release === 'major') return cur.major + 1 + '.0.0'
  if (release === 'minor') return cur.major + '.' + (cur.minor + 1) + '.0'
  return cur.major + '.' + cur.minor + '.' + (cur.patch + 1)
}

/* ── id / 时间 ── */

export function safeId(prefix: string): string {
  try { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8) } catch { return prefix + Math.floor(Math.random() * 1e9).toString(36) }
}

export function now(): string {
  try { return new Date().toISOString() } catch { return '' }
}

/* ── 节点工厂 ── */

export function makeNode(type: NodeType, title: string, order: number, config: Record<string, unknown> = {}, inputs: string[] = []): PipelineNode {
  return { id: 'n' + safeId('n').slice(1), title, type, order, inputs, config, position: undefined }
}

/** 新 pipeline 缺省版本（v0.1.0 草稿 + 默认 input/output 两端） */
export function defaultPipeline(name: string, description: string, kind: PipelineKind): Pipeline {
  const input = { id: 'in', title: '输入', type: 'input' as NodeType, order: 0, inputs: [], config: {} }
  const output = { id: 'out', title: '输出', type: 'output' as NodeType, order: 100, inputs: ['in'], config: {} }
  const ts = now()
  return {
    id: safeId('p'),
    name: name.trim() || '新流水线',
    description: description || '',
    kind,
    tags: [],
    versions: [{
      version: '0.1.0',
      nodes: [input, output],
      inputSchema: { type: 'object', properties: {}, additionalProperties: true },
      changelog: '初始版本',
      published: false,
      createdAt: ts,
    }],
    latestVersion: '0.1.0',
    publishedVersion: null,
    createdAt: ts,
    updatedAt: ts,
  }
}

/** 最新版本（含草稿）节点；未发布的可变 */
export function latestNodes(p: Pipeline): PipelineNode[] {
  const v = p.versions.find((x) => x.version === p.latestVersion)
  return v ? v.nodes : []
}

/* ── 运行状态辅助 ── */

export function nodeStates(nodes: PipelineNode[]): NodeRunState[] {
  return nodes.map((n) => ({ nodeId: n.id, status: 'pending' as const }))
}

export function summarizeDoc(doc: PipelineDoc): { pipelines: number; runs: number; queued: number; running: number } {
  return {
    pipelines: doc.pipelines.length,
    runs: doc.runs.length,
    queued: doc.queue.length,
    running: doc.runs.filter((r) => r.status === 'running').length,
  }
}
