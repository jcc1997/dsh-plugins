# dsh-plugins-3 — UC 验收用例（bug 模板）

> 前置：RD（rd-confirmed）+ TD（td-confirmed）。用例按验收口径展开。

## U-1 导入后配置形态
- 步骤：kanban_import_config 导入 workflow.json。
- 期望：门禁库 11 条（新增「进入 In Dev 需建 workflow 分支」，branch-linked，to=In Dev）；模板 2 个（workflow 10 门禁不变、bug 7 门禁）；workflow 模板不引用新门禁。

## U-2 bug 模板建卡形态
- 步骤：kanban_create(template: "bug")。
- 期望：tags 含 bug/default；卡片挂 7 条门禁（无 rd/td/uc 确认门禁）；会话自动关联照常（session ref）。

## U-3 门禁链（bug 测试卡）
- U-3a 无分支：move → In Dev 被拒（branch-linked 未过），提示建 workflow 分支；
- U-3b 建分支后：git_create_branch → move → In Dev 通过；
- U-3c 无 MR：move → 1st Review 被拒（mr-linked）；关联 MR 后通过；
- U-3d 无 review-1-done：move → Testing 被 tag 门禁拒（短路，不触发评审 pipeline）；打标签后触发 agent 评审（p-workflow-review 正常运行）。

## U-4 文档同步
- 期望：workflow SKILL 双副本一致（含 bug 快捷流程小节）；README 门禁表 11 条 + 模板表 2 行。

## U-5 回归
- workflow 模板卡（如 dsh-plugins-2 已 Done 的卡）：门禁链不受新门禁影响；
- 既有门禁库实体不受新增影响。