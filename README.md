# dsh-plugins

为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）开发的插件集合。

当前包含 **看板（kanban）插件**：一个嵌入 DSH 侧边栏的全功能看板，同时提供**给 Agent 调用的 19 个工具**（数据模型 v3：卡片外部关联 refs + 跨插件 `kanban` 服务 + 归档 + 分组 + 富文本内容），让人和 AI 在同一块板上协作。**git 插件**（task 关联 GitHub/本地仓库/branch/MR + 7 个 `git_*` 工具 + [ID] 自动关联 + MR 同步/合并，M3 已完成并真实端到端验证，方案见 [`plugins/git/PLAN.md`](plugins/git/PLAN.md)）。

> **运行形态**：两个插件当前均为**动态插件**（会话内 `cordis_define` 热更新加载，重启即失，需重新激活）。**正式部署（bundle 化）尚未执行**——迁移路径与前置改造见 [git PLAN §8](plugins/git/PLAN.md)（部署形态、通信协议层 `packages/communication`、建议顺序：先 git 后 kanban）。

## 看板插件

### 界面能力

- **看板**：竖线分隔列（拉到底）、每列独立纵向滚动、整体横向滚动、拖拽排序与跨列移动、当前卡高亮、空状态引导
- **分组（groupby）**：顶栏切换「不分组 / Git 仓库」——按 github-repo 关联分泳道，未关联归「未关联」组（agent 侧 `kanban_view(group_by=repo)` / `kanban_search(repo=)` 同步支持）
- **侧边栏**：看板页内左侧边栏（看板 / 归档 / 设置）
- **归档**：卡片抽屉「归档」移出看板，侧边栏「归档」可恢复（回原列）或永久删除；agent 工具 `kanban_archive` / `kanban_unarchive` / `kanban_list_archived`、`kanban_search(archived=true)`
- **卡片**：新建弹窗、编辑抽屉（980px，自动保存）、标签、评论、一句话纯文本描述（无预览）+ **富文本内容**（自研 Notion 式块编辑器：标题/列表/待办/引用/代码块/分割线/图片粘贴上传）
- **变更记录**：创建 / 更新 / 状态变更 / 标签 / 评论 / 归档 / 恢复全量留痕，含时间与操作者（`手动调整` / `agent`）
- **设置**：数据目录可配置（默认 `~/.dsh/kanban/board.json`，可指向 git 仓库随版本同步）

### Agent 工具

插件向模型注册 19 个工具，Agent 可以直接读写看板：

**查询**
| 工具 | 说明 |
|---|---|
| `kanban_view` | 看板全览：所有列 + 卡片概要 |
| `kanban_get_card` | 单卡完整详情（含评论、变更记录） |
| `kanban_search` | 条件查询：关键词 + 状态（列名/ID）+ 标签 + repo（github 仓库筛选）+ archived（归档查询） |
| `kanban_recent` | 最近改动（按更新时间倒序） |

**操作**
| 工具 | 说明 |
|---|---|
| `kanban_create` | 新建卡片（可指定状态 / 描述 / 标签） |
| `kanban_move` | 移动状态 |
| `kanban_update` | 更新标题 / 描述 / 富文本内容（content 块数组或字符串） |
| `kanban_tags` | 增减标签 |
| `kanban_comment` | 添加评论 |
| `kanban_delete` | 删除卡片（归档卡片也可删） |
| `kanban_archive` | 归档卡片（移出看板，可在侧边栏归档找回） |
| `kanban_unarchive` | 恢复归档卡片（回原列或指定列） |
| `kanban_list_archived` | 列出归档卡片（含原列与归档时间） |

**列管理**
| 工具 | 说明 |
|---|---|
| `kanban_add_column` | 新建列（可指定插入位置） |
| `kanban_rename_column` | 重命名列 |
| `kanban_delete_column` | 删除列（非空默认拒绝，`force: true` 级联删除卡片） |
| `kanban_move_column` | 调整列顺序（按目标位置） |

所有 Agent 操作自动写入变更记录（`actor: "agent"`），与 UI 手动操作（`actor: "手动调整"`）同源可追溯。

## 设计规范

插件 UI 与 DSH 宿主规范统一：直接引用宿主运行时注入的官方设计 tokens（`--dsw-*`，明暗主题自动适配），权威色板已抽取到 [`packages/ui/dsh/design-platform.css`](packages/ui/dsh/design-platform.css)，完整规范见 [`packages/ui/DESIGN.md`](packages/ui/DESIGN.md)。

## 仓库结构

```
dsh-plugins/
├── plugins/
│   ├── git/           # git 插件（M3 完成）：git 服务 + 7 工具 + [ID] 自动关联 + MR 同步/合并，方案见 PLAN.md
│   └── kanban/        # 看板插件：TS 源码 + 编译管线 + 19 个 agent 工具 + kanban 服务（v3：归档/分组/富文本）
├── packages/ui/       # 共享包 @dsh-plugins/ui：设计 tokens + 图标 + 工具函数 + 组件
│   ├── DESIGN.md      # UI 设计规范（与 DSH 宿主统一）
│   └── dsh/design-platform.css   # DSH 官方设计 tokens（抽取自 dsh-client-ui-theme）
└── vendor/deepseek-harness/     # 官方仓库 submodule（sparse checkout：仅 client/ui-primitives 图标与组件源码，无宿主核心）
```

## 安装

**动态插件**（`plugins/kanban`）：在会话内通过 `cordis_define` 即时加载，随会话存在；源码与构建管线见 [`plugins/kanban/README.md`](plugins/kanban/README.md)。

**发布版 bundle**：官方规范见 [DSH 插件教程](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/index.md)，安装方式 `dsh plugin --profile web add <插件目录或 npm 包名>`，安装后重启 dsh 生效。**本仓库插件尚未走此路径**——部署形态、通信协议层与迁移顺序见 [git PLAN §8](plugins/git/PLAN.md)。

## 开发

仓库是 pnpm workspace。动态插件开发（热更新迭代）的完整方法论见 [`.agents/skills/dsh-dynamic-plugin-dev`](.agents/skills/dsh-dynamic-plugin-dev/SKILL.md)，包含受限环境约束、代码模板与踩坑清单；**宿主真实源码的位置与跨插件联动机制速查见 skill 第七节**（vendor submodule 是 sparse，宿主核心在 DSH 运行时缓存里）。

## 参考

- [DSH 官方开发文档](https://github.com/deepseek-ai/deepseek-harness/tree/master/docs/user/develop)
- [官方插件教程：Your first plugin](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/index.md)