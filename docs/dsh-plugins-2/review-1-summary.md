# dsh-plugins-2 — 1st Review 变更摘要

> MR: https://github.com/jcc1997/dsh-plugins/pull/4（workflow/dsh-plugins-2 → main，5 commits）
> 本文件是 1st Review 的评审材料：改动全貌 + 设计要点 + 验证结果。评审通过 → review-1-done → 重启 dsh 后 agent 评审 pipeline 复验（B 组）。

## 改动清单

### 需求二：pipeline 插件改造（plugins/pipeline）

| 文件 | 改动 |
|---|---|
| src/host/engine.ts | llm 节点 fail-closed（无 runLlm 即节点失败，替换原「占位成功」）；verdict 尾行解析（REVIEW_VERDICT:{"ok":true|false,"issues":[...]}）；ok:false/解析失败 → error 带 issues 摘要 → pipeline 失败；cardIdPath 插值透传 |
| src/host/store.ts | 新增 importPipelines（按稳定 id 幂等 upsert：内容比对防空转、发布草稿本身不 bump、重复导入不产生新版本） |
| src/host/tools.ts | 新增 pipeline_import_config 工具（第 12 个） |
| src/index.ts | runLlm 接线宿主 subagents 服务（spawn：parent/signal 透传 + persona/toolFilter 精简 + 上轮评审意见注入续评）、/pipeline-api/import 路由 |
| scripts/verify-dist.mjs | 工具数 11→12、import 路由断言 |
| scripts/.engine-test-entry.ts + .run-engine-test.mjs | 引擎级回归测试（UC A 组，13 例） |

### 需求一：Review Agent（workflow-template + kanban）

| 文件 | 改动 |
|---|---|
| workflow-template/pipelines.json（新） | 「代码评审」pipeline 定义（稳定 id p-workflow-review，input→llm→output，published） |
| workflow-template/prompts/review.md（新） | review prompt 真源：代码逻辑 + 设计规范（docs/ui-design、--dsw-* tokens、AGENTS.md 红线）+ 文档纪律；verdict 尾行契约；判定纪律（≥medium 未解决即不通过） |
| workflow-template/agent-presets/review/（新） | 精简评审预设：仅 fs+bash（token 节省，不挂 skills/web/subagent） |
| workflow-template/workflow.json | Testing 双门禁：保留 tag-required review-1-done + 新增 pipeline 门禁（p-workflow-review） |
| plugins/kanban/src/host/gate.ts | pipeline 门禁失败自动落卡评论（native + preset 双路径；与最后一条相同不重复写） |
| plugins/kanban/src/index.ts | kanbanService 新增 addComment（含去重） |
| workflow-template/skills/workflow/SKILL.md ×2 + README.md | 门禁表/阶段表/标签表/新增「三-bis review pipeline」小节；README 导入流程补 pipeline_import_config |
| plugins/pipeline/README.md | llm 节点现状、import 工具、限制更新 |

### 顺带修复

| 文件 | 改动 |
|---|---|
| plugins/git/src/index.ts | fix: linkRef external_id 兼容驼峰参数（此前 git_create_branch/git_create_mr 自动关联一直失败） |

## 设计要点（与 TD 一致）

1. **fail-closed 优先**：llm 节点未接入 agent 服务时 pipeline 失败 → 门禁拒绝；绝不假放行。
2. **双门禁**：人审标签 + agent 评审 pipeline 都过才进 Testing。
3. **续评（上下文注入式）**：cardIdPath 传 card.id，接线层读卡片上一条「评审未通过」评论注入 prompt，agent 逐条核验修复情况。
4. **token 节省**：review 预设只挂 fs+bash；评审规范由 agent 自己读仓库文件。
5. **评审意见落卡评论**（失败时）+ 拒绝原因带摘要。
6. **模板可移植**：pipelines.json + 稳定 id + pipeline_import_config，新环境导入即用。

## 验证结果

- 引擎级测试（mock runLlm）：**13/13 PASS**（A-1 fail-closed / A-2 ok:false / A-3 ok:true / A-4 非法 verdict / A-5 导入幂等 / A-6 cardIdPath 插值）
- 插件构建 + workflow-ci-check（kanban/git/pipeline/markdown-review）：**ALL PASS**
- 线上环境：pipeline 存储已含 p-workflow-review v0.1.0（published）；看板门禁库 10 条（含新 pipeline 门禁）；模板已挂 10 门禁；review 预设已装 ~/.dsh/.agent-presets/review/
- 宿主级（B 组）验证需在**重启 dsh 后**进行：move→Testing 触发真实 agent 评审（本会话宿主仍跑旧插件 bundle，不在此处触发，避免假放行）

## 待办（重启 dsh 后）

1. 新会话执行 B-1 ~ B-7（UC 文档）：
   - B-1 缺 review-1-done 先被 tag 门禁拒；
   - B-2 含违规分支 move → 评审拒绝 + 卡评论；
   - B-3 修完续评通过（会话连续性）；
   - B-5 设计规范维度生效；
   - B-6 pipeline_import_config 再导一遍（验证幂等 + 工具可用）；
   - B-7 review agent 上下文精简观察。