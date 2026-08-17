# git 插件需求与方案（v0.1 调研稿）

> 状态：**调研完成，规划中，未动手实现**。本文档回答三件事：当前跨插件联动能力现状（调研结论）、通用 task 数据格式设计、git 插件需求与技术方案。
> 相关代码位置：宿主动态插件运行时 `@deepseek-ai/dsh-cordis-host-runner` / `dsh-cordis-client-runner` / `dsh-tool-cordis`（pnpm dlx checkout 内），kanban 插件见 `plugins/kanban/`。

## 1. 背景与目标

1. **数据格式扩张**：单个 task（kanban 卡片）需要关联 github repo、本地仓库地址、branch、MR 等；git 插件与其配合。
2. **平台无关**：数据格式要足够通用，未来可接入 jira 等（我们不自研 jira，但格式不能绑死 github）——这是工具平台化的前提。
3. **sync / update 按钮**：按钮由 git 插件（或某个适配层）注册进来，点击后触发从其他插件拉取最新 MR 与 MR 状态。
4. **先调研后动手**：本文档即调研产出 + 需求/方案；方案评审通过前不写实现代码。

## 2. 调研结论：跨插件联动能力现状

### 2.1 动态插件运行模型（事实）

- 动态插件（`cordis_define` / `cordis_run`）分两个半：
  - **宿主半**：Node 进程内 VM sandbox（`dsh-cordis-host-runner`），负责工具注册、RPC、服务、数据。
  - **客户端半**：浏览器（`dsh-cordis-client-runner`），负责 UI（React + slots）。
- 同一会话的动态插件 **共享同一个 cordis 组合**：run 以子 fiber 挂到宿主组合的 group ctx 下（host-runner `group.ctx.plugin(...)`），因此服务与事件在同一 cordis app 内互通。
- 动态插件的 `apply(ctx)` 收到的是 **ctx 门面（façade）**，不是真实 ctx：白名单动词 + 声明服务，框架内部（root/fiber/registry/plugin…）刻意隐藏。

### 2.2 已有能力（可以直接用的三通道）

| 通道 | 宿主半 | 客户端半 | 跨插件可用？ |
|---|---|---|---|
| **服务** | `ctx.provide(name, svc)` 暴露、`ctx.get(name)` 读取、`inject: ['name']` 声明消费（provider 缺失时自动 park 等待） | 同左（slots/theme 是常规 UI 服务） | **是**。动态插件提供的服务对同会话其他插件可见，宿主服务也可 `ctx.get`（kanban 已在用 `ctx.get('fs')`） |
| **事件** | `ctx.on / ctx.once` 监听（宿主已有大量事件：`slots/changed`、`credentials/updated`、`tool/*`…） | 同左 | **是**（监听方向） |
| **UI 槽位** | — | `ctx.slots.inject(key, () => ctx.slots.register({name, id, order, label}, Comp))`，任何插件可向任意 slot key 注册条目，`order` 排序、unload 级联清理 | **是**。git 插件可以往 kanban 声明的槽位里注册按钮 |

宿主服务目录（`cordis_inspect_query` → `Service.listService`，实际清单以查询为准）至少包含 60 个服务键，与 git 插件直接相关：`fs`（文件）、`web`（HTTP）、`credentials`（凭证）、`shell`（进程）、`timer`、`settings`、`storage`、`tools` 等。

### 2.3 不存在 / 刻意受限的能力

1. **跨插件直接调用工具 execute：不可行（设计使然）**。工具经全局 `ToolRuntime.execute` 走完整守卫链（身份保护、策略、monotonic 守卫、结果规范化）；沙箱里 `ctx.tools` 是只读门面（`schemas` / `get` 只返回元数据），注释明确说明不给可调用句柄是为了防绕过。→ 插件间协作走**服务调用**，不走工具。
2. **动态插件主动发事件：`ctx.emit` 不在门面白名单**。→ 发布-订阅需用自定义服务方法（如 provider 暴露 `subscribe/notify`）或依赖宿主事件；同步完成通知以服务返回值 + UI await 刷新为主。
3. **`harness.handle` RPC：每插件私有**（client↔host 配对，客户端 `host.call` 只能调本插件的 handler）。→ 跨插件 RPC 也要走服务。
4. **动态插件是会话态**：重启进程丢失（需 `cordis_define` 重新定义），刷新页面后 Client 半不自动恢复（官方设计）。→ 源码即真相，及时提交；数据落盘。

### 2.4 结论

- **能力存在**：同会话动态插件之间、动态插件与宿主之间，通过 **服务（provide/inject/get）+ 事件（on）+ 槽位（slots）** 可以完成"git 插件注册 sync 按钮 → 触发拉取 → 写回 kanban 卡片"的完整链路，**无需改宿主**。
- **但都是机制级能力，没有平台化约定**：服务接口、槽位 key、跨插件数据格式需要我们自己定义契约。本方案第 4、5 节就是这套契约。
- 联动的两个插件**必须在同一会话内都已激活**（同会话共享 cordis 组合）；只装其一 → 降级（无按钮 / 无同步）。

## 3. 命名与定位

- 插件名 **`git`**（目录 `plugins/git`，工具前缀 `git_`），不叫 github：同时覆盖 **GitHub 远端 API** 与**本地仓库（git 命令）**，后续可扩展 GitLab 等 provider。
- 平台无关性体现在**数据格式**（第 4 节）与**服务契约**（第 5.3 节），provider 键命名空间隔离，接 jira 时 kanban 零改动。

## 4. 通用 task 数据格式设计（核心）

### 4.1 原则

- **kanban 只管两件事**：① 卡片与外部对象的**稳定引用（refs）**；② 每个 provider 的**不透明同步快照信封（meta.sync）**。
- **provider 管 payload schema**：`snapshot` 内容归 git 插件所有（自带 version），kanban 不解析。
- **向后兼容**：旧卡片没有 `refs` / `meta.sync` 视为空，读路径全部可选。

### 4.2 卡片结构（`plugins/kanban` 数据模型 v2，提案）

```jsonc
{
  "id": "k1", "title": "接入 GitHub MR 同步", "description": "…",
  "tags": [], "comments": [], "activity": [], "createdAt": "…", "updatedAt": "…",

  "refs": [
    {
      "id": "r_xxx",                 // kanban 本地生成，稳定，插件间引用用 ticketId + ref.id
      "kind": "github-repo",         // 命名空间：<platform>-<type>（github-repo / github-branch / github-mr / jira-issue …）
      "platform": "github",          // provider 键（命名空间隔离的关键）
      "externalId": "owner/repo",    // provider 侧 ID（repo 全名 / MR 号 / jira key）
      "url": "https://github.com/…", // 可点击跳转
      "display": "dsh-plugins",      // 展示文本（branch 名 / MR 标题等）
      "meta": { "branch": "feat/sync" },  // provider 自有轻量静态信息（可选）
      "createdAt": "…"
    }
  ],

  "meta": {
    "taskId": "dsh-plugins-42",      // 自动关联 ID（§5.5）：<repo-name>-<int>，MR 标题须携带 [taskId]
    "sync": {
      "github": {                    // 键 = platform（provider 命名空间）
        "version": 1,                // 信封版本
        "lastSyncAt": "2025-…T…Z",   // 上次成功同步
        "error": null,               // 上次失败信息（失败时 UI 给重试入口）
        "snapshot": {                // provider 自有 payload（schema 归 provider，内部带版本）
          "repo": { "owner": "…", "name": "…", "branch": "main" },
          "mrs": [
            { "number": 12, "title": "feat: sync", "state": "open", "url": "https://…", "updatedAt": "…", "mergeable": true }
          ]
        }
      }
      // 未来 "jira": { … } 平级追加，kanban 零改动
    }
  }
}
```

### 4.3 约定与边界

- **refs 由谁写**：kanban（UI 链接编辑 + 工具 `kanban_ticket_link` / `kanban_ticket_unlink`）负责增删改；git 插件同步时**只读 refs、只写 meta.sync**，两者经 ticketId 关联。
- **同一任务可多个 refs**：1 个 repo + N 个 branch + N 个 MR，天然支持。
- **provider 键即隔离域**：`meta.sync.<provider>` 互不覆盖；同 provider 内由插件自管并发（串行写，见 5.4）。
- **taskId 自动关联锚点**：卡片 `meta.taskId`（`<repo-name>-<int>`，§5.5）是 MR 自动关联的锚点；由 kanban 生成或 git 插件认领时写入，同 repo 内唯一即可。
- **平台无关性验证**：接 jira 时只需要——新 provider 键 `jira` + 新 ref kind `jira-issue` + 一个提供 `jira` 服务的插件，kanban / git 全部零改动。这就是"平台无关的工具"的含义。

## 5. git 插件需求与技术方案

### 5.1 功能需求（MR 版本）

| 编号 | 需求 | 说明 | 优先级 |
|---|---|---|---|
| G1 | 任务关联 GitHub 仓库 | 卡片 refs 增加 `github-repo`（owner/repo + url） | P0 |
| G2 | 任务关联本地仓库 | refs 增加 `local-repo`（本地绝对路径；由 git 插件用 `fs`/git 命令解析验证存在） | P0 |
| G3 | 任务关联 branch | refs 增加 `github-branch`（基于 repo 的 branch 名） | P0 |
| G4 | 任务关联 MR | refs 增加 `github-mr`（MR 号，url 跳转） | P0 |
| G5 | 获取 MR 列表与状态 | 按 repo 拉 open MR（列表 + title/state/mergeable/updatedAt） | P0 |
| G6 | **sync 按钮**（注册进 kanban） | 由 git 插件向 kanban 声明的槽位注册"同步"按钮；点击 → 拉最新 MR/状态 → 写回卡片 `meta.sync.github` | P0 |
| G7 | MR 状态展示 | 卡片上展示 refs 与 MR state（open/merged/closed 徽标 + 最近同步时间） | P1 |
| G8 | 凭证管理 | GitHub token 走宿主 `credentials` 服务（不落卡片、不进代码） | P0 |
| G9 | MR 创建（可选） | 从卡片/分支发起 MR | P2 |
| G10 | GitLab 等 provider | 数据格式与契约已支持，仅实现层扩展 | P2 |
| G11 | **MR 自动关联（[ID] 约定）** | task 带 `meta.taskId`（`<repo-name>-<int>`），MR 标题携带 `[taskId]`，sync 时自动建 refs/状态，无需手工 link（见 §5.5） | P0 |

### 5.2 Agent 工具（git 插件注册，前缀 `git_`，草案）

已实现 6 个：`git_configure`（远端 repo / 本地路径 / token）、`git_claim_task_id`（[ID] 认领）、`git_link`（带验证建 refs，G1-G4）、`git_list_mrs`（G5）、`git_sync`（G6/G11：拉取 + [ID] 自动关联 + 信封写回）、`git_status`（同步快照）。

### 5.3 服务契约（跨插件联动核心）

```ts
// kanban 宿主半提供 —— 让其他插件安全读写卡片（不直接碰 board.json）
ctx.provide('kanban', {
  getTicket(ticketId: string): Promise<Ticket | null>
  updateTicket(ticketId: string, patch: { refs?: TaskRef[]; meta?: Record<string, unknown> }): Promise<{ ok: boolean; error?: string }>
})

// git 宿主半提供 —— 数据源 + 同步能力
ctx.provide('git', {
  isConfigured(): boolean                                   // token / 仓库配置就绪？
  link(ticketId: string, spec: TaskRefInput): Promise<{ ok: boolean; error?: string }>   // G1-G4
  listMrs(ticketId: string): Promise<MrInfo[]>                // G5
  sync(ticketId: string, opts?: { force?: boolean }): Promise<{ ok: boolean; syncedAt?: string; error?: string }>  // G6 核心
  snapshot(ticketId: string): Promise<SyncSnapshot | null>    // 读回信封供 UI 展示
})
```

调用方向（满足"由 git 插件或适配层注册按钮"）：

```
kanban client UI（渲染槽位 kanban.ticket.actions / kanban.board.toolbar）
   │  git 插件注册的「同步」按钮 onClick
   ▼
git client → host.call('git/sync', { ticketId })        ← git 插件私有 RPC
   ▼
git host → ctx.get('kanban').getTicket(ticketId)          ← 跨插件服务（读 refs）
   ▼
git host → ctx.credentials 取 token → ctx.web 调 GitHub API（或 ctx.shell 跑本地 git）
   ▼
git host → ctx.get('kanban').updateTicket(ticketId, { meta: { sync: { github: 信封 } } })  ← 跨插件服务（写回）
   ▼
git client → 通知 kanban UI 刷新（经槽位 props 回调 / kanban 重新 load）
```

### 5.4 UI 联动与槽位契约（草案）

- kanban 在客户端**声明并渲染**槽位（目前 kanban 全屏页是自绘组件树，需要增加"槽位宿主"区域）：
  - `kanban.board.toolbar`：看板顶部操作区（放全局「同步全部」）
  - `kanban.ticket.actions`：卡片编辑抽屉/详情区（放单卡「同步」「刷新 MR 状态」）
- git 插件注入：`ctx.slots.inject('kanban.ticket.actions', () => ctx.slots.register({ name: 'kanban.ticket.actions', id: 'git-sync', order: 10, label: () => '同步' }, SyncButton))`
- **降级**：git 未激活时槽位无条目，kanban 不受影响；kanban 未激活时 git 插件自身仍可用（服务/工具独立）。
- 同步完成后的 UI 刷新：优先走槽位 props 回调（若动态槽位支持传递）；否则 kanban 在同步后重新 `kanban/load`（实现最简单，先做这个，M3 验证槽位 props 能力，用 `cordis_inspect_query` → `Slots.listSubTree` 确认）。
- 并发写：git 写回走 kanban 服务的 `updateTicket`（内部沿用现有 `mutateBoard` 读-改-写原子语义），两个插件不并发写文件。

### 5.5 自动关联规范（[ID] 约定）

- **Task ID**：每个 task 必须携带稳定 ID，格式 `<repo-name>-<int>`（如 `dsh-plugins-1`；repo-name = 任务所属项目仓库名，int 同 repo 内递增/时间戳，保证唯一即可）。存储于卡片 `meta.taskId`（M1 数据模型 v2 增加），由 kanban 创建时生成，或 git 插件认领时写入。
- **MR 规范**：MR 标题（或描述首行）必须携带 `[<task-id>]`，如 `[dsh-plugins-1] docs(git): 新增自动关联规范`。允许一个 MR 带多个 `[ID]`（关联多 task）。
- **自动关联**：git 插件 sync 时解析该 repo MR 列表标题/描述中的 `[...]` → 匹配卡片 `meta.taskId` → 自动写入该卡 refs（github-mr）+ `meta.sync.github.snapshot.mrs`，无需手工 link（G4 退化为可选操作）。
- **反向（未来）**：出现未匹配的合法 `[ID]` 且无对应 task 时，可自动建卡（需确认，防垃圾卡）。
- **匹配规则**：大小写不敏感；格式校验 `<repo-name>-<int>`，不合法忽略并记入同步日志。
- **实测**：2025-08 已用 `gh` 在本仓（jcc1997/dsh-plugins）创建测试 PR `[dsh-plugins-1] …`，验证标题携带 [ID] 的约定可被 gh 完整支持（`gh pr create --title '[dsh-plugins-1] …'`）；插件实现后 sync 即可按此解析。

### 5.6 里程碑

| 阶段 | 内容 | 验收 |
|---|---|---|
| M0 | 本调研与方案（本文档） | ✅ 评审通过 |
| M1 | 数据模型 v2：kanban 增加 `refs` / `meta.sync` 信封 + `kanban` 服务 + 工具 `kanban_ticket_link`/`kanban_ticket_unlink` + 卡片 refs 展示；**先做最小跨插件验证**（kanban 提供服务，探测端 ctx.get 可读到） | ✅ 完成（构建 + verify-dist 通过；跨插件服务经 cordis 全局 store 机制成立，待真实宿主激活复核） |
| M2 | git 插件骨架：`git` 服务 + G1-G5 工具 + 凭证（credentials）+ **自动关联解析（G11，[ID] 约定）** | ✅ 完成（6 工具 + 服务 + 端到端逻辑测试通过：claim/sync/自动补 ref/信封写回） |
| M3 | sync 按钮端到端（槽位契约 v1 + G6 + G7 状态展示） | 点击按钮 → 拉取 → 写回 → UI 刷新 |
| M4 | 增强：本地仓库 git 命令（ctx.shell）、MR 创建（G9）、错误/重试 UI、订阅式通知 | 按需 |

### 5.7 开发注意（踩坑预判，来自 skill 与本次调研）

- 热更新必须 **Code Mode**（`cordis_define` 产物每次全量进上下文 ≈50KB+）。
- 写代码前用 `cordis_inspect_query` 查询 `fs` / `web` / `credentials` / `shell` 的准确方法签名；沙箱内 `require`/`fetch` 被拒，HTTP 走 `ctx.web`，进程走 `ctx.shell`。
- 工具参数 schema 顶层平铺（parameters 不在 schema 内）、`output.schema` 需显式 `additionalProperties`、render 返回内容块数组（skill §2.3）。
- 动态插件导出对象而非函数；`registerTool` 放 `ctx.effect()`。
- 服务名/工具名全局唯一（`git_` / `kanban_` 前缀）；provider 服务键（`git`、`kanban`）也要短且唯一。
- **实测签名（2025-08，源码级确认）**：`credentials` = resolve/describe/set/unset，ref 就是普通字符串（`GITHUB_TOKEN` 即可，运行时仅校验 `^[A-Za-z_][A-Za-z0-9_]*$`）；`web.fetch({url})` **不能带请求头**（GitHub API 鉴权须走 bash curl，token 放 spec.env 不进命令行）；`bash.run(spec)` 的 spec 含 command/workdir/timeoutMs/stdoutMaxBytes/sandboxPolicy/env；cordis 服务是全局 store（root isolate 键），任意 fiber `ctx.get` 可见，重复 provide 抛错。

## 6. 风险与开放问题

| 项 | 说明 |
|---|---|
| 动态↔动态服务可见性未实测 | 机制层面成立（同 cordis 组合），M1 第一件事就是最小验证（kanban 服务 + git 探测） |
| `ctx.emit` 不可用 | 通知以服务返回值/订阅方法实现，不依赖事件 |
| 会话态 | git 与 kanban 均需在同一会话激活才联动；重启后重新 define/run |
| board.json 单文件并发 | 沿用 kanban 现有单写者原子语义；后续可迁移 `storage` 服务（P2+） |
| 凭证安全 | GitHub token 只进 `credentials`，不进卡片、不进 git 历史 |
| 槽位 props 能力 | 动态槽位能否收 owner props 需 `Slots.listSubTree` 确认；不行则走"同步后重新 load" |
| refs 管理权 | 倾向 kanban 管 refs 增删、git 管 sync 内容；若 git 工具直接建 refs，需同步更新 kanban 侧展示（服务 API 已覆盖） |
| taskId 分配 | int 需同 repo 唯一：本地生成或远端最大号+1；冲突时 sync 报错，不静默覆盖 |

## 7. 下一步

1. 评审本文档（重点：4.2 数据格式、5.3 服务契约、5.4 槽位契约）。
2. 通过后按 M1 → M2 → M3 实施；每个里程碑单独 commit，文档同步更新。

## 8. 动态 → 部署迁移路径（2026-08 源码级核实）

> 目的：动态插件（`cordis_define`/hot-update）是**迭代手段**，最终以**正式 bundle 插件**部署。
> 本节回答：受限来自哪、部署形态是什么、代码要改什么。来源：cordis 核心 + cordis-plugin-loader + dsh README（bundles 机制）+ dsh-cordis-*-runner（白名单）源码。

### 8.1 受限来源（重要结论）

**所有受限（ctx.emit 禁用、timer 全局禁用、ctx.tools 只读、无 import/require、harness.handle 私有）都是 `dsh-cordis-host-runner / dsh-cordis-client-runner` 给"模型挂载、随时热更新"代码套的安全边界，不是平台能力缺失。**

- Cordis 核心：`ctx.emit(...)` 完整实现（lib/index.js:280）—— emit 平台支持
- cordis-plugin-loader：无 VM、无沙箱，正常模块加载
- dsh 部署机制：profile `package.json` 的 `dsh.profile.bundles` 挂树外插件（README 明确；demo profile 曾 `link:` 本地 `dsh-plugins-hello`）—— 这就是部署路径
- 动态 runner 包描述自证："sandboxed host half" + 白名单门面（effect/on/once/provide，无 emit）

### 8.2 部署形态

1. 每个插件一个正式包（`plugins/kanban` / `plugins/git` 已具备 package.json），按 cordis 插件规范导出（host/client 两半标准入口，非 iife/受限函数体）。
2. 目标 profile 的 `package.json`：`dependencies` 加 `link:` 或 registry 引用 + `dsh.profile.bundles` 数组追加包名。
3. 启动 profile（如 web）即生效；无需 `cordis_define`，重启不丢。

### 8.3 迁移改动点（代码层面）—— 已由通信协议抹平

**2026-08 已落地 `packages/communication`（@dsh-plugins/communication）**：业务代码只依赖 `createComm({ env })`（bus 事件 + rpc + services），开发/部署两形态工厂切换，部署时仅改 env 参数。已接入：git host sync 完成 `bus.publish('git/ticket-synced')`（verify 断言）。迁移表：

| 受限项（动态） | 部署后 | 协议层处理 |
|---|---|---|
| `ctx.emit` 禁用 | ✅ 可 emit（cordis 原生） | `bus.publish/subscribe`：动态=全局服务总线 comm.bus（provide/get）；部署=ctx.emit/on |
| `setTimeout` 等无 | ✅ Node/浏览器原生 | 协议不含 timer（业务自行处理）；自动保存可恢复防抖 |
| `ctx.tools` 只读 | ✅ 可调工具 execute | 插件间协作仍走服务（`services.get`，契约不变） |
| 无 import/require | ✅ 正常模块 | 可引第三方库（axios 等替代 curl） |
| `harness.handle/host.call` 私有 RPC | ✅ 标准机制 | `rpc.call/handle`：动态=harness/host.call 封装；部署=官方通道（接入点预留，未实现前 throw） |
| `slots.register` 受限调用 | ✅ 标准注册 | UI 挂载方式不变（slots 是常规服务） |

**原则**：业务代码禁止直接 import 受限机制（harness/host.call/ctx.emit）；一律经协议。部署时仅改 `createComm` 的 env（或环境探测），业务逻辑零改动。

### 8.4 不变的部分（契约层，部署零改动）

- 数据模型 v2：refs / meta.taskId / meta.sync.<provider> 信封
- [ID] 约定（§5.5）与自动关联逻辑
- `kanban` / `git` 跨插件服务接口（getTicket/updateTicket/listTickets / isConfigured/claimTaskId/link/listMrs/sync/snapshot）
- 槽位契约（kanban.ticket.actions / conversation.view）与降级策略
- GitHub API 逻辑（curl 可保留或换 fetch/axios）

### 8.5 建议顺序

M3 验收通过 → 先按 §8.2 做**一个插件的试部署**（建议 git，依赖少）→ 验证部署形态的 emit/事件链路 → 再迁移 kanban（UI 复杂，最后做）→ 动态版本降级为"预览/调试通道"，文档标注。

### 8.6 社区已验证样板：Ericwong5021/dsh-kanban（2026-08 实读，部署化施工图）

社区插件 [dsh-kanban](https://github.com/Ericwong5021/dsh-kanban) 已按正式 bundle 形态发布（GitHub Release tarball 分发），逐项对照：

**① 包元数据（package.json）—— 我们缺失的全部在此：**
```json
{
  "name": "dsh-kanban",
  "main": "lib/index.js",
  "types": "lib/types/index.d.ts",
  "exports": { ".": {...}, "./client": {...}, "./package.json": "./package.json" },
  "files": ["lib", "cordis.patch.yml"],
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": { "inject": ["@deepseek-ai/dsh-client-runtime", "@deepseek-ai/dsh-client-ui-sidebar"], "platform": "web" }
  },
  "peerDependencies": {
    "@deepseek-ai/cordis": "^4.0.1",
    "@deepseek-ai/dsh-client-runtime": "^0.1.0-rc.5",
    "@deepseek-ai/dsh-client-ui-primitives/sidebar/slots": "^0.1.0-rc.5"
  }
}
```

**② cordis.patch.yml**：`- insert: [{ id: kanban, name: dsh-kanban }]`（行 id + 包名；loader 按包名解析模块，不写相对路径）。

**③ 双入口标准模块**（非 iife/非动态 runner 全局）：
- host：`src/index.ts` → `export function apply(ctx) {}`（标准 cordis 插件）
- client：`src/client/index.ts` → `export const inject = ['slots','sessions','workspaces']` + `export function apply(ctx: ClientContext)`，类型来自 `@deepseek-ai/dsh-client-runtime/client`；用 `ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({...}, Comp))`，register 可带 `inject: () => ownerFace` 回调（owner 接口注入，替代动态形态的 renderSlot props）

**④ 构建（tsdown，替代 esbuild iife）**：tsc 编译 → tsdown 双产物：host `lib/index.js`（esm/node）+ client `lib/client.js`（cjs/browser，banner/footer 包装成 `window.__ModuleLoader__.load({ id, factory: (require) => {...} })`——与 dsh-cordis-client-runner 的 ModuleLoader 同一机制）；CSS modules 经 lightningcss 编译 + 运行时注入 `<style data-plugin-css>`。

**⑤ 发布/安装**：`npm pack` → GitHub Release（tag `v*.*.*` 触发，release.yml 附 tgz）；用户 `dsh plugin add https://github.com/<owner>/<repo>/releases/latest/download/<pkg>-<ver>.tgz` 或 git 直装（需 `prepare` 脚本 + profile `allowBuilds`）。CI：build + `npm pack --dry-run`。

**⑥ 对我们（kanban/git）的迁移增量**：
- host 半：`harness.handle/defineTool/registerTool` 全部要换（正式形态无 harness 全局）——工具注册调研 `@deepseek-ai/dsh-tools` 或 `ctx.tools`；RPC 换 communication 包的 rpc 通道（§8.3 表）
- client 半：`host.call` 私有 RPC 换服务通道（host 半 provide + client 半 ctx 服务访问，需验证 client runtime 的服务读取）；或参考项目做法把数据落浏览器端（localStorage）——**我们的 board.json 在 host 侧，倾向保留 host 存储 + 服务通道**
- 槽位/样式：slots API 同构（动态/正式一致），CSS 需从全局 class 迁移为 CSS modules 或保留全局注入（本仓库用全局 kbnb- 前缀 class + tokens，可原样注入，不必 CSS modules）
- 工具定义（19 个）与数据层（board.ts）零改动，直接复用