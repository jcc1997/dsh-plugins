# dsh-plugins

为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)(DSH)开发的插件集合:看板 + 门禁工作流、git 集成、AI 流水线。三个插件均为**正式 bundle**形态,安装后重启生效、重启不丢。

- [**kanban**](plugins/kanban/README.md):嵌入侧边栏的全功能看板——31 个 agent 工具、行为**门禁**(内置条件 / 代码 / pipeline 三种检查单元,门禁库独立实体复用)、创建模板、归档、分组、富文本内容、**配置导入导出**(kanban_export_config / kanban_import_config)。
- [**git**](plugins/git/README.md):task 关联 GitHub 仓库/分支/MR + 7 个 `git_*` 工具 + [ID] 自动关联 + MR 同步/合并(方案见 [PLAN.md](plugins/git/PLAN.md))。
- [**pipeline**](plugins/pipeline/README.md):类 dify 的可复用 AI 流水线——atomic 基础单元 + combined 组合流水线、npm 风格 semver 版本(v1.0.1)、React Flow 节点图编辑、运行队列与进度、11 个 `pipeline_*` 工具。
- [**workflow-template**](workflow-template/README.md):**开发流程配置样例包**——10 列(Backlog → RD → TD → UC → In Dev → 1st Review → Testing → 2nd review → Stage → Done)+ 9 条门禁 + 创建模板,一份 `workflow.json` + 完整使用指南。看板配置可导入导出:别人导出自己的形态、你导入即可使用;本包即这套机制的一个官方样例,复制出去改成自己的流程。

前三个插件 + workflow-template 组合成一套**带门禁的开发工作流**:Backlog → RD → TD → 验收用例 → 开发 → 1st Review → Testing(pipeline 跑测试)→ 2nd review → Stage → MR 合并 → 自动 Done,详见 [workflow-template 使用指南](workflow-template/README.md) 与 [kanban 的 Agent 门禁指南](plugins/kanban/README.md#面向-agent-的门禁指南)。

## 快速开始

```bash
# 1. 构建产物(新克隆后必做,lib/ 为 gitignore)
cd plugins/kanban && pnpm run check   # 或 plugins/git、plugins/pipeline
# 2. 挂载到 web profile(官方 CLI,自动应用 bundle 的 cordis.patch.yml)
dsh plugin --profile web add /path/to/dsh-plugins/plugins/kanban
dsh plugin --profile web add /path/to/dsh-plugins/plugins/git
dsh plugin --profile web add /path/to/dsh-plugins/plugins/pipeline
# 3. 重启 dsh:侧边栏出现「看板」「Pipeline」入口;agent 工具 kanban_* / git_* / pipeline_* 可用
```

> 插件路由使用自有前缀(/kanban-api、/git-api、/pipeline-api);数据落在 ~/.dsh/<plugin>/ 目录。

## Agent 工具总览

| 插件 | 工具前缀 | 数量 | 重点能力 |
|---|---|---|---|
| kanban | `kanban_*` | 31 | 看板读写、归档、列管理、关联、**门禁库(gate_create/delete/add/remove/list/check)**、**创建模板(template_*)**、**配置导入导出(export/import_config)** |
| git | `git_*` | 7 | 配置、[ID] 认领、关联、MR 列表/同步/合并 |
| pipeline | `pipeline_*` | 11 | 流水线管理、版本发布/删除、运行/进度/队列、catalog |

agent 使用各插件的完整契约(参数、门禁模型、代码沙箱能力)见对应插件 README。

## 仓库结构

```
dsh-plugins/
├── plugins/
│   ├── kanban/      # 看板 + 门禁工作流(31 工具;Agent 门禁指南见其 README)
│   ├── git/         # git 集成(7 工具 + [ID] 关联 + MR 合并)
│   └── pipeline/    # AI 流水线(11 工具;React Flow 节点图)
├── packages/
│   ├── ui/          # 共享包 @dsh-plugins/ui:设计 tokens + 图标 + 工具函数
│   └── communication/ # 通信协议层(bus/rpc/services)
├── workflow-template/ # 开发流程配置样例包:workflow.json + 使用指南(经 kanban_import_config 导入)
├── scripts/         # 仓库级工具(workflow-ci-check.mjs 等)
└── .agents/skills/  # 插件开发技能(dsh-dynamic-plugin-dev 等)
```

## 开发与贡献

- 插件开发完整指南见 [.agents/skills/dsh-dynamic-plugin-dev](.agents/skills/dsh-dynamic-plugin-dev/SKILL.md)(包结构、host/client 双半、构建、槽位 UI 四种模式、踩坑清单)。
- UI 设计规范见 [packages/ui/DESIGN.md](packages/ui/DESIGN.md)(直接引用宿主 --dsw-* tokens,明暗自适应)。
- 工作规则见 [AGENTS.md](AGENTS.md)。

## License

[MIT](LICENSE)
