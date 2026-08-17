---
name: workflow
description: 带门禁的软件开发看板工作流指南(workflow-template):10 列阶段语义、11 条门禁、确认标签、MR 收尾。Use when 当前处于 workflow 模式，或用户显式要求使用带门禁的看板开发流程、推进列、打确认标签、解释门禁不通过原因、导入/自定义流程配置时。关键词:workflow、开发流程、看板工作流、进入下一列、确认标签、rd-confirmed、td-confirmed、uc-confirmed、review-1-done、tests-passed、review-2-done。
---

# workflow — 带门禁的软件开发看板流程

> 本文件真源:`workflow-template/skills/workflow/SKILL.md`;仓库根 `.agents/skills/workflow/SKILL.md` 为同步副本。**改动必须两处一起改。**
> 配套配置:`workflow-template/workflow.json`(经 `kanban_import_config` 导入 dsh-kanban 后生效)。
> workflow 模式 agent 预设:`workflow-template/agent-presets/workflow/`(复制到 `~/.dsh/.agent-presets/workflow/` 后,新建会话的预设选择器出现「workflow 模式」,agent 自动按本文「会话编排」执行)。

> 适用范围：本流程只在 **workflow 模式**（workflow agent preset）下默认启用；其他模式只有用户**显式要求**使用看板工作流 / 创建 kanban ticket 时才启用。不要在任何非 workflow 模式会话里擅自建卡、建分支或提 MR。

## 一、这是什么

一套沉淀在看板上的软件开发流程:**Backlog → RD → TD → UC → In Dev → 1st Review → Testing → 2nd review → Stage → Done**。每进入下一列都有门禁检查,不满足则动作被拒绝;人工确认 = 打 confirm 标签;收尾 = MR 合并自动进 Done。

```
Backlog ──> RD ──> TD ──> UC ──> In Dev ──> 1st Review ──> Testing ──> 2nd review ──> Stage ──> Done
 需求池     设计     技术设计  验收用例   开发       代码评审       测试       上线前复审      预发布    完成
```

## 二、阶段语义(10 列)

| 列 | 含义 / 谁 | 进入门禁 | 通过方式 |
|---|---|---|---|
| Backlog | 需求池,任何人建卡 | 无 | 直接建卡 |
| RD | 设计确认需求可做 | 已关联 GitHub 仓库与 workflow 分支 | `git_create_branch` 建分支自动关联 |
| TD | 写技术设计文档 | 标签 `rd-confirmed` | RD 确认后打标签 |
| UC | 写验收用例 | 标签 `td-confirmed` | TD 确认后打标签 |
| In Dev | 开发实现 | 标签 `uc-confirmed` | UC 确认后打标签 |
| 1st Review | 代码评审(首轮) | 已关联 MR | 关联 MR |
| Testing | 测试(可用 pipeline 自动跑) | 双门禁：标签 `review-1-done`（人审确认）+ Review pipeline 通过（agent 评审 OK，见 §三-bis） | 人审打标签 + agent 评审 pipeline 现场跑 |
| 2nd review | 上线前复审(第二轮) | 标签 `tests-passed` | 测试通过后打标签 |
| Stage | 预发布/待合并 | 标签 `review-2-done` | 复审通过后打标签 |
| Done | 完成 | **MR 已合并** | git 插件合并 MR 后自动放行 |

## 三、门禁清单(11 条)

| 门禁名 | 触发 | 检查器 | config |
|---|---|---|---|
| 进入 RD 需建 workflow 分支 | move → RD | branch-linked | 无（需 github-repo + github-branch 关联） |
| RD 确认才能进 TD | move → TD | tag-required | `{"tags":["rd-confirmed"]}` |
| TD 确认才能进 UC | move → UC | tag-required | `{"tags":["td-confirmed"]}` |
| 验收用例确认才能开发 | move → In Dev | tag-required | `{"tags":["uc-confirmed"]}` |
| 进入 In Dev 需建 workflow 分支 | move → In Dev | branch-linked | 无（需 github-repo + github-branch 关联） |
| 进入评审需关联 MR | move → 1st Review | mr-linked | 无 |
| 1st review 通过才能测试 | move → Testing | tag-required | `{"tags":["review-1-done"]}` |
| Review pipeline 通过才能进 Testing | move → Testing | pipeline | `{"pipelines":["p-workflow-review"]}`（agent 评审 OK 才放行，失败自动落卡评论） |
| 测试通过才能进 2nd review | move → 2nd review | tag-required | `{"tags":["tests-passed"]}` |
| 2nd review 通过才能 Stage | move → Stage | tag-required | `{"tags":["review-2-done"]}` |
| MR 已合并才能进 Done | move → Done | mr-merged | 无 |

> 门禁是门禁库独立实体;检查器统一走沙箱 code 执行,内置类型是预设代码模板。可用 `code` 写任意检查、`pipeline` 现场跑流水线(详见 dsh-kanban README 的 Agent 门禁指南)。

## 三-bis、review pipeline（agent 评审门禁）

> 进 Testing 双门禁：`1st review 通过才能测试`（人审标签）+ `Review pipeline 通过才能进 Testing`（agent 评审 OK）。**顺序约定：agent 评审 pipeline 必须先行且成功，之后才发起人审**（review-1-done 在 agent 评审通过后由人审确认打上；agent 评审未过不消耗人审）。配套文件：`workflow-template/pipelines.json`（pipeline 定义）、`workflow-template/prompts/review.md`（review prompt 真源）、`workflow-template/agent-presets/review/`（精简评审预设）。

### 触发与语义

- move → Testing 时，pipeline 门禁**现场运行**「代码评审」pipeline（`p-workflow-review`，llm 节点）：
  - 评审 agent 按 review prompt 评 **MR diff（代码逻辑）+ 设计规范（docs/ui-design、--dsw-* tokens、AGENTS.md 红线）+ 文档纪律** 三个维度；
  - agent 输出尾行 verdict：`REVIEW_VERDICT:{"ok":true|false,"issues":[...]}`；`ok:true` 才放行；
  - 未通过：门禁拒绝 + **评审问题自动落卡评论**（与最后一条相同不重复写）+ 拒绝原因带问题摘要。
- **fail-closed**：llm 节点未接入 agent 服务 / verdict 解析失败 → pipeline 失败 → 门禁拒绝（宁可拒绝不可假放行）。
- **续评（上下文注入式）**：每轮评审为全新 agent，但 llm 节点会读取卡片上一条「评审未通过」评论，作为【上一轮评审意见】注入本轮 prompt——agent 逐条核验上轮 findings 是否已修复（未修复继续列为未解决问题），功能等价于「接着上次评」。

### 导入与验证

- 新环境：`pipeline_import_config`（导入 `workflow-template/pipelines.json`，稳定 id `p-workflow-review` 幂等）→ `kanban_import_config`（导入 `workflow.json`）→ 门禁即生效。
- 插件改动（pipeline/kanban 源码）需重建并重启 dsh 后生效（动态插件会话内存态重启即失）。

## 三-ter、bug 快捷流程（跳过 RD/TD）

> bug 类卡片走轻量流程：不写 rd.md/td.md/uc.md（复现步骤 + 验收点写卡描述），从 Backlog 直进 In Dev；分支/MR 照建，评审门禁与后续列全保留。建卡用 `kanban_create(title, template: "bug")`（自动挂 7 条门禁：In Dev 建分支 / 1st Review 关联 MR / Testing 双门禁 / tests-passed / review-2-done / mr-merged）。

### bug 流程编排

1. 建卡（template: bug）→ `git_create_branch`（建 workflow/<taskId> 分支并关联）→ `kanban_move(card, "In Dev")`（过 branch-linked 门禁）；
2. 修复开发：复现步骤 + 验收点写进卡描述；修复 commit + push；
3. `git_create_mr` → move Testing 触发 agent 评审 pipeline（**agent 评审通过后才发起人审**）→ 人审（ask_user_question + MR 链接）→ review-1-done → 再 move Testing 通过；
4. Testing（修复验证）→ tests-passed → 2nd review（复审）→ review-2-done → Stage → `git_merge_pr` 合并 → Done。

> 与 workflow 流程的差异：跳过 RD/TD/UC 三列与对应确认标签；其余（评审/测试/收尾）一致。

## 四、Agent 操作手册

### 会话编排（workflow 模式默认流程）

在 workflow 模式或用户显式要求走看板工作流时，用户陈述功能/需求后 agent 直接进入流程，不要停在提问上；其他模式不要自动建卡。

1. **确认建卡**:复述理解 → 与用户确认 → `kanban_create(title, template: "workflow")` 建卡进 Backlog(自动带入门禁与标签;必要时先 `git_claim_task_id` 认领 taskId);
2. **进 RD**:`git_create_branch(card_id)` 建 workflow 分支(过 branch-linked 门禁)→ `kanban_move(card_id, "RD")`;
3. **RD 设计**:若当前会话有 `skill` 工具，先加载 `grill-me` skill，再拷问方案到共识 → 按 `workflow-template/templates/rd.md` 模板产出 `docs/<taskId>/rd.md`(与分支一起演进);
4. **RD 确认**:`md_doc_open(path: "…/docs/<taskId>/rd.md")` 展示给人审阅(划词批注 + 总评)→ 通过 → `kanban_tags(card_id, add: ["rd-confirmed"])`;
5. **建 MR**:RD 确认后 `git_create_mr(card_id)` 提交 MR(标题带 `[taskId]` 自动关联)→ `kanban_move(card_id, "TD")`;
6. **逐阶段推进**:TD(写 td.md → md_doc_open 审阅 → td-confirmed)→ UC(验收用例 → md_doc_open → uc-confirmed)→ In Dev(开发)→ 1st Review(建 MR,move→Testing 触发 agent 评审 pipeline,**agent 评审通过后才发起人审** ask_user_question + MR 链接 → review-1-done)→ Testing(测试 → tests-passed)→ 2nd review(复审 → review-2-done)→ Stage;
7. **收尾**:`git_merge_pr` 合并 MR(自动进 Done);文档与代码随 MR 一起演进,合并即归档。

> 确认方式分两类：**文档确认（RD/TD/UC）用 `md_doc_open`**；**代码评审（1st/2nd review）用 `ask_user_question` + MR 链接**。不通过则把意见整理进卡评论/MR,卡停在当前列。

**建卡（仅限上述适用场景）**:`kanban_create(title, template: "workflow")` —— 自动带入 10 条门禁、预置描述与标签;bug 类用 `template: "bug"`(7 条门禁,见「三-ter、bug 快捷流程」)。

**推进列**:`kanban_move(card_id, status)`。门禁不通过时返回「门禁未通过:<原因>」——向用户解释缺什么,并给出补救动作:

- `mr-linked` 未过 → 引导关联仓库/MR(`kanban_link` 挂 github-repo/github-mr,或 git 插件建分支提 MR,标题带 `[taskId]` 自动关联);
- `branch-linked` 未过 → 引导 `git_create_branch(card_id)`(自动认领 taskId、切 workflow/<taskId> 分支、推送并关联 github-branch);
- `tag-required` 未过 → 说明该列需要对应角色确认,确认后 `kanban_tags(card_id, add: ["<标签>"])`;
- `mr-merged` 未过 → 提示先去 Stage 用 git 插件合并 MR。

**确认标签表**(谁确认 = 哪个标签):

| 标签 | 含义 | 放行到 |
|---|---|---|
| `rd-confirmed` | RD 确认设计 | TD |
| `td-confirmed` | TD 确认技术设计 | UC |
| `uc-confirmed` | 验收用例确认 | In Dev |
| `review-1-done` | 1st Review 人审通过（**agent 评审 pipeline 成功之后**由人审确认打上） | Testing |
| `tests-passed` | 测试通过 | 2nd review |
| `review-2-done` | 2nd review 通过 | Stage |

**人工审批分两类**:
- **文档确认（RD/TD/UC）**:用 `md_doc_open`(依赖 dsh-markdown-review 插件)把要审的文档展示给人,划词批注 + 总评;
- **代码评审（1st/2nd review）**:**不用 md_doc_open**,直接用 `ask_user_question` 提问,MR 链接用**可跳转 markdown 格式**([MR #n](url));改动摘要**放 MR 里**、不进提问正文;选项「通过/不通过」;通过即打对应确认标签。

- agent 调 `md_doc_open(path: "<仓库路径>/docs/<taskId>/<doc>.md", context: "…请审阅…")` → 对话流出现「打开文档」卡片;
- 用户点开大浮窗,划词批注 + 底部总评,点「提交」;
- 工具返回 `{quotes:[{text,note}], comment}`,agent 据此行动:批注整理进卡评论/MR 评论;通过 → `kanban_tags` 打对应确认标签并 `kanban_move` 推进;不通过 → 把意见回给相关人,卡停在当前列。

> 文档约定放 git 仓库 `docs/<taskId>/`(rd.md / td.md / uc.md 等),随 MR 演进;没有独立文档时可打开任意本地 md,或先请用户补充文档再发起审阅。

**git 配合**(dsh-git 插件):
- `git_create_branch(card_id)` — 进 RD 前置:自动认领 taskId、从主分支切 `workflow/<taskId>` 并推送、自动关联 github-branch(本地仓库须干净且在 main/master);
- `git_create_mr(card_id)` — RD 确认后:head=`workflow/<taskId>`、base=main,标题自动带 `[taskId]` 并关联 github-mr;
- `git_merge_pr` — Stage 收尾:合并前检查卡片必须处于 Stage,合并后自动进 Done;
- 卡片抽屉「+ 新增 git 关联」或 `kanban_link` 可手动关联仓库/MR。

**文档约定**:每个 task 的文档放 git 仓库 `docs/<taskId>/`(rd.md / td.md / uc.md 等),随分支 MR 演进;RD/TD/UC 模板见 `workflow-template/templates/`。

**配置流转**:`kanban_export_config` 导出当前形态(列+门禁+模板,不含卡片);`kanban_import_config` 整体替换配置层(旧卡挪第一列,自动备份)。完整指南见 `workflow-template/README.md`。

## 五、自定义维护指引(改了 workflow.json 之后)

流程自定义 = 改 `workflow-template/workflow.json` 再导入。**每次改动必须同步更新本 skill**:

1. `kanban.columns` 增删列 → 更新「二、阶段语义」表与顶部列链图;
2. `kanban.gates` 改触发/检查器/config → 更新「三、门禁清单」表;
3. 确认标签新增/改名 → 更新「四、确认标签表」与各阶段「通过方式」;
4. `kanban.templates` 改名 → 更新建卡示例与 README 中的引用;
5. 重新导入验证(`kanban_import_config`),并在两个 SKILL.md 副本中同步(真源 + 仓库根)。

> 复制 workflow-template 到自己的仓库时,把 `skills/workflow/` 一并拷入目标仓库的 `.agents/skills/` 下,agent 即可自动加载本流程知识。
