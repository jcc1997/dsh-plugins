# dsh-plugins-git

DSH git 插件：让 kanban task 关联 GitHub 仓库 / 本地仓库 / branch / MR，并提供 agent 工具与跨插件同步能力（[ID] 自动关联）。

## 状态

- M0 调研 + M1 数据模型 v2（kanban 侧 refs/taskId/meta.sync 信封，已完成）→ **M2 骨架完成**（本插件：git 服务 + 6 个工具 + GitHub API + [ID] 自动关联，构建与受限环境端到端验证通过）
- 尚未在真实宿主热更新激活（需要 Code Mode 会话 `cordis_define`），首次激活若有签名偏差以 `cordis_inspect_query` 实测为准
- 详细需求与方案见 [PLAN.md](PLAN.md)

## 能力（agent 工具，前缀 `git_`）

| 工具 | 说明 |
|---|---|
| `git_configure` | 配置远端 GitHub 仓库（owner/repo）、本地仓库路径、GitHub token（写入宿主 credentials，ref 名 `GITHUB_TOKEN`） |
| `git_claim_task_id` | 为卡片认领 [ID] 约定 taskId（`<repo-name>-<int>`，同 repo 递增） |
| `git_link` | 带验证地建立关联（github-repo / github-branch / github-mr / local-repo），写入卡片 refs |
| `git_list_mrs` | 列出仓库 open MR（GitHub PR），含标题解析出的 [taskId] |
| `git_sync` | 拉取 open MR → 按 [ID] 自动关联本卡 taskId 的 MR（补 refs）→ 写回 `meta.sync.github` 信封 |
| `git_status` | 查看卡片 taskId / refs / 同步信封（lastSyncAt / error / snapshot） |

## 跨插件服务

`ctx.provide('git', { isConfigured, claimTaskId, link, listMrs, sync, snapshot })`——M3 由 git 客户端向 kanban 槽位注册 sync 按钮时经此调用；kanban 经 `ctx.get('kanban')` 被本插件读写卡片。

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
3. 本地仓库 git 命令（`ctx.shell` 跑 git）、MR 创建、sync 按钮 UI 属 M4/M3
