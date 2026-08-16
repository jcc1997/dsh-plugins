// pipeline 插件宿主半（正式 bundle 形态）：RPC 路由 + pipeline 跨插件服务 + agent 工具
// 数据层在 host/store.ts（fs 持久化），执行引擎在 host/engine.ts（DAG + 队列），
// agent 工具在 host/tools.ts（11 个）。
// 接入点（正式形态）：ctx.webServer.register 暴露 /pipeline-api/*（client UI 数据通道）；
//       ctx.tools.register(defineTool(...)) 注册 agent 工具；ctx.provide('pipeline') 跨插件服务。
// llm 节点已接入宿主 agents 服务（runLlm 注入）；未接入时 fail-closed（节点失败而非占位成功）。
import { defineTool } from '@deepseek-ai/dsh-tools'
import {
  FsLike, readDoc, writeDoc, mutateDoc, findPipeline, findVersion, listCatalog,
  createPipeline, updatePipeline, publishPipeline, deletePipeline, deletePipelineVersion, enqueueRun, importPipelines,
} from './host/store'
import { Pipeline, PipelineNode, PipelineRun, now, safeId, defaultPipeline } from './host/models'
import { RunQueue, ShellLike, executePipeline } from './host/engine'
import { buildToolDefs } from './host/tools'

interface PipelineCtx {
  get(name: string): unknown
  provide(name: string, value: unknown): unknown
  effect(cb: () => unknown): unknown
}

type WebRouteRegistrar = { register(r: { kind: 'exact' | 'prefix'; path: string; handler: (req: any, res: any) => void | Promise<void> }): () => void }

export const inject = ['fs', 'webServer', 'tools']

export function apply(ctx: PipelineCtx) {
  const fs = ctx.get('fs') as FsLike
  if (!fs) return
  const webServer = ctx.get('webServer') as WebRouteRegistrar | undefined
  const tools = ctx.get('tools') as { register(def: unknown): () => void } | undefined
  const shell = ctx.get('shell') as ShellLike | undefined

  /* ── llm 节点：接入宿主 subagents 服务（评审 agent 执行）；未接入时引擎侧 fail-closed ── */
  const subagents = ctx.get('subagents') as any
  const agents = ctx.get('agents') as any
  /** 从消息 content（块数组或字符串）提取纯文本 */
  const blockText = (content: unknown): string => {
    if (typeof content === 'string') return content
    if (Array.isArray(content)) {
      return content
        .filter((b: any) => b && b.type === 'text' && typeof b.text === 'string')
        .map((b: any) => b.text)
        .join('\n')
    }
    return ''
  }

  /** 评审对象摘要：按 kind 解析 refs（refs 为追加顺序，不能取 0 位） */
  const enrichReviewTarget = (up: Record<string, unknown>): string => {
    try {
      const inputOut: any = (up as any).in || up
      const card = inputOut && inputOut.card
      const refs = card && Array.isArray(card.refs) ? card.refs : []
      const byKind = (kind: string) => refs.find((r: any) => r && r.kind === kind && r.externalId)
      const repo = byKind('github-repo')
      const branch = byKind('github-branch')
      const mr = byKind('github-mr')
      const local = byKind('local-repo')
      const parts: string[] = []
      if (local) parts.push('local-repo=' + String(local.externalId))
      if (repo) parts.push('repo=' + String(repo.externalId))
      if (branch) parts.push('branch=' + String(branch.externalId))
      if (mr) parts.push('mr=#' + String(mr.externalId))
      return parts.length ? '【评审对象】' + parts.join(' ') + '\n' : ''
    } catch { return '' }
  }

  /** 读取卡片上一条「评审未通过」评论（续评上下文：让本轮评审核验上轮 findings 是否已修复） */
  const lastReviewComment = async (cardId: string): Promise<string> => {
    try {
      const kanban = ctx.get('kanban') as any
      if (!kanban || typeof kanban.getCard !== 'function') return ''
      const card = await kanban.getCard(cardId)
      const comments = card && Array.isArray(card.comments) ? card.comments : []
      for (let i = comments.length - 1; i >= 0; i--) {
        const text = comments[i] && comments[i].text ? String(comments[i].text) : ''
        if (text.includes('评审未通过')) return text.slice(0, 3000)
      }
      return ''
    } catch { return '' }
  }

  const runLlm: ((prompt: string, up: Record<string, unknown>, conf: Record<string, unknown>) => Promise<string>) | undefined =
    subagents && typeof subagents.start === 'function'
      ? async (prompt, up, conf) => {
          const parent = conf.parentAgent
          if (!parent) throw new Error('缺少调用方 agent 上下文（parentAgent 未注入）')
          const timeoutMs = typeof conf.timeoutMs === 'number' ? conf.timeoutMs : 600000
          const agentOptions: Record<string, unknown> = {}
          if (typeof conf.provider === 'string' && conf.provider) agentOptions.provider = conf.provider
          if (typeof conf.model === 'string' && conf.model) agentOptions.model = conf.model
          if (typeof conf.maxTokens === 'number') agentOptions.maxTokens = conf.maxTokens
          const reviewPersona = typeof conf.persona === 'string' && conf.persona.trim()
            ? conf.persona
            : '你是代码评审 agent。只评审、不改码、不提交。严格按收到的评审指令与仓库内 workflow-template/prompts/review.md 执行，最终输出以最后一行 REVIEW_VERDICT:{"ok":true|false,"issues":[...]} 结尾。'
          // 评审对象摘要（refs 按 kind 解析）+ 续评注入（上轮评审意见）
          const target = enrichReviewTarget(up)
          let fullPrompt = target ? target + prompt : prompt
          if (conf.cardId) {
            const prev = await lastReviewComment(String(conf.cardId))
            if (prev) fullPrompt = '【上一轮评审意见（请逐条核验是否已修复；未修复的继续列为未解决问题，已修复的不再列入）】\n' + prev + '\n\n【本轮评审任务】\n' + prompt
          }
          // 精简工具集（token 节省）：仅读文件 + grep/glob + bash（git diff）；不暴露写工具与无关能力
          const toolFilter = Array.isArray(conf.toolFilter) && conf.toolFilter.length
            ? { allow: conf.toolFilter.map(String) }
            : { allow: ['read', 'glob', 'grep', 'bash'] }
          const run = await subagents.start('spawn', {
            label: 'review' + (conf.cardId ? '-' + conf.cardId : ''),
            prompt: [{ type: 'text', text: fullPrompt }],
            parent,
            signal: (conf.externalSignal as AbortSignal | undefined) || new AbortController().signal,
            ...(Object.keys(agentOptions).length ? { agentOptions } : {}),
            persona: reviewPersona,
            toolFilter,
          })
          let timer: ReturnType<typeof setTimeout> | null = null
          try {
            const result: any = await Promise.race([
              run.result,
              new Promise((_resolve, reject) => {
                timer = setTimeout(() => {
                  try { run.dispose() } catch { /* ignore */ }
                  reject(new Error('评审 agent 超时（' + timeoutMs + 'ms）'))
                }, timeoutMs)
              }),
            ])
            if (result && result.stopReason !== 'completed') {
              throw new Error('评审 agent 未正常完成：' + String(result && result.stopReason) + '（output=' + blockText(result && result.output)?.slice(0, 200) + '）')
            }
            return blockText(result && result.output)
          } finally {
            if (timer) clearTimeout(timer)
            try { await run.dispose() } catch { /* ignore */ }
          }
        }
      : agents && typeof agents.create === 'function'
        ? async () => { throw new Error('subagents 服务不可用（llm 节点需要 ctx.subagents；agents 兜底路径未实现）') }
        : undefined

  /* ── 运行引擎（队列 + 注册表） ── */
  const queue = new RunQueue(fs, {
    fs,
    shell,
    onRunUpdate: async () => { /* 执行器内部自行落盘 */ },
    ...(runLlm ? { runLlm } : {}),
  })

  /* ── HTTP 路由：client UI 数据通道（POST /pipeline-api/*，body JSON） ── */
  function route(path: string, handler: (args: any) => Promise<any>) {
    if (webServer && typeof webServer.register === 'function') {
      ctx.effect(() => webServer.register({
        kind: 'exact',
        path,
        handler: async (req: any, res: any) => {
          try {
            let body = ''
            for await (const chunk of req) body += chunk
            const args = body ? JSON.parse(body) : {}
            const result = await handler(args)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(result))
          } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: false, error: String(e && (e as Error).message ? (e as Error).message : e) }))
          }
        },
      }))
    }
  }

  // 加载全部（pipelines + runs + queue + catalog）
  route('/pipeline-api/load', async () => {
    const doc = await readDoc(fs)
    return { doc, catalog: listCatalog(doc) }
  })
  // 新建
  route('/pipeline-api/create', async (args: any) => {
    return mutateDoc(fs, (doc) => {
      const r = createPipeline(doc, args || {})
      if (!r.ok) return r
      return { ok: true, pipeline: r.pipeline }
    })
  })
  // 更新（meta + 最新草稿节点）
  route('/pipeline-api/update', async (args: any) => {
    return mutateDoc(fs, (doc) => {
      const r = updatePipeline(doc, String(args.pipeline_id), args || {})
      if (!r.ok) return r
      return { ok: true, pipeline: r.pipeline }
    })
  })
  // 发布版本
  route('/pipeline-api/publish', async (args: any) => {
    return mutateDoc(fs, (doc) => {
      const r = publishPipeline(doc, String(args.pipeline_id), args || {})
      if (!r.ok) return r
      return { ok: true, pipeline: r.pipeline, version: r.version }
    })
  })
  // 删除
  route('/pipeline-api/delete', async (args: any) => {
    return mutateDoc(fs, (doc) => {
      const r = deletePipeline(doc, String(args.pipeline_id))
      return r
    })
  })
  // 删除未发布旧版本（已发布拒绝）
  route('/pipeline-api/delete-version', async (args: any) => {
    return mutateDoc(fs, (doc) => {
      const r = deletePipelineVersion(doc, String(args.pipeline_id), String(args.version))
      if (!r.ok) return r
      return { ok: true, deleted_version: args.version, latest_version: (r.pipeline as any).latestVersion }
    })
  })
  // 运行（异步入队）
  route('/pipeline-api/run', async (args: any) => {
    const { runId, run } = await queue.submit(String(args.pipeline_id), args.version || 'latest', args.inputs || {}, 'ui')
    return { ok: true, run_id: runId, status: run.status }
  })

  // 导入（模板分发：按稳定 id 幂等 upsert）
  route('/pipeline-api/import', async (args: any) => {
    const defs = (args && args.config && Array.isArray(args.config.pipelines)) ? args.config.pipelines : []
    if (defs.length === 0) return { ok: false, error: 'config.pipelines 为空' }
    return mutateDoc(fs, (doc) => {
      const r = importPipelines(doc, defs)
      if (!r.ok) return r
      return { ok: true, imported: r.imported }
    })
  })
  // dock 常驻条数据:全部运行倒序(运行中置顶)+ pipeline 名称映射
  route('/pipeline-api/dock-runs', async () => {
    const doc = await readDoc(fs)
    const nameOf = new Map(doc.pipelines.map((p) => [p.id, p.name]))
    const active = new Set(['queued', 'running'])
    const runs = doc.runs.map((r) => ({
      id: r.id, pipelineId: r.pipelineId, pipelineName: nameOf.get(r.pipelineId) || r.pipelineId,
      status: r.status, version: r.version, createdAt: r.createdAt, startedAt: r.startedAt, finishedAt: r.finishedAt,
      error: r.error || '', output: r.output || null,
      done: r.nodes.filter((n) => n.status === 'success' || n.status === 'failed' || n.status === 'skipped').length,
      total: r.nodes.length,
    }))
      .sort((a, b) => {
        const aa = active.has(a.status) ? 1 : 0
        const bb = active.has(b.status) ? 1 : 0
        if (aa !== bb) return bb - aa
        return String(b.createdAt).localeCompare(String(a.createdAt))
      })
      .slice(0, 20)
    return { ok: true, runs }
  })
  // 运行详情
  route('/pipeline-api/run-status', async (args: any) => {
    const doc = await readDoc(fs)
    const run = doc.runs.find((r) => r.id === String(args.run_id))
    return { ok: true, run: run || null }
  })
  // 单 pipeline 详情
  route('/pipeline-api/get', async (args: any) => {
    const doc = await readDoc(fs)
    const p = findPipeline(doc, String(args.pipeline_id))
    return { ok: !!p, pipeline: p || null }
  })

  /* ── 跨插件服务：其他 plugin 经 ctx.get('pipeline') 调用 ── */
  const pipelineService = {
    list: async () => {
      const doc = await readDoc(fs)
      return doc.pipelines.map((p) => ({
        id: p.id, name: p.name, kind: p.kind, description: p.description,
        latestVersion: p.latestVersion, publishedVersion: p.publishedVersion, tags: p.tags,
      }))
    },
    get: async (pipelineId: string) => {
      const doc = await readDoc(fs)
      return findPipeline(doc, String(pipelineId))
    },
    getPublished: async (pipelineId: string, version?: string) => {
      const doc = await readDoc(fs)
      const p = findPipeline(doc, String(pipelineId))
      if (!p) return null
      const v = version || p.publishedVersion || p.latestVersion
      return p.versions.find((x) => x.version === v) || null
    },
    /** 同步运行（阻塞等待结果）；供其他 plugin 编排调用；opts 透传调用方 agent/signal（llm 节点用）；评审失败自动落卡评论 */
    run: async (pipelineId: string, inputs: Record<string, unknown>, version?: string, opts?: { parentAgent?: unknown; externalSignal?: AbortSignal | undefined }) => {
      const result = await queue.submitSync(String(pipelineId), version || 'latest', inputs || {}, 'plugin', opts)
      try {
        // 仅评审类失败落卡（error 含「评审未通过」，其自身已带前缀，不再重复拼接）；其他 pipeline 失败不写评语
        const card = inputs && (inputs as any).card
        const err = result && result.error ? String(result.error) : ''
        if (err.includes('评审未通过') && card && typeof card.id === 'string') {
          const kanban = ctx.get('kanban') as any
          if (kanban && typeof kanban.addComment === 'function') {
            await kanban.addComment(String(card.id), err.slice(0, 2000))
          }
        }
      } catch { /* 评论失败不影响运行结果 */ }
      return result
    },
    /** 异步运行（入队），返回 runId */
    runAsync: async (pipelineId: string, inputs: Record<string, unknown>, version?: string, opts?: { parentAgent?: unknown; externalSignal?: AbortSignal | undefined }) => {
      const { runId, run } = await queue.submit(String(pipelineId), version || 'latest', inputs || {}, 'plugin', opts)
      return { runId, status: run.status }
    },
    status: async (runId: string) => {
      const doc = await readDoc(fs)
      return doc.runs.find((r) => r.id === String(runId)) || null
    },
    catalog: async () => {
      const doc = await readDoc(fs)
      return listCatalog(doc)
    },
  }
  ctx.provide('pipeline', pipelineService)

  /* ── agent 工具注册 ── */
  if (tools && typeof tools.register === 'function') {
    const defs = buildToolDefs({ fs, queue })
    for (const d of defs) {
      // dsh-tools 的 defineTool 需要 parameters 为直接属性映射（已如此构建）
      ctx.effect(() => tools.register(defineTool(d)))
    }
  } else {
    throw new Error('tools service unavailable（正式形态需 @deepseek-ai/dsh-tools）')
  }
}
