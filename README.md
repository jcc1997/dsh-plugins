# dsh-plugins

为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)(DSH)开发的插件集合:看板 + 门禁工作流、git 集成、AI 流水线、markdown 文档审阅。所有插件均为**正式 bundle**形态,安装后重启生效、重启不丢。

- [**kanban**](plugins/kanban/README.md):嵌入侧边栏的全功能看板——31 个 agent 工具、行为**门禁**(内置条件 / 代码 / pipeline 三种检查单元,门禁库独立实体复用)、创建模板、归档、分组、富文本内容、**配置导入导出**(kanban_export_config / kanban_import_config)。
- [**git**](plugins/git/README.md):task 关联 GitHub 仓库/分支/MR + 7 个 `git_*` 工具 + [ID] 自动关联 + MR 同步/合并(方案见 [PLAN.md](plugins/git/PLAN.md))。
- [**pipeline**](plugins/pipeline/README.md):类 dify 的可复用 AI 流水线——atomic 基础单元 + combined 组合流水线、npm 风格 semver 版本(v1.0.1)、React Flow 节点图编辑、运行队列与进度、11 个 `pipeline_*` 工具。
- [**markdown-review**](plugins/markdown-review/README.md):对话流中的 markdown 文档审阅——`md_doc_open` 在消息流打开本地 md 大浮窗,划词批注 + 总评,提交即作为工具结果回传、agent 自动继续。
- [**workflow-template**](workflow-template/README.md):**开发流程配置样例包**——10 列(Backlog → RD → TD → UC → In Dev → 1st Review → Testing → 2nd review → Stage → Done)+ 9 条门禁 + 创建模板,一份 `workflow.json` + 完整使用指南。看板配置可导入导出:别人导出自己的形态、你导入即可使用;本包即这套机制的一个官方样例,复制出去改成自己的流程。

前三个插件 + workflow-template 组合成一套**带门禁的开发工作流**:Backlog → RD → TD → 验收用例 → 开发 → 1st Review → Testing(pipeline 跑测试)→ 2nd review → Stage → MR 合并 → 自动 Done,详见 [workflow-template 使用指南](workflow-template/README.md) 与 [kanban 的 Agent 门禁指南](plugins/kanban/README.md#面向-agent-的门禁指南)。

## 安装

前置:已安装 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)(DSH)。

```bash
# 1. 构建产物(新克隆后必做,lib/ 为 gitignore;装哪个插件就构建哪个)
cd plugins/kanban && pnpm run check      # 看板 + 门禁 + 配置导入导出
cd ../git && pnpm run check              # 可选:MR 关联/合并门禁需要
cd ../pipeline && pnpm run check         # 可选:AI 流水线
cd ../markdown-review && pnpm run check  # 可选:人工审批时展示文档审阅

# 2. 挂载到 web profile(官方 CLI,自动应用 bundle 的 cordis.patch.yml)
dsh plugin --profile web add /path/to/dsh-plugins/plugins/kanban
dsh plugin --profile web add /path/to/dsh-plugins/plugins/git
dsh plugin --profile web add /path/to/dsh-plugins/plugins/pipeline
dsh plugin --profile web add /path/to/dsh-plugins/plugins/markdown-review

# 3. 重启 dsh:侧边栏出现「看板」「Pipeline」入口;agent 工具 kanban_* / git_* / pipeline_* / md_doc_open 可用
```

| 插件 | 是否必需 | 作用 |
|---|---|---|
| kanban | 必选 | 看板 + 行为门禁 + 创建模板 + **配置导入导出** |
| git | 推荐 | GitHub 仓库/分支/MR 关联、[ID] 自动认领、MR 同步与合并(门禁 `mr-linked` / `mr-merged` 依赖它) |
| pipeline | 可选 | 可复用 AI 流水线,可把「测试通过」门禁换成真实 pipeline 检查 |
| markdown-review | 推荐 | 人工审批点:对话流打开本地 md 大浮窗,划词批注 + 总评,提交即回传 agent 继续 |

> 插件路由前缀 /kanban-api、/git-api、/pipeline-api、/md-api;数据落在 ~/.dsh/<plugin>/ 目录。

## 引入这套开发工作流

装好插件后,把本仓库的**官方开发流程样例**导入你的看板,即可获得一套完整的带门禁研发流程:

**1. 导入(一句话)**

把 [`workflow-template/workflow.json`](workflow-template/workflow.json) 的内容发给 DSH 会话里的 agent,说:「用 `kanban_import_config` 导入这份看板配置」。(也可以直接说「导入 workflow-template 作为我的看板配置」。)

**2. 得到**

一块带门禁的开发看板——10 列 + 9 条门禁 + `workflow` 创建模板:

```
Backlog → RD → TD → UC → In Dev → 1st Review → Testing → 2nd review → Stage → Done
```

**3. 开始用**

- 新建卡片选 `workflow` 模板(自动带入 9 条门禁);
- 把卡往下一列拖:不合规会被门禁拦下并提示原因;确认 = 打标签(`rd-confirmed` / `td-confirmed` / `uc-confirmed` / `review-1-done` / `tests-passed` / `review-2-done`);
- 到人工审批点时,agent 用 `md_doc_open` 把 `docs/<taskId>/` 的文档展示在对话流,你划词批注 + 总评,提交后 agent 自动继续;
- 在 Stage 列用 git 插件合并 MR,卡片自动进 Done。

> 导入只替换**配置层**(列 / 门禁 / 模板),你的卡片不受影响(自动挪到新板第一列),导入前自动备份。每个阶段的职责、9 条门禁明细、日常使用五步见 [workflow-template/README.md](workflow-template/README.md) 完整使用指南。

**换别人的形态 / 分享你的形态**:看板配置可导入导出——`kanban_export_config` 导出你当前的列+门禁+模板(不含任何卡片数据,门禁按名字引用),他人 `kanban_import_config` 导入即拿到你的流程;想改成自己的,复制 `workflow-template/` 目录、改 `workflow.json`、再导入即可。

## Agent 工具总览

| 插件 | 工具前缀 | 数量 | 重点能力 |
|---|---|---|---|
| kanban | `kanban_*` | 31 | 看板读写、归档、列管理、关联、**门禁库(gate_create/delete/add/remove/list/check)**、**创建模板(template_*)**、**配置导入导出(export/import_config)** |
| git | `git_*` | 7 | 配置、[ID] 认领、关联、MR 列表/同步/合并 |
| pipeline | `pipeline_*` | 11 | 流水线管理、版本发布/删除、运行/进度/队列、catalog |
| markdown-review | `md_doc_open` | 1 | 对话流打开本地 md 大浮窗:划词批注 + 总评,提交即回传、agent 自动继续 |

agent 使用各插件的完整契约(参数、门禁模型、代码沙箱能力)见对应插件 README。

## 仓库结构

```
dsh-plugins/
├── plugins/
│   ├── kanban/      # 看板 + 门禁工作流(31 工具;Agent 门禁指南见其 README)
│   ├── git/         # git 集成(7 工具 + [ID] 关联 + MR 合并)
│   ├── pipeline/    # AI 流水线(11 工具;React Flow 节点图)
│   └── markdown-review/ # md 文档审阅(md_doc_open:划词批注+总评,提交即回传)
├── packages/
│   ├── ui/          # 共享包 @dsh-plugins/ui:设计 tokens + 图标 + 工具函数
│   └── communication/ # 通信协议层(bus/rpc/services)
├── workflow-template/ # 开发流程配置样例包:workflow.json + 使用指南 + workflow skill(经 kanban_import_config 导入)
├── scripts/         # 仓库级工具(workflow-ci-check.mjs 等)
└── .agents/skills/  # 插件开发技能(dsh-dynamic-plugin-dev 等)+ workflow 流程 skill 同步副本
```

## 开发与贡献

- 插件开发完整指南见 [.agents/skills/dsh-dynamic-plugin-dev](.agents/skills/dsh-dynamic-plugin-dev/SKILL.md)(包结构、host/client 双半、构建、槽位 UI 四种模式、踩坑清单)。
- UI 设计规范见 [packages/ui/DESIGN.md](packages/ui/DESIGN.md)(直接引用宿主 --dsw-* tokens,明暗自适应)。
- 工作规则见 [AGENTS.md](AGENTS.md)。

## License

[MIT](LICENSE)
