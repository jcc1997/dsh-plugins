# dsh-kanban

DSH 看板插件（正式 bundle 形态）：嵌入侧边栏的全功能看板，27 个 agent 工具，人和 AI 在同一块板上协作。

## 能力

- **看板**：竖线分隔列、拖拽排序与跨列移动、分组（按 git 仓库）、归档/恢复、富文本内容（Notion 式块编辑器）、标签、评论、变更记录。
- **外部关联（refs）**：github-repo / github-branch / github-mr / local-repo / session 等；git 插件经子槽位 kanban.card.actions 注入同步按钮。
- **门禁（v4）**：卡片可挂行为门禁——move（移动状态）/ tags（增减标签）/ archive（归档）触发时检查，不通过则拒绝动作。
  - 条件类型：mr-merged（关联 MR 必须已合并，读 github-repo/github-mr 关联 + GitHub API）、tag-required（必须含指定标签）、field-nonempty（字段非空）。
  - 门禁来源：挂在卡片上，或由创建模板带入。典型用法：「对应 MR 必须是 merge 状态才能进入归档」= archive 门禁 mr-merged。
  - agent 侧工具 kanban_gate_add / kanban_gate_remove / kanban_gate_list / kanban_gate_check；UI 侧卡片抽屉「门禁」区块增删；动作前 UI 调 /kanban-api/gate-check 预检，拒绝时红条提示。
- **创建模板（v4）**：预设 description / tags / content / gates，新建卡片时引用免重复输入。agent（kanban_create(template=) 或 kanban_template_* 工具）与手动创建（创建弹窗模板下拉 + 预填）均可用。
- **Agent 工具（27 个）**：kanban_*——查（view/get_card/search/recent）/ 操作（create/move/update/tags/comment/delete）/ 归档（archive/unarchive/list_archived）/ 列（add/rename/delete/move_column）/ 关联（link/unlink）/ 门禁（gate_add/gate_remove/gate_list/gate_check）/ 模板（template_list/create/update/delete）。
- **跨插件服务**：ctx.provide('kanban')（getCard/updateCard/listCards）。

## 数据

- 目录：~/.dsh/kanban/board.json + config.json(dataDir)
- board v4：columns + archive + templates（创建模板）+ 卡片含 gates[]（门禁）

## 开发

```bash
pnpm --filter dsh-kanban check   # typecheck + build + verify（27 工具 / 5 路由断言）
node scripts/smoke-gate.mjs      # 门禁/模板端到端冒烟
node build.mjs --watch           # HMR 开发
```
