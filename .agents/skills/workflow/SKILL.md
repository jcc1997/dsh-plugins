---
name: workflow
description: 带门禁的软件开发看板工作流指南(workflow-template):10 列阶段语义、9 条门禁、确认标签、MR 收尾。Use when 用户在使用带门禁的看板开发流程、推进列、打确认标签、解释门禁不通过原因、导入/自定义流程配置时。关键词:workflow、开发流程、看板工作流、进入下一列、确认标签、rd-confirmed、td-confirmed、uc-confirmed、review-1-done、tests-passed、review-2-done。
---

# workflow — 带门禁的软件开发看板流程

> 本文件真源:`workflow-template/skills/workflow/SKILL.md`;仓库根 `.agents/skills/workflow/SKILL.md` 为同步副本。**改动必须两处一起改。**
> 配套配置:`workflow-template/workflow.json`(经 `kanban_import_config` 导入 dsh-kanban 后生效)。

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
| RD | 设计确认需求可做 | 已关联 GitHub 仓库与 MR | `kanban_link` 关联 repo/MR |
| TD | 写技术设计文档 | 标签 `rd-confirmed` | RD 确认后打标签 |
| UC | 写验收用例 | 标签 `td-confirmed` | TD 确认后打标签 |
| In Dev | 开发实现 | 标签 `uc-confirmed` | UC 确认后打标签 |
| 1st Review | 代码评审(首轮) | 已关联 MR | 关联 MR |
| Testing | 测试(可用 pipeline 自动跑) | 标签 `review-1-done` | 评审通过后打标签 |
| 2nd review | 上线前复审(第二轮) | 标签 `tests-passed` | 测试通过后打标签 |
| Stage | 预发布/待合并 | 标签 `review-2-done` | 复审通过后打标签 |
| Done | 完成 | **MR 已合并** | git 插件合并 MR 后自动放行 |

## 三、门禁清单(9 条)

| 门禁名 | 触发 | 检查器 | config |
|---|---|---|---|
| 进入 RD 需关联 MR | move → RD | mr-linked | 无 |
| RD 确认才能进 TD | move → TD | tag-required | `{"tags":["rd-confirmed"]}` |
| TD 确认才能进 UC | move → UC | tag-required | `{"tags":["td-confirmed"]}` |
| 验收用例确认才能开发 | move → In Dev | tag-required | `{"tags":["uc-confirmed"]}` |
| 进入评审需关联 MR | move → 1st Review | mr-linked | 无 |
| 1st review 通过才能测试 | move → Testing | tag-required | `{"tags":["review-1-done"]}` |
| 测试通过才能进 2nd review | move → 2nd review | tag-required | `{"tags":["tests-passed"]}` |
| 2nd review 通过才能 Stage | move → Stage | tag-required | `{"tags":["review-2-done"]}` |
| MR 已合并才能进 Done | move → Done | mr-merged | 无 |

> 门禁是门禁库独立实体;检查器统一走沙箱 code 执行,内置类型是预设代码模板。可用 `code` 写任意检查、`pipeline` 现场跑流水线(详见 dsh-kanban README 的 Agent 门禁指南)。

## 四、Agent 操作手册

**建卡**:`kanban_create(title, template: "workflow")` —— 自动带入 9 条门禁、预置描述与标签。

**推进列**:`kanban_move(card_id, status)`。门禁不通过时返回「门禁未通过:<原因>」——向用户解释缺什么,并给出补救动作:

- `mr-linked` 未过 → 引导关联仓库/MR(`kanban_link` 挂 github-repo/github-mr,或 git 插件建分支提 MR,标题带 `[taskId]` 自动关联);
- `tag-required` 未过 → 说明该列需要对应角色确认,确认后 `kanban_tags(card_id, add: ["<标签>"])`;
- `mr-merged` 未过 → 提示先去 Stage 用 git 插件合并 MR。

**确认标签表**(谁确认 = 哪个标签):

| 标签 | 含义 | 放行到 |
|---|---|---|
| `rd-confirmed` | RD 确认设计 | TD |
| `td-confirmed` | TD 确认技术设计 | UC |
| `uc-confirmed` | 验收用例确认 | In Dev |
| `review-1-done` | 1st Review 通过 | Testing |
| `tests-passed` | 测试通过 | 2nd review |
| `review-2-done` | 2nd review 通过 | Stage |

**人工审批:先展示文档再拍板**(依赖 dsh-markdown-review 插件)。流程里每次需要人确认(RD/TD/UC 确认、1st/2nd review),先把要审的文档展示给人:

- agent 调 `md_doc_open(path: "<仓库路径>/docs/<taskId>/<doc>.md", context: "…请审阅…")` → 对话流出现「打开文档」卡片;
- 用户点开大浮窗,划词批注 + 底部总评,点「提交」;
- 工具返回 `{quotes:[{text,note}], comment}`,agent 据此行动:批注整理进卡评论/MR 评论;通过 → `kanban_tags` 打对应确认标签并 `kanban_move` 推进;不通过 → 把意见回给相关人,卡停在当前列。

> 文档约定放 git 仓库 `docs/<taskId>/`(rd.md / td.md / uc.md 等),随 MR 演进;没有独立文档时可打开任意本地 md,或先请用户补充文档再发起审阅。

**git 配合**:卡片抽屉「+ 新增 git 关联」或 `kanban_link` 关联仓库;分支/MR 标题带 `[taskId]` 自动关联卡片;Stage 列用 `git_merge_pr`(合并前检查卡片必须处于 Stage)。

**文档约定**:每个 task 的文档放 git 仓库 `docs/<taskId>/`,随分支 MR 演进。

**配置流转**:`kanban_export_config` 导出当前形态(列+门禁+模板,不含卡片);`kanban_import_config` 整体替换配置层(旧卡挪第一列,自动备份)。完整指南见 `workflow-template/README.md`。

## 五、自定义维护指引(改了 workflow.json 之后)

流程自定义 = 改 `workflow-template/workflow.json` 再导入。**每次改动必须同步更新本 skill**:

1. `kanban.columns` 增删列 → 更新「二、阶段语义」表与顶部列链图;
2. `kanban.gates` 改触发/检查器/config → 更新「三、门禁清单」表;
3. 确认标签新增/改名 → 更新「四、确认标签表」与各阶段「通过方式」;
4. `kanban.templates` 改名 → 更新建卡示例与 README 中的引用;
5. 重新导入验证(`kanban_import_config`),并在两个 SKILL.md 副本中同步(真源 + 仓库根)。

> 复制 workflow-template 到自己的仓库时,把 `skills/workflow/` 一并拷入目标仓库的 `.agents/skills/` 下,agent 即可自动加载本流程知识。
