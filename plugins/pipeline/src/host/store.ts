// host/store.ts — pipeline 持久化层：~/.dsh/pipeline/pipeline.json 读改写
// 纯函数 + fs 注入（与 kanban board.ts / git config.json 同构）；不依赖 ctx。
import {
  Pipeline, PipelineVersion, PipelineNode, PipelineRun, PipelineDoc,
  safeId, now, sortVersionsDesc, bumpVersion, parseSemver, isValidSemver,
  defaultPipeline,
} from './models'

export interface FsLike {
  resolve(path: string, opts?: { cwd?: string; signal?: unknown }): Promise<{ targetKey: string; displayPath: string }>
  readText(target: { targetKey: string }, signal?: unknown): Promise<string>
  writeText(target: { targetKey: string }, content: string, expected?: unknown, signal?: unknown, sandboxPolicy?: { mode: string }): Promise<unknown>
}

export const DEFAULT_DIR = '/Users/jinchao.chen/.dsh/pipeline'
export const DOC_FILE = 'pipeline.json'
export const WRITE_POLICY = { mode: 'danger-full-access' }
/** 运行记录保留上限（超出的历史自动裁剪） */
export const MAX_RUNS = 200

export function defaultDoc(): PipelineDoc {
  return { version: 1, pipelines: [], runs: [], queue: [], meta: { updatedAt: now() } }
}

export async function readDoc(fs: FsLike): Promise<PipelineDoc> {
  try {
    const target = await fs.resolve(DEFAULT_DIR + '/' + DOC_FILE)
    const text = await fs.readText(target)
    const doc = JSON.parse(text) as PipelineDoc
    if (!Array.isArray(doc.pipelines)) doc.pipelines = []
    if (!Array.isArray(doc.runs)) doc.runs = []
    if (!Array.isArray(doc.queue)) doc.queue = []
    return doc
  } catch {
    return defaultDoc()
  }
}

export async function writeDoc(fs: FsLike, doc: PipelineDoc): Promise<void> {
  const target = await fs.resolve(DEFAULT_DIR + '/' + DOC_FILE)
  doc.meta = { updatedAt: now() }
  // 裁剪运行历史
  if (doc.runs.length > MAX_RUNS) {
    doc.runs = doc.runs.slice(doc.runs.length - MAX_RUNS)
  }
  await fs.writeText(target, JSON.stringify(doc, null, 2), undefined, undefined, WRITE_POLICY)
}

/** 读-改-写原子操作；fn 返回 null 表示失败 */
export async function mutateDoc(fs: FsLike, fn: (doc: PipelineDoc) => unknown): Promise<any> {
  const doc = await readDoc(fs)
  const result = fn(doc)
  if (result === null) return { ok: false, error: 'not found' }
  await writeDoc(fs, doc)
  return { ok: true, ...(result || {}) }
}

/* ── 查询 ── */

export function findPipeline(doc: PipelineDoc, id: string): Pipeline | null {
  return doc.pipelines.find((p) => p.id === id) || null
}

export function findVersion(p: Pipeline, version: string): PipelineVersion | null {
  return p.versions.find((v) => v.version === version) || null
}

export function findLatest(p: Pipeline): PipelineVersion {
  return p.versions.find((v) => v.version === p.latestVersion) || p.versions[p.versions.length - 1]
}

export function findRun(doc: PipelineDoc, runId: string): PipelineRun | null {
  return doc.runs.find((r) => r.id === runId) || null
}

/* ── 版本管理（npm 风格 semver） ── */

export interface CreateParams {
  name: string
  description?: string
  kind?: 'atomic' | 'combined'
  tags?: string[]
}

/** 新建 pipeline（默认 v0.1.0 草稿） */
export function createPipeline(doc: PipelineDoc, params: CreateParams): { ok: boolean; pipeline?: Pipeline; error?: string } {
  const name = (params.name || '').trim()
  if (!name) return { ok: false, error: 'name is required' }
  if (doc.pipelines.some((p) => p.name === name)) return { ok: false, error: 'duplicate name: ' + name }
  const p = defaultPipeline(name, params.description || '', params.kind === 'combined' ? 'combined' : 'atomic')
  if (params.tags) p.tags = params.tags.map((t) => String(t))
  doc.pipelines.push(p)
  return { ok: true, pipeline: p }
}

export interface UpdateParams {
  name?: string
  description?: string
  tags?: string[]
  /** 更新「最新草稿版本」的节点/入参 schema（不改已发布版本） */
  nodes?: PipelineNode[]
  inputSchema?: Record<string, unknown>
}

/** 更新 pipeline 元信息与最新草稿版本 */
export function updatePipeline(doc: PipelineDoc, id: string, params: UpdateParams): { ok: boolean; pipeline?: Pipeline; error?: string } {
  const p = findPipeline(doc, id)
  if (!p) return { ok: false, error: 'pipeline not found: ' + id }
  if (params.name !== undefined && params.name.trim() !== '') {
    const nm = params.name.trim()
    if (doc.pipelines.some((x) => x.id !== id && x.name === nm)) return { ok: false, error: 'duplicate name: ' + nm }
    p.name = nm
  }
  if (params.description !== undefined) p.description = params.description
  if (params.tags !== undefined) p.tags = params.tags.map((t) => String(t))
  const latest = findLatest(p)
  if (params.nodes !== undefined) {
    if (latest.published) {
      // 最新版本已发布 → 自动开新草稿 patch 版本
      const v = bumpVersion(p.latestVersion, 'patch')
      p.versions.push({ version: v, nodes: params.nodes, inputSchema: params.inputSchema || latest.inputSchema, changelog: '', published: false, createdAt: now() })
      p.latestVersion = v
    } else {
      latest.nodes = params.nodes
      if (params.inputSchema !== undefined) latest.inputSchema = params.inputSchema
    }
  } else if (params.inputSchema !== undefined) {
    if (latest.published) {
      const v = bumpVersion(p.latestVersion, 'patch')
      p.versions.push({ version: v, nodes: latest.nodes, inputSchema: params.inputSchema, changelog: '', published: false, createdAt: now() })
      p.latestVersion = v
    } else {
      latest.inputSchema = params.inputSchema
    }
  }
  p.updatedAt = now()
  return { ok: true, pipeline: p }
}

export interface PublishParams {
  /** 目标发布版本（缺省 = 最新草稿）；release 指定时在最新版基础上 bump */
  version?: string
  release?: 'major' | 'minor' | 'patch'
  changelog?: string
}

/** 发布（或 bump+发布）一个版本：快照不可变、作为外部可复用依赖 */
export function publishPipeline(doc: PipelineDoc, id: string, params: PublishParams): { ok: boolean; pipeline?: Pipeline; version?: string; error?: string } {
  const p = findPipeline(doc, id)
  if (!p) return { ok: false, error: 'pipeline not found: ' + id }
  let target: PipelineVersion | null = null
  let versionStr = ''
  if (params.version) {
    versionStr = String(params.version).trim()
    target = findVersion(p, versionStr)
    if (!target) return { ok: false, error: 'version not found: ' + versionStr }
  } else {
    // 基于最新发布版本 bump（无发布则从最新草稿）
    const base = p.publishedVersion || p.latestVersion
    versionStr = bumpVersion(base, params.release || 'patch')
    target = { version: versionStr, nodes: findLatest(p).nodes, inputSchema: findLatest(p).inputSchema, changelog: params.changelog || '', published: false, createdAt: now() }
    p.versions.push(target)
    p.latestVersion = versionStr
  }
  target.published = true
  target.publishedAt = now()
  if (params.changelog) target.changelog = params.changelog
  // 版本排序 + 最新/已发布指向
  p.versions = [...p.versions].sort((a, b) => { const x = parseSemver(a.version), y = parseSemver(b.version); if (!x || !y) return 0; return (y.major - x.major) || (y.minor - x.minor) || (y.patch - x.patch) })
  p.latestVersion = sortVersionsDesc(p.versions.map((v) => v.version))[0]
  const published = p.versions.filter((v) => v.published)
  p.publishedVersion = published.length ? sortVersionsDesc(published.map((v) => v.version))[0] : null
  p.updatedAt = now()
  return { ok: true, pipeline: p, version: versionStr }
}

export function deletePipeline(doc: PipelineDoc, id: string): { ok: boolean; error?: string } {
  const i = doc.pipelines.findIndex((p) => p.id === id)
  if (i < 0) return { ok: false, error: 'pipeline not found: ' + id }
  doc.pipelines.splice(i, 1)
  return { ok: true }
}

/** 删除一个未发布的旧版本（草稿）；已发布版本不可变，拒绝删除 */
export function deletePipelineVersion(doc: PipelineDoc, id: string, version: string): { ok: boolean; pipeline?: Pipeline; error?: string } {
  const p = findPipeline(doc, id)
  if (!p) return { ok: false, error: 'pipeline not found: ' + id }
  const v = findVersion(p, version)
  if (!v) return { ok: false, error: 'version not found: ' + version }
  if (v.published) return { ok: false, error: '已发布版本不可删除（版本发布后不可变）' }
  if (p.versions.length <= 1) return { ok: false, error: '至少保留一个版本' }
  p.versions = p.versions.filter((x) => x.version !== version)
  p.versions.sort((a, b) => {
    const x = parseSemver(a.version), y = parseSemver(b.version)
    if (!x || !y) return 0
    return (y.major - x.major) || (y.minor - x.minor) || (y.patch - x.patch)
  })
  p.latestVersion = sortVersionsDesc(p.versions.map((x) => x.version))[0]
  const published = p.versions.filter((x) => x.published)
  p.publishedVersion = published.length ? sortVersionsDesc(published.map((x) => x.version))[0] : null
  p.updatedAt = now()
  return { ok: true, pipeline: p }
}

/* ── 运行记录 ── */

export function enqueueRun(doc: PipelineDoc, run: PipelineRun): PipelineRun {
  doc.runs.push(run)
  doc.queue.push(run.id)
  return run
}

export function dequeueRun(doc: PipelineDoc, runId: string): void {
  doc.queue = doc.queue.filter((id) => id !== runId)
}

export function upsertRun(doc: PipelineDoc, run: PipelineRun): void {
  const i = doc.runs.findIndex((r) => r.id === run.id)
  if (i >= 0) doc.runs[i] = run
  else doc.runs.push(run)
}

/* ── 目录：可复用的原子单元 = 已发布的 atomic pipeline 版本 ── */
export function listCatalog(doc: PipelineDoc): any[] {
  const out: any[] = []
  for (const p of doc.pipelines) {
    for (const v of p.versions) {
      if (!v.published) continue
      out.push({
        pipelineId: p.id,
        name: p.name,
        kind: p.kind,
        version: v.version,
        nodeCount: v.nodes.length,
        publishedAt: v.publishedAt,
      })
    }
  }
  return out.sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')))
}

/* ── 导入：模板 pipeline 定义（按稳定 id 幂等 upsert，供 pipeline_import_config / 模板分发） ── */

function normalizeNodes(nodes: unknown): PipelineNode[] {
  const arr = Array.isArray(nodes) ? nodes : []
  return arr.map((n: any, i: number) => ({
    id: n && n.id && typeof n.id === 'string' ? n.id : 'n' + i,
    title: (n && n.title) || ('节点 ' + (i + 1)),
    type: (n && n.type) || 'transform',
    order: n && typeof n.order === 'number' ? n.order : i,
    inputs: n && Array.isArray(n.inputs) ? n.inputs.map(String) : [],
    config: n && n.config && typeof n.config === 'object' ? n.config : {},
  }))
}

export interface ImportPipelineDef {
  id: string
  name?: string
  kind?: 'atomic' | 'combined'
  description?: string
  tags?: string[]
  nodes?: unknown
  input_schema?: Record<string, unknown>
  published?: boolean
  changelog?: string
}

/** 节点结构比对（导入幂等判定用：模板节点与已发布版本节点一致则无需重新发布） */
function sameNodes(a: PipelineNode[], b: PipelineNode[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * 导入 pipeline 定义：按 id 幂等 upsert。
 * - 不存在 → 新建；published 时把当前草稿版本直接发布（不 bump）。
 * - 已存在 → 更新元信息 + 最新草稿节点（已发布版本不可变，自动开新草稿）；
 *   published 且（尚无发布版本 或 模板节点与最新已发布版本不一致）→ 把最新草稿发布为新的已发布版本。
 * - 重复导入相同定义 → 内容一致则不再发布、不产生新版本（幂等）。
 */
export function importPipelines(doc: PipelineDoc, defs: ImportPipelineDef[]): { ok: boolean; imported?: { id: string; status: 'created' | 'updated'; note?: string }[]; error?: string } {
  const out: { id: string; status: 'created' | 'updated'; note?: string }[] = []
  for (const def of defs) {
    if (!def || typeof def !== 'object') return { ok: false, error: '非法 pipeline 定义' }
    const id = String(def.id || '').trim()
    if (!id) return { ok: false, error: '缺少 pipeline id' }
    const nodesN = def.nodes !== undefined ? normalizeNodes(def.nodes) : undefined
    const exist = findPipeline(doc, id)
    if (exist) {
      const latest = findLatest(exist)
      const pubVersions = exist.versions.filter((v) => v.published)
      const latestPub = pubVersions.sort((a, b) => String(b.version).localeCompare(String(a.version), undefined, { numeric: true }))[0]
      const nodesChanged = nodesN !== undefined && !sameNodes(latest.nodes, nodesN)
      const schemaChanged = def.input_schema !== undefined && JSON.stringify(latest.inputSchema) !== JSON.stringify(def.input_schema)
      if (!latest.published) {
        // 本地存在未发布草稿：与模板不一致时**不覆盖**（用户草稿是工作产物），仅提示；一致则无事发生
        if (nodesChanged || schemaChanged) {
          out.push({ id, status: 'updated', note: '存在与模板不一致的本地草稿，未覆盖（保留用户改动）' })
          continue
        }
        updatePipeline(doc, id, { name: def.name, description: def.description, tags: def.tags })
        out.push({ id, status: 'updated' })
        continue
      }
      // 最新为已发布版本（无草稿）：模板与已发布版本不一致才开新草稿；随后 published 时发布该草稿
      const effectiveNodes = nodesChanged ? nodesN : undefined
      const effectiveSchema = schemaChanged ? def.input_schema : undefined
      updatePipeline(doc, id, {
        name: def.name,
        description: def.description,
        tags: def.tags,
        nodes: effectiveNodes,
        inputSchema: effectiveSchema,
      })
      if (def.published) {
        const changed = !latestPub || (nodesN !== undefined && !sameNodes(latestPub.nodes, nodesN))
        if (changed) publishPipeline(doc, id, { version: findLatest(exist).version, changelog: def.changelog || 'imported' })
      }
      out.push({ id, status: 'updated' })
    } else {
      const r = createPipeline(doc, { name: def.name || id, description: def.description || '', kind: def.kind, tags: def.tags })
      if (!r.ok || !r.pipeline) return { ok: false, error: r.error || 'create failed: ' + id }
      r.pipeline.id = id
      if (nodesN !== undefined) {
        const latest = findLatest(r.pipeline)
        latest.nodes = nodesN
        if (def.input_schema) latest.inputSchema = def.input_schema
      }
      if (def.published) publishPipeline(doc, id, { version: findLatest(r.pipeline).version, changelog: def.changelog || 'imported' })
      out.push({ id, status: 'created' })
    }
  }
  return { ok: true, imported: out }
}

/* ── 解析：combined 引用子 pipeline（运行时校验） ── */

/** 解析 node type=pipeline 引用的目标（pipelineId + version），支持 '@latest' / 具体版本 */
export function resolveNodeRef(conf: Record<string, unknown>): { pipelineId: string; version: string } | null {
  const ref = conf.ref
  if (!ref || typeof ref !== 'string') return null
  const at = ref.lastIndexOf('@')
  if (at < 0) return { pipelineId: ref, version: 'latest' }
  return { pipelineId: ref.slice(0, at), version: ref.slice(at + 1) }
}
