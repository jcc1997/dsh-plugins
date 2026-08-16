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

## 3. 宿主 subagents 服务接线（需求二）

### 3.1 类型依据（@deepseek-ai/dsh-subagent lib/types）

- `ctx.subagents.start(name, request: SubagentStartRequest)` → `Promise<SubagentRun>`：
  - request：`{ label?, prompt: ContentBlock[], parent: Agent（必填）, signal: AbortSignal（必填）, agentOptions?, outputSchema?, maxDepth?, toolFilter?: { allow?: string[], deny?: string[] }, persona?: string }`；
  - SubagentRun：`{ id, localAgent?, result: Promise<SubagentResult>, dispose() }`；SubagentResult：`{ output: ContentBlock[], structured?, stopReason: 'completed'|'aborted'|'error'|'max-tokens'|'refusal' }`；
  - spawn provider 支持全部能力（outputSchema/depthLimit/toolFilter/persona）；`inheritsParentContext=false`（每轮全新子 agent，上下文靠 prompt 注入）。
- 备选（会话级续评）：`startContinuable({ provider, label, request, signal })` + `followup(parent, childId, content, { source, signal })`——留作后续演进。

### 3.2 评审连续性（上下文注入式续评）

- 设计（RD §4.2.5）：每轮用 `ctx.subagents.start('spawn', { label, prompt, parent, signal, persona, toolFilter })` 启动全新评审 agent（宿主标准子 agent 通道，复用其工具/模型路由/输出装配，替代早期 agents.create 手搓驱动——后者缺 setup 组合无法启动）；llm 节点配置 `cardIdPath`（占位符插值出 card.id），接线层据此读取卡片上一条「评审未通过」评论，作为【上一轮评审意见】注入 prompt——agent 凭注入的 findings 逐条核验修复情况（未修复继续列为未解决问题），功能等价于会话续评。
- 输出：`run.result` 直接给最终 assistant 输出（ContentBlock[]）+ `stopReason`；`stopReason !== 'completed'` 视为失败；`run.dispose()` 收尾（无常驻生命周期）。
- 调用上下文：parent/signal 经 kanban_move exec → checkGates execCtx → pipeline 检查器 → pipeline 服务 run(opts) → RunQueue → 引擎 → llm 节点 conf 全链路透传；pipeline_run 工具路径同构。

### 3.3 review 精简上下文（token 节省）

- **评审上下文（必须给足）**：① 仓库源码与文档——agent 在仓库工作目录（继承父 agent cwd，仓库路径另有卡片 refs local-repo 兜底）用 read/glob/grep/bash 直接读源码、docs/ui-design、review.md、AGENTS.md，并跑 `git diff origin/main...HEAD` 看 MR 变更；② 卡片信息——repo/branch/mr 关联 + 标题经 prompt 注入。这两样是评审对象本身，绝不裁剪。
- **裁掉无关能力（token 节省）**：subagents.start 的 `toolFilter: { allow: ["read","glob","grep","bash"] }`（spawn provider 支持；只读 + git，无写工具、无 kanban/git/pipeline/web/skill/subagent 等）＋ persona 阴影覆盖部署 persona（一段话，不挂 agent-instructions 大文档）。评审规范由 agent 自行 fs 读仓库文件（review.md / docs/ui-design / AGENTS.md）。
- `workflow-template/agent-presets/review/` 预设文件保留作参考（continuable 会话续评路径将来可能使用）。

### 3.4 runLlm 接线核心（index.ts 注入）

```ts
const subagents = ctx.get('subagents') as any
const runLlm = subagents && typeof subagents.start === 'function'
  ? async (prompt: string, up: Record<string, unknown>, conf: Record<string, unknown>) => {
      const parent = conf.parentAgent
      if (!parent) throw new Error('缺少调用方 agent 上下文（parentAgent 未注入）')
      // 续评：注入上轮「评审未通过」评论
      if (conf.cardId) { const prev = await lastReviewComment(String(conf.cardId)); if (prev) prompt = '【上一轮评审意见…】' + prev + '\n【本轮评审任务】' + prompt }
      const run = await subagents.start('spawn', {
        label: 'review-' + (conf.cardId || 'x'),
        prompt: [{ type: 'text', text: prompt }],
        parent,
        signal: conf.externalSignal || new AbortController().signal,
        persona: String(conf.persona || '…'),
        toolFilter: { allow: (conf.toolFilter || ['read', 'glob', 'grep', 'bash']).map(String) },
      })
      const result = await Promise.race([run.result, timeoutReject(conf.timeoutMs || 600000, run)])
      if (result.stopReason !== 'completed') throw new Error('评审 agent 未正常完成：' + result.stopReason)
      return blockText(result.output)
    }
  : undefined  // 未接入 → 引擎 fail-closed
```

- verdict 解析放引擎（engine.ts runLlmNode），不放接线层——引擎单测可覆盖（mock runLlm 直接返回文本）。
- 评审失败落卡评论：pipeline 服务 run() 在 result.error 时经 kanban addComment 统一写入（门禁侧不再写，单点落评论）。

### 3.5 引擎 llm 节点改造（engine.ts）

```ts
async function runLlmNode(node, ctx) {
  const prompt = typeof node.config.prompt === 'string' ? interpolate(node.config.prompt, ctx) : truncate(JSON.stringify(ctx.up))
  if (!ctx.runLlm) throw new Error('LLM 节点未接入 agent 服务（runLlm 未注入，fail-closed）')
  const text = await ctx.runLlm(prompt, ctx.up, node.config)
  const verdict = parseVerdict(text)
  if (verdict && verdict.ok === true) return { output: text, verdict }
  const issues = Array.isArray(verdict?.issues) ? verdict.issues : []
  const summary = issues.slice(0, 20).map(i => String(i.file || '') + (i.location ? ':' + i.location : '') + ' ' + String(i.message || '')).join('；') || 'verdict 解析失败：' + text.slice(-200)
  return { output: text, verdict, error: '评审未通过：' + summary }
}
```

- 注意：`executePipeline` 对节点结果 `result.error` 非空即 throw（isSoftError=false）→ 节点 failed → pipeline failed → 门禁拒绝。✓ 现有语义不用改。
- 调用上下文透传：conf.parentAgent / conf.externalSignal / conf.cardId（cardIdPath 插值）由引擎注入，接线层消费。

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