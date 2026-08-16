# dsh-plugins-3 — TD 技术设计（bug 模板）

> 前置：RD 已 rd-confirmed。改动为配置+文档级，无插件代码改动（不改 pipeline/kanban 源码，仅 workflow-template 配置与 skill 文档）。

## 1. 改动清单

| 文件 | 改动 |
|---|---|
| workflow-template/workflow.json | ① 门禁库新增「进入 In Dev 需建 workflow 分支」（branch-linked，on=move，to=In Dev）；② templates 新增「bug」模板（description/tags=[bug,default]/gates 7 条） |
| workflow-template/skills/workflow/SKILL.md + .agents 副本 | 新增「bug 快捷流程」小节（编排+门禁集）；「人工审批分两类」确认方式修订（RD/TD 用 md_doc_open，其余 ask_user_question + MR 链接） |
| workflow-template/README.md | 门禁清单表 10→11 条、模板表补 bug 行、编排示例补 bug 流程 |
| docs/dsh-plugins-3/ | rd.md（已确认） |

## 2. bug 模板门禁集（7 条，引用门禁库 id）

1. 进入 In Dev 需建 workflow 分支（新增，branch-linked）
2. 进入评审需关联 MR（mr-linked）
3. 1st review 通过才能测试（tag-required review-1-done）
4. Review pipeline 通过才能进 Testing（pipeline p-workflow-review）
5. 测试通过才能进 2nd review（tag-required tests-passed）
6. 2nd review 通过才能 Stage（tag-required review-2-done）
7. MR 已合并才能进 Done（mr-merged）

> 不挂：进入 RD 需建 workflow 分支（workflow 专用）、rd-confirmed、td-confirmed、uc-confirmed。

## 3. workflow.json 结构变化

```json
kanban.gates: [...] + { name: "进入 In Dev 需建 workflow 分支", on: "move", to: "In Dev", checker: { type: "branch-linked", config: {} } }
kanban.templates: [ workflow, { name: "bug", description: "...", tags: ["bug","default"], gates: [7 条名字] } ]
```

## 4. 验证（导入后）

- kanban_import_config 导入后：门禁库 11 条、模板 2 个；
- 建 bug 测试卡：无分支 move→In Dev 拒；建分支后过；无 MR move→1st Review 拒；关联 MR 后过；无 review-1-done move→Testing 被 tag 门禁拒（门禁不短路：pipeline 门禁同样会触发 agent 评审）；
- workflow 模板不受影响（仍 10 门禁）。

## 5. 风险

- kanban_import_config 整体替换配置层：旧卡挪第一列、门禁挂载清除——导入后需重挂本卡门禁并移回原列；
- 门禁库新增门禁不影响既有卡片（门禁是卡片级引用）。