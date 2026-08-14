# dsh-plugins-git

DSH git 插件（规划中，未实现）。

## 状态

- **M0 调研完成**：跨插件联动能力结论、通用 task 数据格式、需求与技术方案见 [PLAN.md](PLAN.md)。
- 定位：平台无关的 git 数据源插件 —— 让 kanban task 关联 GitHub 仓库 / 本地仓库 / branch / MR，并通过**注册进 kanban 的同步按钮**拉取最新 MR 与状态。
- 命名用 `git` 而非 `github`：同时覆盖远端 API（GitHub，未来 GitLab）与本地仓库（git 命令），数据格式按 provider 命名空间隔离，未来 jira 等接入时 kanban 零改动。

## 目录

```
plugins/git/
├── PLAN.md        # 需求文档 + 数据格式 + 技术方案（评审后按里程碑实施）
└── package.json   # 骨架
```

## 里程碑

M1 数据模型 v2（kanban refs/meta.sync 信封 + kanban 服务）→ M2 git 插件骨架（git 服务 + 工具 + [ID] 自动关联）→ M3 sync 按钮端到端 → M4 增强。详见 PLAN.md §5.6。
