// host/tools.ts — agent 工具定义（defineTool 消费）。
// 面向 agent 的 11 个工具：查/建/改/删/发布/运行/进度/队列/目录。
// 工具 execute 阶段接收 { fs, store 访问器, engine } 注入（避免直接依赖 ctx）。

import { FsLike, readDoc, writeDoc, mutateDoc, findPipeline, findVersion, listCatalog } from './store'
import { Pipeline, PipelineNode, PipelineRun } from './models'
import { RunQueue } from './engine'

export interface ToolEnv {
  fs: FsLike
  queue: RunQueue
}

/** 参数 schema 简写（对齐 kanban：直接属性映射，required 属性级） */
export const STR = (description: string, required = false) => ({ type: 'string' as const, description, ...(required ? { required: true as const } : {}) })
export const BOOL = (description: string, required = false) => ({ type: 'boolean' as const, description, ...(required ? { required: true as const } : {}) })
export const NUM = (description: string, required = false) => ({ type: 'number' as const, description, ...(required ? { required: true as const } : {}) })
export const OBJ = (description: string, required = false) => ({ type: 'json' as const, description, ...(required ? { required: true as const } : {}) })
export const STRS = (description: string) => ({ type: 'array' as const, items: { type: 'string' as const }, description })

export function outputOf(description: string) {
  return {
    schema: { type: 'json' as const },
    render: (_args: unknown, value: unknown) => [{ type: 'text' as const, text: description + '\n' + JSON.stringify(value, null, 2) }],
  }
}

export function buildToolDefs(env: ToolEnv): any[] {
  const { fs, queue } = env

  /** 列出所有 pipeline 概要 */
  const list = {
    name: 'pipeline_list',
    description: '列出所有 pipeline（含最新版本、已发布版本、类型 atomic/combined、节点数）。用于了解当前可用的流水线。',
    parameters: {},
    execute: async (_args: any) => {
      const doc = await readDoc(fs)
      return {
        ok: true,
        total: doc.pipelines.length,
        pipelines: doc.pipelines.map((p) => summarizePipeline(p)),
      }
    },
    output: outputOf('pipeline 列表'),
  }

  const get = {
    name: 'pipeline_get',
    description: '获取单个 pipeline 详情：全部版本（npm 风格 semver）、每个版本的节点图、已发布/最新版本、入参 schema。',
    parameters: {
      pipeline_id: STR('pipeline id（来自 pipeline_list）', true),
      version: STR('可选版本号；缺省返回最新版本详情'),
    },
    execute: async (args: any) => {
      const doc = await readDoc(fs)
      const p = findPipeline(doc, String(args.pipeline_id))
      if (!p) return { ok: false, error: 'pipeline not found: ' + args.pipeline_id }
      const ver = args.version ? findVersion(p, String(args.version)) : null
      return {
        ok: true,
        pipeline: {
          ...summarizePipeline(p),
          versions: p.versions.map((v) => ({
            version: v.version, published: v.published, publishedAt: v.publishedAt,
            nodeCount: v.nodes.length, changelog: v.changelog, createdAt: v.createdAt,
            nodes: v.nodes.map((n) => ({ id: n.id, title: n.title, type: n.type, order: n.order, inputs: n.inputs, config: v.version === p.latestVersion ? n.config : undefined })),
            inputSchema: v.inputSchema,
          })),
          ...(ver ? { requestedVersion: detailedVersion(p, ver.version) } : {}),
        },
      }
    },
    output: outputOf('pipeline 详情'),
  }

  const create = {
    name: 'pipeline_create',
    description: '新建 pipeline。kind=atomic 表示无依赖的基础单元（如转 mp3、转文字）；kind=combined 表示组合流水线（如 bilibili 视频总结，引用多个 atomic）。默认创建 v0.1.0 草稿版本。',
    parameters: {
      name: STR('pipeline 名称（必填，唯一）', true),
      kind: STR('类型：atomic 或 combined（缺省 atomic）'),
      description: STR('一句话描述'),
      tags: STRS('初始标签列表'),
    },
    execute: async (args: any) => {
      const result = await mutateDoc(fs, (doc) => {
        // 同名检查
        if (doc.pipelines.some((p) => p.name === String(args.name).trim())) return { ok: false, error: 'duplicate name: ' + args.name }
        const p = buildNewPipeline(args)
        doc.pipelines.push(p)
        return { pipeline_id: p.id, latest_version: p.latestVersion }
      })
      return result
    },
    output: outputOf('创建结果'),
  }

  const update = {
    name: 'pipeline_update',
    description: '更新 pipeline 的名称/描述/标签，或更新「最新草稿版本」的节点图与入参 schema（不改变已发布版本；配置变化会生成新的发布）。',
    parameters: {
      pipeline_id: STR('pipeline id', true),
      name: STR('新名称（可选）'),
      description: STR('新描述（可选）'),
      tags: STRS('标签（可选，覆盖）'),
      nodes: OBJ('节点数组（可选）：[{ id, title, type, order, inputs, config }]；替换最新草稿版本节点'),
      input_schema: OBJ('入参 JSON Schema 片段（可选）'),
    },
    execute: async (args: any) => {
      return mutateDoc(fs, (doc) => {
        const p = findPipeline(doc, String(args.pipeline_id))
        if (!p) return { ok: false, error: 'pipeline not found: ' + args.pipeline_id }
        return applyUpdate(p, args)
      })
    },
    output: outputOf('更新结果'),
  }

  const publish = {
    name: 'pipeline_publish_version',
    description: '发布新版本（npm 风格 semver）。缺省基于当前版本 patch+1 生成草稿并发布；可指定 release=major/minor/patch 或 version=<具体版本>。发布后版本不可变，可作为子 pipeline 被 combined 引用。',
    parameters: {
      pipeline_id: STR('pipeline id', true),
      release: STR('版本升位：major / minor / patch（缺省 patch）'),
      version: STR('指定具体版本号（v 下划线不用，如 1.2.0），覆盖 release'),
      changelog: STR('该版本变更说明'),
    },
    execute: async (args: any) => {
      return mutateDoc(fs, (doc) => {
        const p = findPipeline(doc, String(args.pipeline_id))
        if (!p) return { ok: false, error: 'pipeline not found: ' + args.pipeline_id }
        return publishVersion(p, args)
      })
    },
    output: outputOf('发布结果'),
  }

  const del = {
    name: 'pipeline_delete',
    description: '删除一个 pipeline（不可恢复）。其历史运行记录保留。',
    parameters: { pipeline_id: STR('pipeline id', true) },
    execute: async (args: any) => {
      return mutateDoc(fs, (doc) => {
        const i = doc.pipelines.findIndex((p) => p.id === String(args.pipeline_id))
        if (i < 0) return { ok: false, error: 'pipeline not found: ' + args.pipeline_id }
        doc.pipelines.splice(i, 1)
        return { deleted: true }
      })
    },
    output: outputOf('删除结果'),
  }

  const run = {
    name: 'pipeline_run',
    description: '运行一条 pipeline（异步入队）。可指定版本（缺省用已发布版本，无则最新）。返回 run id，可用 pipeline_run_status 查进度。',
    parameters: {
      pipeline_id: STR('pipeline id', true),
      version: STR('版本号，缺省 publishedVersion 或 latest'),
      inputs: OBJ('入参对象（JSON）；input 节点的 keys 会从其中抽取', true),
    },
    execute: async (args: any) => {
      const { runId, run } = await queue.submit(String(args.pipeline_id), args.version || 'latest', args.inputs || {}, 'agent')
      return { ok: true, run_id: runId, status: run.status, queued: true }
    },
    output: outputOf('运行提交结果'),
  }

  const status = {
    name: 'pipeline_run_status',
    description: '查询一次运行的进度：整体状态、每个节点的状态（pending/running/success/failed）、输出、错误。用于监控正在运行的 pipeline。',
    parameters: { run_id: STR('run id（来自 pipeline_run）', true) },
    execute: async (args: any) => {
      const doc = await readDoc(fs)
      const run = doc.runs.find((r) => r.id === String(args.run_id))
      if (!run) return { ok: false, error: 'run not found: ' + args.run_id }
      return { ok: true, run: summarizeRun(run) }
    },
    output: outputOf('运行状态'),
  }

  const runs = {
    name: 'pipeline_runs',
    description: '列出运行（默认最近 20 条）：含排队中 / 进行中 / 历史。可了解当前队列与执行情况。',
    parameters: {
      pipeline_id: STR('按 pipeline 过滤（可选）'),
      limit: NUM('返回条数，默认 20，最大 100'),
    },
    execute: async (args: any) => {
      const doc = await readDoc(fs)
      const limit = Math.min(Math.max(parseInt(args.limit, 10) || 20, 1), 100)
      let runs = [...doc.runs].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
      if (args.pipeline_id) runs = runs.filter((r) => r.pipelineId === String(args.pipeline_id))
      return {
        ok: true,
        queue: doc.queue,
        total: runs.length,
        runs: runs.slice(0, limit).map((r) => summarizeRun(r)),
      }
    },
    output: outputOf('运行列表'),
  }

  const catalog = {
    name: 'pipeline_catalog',
    description: '列出可复用的已发布单元（catalog）：所有已发布的 pipeline 版本。combined pipeline 可用这些版本作为子节点引用。',
    parameters: {},
    execute: async (_args: any) => {
      const doc = await readDoc(fs)
      return { ok: true, total: 0, catalog: listCatalog(doc), total2: undefined }
    },
    output: outputOf('可复用单元目录'),
  }

  return [list, get, create, update, publish, del, run, status, runs, catalog]
}

/* ── 内部辅助（供 tools 与 index 共用） ── */

function summarizePipeline(p: Pipeline): any {
  return {
    id: p.id, name: p.name, description: p.description, kind: p.kind, tags: p.tags,
    latest_version: p.latestVersion, published_version: p.publishedVersion,
    version_count: p.versions.length,
    node_count: (p.versions.find((v) => v.version === p.latestVersion)?.nodes || []).length,
    createdAt: p.createdAt, updatedAt: p.updatedAt,
  }
}

function detailedVersion(p: Pipeline, version: string): any {
  const v = p.versions.find((x) => x.version === version)
  if (!v) return null
  return { version: v.version, published: v.published, nodes: v.nodes, inputSchema: v.inputSchema, changelog: v.changelog }
}

function buildNewPipeline(args: any): Pipeline {
  const name = String(args.name).trim()
  const kind = args.kind === 'combined' ? 'combined' : 'atomic'
  const ts = new Date().toISOString()
  const input = { id: 'in', title: '输入', type: 'input' as const, order: 0, inputs: [], config: {} }
  const output = { id: 'out', title: '输出', type: 'output' as const, order: 100, inputs: ['in'], config: {} }
  return {
    id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    name, description: args.description || '', kind,
    tags: Array.isArray(args.tags) ? args.tags.map((t: any) => String(t)) : [],
    versions: [{ version: '0.1.0', nodes: [input, output], inputSchema: { type: 'object', properties: {}, additionalProperties: true }, changelog: '初始版本', published: false, createdAt: ts }],
    latestVersion: '0.1.0', publishedVersion: null, createdAt: ts, updatedAt: ts,
  }
}

const SEMVER = /^(0|[1-9]d*).(0|[1-9]d*).(0|[1-9]d*)$/
function isValid(v: string): boolean { return SEMVER.test(v) }
function parse(v: string): { m: number; n: number; p: number } { const m = SEMVER.exec(v)!; return { m: +m[1], n: +m[2], p: +m[3] } }
function bump(cur: string, rel: string): string {
  const c = parse(cur)
  if (rel === 'major') return (c.m + 1) + '.0.0'
  if (rel === 'minor') return c.m + '.' + (c.n + 1) + '.0'
  return c.m + '.' + c.n + '.' + (c.p + 1)
}

function applyUpdate(p: Pipeline, args: any): any {
  let changed = false
  if (args.name !== undefined && String(args.name).trim() !== '' && p.name !== String(args.name).trim()) { p.name = String(args.name).trim(); changed = true }
  if (args.description !== undefined && p.description !== String(args.description)) { p.description = String(args.description); changed = true }
  if (args.tags !== undefined) { p.tags = args.tags.map((t: any) => String(t)); changed = true }
  const latest = p.versions.find((v) => v.version === p.latestVersion)!
  if (args.nodes !== undefined || args.input_schema !== undefined) {
    if (latest.published) {
      const v = bump(p.latestVersion, 'patch')
      p.versions.push({ version: v, nodes: args.nodes !== undefined ? normalizeNodes(args.nodes) : latest.nodes, inputSchema: args.input_schema !== undefined ? args.input_schema : latest.inputSchema, changelog: '', published: false, createdAt: new Date().toISOString() })
      p.latestVersion = v
    } else {
      if (args.nodes !== undefined) latest.nodes = normalizeNodes(args.nodes)
      if (args.input_schema !== undefined) latest.inputSchema = args.input_schema
    }
    changed = true
  }
  if (changed) p.updatedAt = new Date().toISOString()
  return { ok: true, pipeline_id: p.id, latest_version: p.latestVersion, changed }
}

function normalizeNodes(nodes: any): PipelineNode[] {
  const arr = Array.isArray(nodes) ? nodes : []
  return arr.map((n: any, i: number) => ({
    id: n.id && typeof n.id === 'string' ? n.id : 'n' + i,
    title: n.title || ('节点 ' + (i + 1)),
    type: n.type || 'transform',
    order: typeof n.order === 'number' ? n.order : i,
    inputs: Array.isArray(n.inputs) ? n.inputs.map(String) : [],
    config: n.config && typeof n.config === 'object' ? n.config : {},
  }))
}

function publishVersion(p: Pipeline, args: any): any {
  const ts = new Date().toISOString()
  let target: any = null
  if (args.version) {
    const v = String(args.version).trim()
    target = p.versions.find((x) => x.version === v)
    if (!target) return { ok: false, error: 'version not found: ' + v }
  } else {
    const base = p.publishedVersion || p.latestVersion
    const v = bump(base, args.release || 'patch')
    const latest = p.versions.find((x) => x.version === p.latestVersion)!
    target = { version: v, nodes: latest.nodes, inputSchema: latest.inputSchema, changelog: args.changelog || '', published: false, createdAt: ts }
    p.versions.push(target)
    p.latestVersion = v
  }
  target.published = true
  target.publishedAt = ts
  if (args.changelog) target.changelog = args.changelog
  // 重排序
  p.versions.sort((a: any, b: any) => { const x = parse(a.version), y = parse(b.version); return (y.m - x.m) || (y.n - x.n) || (y.p - x.p) })
  p.latestVersion = p.versions[0].version
  const pubs = p.versions.filter((v: any) => v.published)
  p.publishedVersion = pubs.length ? pubs[0].version : null
  p.updatedAt = ts
  return { ok: true, pipeline_id: p.id, published_version: p.publishedVersion }
}

function summarizeRun(r: PipelineRun): any {
  return {
    id: r.id, pipeline_id: r.pipelineId, version: r.version, status: r.status,
    inputs: r.inputs, output: r.output, error: r.error,
    nodes: r.nodes, source: r.source,
    createdAt: r.createdAt, startedAt: r.startedAt, finishedAt: r.finishedAt,
  }
}
