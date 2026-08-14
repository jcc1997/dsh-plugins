# dsh-plugins

为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）开发的插件集合。

当前包含三个插件：

- **看板（kanban）插件**：嵌入 DSH 侧边栏的全功能看板，提供**给 Agent 调用的 19 个工具**（数据模型 v3：卡片外部关联 refs + 跨插件 `kanban` 服务 + 归档 + 分组 + 富文本内容），让人和 AI 在同一块板上协作。
- **git 插件**：task 关联 GitHub/本地仓库/branch/MR + 7 个 `git_*` 工具 + [ID] 自动关联 + MR 同步/合并（方案见 [`plugins/git/PLAN.md`](plugins/git/PLAN.md)）。
- **pipeline 插件**（新）：类 dify 的可复用 AI 流水线——atomic 基础单元（如「转 mp3」）+ combined 组合流水线（如「bilibili 视频总结」），npm 风格 semver 版本管理（v1.0.1）、节点图编辑、运行队列与进度监控、10 个 `pipeline_*` agent 工具、跨插件 `pipeline` 服务。

> **运行形态**：三个插件均为**正式 bundle**（`dsh plugin --profile web add` 挂载，重启不丢）；动态插件通道（`cordis_define`）仅作会话内快速原型。

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

## Pipeline 插件

类似 dify 的可复用 AI 流水线。把「视频下载 → 转 mp3 → 语音转文字 → LLM 总结」这类流程拆成可复用的基本单元并组合：

- **主界面**：侧边栏入口（同看板）打开全屏面板——流水线列表 / 运行与队列 / 说明。
- **版本（npm 风格 semver）**：版本号形如 `v1.0.1`；发布后版本不可变（可作为子单元被引用）；最新版本是可编辑草稿；发布时按 patch/minor/major 升位。
- **atomic 与 combined**：atomic = 无依赖基础单元（复用单元）；combined = 引用已发布 atomic 的组合流水线（`pipeline` 节点 ref 支持 `<pipelineId>@<version>` / `@latest`）。
- **节点类型**：input / output / exec（shell 命令）/ fetch（HTTP）/ transform（JSON 转换）/ llm（大模型分析）/ pipeline（子流水线）；`{input.xxx}` / `{up.<nodeId>.<field>}` 占位符串联数据。
- **运行与队列**：运行入队串行执行，「运行与队列」视图实时轮询进度（节点级 pending/running/success/failed）。
- **面向 agent**：10 个 `pipeline_*` 工具（查/建/改/删/发布/运行/进度/队列/目录）。
- **跨插件**：`ctx.get('pipeline')` 服务 `list / get / getPublished / run（同步）/ runAsync（入队）/ status / catalog`。
- **LLM 节点（沙箱子 agent）延后实现**：引擎已留 `runLlm` 注入点，当前返回占位说明。

数据：`~/.dsh/pipeline/pipeline.json`。详见 [`plugins/pipeline/README.md`](plugins/pipeline/README.md)。

## 设计规范

插件 UI 与 DSH 宿主规范统一：直接引用宿主运行时注入的官方设计 tokens（`--dsw-*`，明暗主题自动适配），权威色板已抽取到 [`packages/ui/dsh/design-platform.css`](packages/ui/dsh/design-platform.css)，完整规范见 [`packages/ui/DESIGN.md`](packages/ui/DESIGN.md)。

## 仓库结构

```
dsh-plugins/
├── plugins/
│   ├── git/           # git 插件：git 服务 + 7 工具 + [ID] 自动关联 + MR 同步/合并，方案见 PLAN.md
│   ├── kanban/        # 看板插件：TS 源码（模块化拆分）+ 编译管线 + 19 个 agent 工具 + kanban 服务（v3：归档/分组/富文本）
│   └── pipeline/      # pipeline 插件：流水线引擎（DAG + 队列）+ 版本管理 + 10 个 agent 工具 + pipeline 跨插件服务
├── packages/
│   ├── communication/ # 通信协议层（bus/rpc/services，开发/部署双形态工厂）
│   └── ui/            # 共享包 @dsh-plugins/ui：设计 tokens + 图标 + 工具函数 + 组件
│   ├── DESIGN.md      # UI 设计规范（与 DSH 宿主统一）
│   └── dsh/design-platform.css   # DSH 官方设计 tokens（抽取自 dsh-client-ui-theme）
└── vendor/deepseek-harness/     # 官方仓库 submodule（sparse checkout：仅 client/ui-primitives 图标与组件源码，无宿主核心）
```

## 安装

### 正式 bundle（推荐，重启不丢）

三插件均为正式 bundle 形态，构建产物 `lib/`（gitignore，新克隆后需重建）：

```bash
# 重建产物并验证
cd plugins/pipeline && pnpm run check   # 或 plugins/kanban / plugins/git
# 挂载到 web profile（官方 CLI，自动应用 bundle 的 cordis.patch.yml）
dsh plugin --profile web add /path/to/dsh-plugins/plugins/pipeline
# 安装后重启 dsh 生效；重启不丢，无需 cordis_define
```

### 动态插件（会话内快速原型）

会话需为 **创造模式 + Code Mode**（工具列表含 `cordis_define` / `cordis_run` / `run_code`）。动态插件随会话存在、重启即失；完整方法见 [`.agents/skills/dsh-dynamic-plugin-dev`](.agents/skills/dsh-dynamic-plugin-dev/SKILL.md)。

## 发布

发布方式对齐 [官方 publish 教程](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.md)：

- **dist-tag**：官方与生态惯例是**默认 `latest`**（rc 版用 `--tag next`，官方 @deepseek-ai/dsh 即如此），**无自定义 tag 约定**。
- **发布**：`npm publish`（默认 latest）；或 `pnpm pack` 出 tarball 分发；git 安装需作者提供 `prepare` 构建脚本 + 用户在 profile 的 `pnpm-workspace.yaml` 配 `allowBuilds`。
- **安装**：`dsh plugin --profile <name> add <npm 包名>`（等价 pnpm add + 按 `dsh.bundle` 声明自动挂 layer）。

本仓库已配置：包名按官方示例规范 `dsh-<name>`（`dsh-kanban` / `dsh-git` / `dsh-pipeline`，官方自带 bundle 用 `@deepseek-ai/dsh-*` scope）、`files` 白名单、`publishConfig.access=public`、`keywords` 含 dsh-plugin、`npm run publish:<name>` = check + publish。

> **bundle 机制**：三插件均已在 package.json 声明 `dsh.bundle: { patch } ` + `cordis.patch.yml`，`dsh plugin add` 会自动挂载为插件层（无需手动 insert）。

## 开发

仓库是 pnpm workspace。动态插件开发（热更新迭代）的完整方法论见 [`.agents/skills/dsh-dynamic-plugin-dev`](.agents/skills/dsh-dynamic-plugin-dev/SKILL.md)，包含受限环境约束、代码模板与踩坑清单；**宿主真实源码的位置与跨插件联动机制速查见 skill 第七节**（vendor submodule 是 sparse，宿主核心在 DSH 运行时缓存里）。

## 参考

- [DSH 官方开发文档](https://github.com/deepseek-ai/deepseek-harness/tree/master/docs/user/develop)
- [官方插件教程：Your first plugin](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/index.md)