# dsh-plugins-git

DSH git 插件：让 kanban task 关联 GitHub 仓库 / 本地仓库 / branch / MR，并提供 agent 工具与跨插件同步能力（[ID] 自动关联）。

## 状态

- M0 调研 + M1 数据模型 v2（kanban 侧 refs/taskId/meta.sync 信封，已完成）→ **M2 骨架完成**（本插件：git 服务 + 6 个工具 + GitHub API + [ID] 自动关联，构建与受限环境端到端验证通过）→ **M3 sync 按钮完成**（client 向 kanban.card.actions 槽位注册「同步」按钮 + host 暴露 git/sync RPC + MR 状态展示）
- **已在真实宿主热更新激活**（2026-08，Code Mode 会话 `cordis_define` + `cordis_run`），真实 GitHub 端到端验证通过：`git_configure`（repo + token）→ `git_claim_task_id`（`dsh-plugins-1`）→ `git_sync` 匹配远端 PR #1 标题 `[dsh-plugins-1]` → 自动补 `github-mr` ref + 写回 `meta.sync.github` 信封；M3 槽位链路验证：`kanban.card.actions` 声明可见、`git-sync` occupant active
- 详细需求与方案见 [PLAN.md](PLAN.md)

## 能力（agent 工具，前缀 `git_`）

| 工具 | 说明 |
|---|---|
| `git_configure` | 配置远端 GitHub 仓库（owner/repo）、本地仓库路径、GitHub token（写入宿主 credentials，ref 名 `GITHUB_TOKEN`） |
| `git_claim_task_id` | 为卡片认领 [ID] 约定 taskId（`<repo-name>-<int>`，同 repo 递增）；卡片未关联 github-repo 且未配置远端仓库时拒绝认领（不编造 ID） |
| `git_link` | 带验证地建立关联（github-repo / github-branch / github-mr / local-repo），写入卡片 refs |
| `git_list_mrs` | 列出仓库 open MR（GitHub PR），含标题解析出的 [taskId] |
| `git_sync` | 拉取 open MR → 按 [ID] 自动关联本卡 taskId 的 MR（补 refs）→ 写回 `meta.sync.github` 信封 |
| `git_status` | 查看卡片 taskId / refs / 同步信封（lastSyncAt / error / snapshot） |

## 跨插件服务与 UI（M3）

- 服务：`ctx.provide('git', { isConfigured, claimTaskId, link, listMrs, sync, snapshot })`；kanban 经 `ctx.get('kanban')` 被本插件读写卡片。
- 槽位：client 向 `kanban.card.actions`（kanban 声明的 list 子槽位）注册 `git-sync` 按钮；onClick → `host.call('git/sync', { cardId })`（host 半 `harness.handle` 私有 RPC，内部走 syncCard）→ 成功后调用 owner 传入的 `onSynced` 刷新看板。
- 降级：kanban 未激活/未声明槽位 → `slots.inject` 等待声明出现后执行，无按钮但插件本身可用。

## 数据

- 配置：`~/.dsh/git/config.json`（repo / localPath）
- 凭证：宿主 `credentials` 服务，ref `GITHUB_TOKEN`（值不落卡片、不进 git 历史）
- 卡片侧：refs 与 `meta.sync.github` 信封由 kanban 存储（数据模型 v2）

## 目录

```
plugins/git/
├── build.mjs / shims/            # esbuild 编译管线（同 kanban）
├── src/host/entry.ts             # git 服务 + 6 工具 + GitHub API（bash curl 优先 / ctx.web 退化）+ [ID] 解析
├── src/client/entry.tsx          # 最小客户端（M3 注册 sync 按钮）
├── scripts/verify-dist.mjs       # 受限环境验证 + 端到端逻辑测试（mock 看板/bash）
└── dist/                         # 构建产物（gitignore）
```

## 已知限制

1. 动态插件会话态：重启进程丢失，需重新 `cordis_define`；与 kanban 需在同一会话激活才可联动
2. `ctx.web.fetch` 不能带请求头（只读抓取缝隙），GitHub API 鉴权走 bash curl（token 经 env 传入，不进命令行）；无 bash 时退化匿名抓取（限流 60 req/h）
3. 本地仓库 git 命令（`ctx.shell` 跑 git）、MR 创建属 M4
