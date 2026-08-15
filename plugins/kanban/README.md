# dsh-kanban

DSH 看板插件（正式 bundle 形态）：嵌入侧边栏的全功能看板，27 个 agent 工具，人和 AI 在同一块板上协作。

## 能力

- **看板**：竖线分隔列、拖拽排序与跨列移动、分组（按 git 仓库）、归档/恢复、富文本内容（Notion 式块编辑器）、标签、评论、变更记录。
- **外部关联（refs）**：github-repo / github-branch / github-mr / local-repo / session 等；git 插件经子槽位 kanban.card.actions 注入同步按钮。
- **门禁（Gate）**：卡片可挂行为门禁——move（移动状态）/ tags（增减标签）/ archive（归档）触发时检查，不通过则拒绝动作。门禁是统一抽象：**一个检查单元（checker）**，可以是内置条件、一段代码、一条/多条 pipeline。详见下文「面向 Agent 的门禁指南」。
- **创建模板**：预设 description / tags / content / gates，新建卡片时引用免重复输入。agent（kanban_create(template=) 或 kanban_template_* 工具）与手动创建（创建弹窗模板下拉 + 预填）均可用。
- **跨插件服务**：ctx.provide('kanban')（getCard / updateCard / listCards / getCardStatus / moveCard）。

## 面向 Agent 的门禁指南

> agent 在对话中给卡片挂门禁、写门禁代码前，先读本节——工具参数、检查器契约、沙箱能力都在这里。

### 1. 门禁模型

一个门禁 = 某类动作触发时、必须通过的一个检查单元：

```json
{
  "id": "g...",              // 自动生成
  "name": "进 RD 需关联 MR",  // 展示用
  "on": "move",              // 触发行为：move / tags / archive
  "to": "RD",                // 仅 move：限定目标列名（可选；不填 = 移到任何列都触发）
  "checker": { "type": "…", "config": { } }   // 检查单元
}
```

一张卡片可挂**多条门禁**，触发动作时全部通过才放行；任一失败返回「门禁未通过：<原因>」并拒绝动作。门禁可挂在卡片上，也可由创建模板带入。

### 2. checker 六种类型

| type | 说明 | config |
|---|---|---|
| `tag-required` | 卡片必须含指定标签 | `{tags: ["rd-confirmed"]}` |
| `field-nonempty` | 卡片字段非空 | `{field: "description"}` |
| `mr-linked` | 已关联 GitHub 仓库 + MR（读 refs） | 无 |
| `mr-merged` | 关联 MR 已全部合并（GitHub API + GITHUB_TOKEN） | 无 |
| `code` | **一段代码**（沙箱执行，见 §3） | `{code}` 或 `{script}`，可选 `{timeoutMs}` |
| `pipeline` | **现场启动 pipeline 并等全部成功**（GitHub CI 门禁语义） | `{pipelines: ["<pipelineId>", ...]}`，并行执行 |

### 3. code checker：沙箱里有什么

代码在**宿主 codeRuntime 的 worker 沙箱**中执行（与 run_code 同款隔离：空环境、heap/时间预算、可硬杀；语义为「containment not security」——代码拥有与 bash 等同的信任）。代码为 TypeScript 风格，支持 top-level await，**顶层 return 判定结果**：`return { ok: true }` 通过，`return { ok: false, reason: '…' }` 拒绝（兼容旧写法：console.log 最后一行 JSON 同样被解析）。

沙箱内可用全局对象 **`gate`**：

| 函数 | 能力 | 示例 |
|---|---|---|
| `gate.card({})` | 当前被检查的卡片（完整 JSON） | `const c = await gate.card({})` |
| `gate.getCard({cardId})` | 读任意卡片 | `await gate.getCard({cardId: 'k…'})` |
| `gate.runPipeline({pipelineId, inputs})` | 现场跑一条 pipeline 并等结果（pipeline 插件服务） | `await gate.runPipeline({pipelineId: 'p…', inputs: {card}})` |
| `gate.call({service, method, args})` | **通用服务桥：调用任意宿主插件服务** | `await gate.call({service: 'git', method: 'isConfigured'})` |

**协议约定（必须遵守，违反即报错）**：
1. 调用一律**单对象参数**——`gate.call({…})` 而非位置参数 `gate.call('git','m')`（SDK 只桥接第一个实参）；
2. **必须带参数**——无参调用 `gate.card()` 会被拒（"binding arguments must be lossless JSON"），写 `gate.card({})`；
3. 参数与返回值都必须是 **lossless JSON**（纯数据，无 undefined/函数）。

**降级**：宿主无 codeRuntime 时，退化为 bash 沙箱子进程（node 执行，卡片与门禁载荷写入临时文件 `/tmp/dsh-gate-<id>.json`，进程内 `process.argv[2]` 读载荷），此模式下**没有 gate 命名空间**（沙箱网络受限，调不了插件）。

#### 示例 1：人工确认（最常用）

```
kanban_gate_add(card_id, checker_type: "tag-required", on: "move", to: "RD Ready",
                name: "RD 人工确认", config: {tags: ["rd-confirmed"]})
# 确认动作 = agent 在对话流里打标签：kanban_tags(card_id, add: ["rd-confirmed"])
```

#### 示例 2：MR 合并才能归档

```
kanban_gate_add(card_id, checker_type: "mr-merged", on: "archive", name: "MR 已合并才能归档")
```

#### 示例 3：进 Done 前跑测试 pipeline（现场等结果）

```
kanban_gate_add(card_id, checker_type: "pipeline", on: "move", to: "Done",
                name: "测试流水线通过", config: {pipelines: ["<三插件验证 pipelineId>"]})
```

#### 示例 4：沙箱内调其他插件（code）

```
kanban_gate_add(card_id, checker_type: "code", on: "move", to: "Stage", name: "git 已配置且标题够长",
  config: {code: "const gitCfg = await gate.call({service: 'git', method: 'isConfigured'});\nconst card = await gate.card({});\nreturn { ok: gitCfg.configured === true && String(card.title).length > 5, reason: 'git 未配置或标题过短' };"})
```

### 4. 相关工具

- 门禁管理：`kanban_gate_add` / `kanban_gate_remove` / `kanban_gate_list` / `kanban_gate_check`（手动预检，不执行动作）
- 模板带门禁：`kanban_template_create(gates: […])` → 建卡 `kanban_create(template: …)` 自动带入
- UI：卡片抽屉「门禁」区块增删；动作前 UI 调 /kanban-api/gate-check 预检

## 数据

- 目录：~/.dsh/kanban/board.json + config.json(dataDir)
- board：columns + archive + templates（创建模板）；卡片含 gates[]（门禁，旧平铺格式读取时自动迁移）

## 开发

```bash
pnpm --filter dsh-kanban check   # typecheck + build + verify（27 工具 / 5 路由断言）
node scripts/smoke-gate.mjs      # 门禁/模板端到端冒烟
node build.mjs --watch           # HMR 开发
```
