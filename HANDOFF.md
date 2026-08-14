# HANDOFF — 跨会话交接状态

> 用途：动态插件是会话态，对话记忆不跨会话；**本文件 + git 历史 = 持久上下文**。
> 新会话起步：读 AGENTS.md → 加载 skill（.agents/skills/dsh-dynamic-plugin-dev/SKILL.md）→ 读本文件 → 读 plugins/git/PLAN.md。

## 当前状态（2026-08）

- **分支**：`feat/mr-autolink`（PR #1 载体，含 4 个未合并 commit：71aaef4 自动关联规范文档、b889fe8 kanban v2、5395b4a git M2、4bac7bb lock）；`main` = 9bcd7dd。合并 PR #1 后建议把实现 rebase/合回 main。
- **M1 kanban v2 完成**（构建 + verify-dist 通过）：数据模型 v2（卡片 refs / meta.taskId / meta.sync.<provider> 信封）、`kanban` 跨插件服务（getCard/updateCard/listCards）、工具 16 个（新增 kanban_link / kanban_unlink）、抽屉 refs UI。
- **M2 git 骨架完成并已在真实宿主热更新激活**：6 工具、`git` 服务、GitHub API（bash curl + credentials token → ctx.web 匿名退化）、[ID] 自动关联。**真实端到端验证通过**（2026-08-14）：git_configure（jcc1997/dsh-plugins + token）→ claim `dsh-plugins-1` → git_sync 匹配 PR #1 标题 `[dsh-plugins-1]` → 自动补 github-mr ref + 写 meta.sync.github 信封落盘。
- **M2 修复**：git_claim_task_id 在卡片未关联 repo 且未配置远端仓库时**拒绝认领**（原实现编造 `task-N` 不合规 ID，已修 + verify 断言更新）。
- **注意**：宿主进程里曾有旧会话激活的 kanban 工具注册（其他工作区会话残留）导致首次 `cordis_run` 报 `tool kanban_view is already registered`——停掉旧 Run 后重新激活即可，非源码问题。
- **未做**：M3 sync 按钮；M4 本地 git 命令/MR 创建。

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
- 动态插件限制：ctx.emit 不可用（不能发事件）、ctx.tools 只读（不能跨插件调工具 execute）、harness.handle/host.call 每插件私有、inject 需对象形式、会话态重启即失。
- 完整机制见 skill §七；设计论证见 plugins/git/PLAN.md §2/§5。

## M3 设计要点（sync 按钮）

- kanban client 声明并渲染槽位：`kanban.board.toolbar` / `kanban.card.actions`（全屏页增加槽位宿主区域）。
- git client：`ctx.slots.inject('kanban.card.actions', () => ctx.slots.register({ name, id: 'git-sync', order, label }, SyncButton))`；onClick → `host.call('git/sync', { cardId })`（git 私有 RPC，宿主半已有 syncCard）→ 写回走 `ctx.get('kanban')`。
- UI 刷新：先做"同步后 kanban 重新 kanban/load"；槽位 props 能力用 `cordis_inspect_query` Slots.listSubTree 确认后再决定是否传回调。
- MR 状态展示：卡片 refs 与 meta.sync.github.snapshot.mrs 渲染 state 徽标（open/merged/closed）+ 最近同步时间。
- 降级：git 未激活 → 槽位无条目，kanban 无感。
