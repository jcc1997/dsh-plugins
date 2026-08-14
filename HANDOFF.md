## 当前状态（v3 迭代，2026-08）

- **kanban v3（本会话已完成并热更新激活 kbnb-5/pkg-35，等待 Client 批准）**：
  - **归档**：卡片抽屉「归档」→ board.archive（隐藏移出看板）；页内左侧边栏「归档」列表（原列/归档时间）→ 恢复（回原列或第一列）/永久删除/清空归档；agent 工具 kanban_archive / kanban_unarchive / kanban_list_archived；search 支持 archived=true；getCard/服务 getCard/updateCard 覆盖归档卡
  - **页内左侧边栏**：看板 / 归档 / 设置（设置页内嵌，原 settings.section 保留）
  - **groupby**：UI 顶栏「分组」= 不分组 | Git 仓库（按 github-repo ref 分泳道，未关联归末组，组内拖拽，跨组忽略）；agent 侧 kanban_view(group_by=repo) 分组返回 + kanban_search(repo=...) 筛选
  - **布局**：页面上下撑满、列间竖线拉到底、每列独立纵向滚动、看板横向滚动（分组模式按组横向滚动）
  - **富文本 content（自研块编辑器，零依赖）**：card.content = KanbanBlock[]（text/h1/h2/h3/bullet/ordered/check/quote/code/divider/image，text 存内联 HTML）；工具栏 B/I/S/行内代码/H1-H3/列表/待办/引用/代码块/分割线/图片（粘贴或文件 → FileReader → dataURL）；标题/描述改 contentEditable（无 input 边框），描述单行纯文本无预览
  - **关键坑（本会话实测）**：① client 半闭包只遮蔽 setTimeout/setInterval/clearTimeout/clearInterval/fetch/require/process/Buffer —— document/window/FileReader 是环境全局可用（旧 skill 说"无 document/window"过时）；② cordis_define 的 code 用模板字符串时小心反引号；③ SDK 读段文件要取 r.stdout.text（不是 r.stdout），段文件末尾 \n 需先剔除再 JSON.parse；④ 动态 client 不能装开源富文本编辑器（无 import/timer），自研 contentEditable + execCommand 方案最稳；⑤ 拖拽列头在分组模式禁用（跨组无意义）
- **未做**：M4 本地 git 命令/MR 创建；正式部署（bundle 化）不变

# HANDOFF — 跨会话交接状态

> 用途：动态插件是会话态，对话记忆不跨会话；**本文件 + git 历史 = 持久上下文**。
> 新会话起步：读 AGENTS.md → 加载 skill（.agents/skills/dsh-dynamic-plugin-dev/SKILL.md）→ 读本文件 → 读 plugins/git/PLAN.md。

## 当前状态（2026-08）

- **分支**：`feat/mr-autolink` 已合并入 main（PR #1 squash，merge commit d35dafe，2026-08-14）；本地/远端该分支已删，当前在 **main**（= d35dafe）。后续开发直接基于 main 开新分支。
- **M1 kanban v2 完成**（构建 + verify-dist 通过）：数据模型 v2（卡片 refs / meta.taskId / meta.sync.<provider> 信封）、`kanban` 跨插件服务（getCard/updateCard/listCards）、工具 16 个（新增 kanban_link / kanban_unlink）、抽屉 refs UI。
- **M2 git 骨架完成并已在真实宿主热更新激活**：6 工具、`git` 服务、GitHub API（bash curl + credentials token → ctx.web 匿名退化）、[ID] 自动关联。**真实端到端验证通过**（2026-08-14）：git_configure（jcc1997/dsh-plugins + token）→ claim `dsh-plugins-1` → git_sync 匹配 PR #1 标题 `[dsh-plugins-1]` → 自动补 github-mr ref + 写 meta.sync.github 信封落盘。
- **M2 修复**：git_claim_task_id 在卡片未关联 repo 且未配置远端仓库时**拒绝认领**（原实现编造 `task-N` 不合规 ID，已修 + verify 断言更新）。
- **注意**：宿主进程里曾有旧会话激活的 kanban 工具注册（其他工作区会话残留）导致首次 `cordis_run` 报 `tool kanban_view is already registered`——停掉旧 Run 后重新激活即可，非源码问题。
- **M3 sync 按钮完成并激活验证通过**：kanban client 声明子槽位 `kanban.card.actions`（sidebar 条目 children，list/root）+ 抽屉内渲染槽位宿主；git client 向该槽位注册 `git-sync` 按钮（onClick → host.call('git/sync') → owner onSynced 回调刷新看板）；host 半暴露 `harness.handle('git/sync')`；抽屉新增 MR state 徽标（open/merged/closed）+ 同步时间（G7）。实测：`Slots.listSubTree(root=kanban.card.actions)` 显示 declaredBy kbnb-3、occupants 含 git-sync（active）。**M3 验收达成：点击按钮 → 拉取 → 写回 → UI 刷新**。
- **M3+ 抽屉 Git 卡片整合**：git 相关展示收敛为一张「Git 关联卡片」——仓库（github-repo ref）+ MR 列表（同步快照渲染 state 徽标/标题/更新时间）+ 同步状态行（lastSyncAt/error/分支）；同步按钮经槽位渲染在 Git 卡片头部。
- **M3+ 关联卡片重构**：所有关联统一「关联」卡片按类型展示 + 删除；「+ 新增」折叠表单（GitHub 仓库/分支/MR/本地仓库/会话）；jira 已移除。**会话关联**（ref kind session）：点击 → 关闭看板 + `sessions.open(id)` 定位会话（client 服务实测可用）。**会话「任务」工作台**：注册 `conversation.view`（session scope，组件收 sessionId）→ 左侧任务列表（标题/状态/更新时间，updatedAt 倒序默认选最近）+ 右侧内嵌详情（复用 CardDetail，点击切换，不再弹抽屉）。**槽位渲染授权 vs 服务通道**：`kanban.card.actions` 子槽位由 sidebar 条目声明（声明者独占 renderSlot），会话 tab 无法渲染该槽位 → 同步按钮走 `kanban/git-sync` 桥接 RPC（kanban host 内 `ctx.get('git').sync`，跨插件服务通道）。**动态 client 无 timer 全局（实测坑）**：`setTimeout` 在动态 client 半不可用（渲染 conversation.view 时直接崩溃），自动保存改为变更即存 + 卡片切换首帧跳过；需要防抖/定时应 inject timer 服务（`timer.debounce`）。