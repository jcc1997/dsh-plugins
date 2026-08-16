# dsh-workflow-template

> 一套跑在 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)(DSH) 上的**完整软件开发工作流**：从用户一句话到 MR 合并上线，人和 agent 在同一块看板上协作，每一步都有门禁兜底、每一份文档都随 MR 演进。

## 理念：这不是「看板配置」，是一条开发流程

传统看板只记录「卡在哪」；这套 workflow 把**整条研发流程的规则**沉淀成配置 + 知识卡：

- **流程即配置**：10 个阶段列、10 条行为门禁、1 个创建模板，全部声明在 `workflow.json`（配套 `pipelines.json` 定义评审 pipeline），一键导入、可导出分享、复制即得自己的流程；
- **门禁兜底**：进入下一列必须满足条件（分支已建 / 确认标签 / MR 已合并），不满足动作被拒绝——人不会漏流程，agent 不会跳过环节；
- **人在环上**：每次需要拍板（RD/TD/UC 确认、两轮 review）都先把文档在对话流里打开给你看（划词批注 + 总评），你提交后 agent 自动继续；
- **文档随代码演进**：每个任务在 `docs/<taskId>/` 产出 rd.md / td.md / uc.md，跟随 `workflow/<taskId>` 分支一起进 MR，合并即归档；
- **每次会话都走同一套逻辑**：你提出功能 → agent 确认建卡 → 进 RD（grill-me 拷问方案 + 模板产出设计）→ 你审阅确认 → 建 MR → 逐阶段推进 → 合并收尾。agent 按 `skills/workflow/SKILL.md` 的「会话编排」自动执行，不需要你重复交代。

```
Backlog ──> RD ──> TD ──> UC ──> In Dev ──> 1st Review ──> Testing ──> 2nd review ──> Stage ──> Done
 需求池     设计     技术设计  验收用例   开发       代码评审     测试       上线前复审      预发布    完成
```

## Agent 安装指南（给 agent 看的步骤，用户照说即可）

> 用法：把本 README（或本目录）交给 DSH 会话，说「按 workflow-template 的安装指南配置」，agent 会按下面的顺序执行。

### 第一步：安装插件

| 插件 | 必选/推荐 | 作用 |
|---|---|---|
| **dsh-kanban** | 必选 | 看板 + 门禁引擎 + 配置导入导出 |
| **dsh-git** | 推荐 | `git_create_branch` / `git_create_mr` / `git_merge_pr` 等 git 工具，门禁 `branch-linked` / `mr-linked` / `mr-merged` 依赖它 |
| **dsh-markdown-review** | 推荐 | 人工审批：`md_doc_open` 在对话流打开文档大浮窗，划词批注 + 总评，提交即回传 |
| **dsh-pipeline** | 推荐 | 真实 pipeline 检查（门禁 `pipeline`）：Testing 双门禁的「代码评审」agent 评审靠它执行；含 `pipeline_import_config` 导入工具 |

装好后让用户**打开一次看板**（生成看板数据文件）。

### 第二步：配置插件

1. **git 插件**（进 RD 门禁要建分支，需要本地仓库 + GitHub 仓库 + token）：
   - 会话里说：「用 `git_configure` 配置仓库 owner/repo、本地仓库路径 `<你的仓库路径>`，并设置 GitHub token」；
   - 或 agent 直接依次调用 `git_configure(owner, repo, local_path, token)`。
2. **pipeline 插件**：进 Testing 双门禁含 agent 评审（`pipeline` 检查器），需先 `pipeline_import_config` 导入 `workflow-template/pipelines.json`（稳定 id `p-workflow-review`，幂等）。

### 第三步：配置 preset（导入工作流配置）

1. **安装 agent 预设（workflow 模式）**：把本目录 `agent-presets/workflow/` 复制到 `~/.dsh/.agent-presets/workflow/`（agent 执行 `cp -r workflow-template/agent-presets/workflow ~/.dsh/.agent-presets/`）。之后**新建会话**时在预设选择器里选「workflow 模式」，agent 就自动按「会话编排」执行——不需要再交代流程；也可在设置 → Agent 预设里把它设为默认；
2. agent 读取本目录 `workflow.json`，执行 `kanban_import_config` 导入（整体替换配置层，**旧卡片不受影响**：挪到第一列、门禁挂载清除，导入前自动备份 `board.json.bak-<时间戳>`）；
3. 执行 `pipeline_import_config`（读取本目录 `pipelines.json`）导入评审 pipeline 定义（按稳定 id 幂等 upsert）；
3. 把 `skills/workflow/` 复制进当前仓库的 `.agents/skills/`（本仓库已同步，复制到别的仓库时记得带过去）——agent 之后自动加载流程知识。

### 完成自检

- 看板有 10 列（Backlog → Done）、门禁库有 10 条门禁、创建模板里有 `workflow`；pipeline 列表里有 `代码评审`（p-workflow-review）；
- 对一张卡 `kanban_move(card, "RD")` 会被「进入 RD 需建 workflow 分支」拒绝——说明门禁生效；
- 对一张处于 1st Review、已打 `review-1-done` 的卡 `kanban_move(card, "Testing")`：先触发「代码评审」pipeline，agent 未给出 OK 则被拒绝且卡上出现评审评论——说明 review 门禁生效；
- **新建会话的预设选择器里能看到「workflow 模式」**（复制 `agent-presets/workflow/` 后刷新页面即可看到，无需重启 dsh）；
- 建一张卡试试全流程（见下「日常使用」）。

## 日常使用

1. **建卡**：`kanban_create(title, template: "workflow")` 自动带入 9 条门禁与预置标签；或看板列头「+」手动建。
2. **会话编排（默认流程，agent 自动走）**：

   1. 你陈述功能 → agent 复述确认 → 建卡进 Backlog（自动认领 taskId）；
   2. 进 RD：`git_create_branch` 建 `workflow/<taskId>` 分支并推送（过 branch-linked 门禁）→ 移到 RD；
   3. RD 设计：agent 用 `grill-me` 拷问方案到共识 → 按 `templates/rd.md` 模板产出 `docs/<taskId>/rd.md`；
   4. RD 确认：`md_doc_open` 打开 rd.md 给你审阅 → 通过 → 打 `rd-confirmed`；
   5. 建 MR：`git_create_mr` 提交 MR（标题带 `[taskId]` 自动关联）→ 移到 TD；
   6. 逐阶段推进：TD（td.md → 审阅 → `td-confirmed`）→ UC（验收用例 → `uc-confirmed`）→ In Dev（开发）→ 1st Review（评审 → `review-1-done`）→ Testing（测试 → `tests-passed`）→ 2nd review（复审 → `review-2-done`）→ Stage；
   7. 收尾：`git_merge_pr` 合并 MR，卡片自动进 Done。

3. **门禁不通过时**：agent 会告诉你缺什么并给补救动作（建分支 / 打标签 / 合并 MR），你只需确认。
4. **确认 = 打标签**：`rd-confirmed` / `td-confirmed` / `uc-confirmed` / `review-1-done` / `tests-passed` / `review-2-done`，由对应角色确认后打上。

## 门禁清单（10 条）

| # | 门禁名 | 触发 | 检查器 | config |
|---|---|---|---|---|
| 1 | 进入 RD 需建 workflow 分支 | move → RD | branch-linked | 无（需 github-repo + github-branch 关联） |
| 2 | RD 确认才能进 TD | move → TD | tag-required | `{"tags":["rd-confirmed"]}` |
| 3 | TD 确认才能进 UC | move → UC | tag-required | `{"tags":["td-confirmed"]}` |
| 4 | 验收用例确认才能开发 | move → In Dev | tag-required | `{"tags":["uc-confirmed"]}` |
| 5 | 进入评审需关联 MR | move → 1st Review | mr-linked | 无 |
| 6 | 1st review 通过才能测试 | move → Testing | tag-required | `{"tags":["review-1-done"]}` |
| 7 | Review pipeline 通过才能进 Testing | move → Testing | pipeline | `{"pipelines":["p-workflow-review"]}`（agent 评审 OK 才放行；失败自动落卡评论；下轮续评注入上轮意见） |
| 7 | 测试通过才能进 2nd review | move → 2nd review | tag-required | `{"tags":["tests-passed"]}` |
| 8 | 2nd review 通过才能 Stage | move → Stage | tag-required | `{"tags":["review-2-done"]}` |
| 9 | MR 已合并才能进 Done | move → Done | mr-merged | 无 |

> 门禁是看板库里的独立实体，可复用；检查器统一走沙箱 code 执行，可用 `code` 写任意检查、`pipeline` 现场跑流水线。详见 [kanban 的 Agent 门禁指南](../plugins/kanban/README.md#面向-agent-的门禁指南)。

## 自定义：复制成你自己的流程

1. 把本目录复制出去（如 `cp -r workflow-template my-flow`）;
2. 编辑 `my-flow/workflow.json`: `kanban.columns` 增删阶段、`kanban.gates` 改触发/检查器/config、`kanban.templates` 改模板与门禁勾选;
3. 重新 `kanban_import_config` 导入（整体替换、自动备份）;
4. 同步更新 `skills/workflow/SKILL.md`（阶段语义表 / 门禁清单 / 标签表 / 会话编排，见该文件维护清单）;
5. 需要新的文档模板（如 td.md / uc.md）就放进 `templates/`，并让 agent 在对应阶段按模板产出到 `docs/<taskId>/`。

## 文件说明

| 文件 | 作用 |
|---|---|
| `workflow.json` | 工作流配置（列 + 门禁 + 模板），**单一事实源**，与 kanban_export_config 导出格式一致 |
| `agent-presets/workflow/` | workflow 模式 agent 预设（拷入 ~/.dsh/.agent-presets/ 即出现在会话预设选择器） |
| `skills/workflow/SKILL.md` | 流程含义 + agent 会话编排手册（拷入 .agents/skills/ 即被自动加载） |
| `templates/rd.md` | RD 设计文档模板（产出 docs/<taskId>/rd.md） |
| `README.md` | 本文件：理念 + 安装指南 + 使用指南 |

## License

[MIT](../LICENSE)
