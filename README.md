# dsh-plugins

为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)(DSH)开发的插件集合：看板 + 门禁工作流、git 集成、AI 流水线、markdown 文档审阅。所有插件均为**正式 bundle** 形态，安装后重启生效、重启不丢。

## 快速开始

如果你已经装好 DSH，只需要把本仓库路径告诉 DSH 会话里的 agent：

> 按 README 安装 dsh-plugins，并导入 workflow-template 作为我的开发工作流。

agent 会完成：**构建插件 → 挂载到 web profile → 配置 git/pipeline → 导入看板配置 → 提示重启**。你不需要手动敲安装命令。

> 想自己手动装？见文末 [手动安装（给 agent / 开发者）](#手动安装给-agent--开发者)。

## 功能

下面按插件分别介绍。每个插件都有独立的 [plugins/](plugins/) README，包含完整工具契约、数据模型和限制。

### 1. kanban：看板 + 门禁工作流

**解决什么问题**：人和 AI 在同一块看板上协作，并且用「门禁」强制流程不被跳过。

**核心能力**：

- 全功能看板：列管理、拖拽移动、归档/恢复、分组、标签、评论、富文本内容、变更记录。
- 31 个 `kanban_*` agent 工具：建卡、移动、评论、关联、配置导入导出等。
- 行为门禁（Gate）：移动、打标签、归档时触发检查，不通过就拒绝动作。
- 门禁库是独立实体：可被多张卡/多个模板复用，支持内置条件、沙箱代码、pipeline 三类检查器。
- 创建模板：预设 description / tags / content / 门禁，新建卡片时一键带入。
- 配置导入导出：`kanban_export_config` / `kanban_import_config`，可分享整套流程。

**入口**：侧边栏「看板」；数据落在 `~/.dsh/kanban/`。

详细文档：[plugins/kanban/README.md](plugins/kanban/README.md)

### 2. git：GitHub / 分支 / MR 集成

**解决什么问题**：让卡片和真实仓库绑定，自动建 workflow 分支、提 MR、同步状态、合并收尾。

**核心能力**：

- `git_configure`：配置 GitHub 仓库、本地仓库路径、GitHub token。
- `[ID]` 约定：卡片自动认领 `<repo>-<int>` taskId，MR 标题带 `[taskId]` 自动关联。
- `git_create_branch`：从主分支切出 `workflow/<taskId>` 并推送。
- `git_create_mr` / `git_list_mrs` / `git_sync` / `git_merge_pr`：MR 全生命周期管理。
- 与 kanban 门禁联动：`branch-linked`、`mr-linked`、`mr-merged` 依赖 git 插件。

**入口**：agent 工具 `git_*`；数据落在 `~/.dsh/git/`。

详细文档：[plugins/git/README.md](plugins/git/README.md)

### 3. pipeline：可复用 AI 流水线

**解决什么问题**：把「转 mp3、转文字、跑测试」这类原子能力组装成可复用的自动化流水线，并让门禁现场跑流水线做检查。

**核心能力**：

- atomic 基础单元 + combined 组合流水线，类似 dify 的节点图编辑。
- npm 风格 semver 版本管理：发布后不可变，可被其他流水线引用。
- 节点类型：input / output / exec / fetch / transform / llm / pipeline。
- 运行队列与进度：对话流 dock 常驻显示，支持查看每个节点状态和输出。
- 11 个 `pipeline_*` agent 工具：管理、发布、运行、查进度、导入配置等。
- 可被 kanban 门禁调用：`pipeline` 检查器现场跑流水线并等全部成功。

**入口**：侧边栏「Pipeline」；数据落在 `~/.dsh/pipeline/`。

详细文档：[plugins/pipeline/README.md](plugins/pipeline/README.md)

### 4. markdown-review：对话流文档审阅

**解决什么问题**：在需要人工审批的节点，把本地 markdown 文档直接打开在对话流里，让人划词批注 + 总评，提交后 agent 自动继续。

**核心能力**：

- `md_doc_open` 在消息流打开本地 md 大浮窗，支持 mermaid 渲染。
- 划词批注：批注框嵌在对应段落下方，提交时带行号范围给 agent 定位。
- 总评 + 引用清单：可编辑、删除、点击定位原文。
- 提交即回传：工具结果直接成为 agent 的输入，继续后续流程。

**入口**：agent 工具 `md_doc_open`；数据落在 `~/.dsh/markdown-review/`。

详细文档：[plugins/markdown-review/README.md](plugins/markdown-review/README.md)

### 5. workflow-template：开箱即用的研发流程

**解决什么问题**：不用从零搭流程，直接导入一份完整的「10 列看板 + 门禁 + 创建模板 + agent 预设」研发工作流。

**核心能力**：

- 10 列流程：`Backlog → RD → TD → UC → In Dev → 1st Review → Testing → 2nd review → Stage → Done`。
- 11 条门禁 + 2 个创建模板（`workflow` / `bug`），把「分支已建、文档已确认、MR 已合并」固化成规则。
- 一份 `workflow.json` 即可导入/导出/分享/自定义。
- 配套 `pipelines.json`：导入后可直接用真实 AI 评审 pipeline 做 Testing 门禁。

**入口**：把 `workflow-template/workflow.json` 交给 agent 用 `kanban_import_config` 导入。

详细文档：[workflow-template/README.md](workflow-template/README.md)

## 这套插件组合起来

这些插件 + workflow-template 组合成一套**带门禁的开发工作流**：

```
Backlog → RD → TD → UC → In Dev → 1st Review → Testing → 2nd review → Stage → Done
```

- 进 RD 前自动建 `workflow/<taskId>` 分支；
- RD/TD/UC/两轮 review 都通过 `md_doc_open` 打开文档给人确认；
- 进 Testing 可触发 pipeline 做真实检查；
- 到 Stage 后用 `git_merge_pr` 合并 MR，卡片自动进 Done。

## 安装

### 一句话安装（推荐，给人看）

> 把本仓库路径发给 DSH 会话里的 agent，说：
> 「按 README 安装 dsh-plugins，并导入 workflow-template 作为我的开发工作流。」

agent 会帮你完成构建、安装、配置和导入；你只需要在需要时提供 GitHub token / 本地仓库路径等信息。

### 安装后你会得到

- 侧边栏出现「看板」「Pipeline」入口；
- agent 可用 `kanban_*`、`git_*`、`pipeline_*`、`md_doc_open` 工具；
- 看板里有一套 10 列 + 门禁 + 模板的研发流程，可以直接开始用。

### 手动安装（给 agent / 开发者）

> 说明：插件包入口指向 `lib/`，而 `lib/` 是构建产物（gitignore），所以手动安装时**必须先构建、再 `dsh plugin add`**。agent 安装时会自动按这个顺序执行。

前置：已安装 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)(DSH)，并在仓库根目录执行过 `pnpm install`。

```bash
# 1. 构建产物（装哪个插件就构建哪个）
cd plugins/kanban && pnpm run check
cd ../git && pnpm run check
cd ../pipeline && pnpm run check
cd ../markdown-review && pnpm run check

# 2. 挂载到 web profile（官方 CLI，自动应用 bundle 的 cordis.patch.yml）
dsh plugin --profile web add /path/to/dsh-plugins/plugins/kanban
dsh plugin --profile web add /path/to/dsh-plugins/plugins/git
dsh plugin --profile web add /path/to/dsh-plugins/plugins/pipeline
dsh plugin --profile web add /path/to/dsh-plugins/plugins/markdown-review

# 3. 重启 dsh：侧边栏出现「看板」「Pipeline」入口
```

| 插件 | 是否必需 | 作用 |
|---|---|---|
| kanban | 必选 | 看板 + 行为门禁 + 创建模板 + 配置导入导出 |
| git | 推荐 | GitHub 仓库/分支/MR 关联、[ID] 自动认领、MR 同步与合并（门禁 `mr-linked` / `mr-merged` 依赖它） |
| pipeline | 可选 | 可复用 AI 流水线，可把「测试通过」门禁换成真实 pipeline 检查 |
| markdown-review | 推荐 | 人工审批点：对话流打开本地 md 大浮窗，划词批注 + 总评，提交即回传 agent 继续 |

> 插件路由前缀 `/kanban-api`、`/git-api`、`/pipeline-api`、`/md-api`；数据落在 `~/.dsh/<plugin>/` 目录。

## Agent 工具总览

| 插件 | 工具前缀 | 数量 | 重点能力 |
|---|---|---|---|
| kanban | `kanban_*` | 31 | 看板读写、归档、列管理、关联、门禁库、创建模板、配置导入导出 |
| git | `git_*` | 7 | 配置、[ID] 认领、关联、MR 列表/同步/合并 |
| pipeline | `pipeline_*` | 11 | 流水线管理、版本发布/删除、运行/进度/队列、catalog |
| markdown-review | `md_doc_open` | 1 | 对话流打开本地 md 大浮窗：划词批注 + 总评，提交即回传、agent 自动继续 |

agent 使用各插件的完整契约（参数、门禁模型、代码沙箱能力）见对应插件 README。

## 仓库结构

```
dsh-plugins/
├── plugins/
│   ├── kanban/      # 看板 + 门禁工作流（31 工具；Agent 门禁指南见其 README）
│   ├── git/         # git 集成（7 工具 + [ID] 关联 + MR 合并）
│   ├── pipeline/    # AI 流水线（11 工具；React Flow 节点图）
│   └── markdown-review/ # md 文档审阅（md_doc_open：划词批注+总评，提交即回传）
├── packages/
│   ├── ui/          # 共享包 @dsh-plugins/ui：设计 tokens + 图标 + 工具函数
│   └── communication/ # 通信协议层（bus/rpc/services）
├── workflow-template/ # 开发流程配置样例包：workflow.json + 使用指南 + workflow skill（经 kanban_import_config 导入）
├── apps/ui-showcase/ # UI 组件库独立 showcase 开发服务（pnpm dev:ui）
├── scripts/         # 仓库级工具（workflow-ci-check.mjs 等）
└── .agents/skills/  # 插件开发技能（dsh-dynamic-plugin-dev 等）+ workflow 流程 skill 同步副本
```

## 开发与贡献

- **UI 组件开发**：`pnpm dev:ui` 起独立组件库 showcase 服务（http://127.0.0.1:5173，不依赖 dsh 宿主）——在 [apps/ui-showcase](apps/ui-showcase) 里开发/微调组件，规范见 [docs/ui-design](docs/ui-design)。
- 插件开发完整指南见 [.agents/skills/dsh-dynamic-plugin-dev](.agents/skills/dsh-dynamic-plugin-dev/SKILL.md)（包结构、host/client 双半、构建、槽位 UI 四种模式、踩坑清单）。
- UI 设计规范见 [docs/ui-design](docs/ui-design)（tokens 索引 / 风格指引 / 组件规范，直接引用宿主 `--dsw-*` tokens，明暗自适应）。
- 工作规则见 [AGENTS.md](AGENTS.md)。

## License

[MIT](LICENSE)
