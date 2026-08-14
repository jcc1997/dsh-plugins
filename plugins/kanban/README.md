# dsh-plugins-kanban

DSH 看板插件（动态插件开发版，热更新迭代中）。

## 能力

- **UI**：侧边栏「看板」入口（全屏页）→ 竖线分割列看板、拖拽排序/跨列、新建弹窗、编辑抽屉（960px 左右分栏：左列标题/描述/评论，右列状态/标签/关联卡片/变更记录；蒙层点击自动关闭；Notion 风格大标题，自动保存）、标签 chips、列配置弹窗、当前卡高亮
- **Agent 工具**（host 注册，16 个）：卡片 `view` / `get_card` / `search` / `recent` / `create` / `move` / `update` / `tags` / `comment` / `delete` + 列 `add_column` / `rename_column` / `delete_column`（非空需 force）/ `move_column` + 关联 `link` / `unlink`；操作自动写入变更记录（`actor: "agent"`）
- **外部关联（数据模型 v2）**：卡片可关联 `github-repo` / `github-branch` / `github-mr` / `local-repo` / `jira-issue` 等引用（refs），UI 抽屉可增删，agent 经 `kanban_link` / `kanban_unlink` 编辑
- **卡片操作槽位（M3）**：sidebar 条目声明子槽位 `kanban.card.actions`（list/root），Git 关联卡片头部渲染为操作区宿主；git 插件注册「同步」按钮 → owner props（cardId + onSynced 刷新回调）→ 同步完成后看板自动重载；git 未激活时槽位无条目，看板无感
- **Git 关联卡片（M3+）**：抽屉内 git 相关整合为一张卡片——仓库（github-repo ref）、MR 列表（同步快照渲染 state 徽标 open/merged/closed + 标题 + 更新时间）、同步状态（最近同步时间 / 失败信息 / 分支）
- **关联卡片（按类型管理）**：所有关联统一在「关联」卡片按类型展示 + 删除；「+ 新增」折叠表单按类型添加（GitHub 仓库 / 分支 / MR / 本地仓库 / 会话），jira 已移除
- **会话关联**：ref kind `session`，点击跳转定位到对应会话（关闭看板）；会话「任务」tab 展示关联 task
- **会话「任务」tab（conversation.view）**：当前会话关联的 task 列表，点击打开可编辑详情（复用 CardDrawer）
- **跨插件服务**：host 提供 `ctx.provide('kanban', { getCard, updateCard, listCards })`，其他插件（如 git）经 `ctx.get('kanban')` 安全读写卡片，不直接碰 board.json
- **设置**：settings.section 配置数据目录（默认 `~/.dsh/kanban/board.json`，可指向 git 仓库）

## 目录

```
plugins/kanban/
├── build.mjs               # esbuild：TS/TSX → dist/client.js + dist/host.js（受限环境函数体）+ dist/submit.json
├── shims/                  # react / jsx-runtime shim（alias 到自由变量 React）
├── src/client/             # TSX 多文件：entry / page / drawer / create / columns / settings / styles
├── src/host/entry.ts       # RPC（kanban/load、save、set-data-dir）+ kanban 跨插件服务 + 16 个动态模型工具
├── scripts/verify-dist.mjs # vm 模拟受限环境验证产物（含工具注册断言）
└── dist/                   # 构建产物（gitignore）
```

## 开发

```bash
node build.mjs                 # 构建
node build.mjs --watch         # 监听
node scripts/verify-dist.mjs   # 验证
```

热更新：Code Mode 会话内 SDK 零粘贴（切块读入 submit.json → cordis_define → cordis_run update），详见根目录 skill。

## 数据模型

```json
{ "version": 1, "columns": [{ "id", "title", "cards": [{
    "id", "title", "description", "tags": ["..."],
    "comments": [{ "id", "text", "createdAt" }],
    "activity": [{ "id", "text", "at", "actor" }],   // actor: "手动调整" | "agent"
    "links": [], "createdAt", "updatedAt",
    "refs": [{ "id", "kind", "platform", "externalId", "url?", "display?", "meta?", "createdAt" }],  // v2 外部关联
    "meta": {                                          // v2
      "taskId": "dsh-plugins-1",                       // [ID] 自动关联锚点（git 插件认领）
      "sync": { "github": { "version", "lastSyncAt", "error", "snapshot" } }  // 各 provider 同步信封（provider 自管 payload）
    }
}], "meta": {} }], "meta": {} }
```

## 已知问题

1. 刷新页面后 Client 半不会自动恢复（官方设计）——在 Run 卡片手动重新激活
2. 重启 dsh 进程后动态插件丢失——`kind: new` 重新定义，源码以本目录为准