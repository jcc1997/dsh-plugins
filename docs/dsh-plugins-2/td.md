# dsh-plugins-2 — TD 技术设计（Review Agent + pipeline 插件改造）

> 真源：本文件。前置：RD 已 rd-confirmed（见 docs/dsh-plugins-2/rd.md）。经 md_doc_open 人审通过（打 td-confirmed）后进 UC。

## 1. 技术背景

- 两个 Main Requirement（RD §2）：
  - 需求一 Review Agent：`workflow-template/pipelines.json`（评审 pipeline 定义）+ `workflow-template/prompts/review.md`（review prompt）+ workflow.json Testing 双门禁 + kanban gate 失败落评论。
  - 需求二 pipeline 插件改造：engine llm 节点 fail-closed、index.ts 接宿主 agents 服务、pipeline_import_config 新工具。
- 关键现状：
  - `engine.ts runLlmNode`：有 `ctx.runLlm` 注入点，未注入时返回 `{ output:'', note:'占位' }`（静默成功）——须改为 throw（fail-closed）。
  - `RunQueue` 构造于 `index.ts`：`new RunQueue(fs, { fs, shell, onRunUpdate })`——未传 runLlm。
  - 宿主服务：`ctx.get('agents')` 暴露 `AgentRegistry`：`create(CreateAgentOptions): Promise<AgentHandle>`；`AgentHandle = { agent, dispose() }`；驱动：`agent.followup(UserMessage)` + `agent.whenIdle(): Promise<void>`；读最终输出走 `agent.session`（dsh-session 事件/查询，见 §3）。
  - 门禁 pipeline 检查器（kanban gate.ts）：`svc.run(pipelineId, { card })` 同步等待；输出带 `error` 即门禁失败；`deps.getService('kanban')` 可调 kanban 服务（写评论用）。
  - pipeline 数据：`~/.dsh/pipeline/pipeline.json`（fs 持久化，重启不丢）。

## 2. 总体设计

```
move→Testing（kanban gate）
  ├─ 门禁1 tag-required review-1-done（既有，不变）
  └─ 门禁2 pipeline 检查器 { pipelines:["p-workflow-review"] }
       └─ pipeline 服务 run() → submitSync → executePipeline
            └─ llm 节点 → runLlm（index.ts 注入，接 agents 服务）
                 ├─ agents.create(子 agent, origin=subagent)
                 ├─ followup(review prompt) → whenIdle()
                 ├─ 收集最终 assistant 文本 → 解析 REVIEW_VERDICT
                 ├─ ok:false → result.error（issues 摘要）→ 节点失败 → pipeline failed
                 └─ 门禁失败 → kanban 写卡评论（失败时） + 拒绝原因带摘要
```

## 3. 宿主 agents 服务接线细节（需求二）

### 3.1 类型依据（@deepseek-ai/dsh-agent lib/types）

- `CreateAgentOptions`：`{ sessionId, meta?: { cwd?, parentSession?, seedLength?, origin?: 'subagent', delegationDepth?, agentPreset? }, seed?, agentOptions?: { provider?, model?, maxTokens? }, signal?, setup? }`。
- `AgentHandle`：`{ agent: Agent, dispose(): Promise<void> }`；`Agent`：`id, options, session, inbox, status, cancel(cause, opts?), whenIdle(): Promise<void>, runMaintenance(task), send(msg,target,wakeup), followup(msg), steer(msg), inject(msg)`。
- 无「直接取最后一条消息」的同步 API：最终输出从 `agent.session`（dsh-session）读取——实现用 `agent` 事件或 session query 服务（`ctx.get('sessionQuery')` / `ctx.get('sessionProjections')`）；最低成本方案：监听 `agent/turn-stopping` / `agent/status`（idle）后查询 session 最近 assistant 消息。
  - 具体读取：`ctx.get('sessionQuery')` 提供查询接口（dsh-session types 中 `sessionQuery` 服务存在）；若不可用，退路：用 `agent.session` 的 log 事件（`session/event`）在 whenIdle 前累积最后一条 `assistant` 消息。
  - 实现顺序：先接 `sessionQuery`，单测用 mock；宿主侧联调时按实际 d.ts 微调（RD §5 已列风险与缓解）。

### 3.2 评审会话连续性（按卡复用 agent session）

- 设计（RD §4.2.4）：llm 节点可配 `sessionKey`（engine 对 `config.sessionKey` 与 prompt 一样做占位符插值）；runLlm 接线按 sessionKey 决定会话策略：
  ```ts
  const liveAgents = new Map<string, AgentHandle>()   // sessionId -> handle（插件级，跨 run 常驻）
  // 每轮：
  //   1. liveAgents.get(sessionId) 存在 → followup 续评
  //   2. 否则 agents.resume({ resumeSessionId: sessionId }) 成功 → followup 续评（宿主重启后恢复）
  //   3. 否则 agents.create({ sessionId, meta:{ origin:'subagent' } }) → followup 首评
  // 收尾：ok:true → dispose + liveAgents.delete（闭环）；ok:false → 保留 handle（不 dispose，会话持久化）
  // 无 sessionKey → 每轮全新 agent，结束即 dispose（兼容通用 llm 节点）
  ```
- resume 前置：create 的 session 需已持久化（dsh-session 持久化是宿主默认行为；dispose 会删除 session，故失败轮次**不 dispose** 是续评的前提——与 RD 生命周期一致）。
- 读最终文本 `readLastAssistantText`：优先 `ctx.get('sessionQuery')`；不可用时监听 `agent/turn-stopping` 累积最后一条 assistant 消息（退路）。
- 本轮 followup 内容：由 pipeline prompt 表达「上一轮未解决问题应当已修复，验证修复并查新问题」；agent 会话历史自带上轮 findings。

### 3.3 review 精简预设（token 节省，workflow-template/agent-presets/review/agent.cordis.yml）

- **评审上下文（必须给足）**：① 仓库源码与文档——agent 在仓库工作目录（`meta.cwd` = 仓库路径，当前检出的 `workflow/<taskId>` 分支）用 fs/bash 直接读源码、docs/ui-design、review.md、AGENTS.md，并跑 `git diff origin/main...HEAD` 看 MR 变更；② 卡片信息——repo/branch/mr 关联 + 标题经 prompt 注入。这两样是评审对象本身，绝不裁剪。
- **裁掉的是无关能力（token 节省）**：skills 目录（`tool-skill`/skill-filesystem）、`tool-web`、`tool-subagent*`、`tool-workflow`、`tool-goal`、plan-mode、大段 persona/指令文档——这些与评审无关，挂上只会白白吃上下文。
- 组成（对照 workflow 预设裁剪）：
  - persona：一段话身份（代码评审 agent + verdict 要求），不引用 workflow 会话编排等大段内容；
  - 工具：`tool-fs`、`tool-fs-search`、`tool-bash`（跑 git diff）——**不注册** skill-filesystem/tool-skill、tool-web、tool-subagent*、tool-workflow、tool-goal、plan-mode 等；
  - 系统 prompt 段落：不挂 agent-instructions 大文档；评审规范由 agent 自行 fs 读仓库文件（review.md / docs/ui-design / AGENTS.md）。
- llm 节点 config `agentPreset: "review"`；宿主要求 preset 文件可被 agents.create 的 meta.agentPreset 解析（若不支持自定义 preset 解析，退路：runLlm 的 setup 回调里按 agentCtx 只注册 fs/bash 两个工具，等价效果）。

- 目的：review agent 只拿到评审所需上下文，不挂 skills/web/subagent/workflow 等无关能力（用户批注：token 节省）。
- 组成（对照 workflow 预设裁剪）：
  - persona：一段话身份（代码评审 agent + verdict 要求），不引用 workflow 会话编排等大段内容；
  - 工具：`tool-fs`、`tool-fs-search`、`tool-bash`（跑 git diff）——**不注册** skill-filesystem/tool-skill、tool-web、tool-subagent*、tool-workflow、tool-goal、plan-mode 等；
  - 系统 prompt 段落：不挂 agent-instructions 大文档；评审规范由 agent 自行 fs 读仓库文件（review.md / docs/ui-design / AGENTS.md）。
- llm 节点 config `agentPreset: "review"`；宿主要求 preset 文件可被 agents.create 的 meta.agentPreset 解析（若不支持自定义 preset 解析，退路：runLlm 的 setup 回调里按 agentCtx 只注册 fs/bash 两个工具，等价效果）。

### 3.4 runLlm 实现（index.ts 注入）

```ts
const agents = ctx.get('agents') as AgentRegistry | undefined
const runLlm = agents
  ? async (prompt: string, up: Record<string, unknown>, conf: Record<string, unknown>) => {
      const sessionId = safeId('a')
      const handle = await agents.create({
        sessionId,
        meta: { cwd: process.cwd(), origin: 'subagent', agentPreset: String(conf.agentPreset || 'review') },
        agentOptions: {
          ...(conf.provider ? { provider: String(conf.provider) } : {}),
          ...(conf.model ? { model: String(conf.model) } : {}),
          ...(typeof conf.maxTokens === 'number' ? { maxTokens: conf.maxTokens } : {}),
        },
      })
      const timeoutMs = typeof conf.timeoutMs === 'number' ? conf.timeoutMs : 600000
      const timer = setTimeout(() => handle.agent.cancel('timeout' as any), timeoutMs)
      try {
        handle.agent.followup({ role: 'user', content: prompt } as any)
        await handle.agent.whenIdle()
        const text = await readLastAssistantText(handle.agent)  // §3.1
        return text
      } finally {
        clearTimeout(timer)
        await handle.dispose().catch(() => {})
      }
    }
  : async () => { throw new Error('agent 服务未激活：llm 节点无法执行（fail-closed）') }
```

- verdict 解析放引擎（engine.ts runLlmNode），不放接线层——引擎单测可覆盖（mock runLlm 直接返回文本）。

### 3.3 引擎 llm 节点改造（engine.ts）

```ts
async function runLlmNode(node, ctx) {
  const prompt = typeof node.config.prompt === 'string' ? interpolate(node.config.prompt, ctx) : truncate(JSON.stringify(ctx.up))
  if (!ctx.runLlm) throw new Error('LLM 节点未接入 agent 服务（runLlm 未注入，fail-closed）')
  const text = await ctx.runLlm(prompt, ctx.up, node.config)
  // verdict 判定（fail-closed）：解析失败按不通过
  const verdict = parseVerdict(text)   // 正则 REVIEW_VERDICT:s*({.*}) 尾行
  if (verdict && verdict.ok === true) return { output: text, verdict }
  const issues = Array.isArray(verdict?.issues) ? verdict.issues : []
  const summary = issues.slice(0, 20).map(i => String(i.file || '') + (i.location ? ':' + i.location : '') + ' ' + String(i.message || '')).join('；') || 'verdict 解析失败：' + text.slice(-200)
  return { output: text, verdict, error: '评审未通过：' + summary }
}
```

- 注意：`executePipeline` 对节点结果 `result.error` 非空即 throw（isSoftError=false）→ 节点 failed → pipeline failed → 门禁拒绝。✓ 现有语义不用改。

## 4. pipeline_import_config（需求二，tools.ts + index.ts + store.ts）

### 4.1 工具定义

```ts
const importConfig = {
  name: 'pipeline_import_config',
  description: '导入 pipeline 定义（按 id 幂等 upsert）：{ pipelines: [{ id, name, kind, description, tags, nodes, input_schema?, published? }] }',
  parameters: { config: OBJ('pipeline 定义数组容器', true) },
  execute: async (args) => mutateDoc(fs, (doc) => {
    const arr = args?.config?.pipelines || []
    const out = []
    for (const def of arr) {
      const id = String(def.id || '').trim()
      if (!id) return null
      const exist = doc.pipelines.find(p => p.id === id)
      if (exist) {
        // 更新元信息 + 最新草稿版本节点（已发布版本不可变）
        if (def.name) exist.name = String(def.name)
        if (def.description !== undefined) exist.description = String(def.description)
        if (Array.isArray(def.tags)) exist.tags = def.tags.map(String)
        if (def.kind) exist.kind = def.kind === 'combined' ? 'combined' : 'atomic'
        const latest = exist.versions.find(v => v.version === exist.latestVersion)
        if (latest && !latest.published && Array.isArray(def.nodes)) latest.nodes = normalizeNodes(def.nodes)
        if (def.input_schema) latest && (latest.inputSchema = def.input_schema)
        if (def.published) publishVersion(exist, { changelog: def.changelog || 'imported' })
        out.push({ id, status: 'updated' })
      } else {
        const p = buildNewPipeline({ name: def.name || id, description: def.description, tags: def.tags, kind: def.kind })
        p.id = id
        const latest = p.versions[0]
        if (Array.isArray(def.nodes)) latest.nodes = normalizeNodes(def.nodes)
        if (def.input_schema) latest.inputSchema = def.input_schema
        if (def.published) publishVersion(p, { changelog: def.changelog || 'imported' })
        doc.pipelines.push(p)
        out.push({ id, status: 'created' })
      }
    }
    return { imported: out }
  }),
}
```

- 注册进 buildToolDefs；同时 `/pipeline-api/import` HTTP 路由复用同一逻辑。

### 4.2 幂等性验证点

- 同 config 连续导入两次：第二次全部 status=updated；节点内容与第一次一致；不产生多余版本（published 分支 publishVersion 幂等：重复 publish 相同版本号会 bump patch——注意：重复导入已 published 定义会生成 patch 新版本。**缓解**：publish 前检查目标版本已发布则跳过）。

## 5. Review Agent 落地（需求一）

### 5.1 workflow-template/pipelines.json

```json
{
  "pipelines": [
    {
      "id": "p-workflow-review",
      "name": "代码评审",
      "kind": "atomic",
      "description": "workflow 1st Review→Testing 门禁：agent 按 review prompt 评审 MR（代码逻辑 + 设计规范 + 文档纪律），REVIEW_VERDICT ok 才放行",
      "tags": ["workflow", "review"],
      "published": true,
      "nodes": [
        { "id": "in", "title": "输入", "type": "input", "order": 0, "inputs": [], "config": {} },
        { "id": "review", "title": "Agent 评审", "type": "llm", "order": 10, "inputs": ["in"], "config": {
            "prompt": "你是 DSH 仓库的代码评审 agent。入参 card 是待评审卡片（含 github-repo/github-branch/github-mr 关联）。先读取仓库 workflow-template/prompts/review.md 获取完整评审要求，再按流程评审 MR 分支 diff（对比 base main）；全部问题解决才可给出 OK。最终必须以一行 REVIEW_VERDICT:{"ok":true|false,"issues":[...]} 结尾，issues 为未解决问题数组（每项含 file/location/severity/message）。",
            "timeoutMs": 600000
        } },
        { "id": "out", "title": "输出", "type": "output", "order": 100, "inputs": ["review"], "config": {} }
      ]
    }
  ]
}
```

### 5.2 review prompt（workflow-template/prompts/review.md）

- 章节：角色与目标 / 评审对象（分支 diff + 文档）/ 代码逻辑维度 / 设计规范维度 / 文档纪律维度 / 输出格式（问题清单 + REVIEW_VERDICT 尾行）/ 判定纪律（≥medium 即不通过；疑似问题标注待确认）。
- 完整内容见交付文件（随本 MR）。

### 5.3 workflow.json Testing 双门禁

- 保留 tag-required；新增 pipeline 门禁（RD §4.2.3 的 JSON）；模板 gates 数组追加名称「Review pipeline 通过才能进 Testing」。

### 5.4 kanban gate 失败落评论（plugins/kanban/src/host/gate.ts）

- `nativeCheckers['pipeline']` 失败分支：`deps.getService('kanban')` → `addComment(card.id, '评审未通过：' + reason)`；若服务/方法不可用跳过（不影响门禁）。
- 去重：调 `kanban.getCard(card.id)` 取最后一条评论，相同内容跳过。
- presetProgram（code 沙箱路径）同步加：gate.call kanban addComment——注意沙箱内 gate.call 同步；保持 try/catch 不影响判定。
- 注意：`nativeCheckers['pipeline']` 与 `checkerRegistry['pipeline']` 目前**重复实现**（两处），本次只改 nativeCheckers（宿主路径）；codeRuntime 路径走 presetProgram 也需同步（预设模板更新）。

## 6. 测试计划

### 6.1 引擎单测（本会话，node 直跑 engine 逻辑）

- mock runLlm 三例：无 runLlm（throw→failed）、ok:false（failed + issues 摘要）、ok:true（success + verdict）。
- 用 store 的 defaultDoc + 临时 fs 构造 PipelineDoc，直接 executePipeline（deps 注入 mock runLlm / shell 不需要）。
- 验证 pipeline_import_config：导入 pipelines.json → findPipeline('p-workflow-review') 命中；重复导入幂等。

### 6.2 构建校验

- `node build.mjs`（pipeline/kanban 插件）→ `node scripts/verify-dist.mjs`。

### 6.3 宿主级（用户重启 dsh 后）

- 见 RD §6 需求一验收 5–7。

## 7. 兼容与迁移

- 同 RD §4.5；补充：llm 节点语义变化（占位成功→fail-closed）在 pipeline README 注明；pipeline_import_config 对已发布 pipeline 的覆盖仅限元信息+草稿节点，已发布版本不可变（与既有 publish 语义一致）。

## 8. 开放问题

- 无。