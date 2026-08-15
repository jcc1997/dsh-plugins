# dsh-plugins-2 — UC 验收用例（Review Agent + pipeline 插件改造）

> 前置：RD（rd-confirmed）+ TD（td-confirmed）。经 md_doc_open 人审通过（打 uc-confirmed）后进 In Dev。
> 用例按两个 Main Requirement 分组；宿主级用例（需重启 dsh）标注 [宿主级]。

## A. 需求二：pipeline 插件改造（引擎级，本会话可验）

### A-1 llm 节点 fail-closed（无 runLlm）
- 前置：构造 pipeline（input → llm → output），引擎 executePipeline 不注入 runLlm。
- 步骤：运行该 pipeline。
- 期望：llm 节点 failed，pipeline 整体 failed，error 含「未接入 agent 服务 / runLlm 未注入」；**不是**占位成功。
- 关联：TD §3.4 / RD §4.3.1。

### A-2 verdict ok:false → pipeline 失败
- 前置：注入 mock runLlm（返回 `...REVIEW_VERDICT:{"ok":false,"issues":[{"file":"a.ts","location":"L10","severity":"high","message":"越界"}]}`）。
- 步骤：运行 llm 节点 pipeline。
- 期望：节点结果带 error「评审未通过：a.ts:L10 越界」，pipeline failed，run.output 保留 agent 文本与 verdict 结构。
- 关联：TD §3.4 / RD §4.3.1。

### A-3 verdict ok:true → 通过
- 前置：mock runLlm 返回 `REVIEW_VERDICT:{"ok":true,"issues":[]}`。
- 步骤：运行。
- 期望：节点 success，pipeline success，output 含 `verdict: {ok:true}`。
- 关联：TD §3.4。

### A-4 verdict 格式非法 → fail-closed
- 前置：mock runLlm 返回不含 REVIEW_VERDICT 的文本。
- 步骤：运行。
- 期望：pipeline failed，error 提示 verdict 解析失败（提示 prompt 格式要求）。
- 关联：TD §3.4 / RD §4.3.1。

### A-5 pipeline_import_config 幂等导入
- 前置：准备 pipelines.json（含 id `p-workflow-review`）。
- 步骤：① 导入 → ② 再导入一次。
- 期望：① 返回 created，`pipeline_get('p-workflow-review')` 命中且节点正确（in/review/out，llm config 含 prompt 与 timeoutMs）；② 返回 updated，节点内容与①一致，不产生多余版本（published 重复导入不 bump patch）。
- 关联：TD §4 / RD §4.3.3。

### A-6 会话连续性（engine 层契约）
- 前置：runLlm 注入点按 sessionKey 分发（接线层实现，引擎层验证 prompt 插值与 config 传递）。
- 步骤：engine 对 `config.sessionKey` 做占位符插值（`{input.card.id}` → 实际值）。
- 期望：llm 节点 config.sessionKey 正确插值后传给 runLlm。
- 关联：TD §3.2。

## B. 需求一：Review Agent（宿主级，用户重启 dsh 后验证）

### B-1 双门禁：缺人审标签先被拒
- 前置：测试卡处于 1st Review，已关联 MR，卡片无 review-1-done。
- 步骤：`kanban_move(card, "Testing")`。
- 期望：被 tag 门禁拒绝（缺 review-1-done），**不触发**评审 pipeline。
- 关联：RD §4.2.4。

### B-2 agent 评审未 OK → 拒绝 + 卡评论
- 前置：测试分支故意含一个违规（如 UI 硬编码颜色 / 出现 emoji），打上 review-1-done。
- 步骤：move → Testing。
- 期望：评审 pipeline 运行后拒绝；拒绝原因带 issues 摘要；卡片出现评审评论（含问题清单）；**不**进 Testing。
- 关联：RD §4.2.6 / §4.2.5。

### B-3 修完问题续评通过（会话连续性）
- 前置：B-2 失败后，修复违规并提交推送（不重启 dsh）。
- 步骤：再次 move → Testing。
- 期望：评审 agent **续评**（记得上轮 findings，可对比其输出/评论确认不是全新评审）；本轮无未解决问题 → REVIEW_VERDICT ok:true → 门禁通过 → 进 Testing。
- 关联：RD §4.2.5。

### B-4 通过后不刷「评审通过」评论
- 步骤：B-3 通过后查看卡评论。
- 期望：无新增「评审通过」类评论（仅失败落评论）。
- 关联：RD §4.2.6。

### B-5 设计规范维度生效
- 前置：测试分支含 tokens 违规（硬编码颜色/圆角，未走 --dsw-*）。
- 步骤：move → Testing（有 review-1-done）。
- 期望：评审意见明确指出设计规范违规（引用 docs/ui-design 或 --dsw-* 规则）。
- 关联：RD §4.2.3 / §4.2.2。

### B-6 模板导入流程
- 前置：新环境（或清空看板配置 + pipeline 仓库）。
- 步骤：`pipeline_import_config`（pipelines.json）→ `kanban_import_config`（workflow.json）→ 建卡 move 到 Testing。
- 期望：门禁引用 `p-workflow-review` 生效（不报「pipeline 不存在」），评审流程可跑。
- 关联：RD §4.2.4 / §4.3.3。

### B-7 review agent 上下文精简
- 步骤：宿主级观察评审运行（或审查 review 预设）。
- 期望：review agent 不加载 skills/web/subagent 等能力；其工具集仅 fs/bash（+ 必要的 git 能力）；评审所需源码/文档上下文完整。
- 关联：TD §3.3 / RD §4.2.2。

## C. 回归

### C-1 既有 pipeline 行为不变
- 步骤：运行「三插件验证」（exec 节点）与 demo pipeline。
- 期望：行为与改动前一致（exec/fetch/transform 不受影响）。
- 关联：TD §7。

### C-2 其他列门禁不变
- 步骤：抽查 2nd review / Stage / Done 门禁。
- 期望：与改动前一致。
- 关联：RD §2 非目标。

## 通过口径

- A 组（引擎级）：A-1 ~ A-6 全过（本会话，mock runLlm 直跑引擎 + pipeline_import_config 实测）。
- B 组（宿主级）：B-1 ~ B-7 全过（用户重启 dsh 后新会话验证；B-3 验证续评）。
- C 组：C-1 ~ C-2 全过。
