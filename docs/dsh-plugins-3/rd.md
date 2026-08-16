# dsh-plugins-3 — 新增 bug 模板：bug 处理跳过 RD/TD（Backlog→In Dev 直进，评审门禁保留）RD

> grill-me 已收敛（4 个决策点），本文件为决策落档。

## 1. 需求背景

- 一句话：bug 类卡片走轻量流程——跳过 RD（需求设计）/TD（技术设计）/UC（验收用例）三列的文档确认，从 Backlog 建卡直进 In Dev；分支/MR 照建，1st Review 双门禁（人审 + agent 评审 pipeline）与后续列门禁全保留。
- 用户诉求：bug 处理流程应该跳过 RD 和 TD，做一个新的 template。

## 2. 目标与非目标

| 目标 | 非目标 |
|---|---|
| workflow.json 新增「bug」模板：挂 7 条门禁，不挂 rd-confirmed/td-confirmed/uc-confirmed | 不改动 workflow 模板与 10 列结构 |
| 新增「进入 In Dev 需建 workflow 分支」门禁（branch-linked，to: In Dev）——bug 卡仍需 workflow/<taskId> 分支以便提 MR 合并 | 不为 bug 流程新增看板列 |
| SKILL 双副本 + README 同步 bug 快捷流程 | 不迁移现有 IME bug 卡（保持 workflow 门禁） |
| kanban_import_config 导入后建测试卡验证门禁链 | — |

## 3. 方案设计（grill-me 决策）

| 决策点 | 结论 |
|---|---|
| 列路径 | Backlog → In Dev 直进（跳过 RD/TD/UC 列）；新增 branch-linked@In Dev 门禁 |
| 评审门禁 | 双门禁全保留（review-1-done 人审 + Review pipeline agent 评审） |
| 模板形态 | 新「bug」模板与 workflow 并列；tags=[bug, default] |
| 文档与验证 | SKILL 双副本「bug 快捷流程」小节 + README 模板表补行 + 导入后建测试卡验证 |

### 3.1 bug 模板门禁集（7 条）

| 门禁 | 触发 | 检查器 |
|---|---|---|
| 进入 In Dev 需建 workflow 分支（新增） | move → In Dev | branch-linked |
| 进入评审需关联 MR | move → 1st Review | mr-linked |
| 1st review 通过才能测试 | move → Testing | tag-required review-1-done |
| Review pipeline 通过才能进 Testing | move → Testing | pipeline p-workflow-review |
| 测试通过才能进 2nd review | move → 2nd review | tag-required tests-passed |
| 2nd review 通过才能 Stage | move → Stage | tag-required review-2-done |
| MR 已合并才能进 Done | move → Done | mr-merged |

### 3.2 bug 流程编排（SKILL 文档化）

建卡（template: bug）→ git_create_branch（建 workflow/<taskId> 分支并关联）→ move In Dev（过 branch-linked）→ 修复开发（复现步骤+验收点写卡描述）→ git_create_mr → move 1st Review → 人审（ask_user_question + MR 链接）→ review-1-done + agent 评审 pipeline OK → Testing（CI/修复验证）→ tests-passed → 2nd review → review-2-done → Stage → git_merge_pr → Done。

### 3.3 文档与验证

- workflow-template/workflow.json：门禁库 + templates 各加一条；
- workflow SKILL 双副本：「三-bis」后加「bug 快捷流程」小节；
- workflow-template/README.md：门禁清单表（10→11 条）+ 模板表补 bug 行；
- kanban_import_config 导入 → 建 bug 测试卡（template: bug）→ 验证 move 链（In Dev 需分支；1st Review 需 MR；Testing 双门禁）→ 删测试卡。

## 4. 验收口径（供 UC）

1. 门禁库含「进入 In Dev 需建 workflow 分支」，bug 模板引用它，workflow 模板不引用；
2. bug 模板建卡后 tags 含 bug/default，门禁 7 条；
3. bug 测试卡：无分支时 move→In Dev 被拒；git_create_branch 后通过；无 MR 时 move→1st Review 被拒；关联 MR 后通过；缺 review-1-done 时 move→Testing 被 tag 门禁拒；
4. 文档同步（SKILL 双副本一致、README 更新）。

## 5. 开放问题

- 无（grill-me 已收敛）。