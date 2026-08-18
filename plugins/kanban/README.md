# dsh-kanban

DSH Kanban插件（正式 bundle 形态）：嵌入侧边栏的全功能Kanban，31 个 agent 工具，人和 AI 在同一块板上协作。

## 能力

- **Kanban**：竖线分隔列、拖拽排序与跨列移动、分组（按 git 仓库）、归档/恢复、富文本内容（Notion 式块编辑器）、标签、评论、变更记录。
- **外部关联（refs）**：github-repo / github-branch / github-mr / local-repo / session 等；git 插件经子槽位 kanban.ticket.actions 注入同步按钮。
- **会话自动关联**：`kanban_ticket_create` 由 agent 调用时自动挂 `{kind:'session', externalId:<agent.session.id>}` 引用（会话「Ticket」tab 按它列出本会话创建的卡）；历史卡可 `kanban_ticket_link(kind='session')` 手动补挂。
- **门禁（Gate）**：门禁是**门禁库里的独立实体**（单独配置，Ticket/模板按 id 勾选复用）——move（移动状态）/ tags（增减标签）/ archive（归档）触发时检查，不通过则拒绝动作。检查器统一抽象为 **checker**：内置条件 / 沙箱代码 / pipeline 三种写法，唯一执行底层是沙箱 code。详见下文「面向 Agent 的门禁指南」。
- **创建模板**：预设 description / tags / content / 门禁勾选（gate_ids 引用门禁库），新建Ticket时引用免重复输入。agent（kanban_ticket_create(template=) 或 kanban_template_* 工具）与手动创建（创建弹窗模板下拉 + 预填）均可用。
- **跨插件服务**：ctx.provide('kanban')（getTicket / updateTicket / listTickets / getTicketStatus / moveTicket）。

> 想直接拿到一套现成的开发流程（10 列 + 11 条门禁 + workflow 模板），把仓库根目录 [workflow-template](../../workflow-template/README.md) 样例包的 `workflow.json` 交给 agent 用 `kanban_import_config` 导入即可——复制出去改一改就是自己的流程。

## 面向 Agent 的门禁指南

> agent 在对话中给Ticket 挂门禁、写门禁代码前，先读本节——工具参数、检查器契约、沙箱能力都在这里。

### 1. 门禁模型（v6：门禁库）

门禁是**门禁库（board.gateLibrary）里的独立实体**：单独创建、单独配置，Ticket与模板按 id **勾选引用**（ticket.gateIds / template.gateIds）。同一门禁可被多张卡/多个模板复用，改一处全局生效。

```json
{
  "id": "g...",              // 自动生成（库 id）
  "name": "进 RD 需建 workflow 分支",  // 展示用
  "on": "move",              // 触发行为：move / tags / archive
  "to": "RD",                // 仅 move：限定目标列名（可选；不填 = 移到任何列都触发）
  "checker": { "type": "…", "config": { } }   // 检查单元
}
```

一张Ticket可勾选**多条门禁**，触发动作时全部通过才放行；任一失败返回「门禁未通过：<原因>」并拒绝动作。模板勾选的门禁在建卡时随卡带入（复制 gateIds 引用）。旧版内联 `gates[]` 数据读取时自动迁入门禁库。

### 2. checker 六种类型（唯一执行底层 = 沙箱 code）

所有 checker 最终都以**代码**形式在 code 沙箱里执行（架构：内置类型 = 预设代码模板，见 §3）。声明式类型只是快捷预设，与手写 code 等价：

| type | 预设代码做的事 | config |
|---|---|---|
| `tag-required` | 检查 `ticket.tags` 包含指定标签 | `{tags: ["rd-confirmed"]}` |
| `field-nonempty` | 检查Ticket字段非空 | `{field: "description"}` |
| `mr-linked` | 检查 refs 有 github-repo + github-mr | 无 |
| `branch-linked` | 检查 refs 有 github-repo + github-branch（workflow 分支已建） | 无 |
| `mr-merged` | 经 `gate.call` git.sync 拿 MR 快照，检查全部 merged | 无 |
| `code` | **手写代码**（见 §3） | `{code}` 或 `{script}`，可选 `{timeoutMs}` |
| `pipeline` | 经 `gate.runPipeline` 现场跑并等全部成功（GitHub CI 门禁语义） | `{pipelines: [...]}`，并行执行 |

> 无 codeRuntime 时降级：内置预设走宿主等价实现（行为一致），code 类型走 bash 子进程（无 gate 命名空间）。

> **pipeline 门禁的执行上下文（踩坑备忘 · dsh-plugins-4）**：pipeline 检查器只在**真实动作调用**（如 `kanban_ticket_move`）里携带调用方 agent 上下文；若 pipeline 含 llm 节点（如 workflow 评审 `p-workflow-review`），用 `kanban_gate_check` 预检会报 `缺少调用方 agent 上下文`、独立 `pipeline_run` 会 `aborted before child publication`——都跑不了评审。验证评审类 pipeline 门禁请用真实 move（评审通过时拒因只剩缺 review-1-done；未过会落卡评论）。

### 3. code checker：沙箱里有什么

代码在**宿主 codeRuntime 的 worker 沙箱**中执行（与 run_code 同款隔离：空环境、heap/时间预算、可硬杀；语义为「containment not security」——代码拥有与 bash 等同的信任）。代码为 TypeScript 风格，支持 top-level await，**判定结果一律由顶层 return 给出**：`return { ok: true }` 通过，`return { ok: false, reason: '…' }` 拒绝。

沙箱内可用全局对象 **`gate`**：

| 函数 | 能力 | 示例 |
|---|---|---|
| `gate.ticket({})` | 当前被检查的Ticket（完整 JSON） | `const c = await gate.ticket({})` |
| `gate.getTicket({ticketId})` | 读任意Ticket | `await gate.getTicket({ticketId: 'k…'})` |
| `gate.runPipeline({pipelineId, inputs})` | 现场跑一条 pipeline 并等结果（pipeline 插件服务） | `await gate.runPipeline({pipelineId: 'p…', inputs: {ticket}})` |
| `gate.call({service, method, args})` | **通用服务桥：调用任意宿主插件服务** | `await gate.call({service: 'git', method: 'isConfigured'})` |

**协议约定（必须遵守，违反即报错）**：
1. 调用一律**单对象参数**——`gate.call({…})` 而非位置参数 `gate.call('git','m')`（SDK 只桥接第一个实参）；
2. **必须带参数**——无参调用 `gate.ticket()` 会被拒（"binding arguments must be lossless JSON"），写 `gate.ticket({})`；
3. 参数与返回值都必须是 **lossless JSON**（纯数据，无 undefined/函数）。

**降级**：宿主无 codeRuntime 时，退化为 bash 沙箱子进程（node 执行，Ticket与门禁载荷写入临时文件 `/tmp/dsh-gate-<id>.json`，进程内 `process.argv[2]` 读载荷），此模式下**没有 gate 命名空间**（沙箱网络受限，调不了插件）。

#### 示例 1：人工确认（最常用）

```
# 1) 在门禁库创建门禁（独立实体，只建一次，多卡复用）
kanban_gate_create(name: "RD 人工确认", checker_type: "tag-required",
                   on: "move", to: "RD", config: {tags: ["rd-confirmed"]})
# 2) Ticket勾选挂载（或模板 gate_ids 勾选后随卡带入）
kanban_gate_add(ticket_id, gate_id: "<上一步的 gate_id>")
# 确认动作 = agent 在对话流里打标签：kanban_ticket_tags(ticket_id, add: ["rd-confirmed"])
```

#### 示例 2：MR 合并才能归档

```
kanban_gate_create(name: "MR 已合并才能归档", checker_type: "mr-merged", on: "archive")
kanban_gate_add(ticket_id, gate_id: "<gate_id>")
```

#### 示例 3：进 Done 前跑测试 pipeline（现场等结果）

```
kanban_gate_create(name: "测试流水线通过", checker_type: "pipeline", on: "move", to: "Done",
                   config: {pipelines: ["<三插件验证 pipelineId>"]})
kanban_gate_add(ticket_id, gate_id: "<gate_id>")
```

#### 示例 4：沙箱内调其他插件（code）

```
kanban_gate_create(name: "git 已配置且标题够长", checker_type: "code", on: "move", to: "Stage",
  config: {code: "const gitCfg = await gate.call({service: 'git', method: 'isConfigured'});\nconst ticket = await gate.ticket({});\nreturn { ok: gitCfg.configured === true && String(ticket.title).length > 5, reason: 'git 未配置或标题过短' };"})
```

#### 模板勾选门禁（随卡带入）

```
kanban_template_create(name: "workflow", gate_ids: ["<gate_id>…"])   # 或内联 gates 数组（自动入库）
kanban_ticket_create(title: …, template: "workflow")                        # 新卡自动勾选相同门禁
```

### 4. 相关工具

- 门禁库：`kanban_gate_create` / `kanban_gate_delete`（删库同时从Ticket/模板摘除）/ `kanban_gate_list`（返回 gate_library + 指定Ticket ticket_gates）
- 挂载：`kanban_gate_add`（ticket_id + gate_id）/ `kanban_gate_remove`；预检：`kanban_gate_check`（不执行动作）
- 模板带门禁：`kanban_template_create/update` 支持 `gate_ids`（兼容内联 `gates` 自动入库）→ 建卡 `kanban_ticket_create(template: …)` 自动带入
- UI：「门禁」页 = 门禁库 CRUD（含引用关系）；Ticket 抽屉「门禁」区块勾选挂载；动作前 UI 调 /kanban-api/gate-check 预检
- 配置流转：`kanban_export_config`（导出列+门禁库+模板，按名字引用，不含任何Ticket/个人数据）/ `kanban_import_config`（整体替换配置层，旧Ticket挪第一列，自动备份 board.json）——格式与 workflow-template 的 workflow.json 一致

## 数据

- 目录：~/.dsh/kanban/board.json + config.json(dataDir)
- board：columns + archive + templates（创建模板）+ gateLibrary（门禁库）；Ticket/模板含 gateIds[]（引用门禁库；旧内联 gates[] 读取时自动迁移入库）

## 开发

```bash
pnpm --filter dsh-kanban check   # typecheck + build + verify（31 工具 / 5 路由断言）
node scripts/smoke-gate.mjs      # 门禁/模板端到端冒烟
node build.mjs --watch           # HMR 开发
```
