# dsh-plugins-2 — Review Agent 评审门禁 + pipeline 插件改造 RD

> 产出放 `docs/<taskId>/rd.md`，随 `workflow/<taskId>` 分支 MR 演进。
> 进入 RD 前置：`git_create_branch` 已建分支并关联（branch-linked 门禁）。本文档经 `md_doc_open` 人审通过（打 `rd-confirmed`）后，方可 `git_create_mr` 并推进 TD。

> 本任务包含两个 Main Requirement：
> - **需求一（Review Agent）**：用户侧可见的评审能力——「代码评审」pipeline + review prompt + Testing 双门禁；
> - **需求二（pipeline 插件改造）**：支撑需求一的平台能力——llm 节点真实执行（接入宿主 agents 服务）、fail-closed、pipeline_import_config 导入工具。
> 两者强依赖（需求一的门禁跑在需求二的引擎能力上），故合一张卡、一个 MR，但设计与验收分开描述。

## 1. 需求背景

- 一句话：把「1st Review → Testing」的人工标签门禁升级为「人工确认 + agent 评审 pipeline」双门禁——move 到 Testing 时现场触发「代码评审」pipeline，由 agent 按 review prompt 对 MR 做代码逻辑 + 设计规范 + 文档纪律评审，问题全部解决且 agent 给出 OK 才放行。
- 用户诉求原文（来自 Backlog 卡片）：「补充一个 review 的 pipeline。Review 进入 Testing 前，需要满足门禁，触发 pipeline 触发 agent 进行 review。这里还要补充 review prompt。review 除了代码逻辑，还有 review 设计规范。然后 review 问题都解决了，agent 给出 OK 了才能到 Testing。」
- 现状约束（为什么需要需求二）：pipeline 引擎虽有 `llm` 节点类型与 `runLlm` 注入点，但插件从未接线——`llm` 节点目前返回占位结果（**静默成功**）。不先做需求二，需求一的「agent 评审」无法真实执行，且门禁会假放行。

## 2. 目标与非目标

### 需求一：Review Agent（评审能力）

| 目标 | 非目标 |
|---|---|
| move → Testing 门禁现场运行「代码评审」pipeline（pipeline 检查器），agent 评审未 OK 则拒绝移动 | 不改动其他列的门禁（2nd review / Stage / Done 维持现状） |
| 新增 review prompt 真源（workflow-template/prompts/review.md），覆盖代码逻辑、设计规范（docs/ui-design + AGENTS.md 红线）、文档纪律 | 不做 2nd review 阶段的 agent 复审（用户未要求，留作后续） |
| 双门禁：人审标签 `review-1-done` + agent 评审 pipeline 都满足才能进 Testing（用户选定） | 不引入评审结果缓存/增量评审（每次 move 尝试都重跑，保证评最新代码） |
| 评审问题自动落卡评论，门禁拒绝原因带问题摘要（用户选定） | 通过时不在卡上刷「评审通过」记录（避免噪音） |

### 需求二：pipeline 插件改造（平台能力）

| 目标 | 非目标 |
|---|---|
| `llm` 节点真实执行：接入宿主 `agents` 服务创建子 agent，多轮评审后返回结构化 verdict | 不改 exec/fetch/transform/pipeline 等既有节点行为 |
| fail-closed：无 runLlm / agent 服务不可用 / verdict 无法解析时，llm 节点失败 → pipeline 失败 → 门禁拒绝，绝不静默放行 | 不实现 llm 节点的通用「多模型对话」能力（本次只服务评审场景，prompt 由节点 config 提供） |
| 新增 `pipeline_import_config` 工具（按稳定 id 幂等 upsert），模板 pipeline 定义放 `workflow-template/pipelines.json`，门禁引用稳定 id `p-workflow-review`，跨环境导入即用 | 不做 findPipeline 名称回退（保持查找语义单一，用户选定 import 方案） |

## 3. 范围

- 涉及模块 / 仓库：`dsh-plugins` 仓库
  - 需求一：`workflow-template/pipelines.json`（新增）、`workflow-template/prompts/review.md`（新增）、`workflow-template/workflow.json`（Testing 门禁）、`plugins/kanban/src/host/gate.ts`（pipeline 检查器失败时写卡评论）、`workflow-template/skills/workflow/SKILL.md` + `.agents/skills/workflow/SKILL.md`（双副本）、`workflow-template/README.md`
  - 需求二：`plugins/pipeline/src/host/engine.ts`、`plugins/pipeline/src/host/tools.ts`、`plugins/pipeline/src/index.ts`、`plugins/pipeline/README.md`
- 涉及角色 / 调用方：看板 workflow 模式的 agent（move 卡片触发门禁）、卡片 owner（被拒绝后按评论修问题再 move）、pipeline 插件使用者（pipeline_import_config）
- 边界：
  - 评审 agent 由宿主 `agents` 服务创建（origin=subagent），作用域仅在 pipeline 运行期间，运行结束 dispose
  - pipeline 数据持久化 `~/.dsh/pipeline/pipeline.json`，重启不丢；pipeline_import_config 幂等 upsert（稳定 id）
  - 本会话无 cordis 工具（非创造模式），插件改动无法热更新：交付源码 + 构建校验 + 引擎级测试（mock runLlm）；宿主侧真实 agent 评审在用户重启 dsh 后的新会话验证

## 4. 方案设计

### 4.1 总体决策（grill-me 收敛，两个需求共用）

| 决策点 | 结论 |
|---|---|
| 门禁语义 | 双门禁：tag-required `review-1-done`（人审）+ pipeline 检查器（agent 评审 OK），两者都过才进 Testing |
| review prompt 范围 | 代码逻辑 + 设计规范（docs/ui-design、AGENTS.md 红线）+ 文档纪律 |
| 评审意见落点 | 自动写卡评论 + 门禁拒绝原因带摘要（通过不刷评论） |
| 模板引用方式 | pipelines.json 定义 + `pipeline_import_config` + 稳定 id `p-workflow-review`（用户选定，不做名称回退） |
| 验证边界 | 本会话：源码 + 构建校验 + 引擎级测试（mock runLlm）；用户重启 dsh 后新会话做宿主级验证 |

### 4.2 需求一：Review Agent 详细设计

#### 4.2.1 评审 pipeline 定义（workflow-template/pipelines.json）

- `id: "p-workflow-review"`，name「代码评审」，kind atomic，节点：
  1. `in`（input）：透传 `card`（门禁检查器注入 `{ card }`）；
  2. `review`（llm）：`config.prompt` 为引导 prompt（中文）：「你是 DSH 仓库的代码评审 agent。入参 card 是待评审卡片（含 github-repo/github-branch/github-mr 关联）。先读取仓库 `workflow-template/prompts/review.md` 获取完整评审要求，再按流程评审 MR 分支 diff；全部问题解决才可给出 OK。最终必须以一行 `REVIEW_VERDICT:{"ok":true|false,"issues":[...]}` 结尾，issues 为未解决问题数组（每项含 file/location/severity/message）。」`config.timeoutMs` 600000；
  3. `out`（output）：汇总输出（agent 文本 + verdict 结构）。
- 评审通过时输出含 `verdict: {ok:true}`；不通过时 pipeline 失败（error 携带 issues 摘要）。

#### 4.2.2 review agent 精简上下文（token 节省）

- review agent 用**精简预设**（`workflow-template/agent-presets/review/`）：只注册评审所需的最小工具集——fs 读写/搜索 + bash（跑 git diff），**不注册** skills、web、subagent、workflow、pipeline 等与评审无关的能力；persona 一段话，不叠多余 prompt 段。
- llm 节点 config `agentPreset: "review"` 指定；评审所需的规范/红线知识由 agent 自己用 fs 读仓库内文件（review.md / docs/ui-design / AGENTS.md），不靠 skill 目录。
- 卡片上下文只注入必要字段（repo/branch/mr 关联 + 标题），不整卡全量塞 prompt。

#### 4.2.3 review prompt 真源（workflow-template/prompts/review.md）

- 结构：
  1. 角色与目标：只评审、不改代码；最终给出严格 verdict；
  2. 评审对象：卡片关联仓库的 `workflow/<taskId>` 分支相对 base（main）的 MR diff + 关联文档；
  3. 维度一「代码逻辑」：正确性（含边界/并发/错误处理）、回归风险、缺失测试、危险行为（权限/破坏性操作/静默吞错）；
  4. 维度二「设计规范」：docs/ui-design/（tokens.md / style-guide.md / components.md）与 packages/ui/host/design-platform.css 的 `--dsw-*` tokens；AGENTS.md 红线：UI 一律宿主 tokens、禁止 emoji、共享优先（跨插件复用进 packages/ui，禁止插件内复制）；源码即真相（dist/ 产物不提交）；
  5. 维度三「文档纪律」：改动涉及文档时 README / 插件 README / skill 同步（AGENTS.md 文档职责分工）；文档与代码同 MR；
  6. 输出格式：问题清单（file/location/severity/message）+ 一行 `REVIEW_VERDICT:{"ok":true|false,"issues":[...]}`；ok 仅当全部问题已解决（本轮无未解决问题）；
  7. 判定纪律：不通过 = 存在任一 severity≥medium 未解决问题；不确定的疑似问题计入 issues 并在 message 标注「待确认」。

#### 4.2.4 门禁配置（workflow-template/workflow.json）

- 原「1st review 通过才能测试」（tag-required review-1-done）保留；
- 新增（双门禁第二道）：
```json
{
  "name": "Review pipeline 通过才能进 Testing",
  "on": "move",
  "to": "Testing",
  "checker": { "type": "pipeline", "config": { "pipelines": ["p-workflow-review"] } }
}
```
- 模板 gates 列表同步追加该门禁名。

#### 4.2.5 评审连续性（上下文注入式续评，评审 agent 接着上轮意见评）

- **实现**：每轮评审通过 `subagents.start('spawn')` 启动全新评审 agent（宿主标准子 agent 通道）；llm 节点把 `card.id` 传给接线层（`cardIdPath`），接线层读取卡片上一条「评审未通过」评论，作为【上一轮评审意见】注入本轮 prompt。
- 续评语义：agent 凭注入的上轮 findings 逐条核验修复情况——未修复继续列为未解决问题（NOT OK），已修复不再列入；实现等价于「拿上次 session 继续评」，且无常驻 agent 生命周期负担（每轮用完即 dispose）。
- 备选（session 级续评）：宿主 `subagents` 的 continuable 通道可做真实会话续评（startContinuable + followup），留作后续演进（当前实现已满足 B-3 验收口径）。

#### 4.2.6 评审意见落卡评论（plugins/kanban/src/host/gate.ts 小改）

- pipeline 门禁检查器（nativeCheckers['pipeline'] / presetProgram）在 pipeline 运行**失败**时，从 `out.error` 提取 issues 摘要，通过 `gate.call({service:'kanban', method:'addComment', args:[cardId, text]})` 写卡评论（失败不影响门禁判定）；通过时不写评论。
- 简单去重：与卡最后一条评论内容相同则不重复写（避免连续 move 刷屏）。
- 若 kanban 服务不可用则降级为仅拒绝原因展示。
- 门禁拒绝原因：`pipeline p-workflow-review 失败：<issues 摘要截断>`。

### 4.3 需求二：pipeline 插件改造详细设计

#### 4.3.1 引擎 llm 节点 fail-closed（plugins/pipeline/src/host/engine.ts）

- `runLlmNode` 改造：
  - `ctx.runLlm` 存在时：`const text = await ctx.runLlm(prompt, ctx.up, node.config)`，返回 `{ output: text }`；
  - `ctx.runLlm` 缺失时：**throw**（原占位返回改为失败），节点 failed → pipeline failed（fail-closed）；
  - verdict 判定：runLlm 返回文本中解析 `REVIEW_VERDICT:{"ok":true|false,"issues":[...]}` 尾行；`ok:false` 或解析失败 → 节点结果带 `error: "评审未通过：<issues 摘要>"` → pipeline 失败；
  - `isSoftError` 语义不变（error 字段即失败）。
- 引擎保持可测：runLlm 由调用方注入，引擎本体不依赖宿主 agent API。

#### 4.3.2 插件接线（plugins/pipeline/src/index.ts）

- `const agents = ctx.get('agents')`；构造 RunQueue deps 时注入 `runLlm` 实现：
  - 入参：`prompt`（已插值）、`up`（上游输出）、`conf`（节点 config：`model`/`maxTokens`/`timeoutMs`/`agentPreset`）；
  - 流程：`agents.create({ sessionId: safeId('a'), meta: { cwd, origin: 'subagent', agentPreset: conf.agentPreset || 'review' }, agentOptions: { provider, model }, signal })` → `agent.followup({ role:'user', content: prompt })` → `await agent.whenIdle()` → 读会话最后一条 assistant 消息文本 → `handle.dispose()`；
  - verdict 解析：正则提取尾行 `REVIEW_VERDICT:\s*(\{.*\})` → `{ok, issues}`；解析失败视为不通过（fail-closed，错误信息提示 prompt 格式要求）；
  - 超时：`conf.timeoutMs`（默认 10 分钟）用 AbortSignal 与 `whenIdle` 竞速，超时 dispose 并报错。
- 若 `agents` 服务不可得：注入恒抛错实现（fail-closed），llm 节点报「agent 服务未激活」。

#### 4.3.3 pipeline_import_config 新工具（plugins/pipeline/src/host/tools.ts + index.ts）

- 工具 `pipeline_import_config({ config })`：
  - 入参 `config`：`{ pipelines: [{ id, name, kind, description, tags, nodes, input_schema?, published? }] }`；
  - 语义：按 `id` upsert——已存在则替换其「最新草稿版本」节点与元信息；不存在则新建（初始版本 v0.1.0 草稿）；`published: true` 时发布该版本（幂等）；
  - 返回每条的 created/updated 状态；
  - 同时提供 HTTP 路由 `/pipeline-api/import`（与既有路由同构），供 client/其他插件调用。

### 4.4 文档同步（需求一 + 需求二）

- `workflow-template/skills/workflow/SKILL.md` 与 `.agents/skills/workflow/SKILL.md` 双副本：
  - 门禁清单表：Testing 行改为「双门禁：tag-required review-1-done + pipeline p-workflow-review（agent 评审 OK）」；
  - 新增「review pipeline」小节：触发时机、review prompt 位置、verdict 语义、重启验证说明；
  - 确认标签表不变（review-1-done 语义保留）；
- `workflow-template/README.md`：导入流程增加 `pipeline_import_config` 一步；
- `plugins/pipeline/README.md`：llm 节点现状更新（不再占位、fail-closed 语义）、pipeline_import_config 用法。

### 4.5 兼容与迁移

- 存量 pipeline 不受影响（需求二不改既有 exec/fetch/transform 行为）；
- 旧 llm 节点（若有）从「占位成功」变为 fail-closed——语义变更在 pipeline README 说明；
- 看板导入：`kanban_import_config`（整体替换，旧卡挪第一列、门禁挂载清除）→ 重新 `kanban_gate_add` 挂门禁；本次导入前先 `kanban_export_config` 备份；
- 本会话验证边界：无 cordis 工具不能热更新插件；交付后由用户重启 dsh，新会话按流程验证（见 §6）。

## 5. 影响面与风险

| 风险 | 影响 | 概率 | 缓解 | 归属 |
|---|---|---|---|---|
| 宿主 agents 服务 API 与本设计假设不符（CreateAgentOptions 字段/驱动方式） | 需求二接线返工 | 中 | 引擎 runLlm 注入点保持；接线集中在 index.ts 一处，按实际 d.ts 调整；mock 单测先行 | 需求二 |
| llm 节点未接线时门禁假放行（占位成功） | 门禁失效 | 高（现状即如此） | fail-closed：无 runLlm 即 throw；本任务必改项 | 需求二 |
| 评审 agent 输出不满足 verdict 格式 | 评审不可判定 | 中 | prompt 强制尾行格式；解析失败按不通过处理（fail-closed），错误信息可读 | 需求一 |
| 每次 move 重跑评审耗时/耗 token | move 变慢 | 中 | 双门禁下 agent 评审仅在人工确认后触发；超时（10 分钟）与 dispose 兜底 | 需求一 |
| 导入 pipelines.json 覆盖同名/同 id pipeline | 数据覆盖 | 低 | pipeline_import_config 幂等 upsert 且返回 changed 状态；README 提示先备份 | 需求二 |
| 评审评论刷屏（重复 move） | 卡评论噪音 | 中 | 仅失败时落评论；与最后一条评论相同不重复写 | 需求一 |
| 评审 agent 常驻内存（失败轮次不 dispose） | 常驻 agent 累积 | 中 | 仅按卡持有（Map）；ok:true 即释放；本期不做空闲清理，README 登记 | 需求一 |
| review agent 上下文过重（挂 skill/web 等无关能力） | token 浪费、评审变慢 | 中 | 精简 review 预设：仅 fs+bash 最小工具集，不注册 skills/web/subagent；persona 精简 | 需求一 |

## 6. 验收口径（供 UC 阶段展开）

### 需求二（引擎级，本会话 mock runLlm 可验）

1. llm 节点在无 runLlm 时节点失败、pipeline failed（fail-closed）；
2. runLlm 返回 `REVIEW_VERDICT:{"ok":false,...}` 时 pipeline failed，error 含 issues 摘要；
3. runLlm 返回 `REVIEW_VERDICT:{"ok":true,...}` 时 pipeline success，输出含 verdict；
4. `pipeline_import_config` 导入 pipelines.json 后按稳定 id `p-workflow-review` 可查、重复导入幂等。

### 需求一（宿主级，用户重启 dsh 后新会话验证）

5. move → Testing：先缺 review-1-done 标签被拒（tag 门禁），打标签后再被评审 pipeline 拒绝（agent 评审未 OK，卡上有评审评论）；
6. 按评论修完问题再 move → 评审通过进 Testing；
  6a. **续评验证**：第一轮评审失败后不重启 dsh，修问题再 move——第二轮评审 agent 记得上轮 findings（可从其输出/评论对比确认是续评而非新评）；
7. 评审 agent 确实读了设计规范（评审意见能指出 tokens/emoji 类问题——用含违规的测试分支验证一次）。

## 7. 开放问题

- 无（grill-me 已收敛：双门禁 / prompt 三维度 / 评论落点 / 稳定 id + import / 重启验证边界；两个 Main Requirement 已在 §2/§4/§5/§6 分开描述）。