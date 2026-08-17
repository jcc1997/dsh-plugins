# dsh-git

DSH git 插件：让 kanban Ticket关联 GitHub 仓库 / 本地仓库 / workflow 分支 / MR，提供建分支、提 MR、同步、合并等 agent 工具，并支持跨插件服务（ctx.provide("git")）与 [taskId] 自动关联约定。

## 能力

- **配置**：`git_configure` 配置 GitHub 仓库（owner/repo）、本地仓库路径与 GitHub token（token 写入宿主 credentials，ref 名 `GITHUB_TOKEN`，不落盘明文）；
- **taskId 约定**：Ticket 自动认领 `<repo>-<int>` 形式 taskId（`[ID]` 约定）；MR 标题携带 `[taskId]` 即可被 `git_sync` 自动关联到Ticket；
- **workflow 分支/MR**：`git_create_branch` 从主分支切 `workflow/<taskId>` 并推送、自动关联 github-branch；`git_create_mr` 以 head=workflow/<taskId> 建 PR 并自动关联 github-mr；
- **同步与合并**：`git_sync` 拉取 open MR 写回Ticket meta.sync.github 快照信封；`git_merge_pr` 合并（门禁：Ticket 须处于 Stage 列），合并后自动 git_sync + 移入 Done；
- **跨插件服务**：ctx.provide("git")（isConfigured / sync / claimTaskId / link）；kanban 的 mr-merged 门禁经 gate.call 调 git.sync 拿 MR 快照判定。

## Agent 工具一览

| 工具 | 作用 |
|---|---|
| `git_configure(owner?, repo?, local_path?, token?)` | 配置远端仓库 / 本地路径 / GitHub token（任一字段可选） |
| `git_claim_task_id(card_id)` | 为Ticket认领 taskId（已有则原样返回；同 repo 递增） |
| `git_link(card_id, kind, external_id, ...)` | 建立带验证的外部关联（github-repo / github-branch / github-mr / local-repo） |
| `git_list_mrs(card_id?/owner?/repo?)` | 列出仓库 open MR 与标题解析出的 [taskId] |
| `git_sync(card_id)` | 同步Ticket关联仓库 MR 状态 → 按 [taskId] 自动关联 → 写回 meta.sync.github 信封 |
| `git_status(card_id)` | 查看Ticket taskId / refs / 同步快照信封 |
| `git_create_branch(card_id)` | workflow 分支前置：本地仓库干净且在主分支 → 切 `workflow/<taskId>` 推送 → 自动关联 github-branch |
| `git_create_mr(card_id, base?, draft?)` | RD 确认后建 MR：head=workflow/<taskId>、标题带 [taskId] → 自动关联 github-mr |
| `git_merge_pr(card_id?, owner?, repo?, mr_number, squash?)` | 合并 MR：Ticket 须处于 Stage 列（workflow 门禁）→ 合并后自动同步并移入 Done |

## 数据模型

- 配置：`~/.dsh/git/config.json`（`{ repo: {owner, name}, localPath }`）；
- 凭证：宿主 credentials，ref 名 `GITHUB_TOKEN`（git_configure 写入，不落盘明文）；
- Ticket 侧：`refs[]`（github-repo / github-branch / github-mr / local-repo）+ `meta.sync.github` 快照信封（version / lastSyncAt / error / snapshot.mrs）；
- 分支命名：`workflow/<taskId>`（如 workflow/dsh-plugins-7）；MR 标题：`[taskId] 标题`。

## 依赖与限制

- 本地 git 操作（git_create_branch）走宿主 bash/shell 服务，需要本地仓库路径（git_configure local_path）；
- 远端操作（git_create_mr / git_merge_pr / git_sync）走 GitHub REST API，需要 GITHUB_TOKEN；
- 建分支要求本地仓库干净且在 main/master；已存在同名分支时拒绝重建。

## 状态

正式 bundle 形态；与 dsh-kanban 门禁（branch-linked / mr-linked / mr-merged）配合，构成 workflow-template 的 git 侧支撑。
