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

  /* ── llm 节点：接入宿主 agents 服务（评审 agent 执行）；未接入时引擎侧 fail-closed ── */
  const agents = ctx.get('agents') as any
  const liveAgents = new Map<string, any>()   // 评审会话常驻表：sessionId -> AgentHandle（失败轮次保留供续评）
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
  const readLastAssistantText = (agent: any): string => {
    try {
      const msgs = agent && agent.session && typeof agent.session.deriveMessages === 'function' ? agent.session.deriveMessages() : []
      for (let i = msgs.length - 1; i >= 0; i--) {
        const m = msgs[i]
        if (m && m.role === 'assistant') {
          const t = blockText(m.content)
          if (t.trim()) return t
        }
      }
      return ''
    } catch { return '' }
  }
  const parseVerdict = (text: string): { ok: boolean; issues?: unknown[] } | null => {
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
  const cwd = typeof process !== 'undefined' && process.cwd ? process.cwd() : undefined
  const runLlm: ((prompt: string, up: Record<string, unknown>, conf: Record<string, unknown>) => Promise<string>) | undefined =
    agents && typeof agents.create === 'function'
      ? async (prompt, up, conf) => {
          const sessionKey = typeof conf.sessionKey === 'string' && conf.sessionKey.trim() ? conf.sessionKey.trim() : ''
          const sessionId = sessionKey || safeId('a')
          const timeoutMs = typeof conf.timeoutMs === 'number' ? conf.timeoutMs : 600000
          const agentOptions: Record<string, unknown> = {}
          if (typeof conf.provider === 'string' && conf.provider) agentOptions.provider = conf.provider
          if (typeof conf.model === 'string' && conf.model) agentOptions.model = conf.model
          if (typeof conf.maxTokens === 'number') agentOptions.maxTokens = conf.maxTokens
          let handle: any = sessionKey ? liveAgents.get(sessionId) : null
          try {
            // 续评：恢复上一轮持久化 session（宿主重启后仍有效）
            if (!handle && sessionKey && typeof agents.resume === 'function') {
              try { handle = await agents.resume({ resumeSessionId: sessionId, agentOptions }) } catch { handle = null }
            }
            if (!handle) {
              handle = await agents.create({
                sessionId,
                meta: { ...(cwd ? { cwd } : {}), origin: 'subagent', agentPreset: typeof conf.agentPreset === 'string' && conf.agentPreset ? conf.agentPreset : 'review' },
                agentOptions,
              })
            }
            if (sessionKey) liveAgents.set(sessionId, handle)
            const agent = handle && handle.agent
            if (!agent) throw new Error('agent 创建失败')
            const timer = setTimeout(() => { try { agent.cancel('timeout') } catch { /* ignore */ } }, timeoutMs)
            try {
              // Message 契约：id + role + content 块数组 + source（缺一即被 inbox 拒收，agent 不启动）
              agent.followup({
                id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
                role: 'user',
                content: [{ type: 'text', text: prompt }],
                source: { kind: 'plugin', plugin: 'pipeline' },
              })
              await agent.whenIdle()
              const text = readLastAssistantText(agent)
              // 通过（ok:true）→ 闭环释放；失败/解析失败 → 保留 handle 供下一轮续评
              const verdict = parseVerdict(text)
              if (verdict && verdict.ok === true && sessionKey) {
                liveAgents.delete(sessionId)
                try { await handle.dispose() } catch { /* ignore */ }
              }
              return text
            } finally {
              clearTimeout(timer)
            }
          } catch (e) {
            if (sessionKey) liveAgents.delete(sessionId)
            try { if (handle) await handle.dispose() } catch { /* ignore */ }
            throw e
          }
        }
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
    /** 同步运行（阻塞等待结果）；供其他 plugin 编排调用 */
    run: async (pipelineId: string, inputs: Record<string, unknown>, version?: string) => {
      return queue.submitSync(String(pipelineId), version || 'latest', inputs || {}, 'plugin')
    },
    /** 异步运行（入队），返回 runId */
    runAsync: async (pipelineId: string, inputs: Record<string, unknown>, version?: string) => {
      const { runId, run } = await queue.submit(String(pipelineId), version || 'latest', inputs || {}, 'plugin')
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
