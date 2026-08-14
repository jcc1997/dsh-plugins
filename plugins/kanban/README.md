# dsh-plugins-kanban

DSH 看板插件（动态插件开发版，热更新迭代中）。

## 能力

- **UI（v3）**：侧边栏「看板」入口（全屏页）→ 页内左侧边栏（**看板 / 归档 / 设置**）+ 主区
  - **布局**：页面上下撑满；列间竖线拉到底；**每列独立纵向滚动**；看板整体横向滚动（分组模式按组横向滚动）
  - **分组（groupby）**：顶栏「分组」切换 `不分组 / Git 仓库`——按 github-repo 关联分泳道，未关联卡片归「未关联」组；分组内拖拽排序/跨列，跨组拖拽忽略
  - **归档**：卡片抽屉「归档」→ 移出看板隐藏；侧边栏「归档」列出（原列 + 归档时间），可**恢复**（回原列，原列已删回第一列）或**永久删除**；「清空归档」一键清理
  - **卡片展示**：title + description（一句话纯文本，单行省略，无预览）+ 标签；新增 `content` 富文本概念
  - **富文本内容（自研 Notion 式块编辑器，零外部依赖）**：块模型 text/h1/h2/h3/bullet/ordered/check/quote/code/divider/image；内联加粗/斜体/删除线/行内代码（execCommand）；**图片支持粘贴与文件选择**（FileReader → dataURL）；标题/描述均 contentEditable（无 input 边框）
  - 其余：拖拽排序/跨列、新建弹窗（contentEditable + 富文本）、编辑抽屉（980px 左右分栏）、标签 chips、列配置弹窗、蒙层点击自动关闭、自动保存、当前卡高亮
- **Agent 工具**（host 注册，19 个）：卡片 `view`（支持 group_by=repo）/ `get_card` / `search`（支持 repo、archived 筛选）/ `recent` / `create` / `move` / `update`（支持 content）/ `tags` / `comment` / **`archive` / `unarchive` / `list_archived`** / `delete` + 列 `add_column` / `rename_column` / `delete_column`（非空需 force）/ `move_column` + 关联 `link` / `unlink`；操作自动写入变更记录（`actor: "agent"`）
- **外部关联（数据模型 v2）**：卡片可关联 `github-repo` / `github-branch` / `github-mr` / `local-repo` / `jira-issue` 等引用（refs），UI 抽屉可增删，agent 经 `kanban_link` / `kanban_unlink` 编辑
- **卡片操作槽位（M3）**：sidebar 条目声明子槽位 `kanban.card.actions`（list/root），Git 关联卡片头部渲染为操作区宿主；git 插件注册「同步」按钮 → owner props（cardId + onSynced 刷新回调）→ 同步完成后看板自动重载；git 未激活时槽位无条目，看板无感
- **Git 关联卡片（M3+）**：抽屉内 git 相关整合为一张卡片——仓库（github-repo ref）、MR 列表（同步快照渲染 state 徽标 open/merged/closed + 标题 + 更新时间）、同步状态（最近同步时间 / 失败信息 / 分支）
- **关联卡片（按类型管理）**：所有关联统一在「关联」卡片按类型展示 + 删除；「+ 新增」折叠表单按类型添加（GitHub 仓库 / 分支 / MR / 本地仓库 / 会话），jira 已移除
- **会话关联**：ref kind `session`，点击跳转定位到对应会话（关闭看板）；会话「任务」tab 展示关联 task
- **会话「任务」工作台（conversation.view）**：左侧任务列表（标题/状态/更新时间，按 updatedAt 倒序，默认选中最近一个），右侧直接内嵌详情（复用 CardDetail，无抽屉外壳；点击左侧切换）；详情内同步按钮走 `kanban/git-sync` 桥接 RPC（槽位渲染授权仅限看板侧条目，会话 tab 用跨插件服务通道替代）
- **自动保存**：内容变更立即提交（动态 client 半无 `setTimeout` 全局，不能做防抖；切换卡片时首帧跳过避免误写）
- **跨插件服务**：host 提供 `ctx.provide('kanban', { getCard, updateCard, listCards })`（getCard/updateCard 已覆盖归档卡片；listCards 带 archived 标记），其他插件（如 git）经 `ctx.get('kanban')` 安全读写卡片，不直接碰 board.json
- **设置**：页内侧边栏「设置」（原 settings.section 保留）配置数据目录（默认 `~/.dsh/kanban/board.json`，可指向 git 仓库）

## 目录

```
plugins/kanban/
├── build.mjs               # esbuild：TS/TSX → dist/client.js + dist/host.js（受限环境函数体）+ dist/submit.json
├── shims/                  # react / jsx-runtime shim（alias 到自由变量 React）
├── src/client/             # TSX 多文件：entry / page / drawer / create / columns / settings / rich-text / board-hook / styles
├── src/host/entry.ts       # RPC（kanban/load、save、set-data-dir、git-sync）+ kanban 跨插件服务 + 19 个动态模型工具
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

## 部署（当前未执行）

- **当前运行形态**：动态插件（会话内 `cordis_define` 加载，重启即失）。正式 bundle 部署**尚未执行**。
- 部署路径（源码级核实）：插件按 cordis 规范导出 → 目标 profile 的 `package.json` 的 `dependencies`（`link:` 或 registry）+ `dsh.profile.bundles` 追加包名 → 重启生效。详见 [git PLAN §8](plugins/git/PLAN.md)（受限来源、通信协议层 `packages/communication`、迁移表、建议顺序：先 git 试部署 → 再 kanban）。

## 数据模型

```json
{ "version": 2, "columns": [{ "id", "title", "cards": [{
    "id", "title", "description", "content": [{ "id", "type", "text?", "url?", "checked?" }],  // v3 富文本块（type: text|h1|h2|h3|bullet|ordered|check|quote|code|divider|image）
    "tags": ["..."],
    "comments": [{ "id", "text", "createdAt" }],
    "activity": [{ "id", "text", "at", "actor" }],   // actor: "手动调整" | "agent"
    "links": [], "createdAt", "updatedAt",
    "refs": [{ "id", "kind", "platform", "externalId", "url?", "display?", "meta?", "createdAt" }],  // v2 外部关联
    "meta": {                                          // v2
      "taskId": "dsh-plugins-1",                       // [ID] 自动关联锚点（git 插件认领）
      "sync": { "github": { "version", "lastSyncAt", "error", "snapshot" } }  // 各 provider 同步信封（provider 自管 payload）
    }
}], "meta": {} }],
"archive": [{                                            // v3 归档（隐藏卡片，可恢复）
    "id", "title", "description", "content", "refs", "meta", "tags", "comments", "activity",
    "archivedFrom": "原列 id", "archivedAt": "ISO"
}], "meta": {} }
```

## 已知问题

1. 刷新页面后 Client 半不会自动恢复（官方设计）——在 Run 卡片手动重新激活
2. 重启 dsh 进程后动态插件丢失——`kind: new` 重新定义，源码以本目录为准
3. 富文本图片以 dataURL 内联存于 board.json（本地看板语义，注意文件体积）
4. 动态 client 无法引入开源富文本编辑器（无 import/require、无 timer 全局），v3 自研轻量块编辑器（contentEditable + execCommand + FileReader）