# HANDOFF — 跨会话交接状态

> 用途：动态插件是会话态，对话记忆不跨会话；**本文件 + git 历史 = 持久上下文**。
> 新会话起步：读 AGENTS.md → 加载 skill（.agents/skills/dsh-dynamic-plugin-dev/SKILL.md）→ 读本文件 → 读 plugins/git/PLAN.md。

## 当前状态（2026-08）

- **分支**：`feat/mr-autolink`（PR #1 载体，含 4 个未合并 commit：71aaef4 自动关联规范文档、b889fe8 kanban v2、5395b4a git M2、4bac7bb lock）；`main` = 9bcd7dd。合并 PR #1 后建议把实现 rebase/合回 main。
- **M1 kanban v2 完成**（构建 + verify-dist 通过）：数据模型 v2（卡片 refs / meta.taskId / meta.sync.<provider> 信封）、`kanban` 跨插件服务（getCard/updateCard/listCards）、工具 16 个（新增 kanban_link / kanban_unlink）、抽屉 refs UI。
- **M2 git 骨架完成并已在真实宿主热更新激活**：6 工具、`git` 服务、GitHub API（bash curl + credentials token → ctx.web 匿名退化）、[ID] 自动关联。**真实端到端验证通过**（2026-08-14）：git_configure（jcc1997/dsh-plugins + token）→ claim `dsh-plugins-1` → git_sync 匹配 PR #1 标题 `[dsh-plugins-1]` → 自动补 github-mr ref + 写 meta.sync.github 信封落盘。
- **M2 修复**：git_claim_task_id 在卡片未关联 repo 且未配置远端仓库时**拒绝认领**（原实现编造 `task-N` 不合规 ID，已修 + verify 断言更新）。
- **注意**：宿主进程里曾有旧会话激活的 kanban 工具注册（其他工作区会话残留）导致首次 `cordis_run` 报 `tool kanban_view is already registered`——停掉旧 Run 后重新激活即可，非源码问题。
- **M3 sync 按钮完成并激活验证通过**：kanban client 声明子槽位 `kanban.card.actions`（sidebar 条目 children，list/root）+ 抽屉内渲染槽位宿主；git client 向该槽位注册 `git-sync` 按钮（onClick → host.call('git/sync') → owner onSynced 回调刷新看板）；host 半暴露 `harness.handle('git/sync')`；抽屉新增 MR state 徽标（open/merged/closed）+ 同步时间（G7）。实测：`Slots.listSubTree(root=kanban.card.actions)` 显示 declaredBy kbnb-3、occupants 含 git-sync（active）。**M3 验收达成：点击按钮 → 拉取 → 写回 → UI 刷新**。
- **M3+ 抽屉 Git 卡片整合**：git 相关展示收敛为一张「Git 关联卡片」——仓库（github-repo ref）+ MR 列表（同步快照渲染 state 徽标/标题/更新时间）+ 同步状态行（lastSyncAt/error/分支）；同步按钮经槽位渲染在 Git 卡片头部。
- **M3+ 关联卡片重构**：所有关联统一「关联」卡片按类型展示 + 删除；「+ 新增」折叠表单（GitHub 仓库/分支/MR/本地仓库/会话）；jira 已移除。**会话关联**（ref kind session）：点击 → 关闭看板 + `sessions.open(id)` 定位会话（client 服务实测可用）。**会话「任务」工作台**：注册 `conversation.view`（session scope，组件收 sessionId）→ 左侧任务列表（标题/状态/更新时间，updatedAt 倒序默认选最近）+ 右侧内嵌详情（复用 CardDetail，点击切换，不再弹抽屉）。**槽位渲染授权 vs 服务通道**：`kanban.card.actions` 子槽位由 sidebar 条目声明（声明者独占 renderSlot），会话 tab 无法渲染该槽位 → 同步按钮走 `kanban/git-sync` 桥接 RPC（kanban host 内 `ctx.get('git').sync`，跨插件服务通道）。**动态 client 无 timer 全局（实测坑）**：`setTimeout` 在动态 client 半不可用（渲染 conversation.view 时直接崩溃），自动保存改为变更即存 + 卡片切换首帧跳过；需要防抖/定时应 inject timer 服务（`timer.debounce`）。
- **未做**：M4 本地 git 命令（ctx.shell）/MR 创建（G9）；**正式部署（bundle 化）**——详见 plugins/git/PLAN.md §8「动态 → 部署迁移路径」（源码级核实：所有受限来自动态 runner 安全边界，部署后 ctx.emit/timer/import 全部解开；契约层零改动）。

## 新会话起步清单（创造模式 + Code Mode）

1. 确认会话工具列表含 `cordis_define` / `cordis_run` / `cordis_inspect_*`（创造模式）与 `run_code`（Code Mode）。
2. `git fetch && git checkout feat/mr-autolink`（或先合并 PR #1）。
3. `pnpm install`（新依赖时）。
4. **重建产物**（dist 是 gitignore，新会话必须重建）：
   - `cd plugins/kanban && node build.mjs && node scripts/verify-dist.mjs`
   - `cd plugins/git && node build.mjs && node scripts/verify-dist.mjs`
5. 热更新（skill §五 SDK 零粘贴）：kanban 与 git 均 `cordis_define`（kind: new）→ `cordis_run` → `cordis_inspect_self` 确认 currentPackageId。
   - **若报 `tool kanban_view is already registered`**：宿主进程内残留了其他会话/工作区激活的同名工具，先停掉旧 Run（UI 手动或 cordis_stop），再重新 run；不是源码问题。
6. 激活验证：kanban 开板正常 → git 对真实卡片跑 `git_claim_task_id`（先 `git_configure` 配 repo + token，否则拒绝）→ `git_sync` → 检查卡片 refs 自动出现 github-mr、meta.sync.github 信封落盘。
7. 若签名偏差：`cordis_inspect_query` → Service.listService / Event.listEvents / Slots.listSubTree 实测修正。

## 宿主签名速查（源码级实测，别重复调研）

- `credentials`：resolve(ref)/describe(ref)/set(ref,value)/unset(ref)；ref 就是普通字符串（`GITHUB_TOKEN`，运行时仅校验 `^[A-Za-z_][A-Za-z0-9_]*$`）。
- `web.fetch({url})` **不能带请求头**（只读抓取缝隙）→ GitHub API 鉴权走 bash curl，token 放 spec.env 不进命令行。
- `bash.run(spec)`：{ command, workdir, timeoutMs, stdoutMaxBytes, sandboxPolicy?, env? } → { exitCode, stdout: { text } }。
- cordis 服务是**全局 store**（root isolate 键）：任意动态插件 ctx.get 可见、重复 provide 抛错、停用自动失效。
- **事件白名单（源码级实测 2026-08，host/client 两半同款）**：`effect / on / once / provide` + timer（timeout/interval/setTimeout/setInterval/throttle/debounce）。`ctx.on/once` 可监听宿主事件（50 个：credentials/updated、tools/change、session/*、slots/changed…）；**`ctx.emit` 不在白名单——动态插件不能发事件**，跨插件通知只能走服务/私有 RPC/回调（PLAN §2.3 结论，2026-08 复确认，勿再尝试突破）。
- 动态插件限制：ctx.tools 只读（不能跨插件调工具 execute）、harness.handle/host.call 每插件私有、inject 需对象形式、会话态重启即失。
- 完整机制见 skill §七；设计论证见 plugins/git/PLAN.md §2/§5；部署迁移路径见 PLAN §8。

## 部署形态速查（源码级，2026-08）

- **受限是动态插件专属**：`ctx.emit` 禁用 / timer 全局禁用 / 无 import / ctx.tools 只读 / harness RPC 私有 —— 全部来自 `dsh-cordis-*-runner` 的沙箱白名单（防热更新代码绕过守卫链），**不是平台不支持**（cordis 核心 lib/index.js:280 有完整 emit；loader 无沙箱）。
- **部署路径**：目标 profile 的 package.json → `dependencies`（`link:` 本地或 registry）+ `dsh.profile.bundles` 追加包名 → 启动即生效，重启不丢。先例：demo profile 曾挂 `dsh-plugins-hello`。
- **通信协议已落地（2026-08）**：`packages/communication`（@dsh-plugins/communication）—— `createComm({ env })` 工厂（bus 事件 + rpc + services），开发（动态受限：bus=全局服务 comm.bus / rpc=harness+host.call）与部署（bus=ctx.emit/on / rpc=官方通道预留）两形态统一；业务代码禁止直接 import harness/host.call/ctx.emit。已接入 git host（sync 完成 publish `git/card-synced`，verify 断言）。部署时仅改 env 参数，业务逻辑零改动。
- **迁移改动**：恢复 timer/import；**契约层（数据模型/服务接口/槽位/[ID]）零改动**。建议顺序：先部署 git（依赖少）→ 再 kanban（UI 复杂）。

## M3 实现要点（已完成，2026-08-14 实测）

- kanban client 在 sidebar.footer.action 条目 register 时传 `children: { 'kanban.card.actions': { kind: 'list', scope: 'root' } }` 声明子槽位；组件 props 收到 `renderSlot`（声明即渲染授权，plain-JS 无类型检查），经 KanbanPage 透传到抽屉，以 `renderSlot('kanban.card.actions', { cardId, onSynced }, {})` 渲染。
- git client：`slots.inject('kanban.card.actions', () => slots.register({ name, id: 'git-sync', order: 10, label: () => '同步' }, SyncButton))`；onClick → `host.call('git/sync', { cardId })`（host 半 `harness.handle('git/sync')` → syncCard）→ 成功调 owner `onSynced` → kanban 重新 kanban/load。
- 槽位 props 能力**已实测可用**（owner props 任意对象透传，含函数回调）；`cordis_inspect_query` → Slots.listSubTree(root=槽位) 可查 declaredBy + occupants（含 registrant/id/order/priority/active）。
- MR 状态展示：抽屉渲染 github-mr refs 的 state 徽标 + meta.sync.github 最近同步时间/错误（G7）。
- 降级：git 未激活 → 槽位无条目，kanban 无感（inject 在声明存在时同步执行，kanban 先激活则直接注册；反之 git 先激活则等待声明出现）。
- 坑：切块读 submit.json 前必须 `mkdir -p` 段目录，否则段文件缺失 → define 传空代码 → `Host half returned undefined`。
