# dsh-plugins-kanban

DSH 看板插件（动态插件开发版）。

## 状态

- **开发中**：当前以动态插件（cordis_define）形式运行于会话内，热更新迭代中
- 运行版本：`kbnb-2/pkg-7`（run-6）
- **待解决**：点击侧边栏"看板"按钮无反应（排查中，日志已埋点）

## 文件

| 文件 | 说明 |
|---|---|
| `src/host.js` | Host 半函数体（cordis_define code.host）：fs 持久化 + kanban/load、kanban/save、kanban/set-data-dir RPC |
| `src/client.js` | Client 半函数体（cordis_define code.client）：侧边栏按钮 + 整页看板 + 拖拽 + 详情弹窗 |
| `package.json` | 待整理为可发布 bundle（`dsh.bundle`） |

## 数据

- 默认存储：`~/.dsh/kanban/board.json`（数据目录可配置，⚙ 设置）
- 结构：`{ version, columns: [{ id, title, cards: [{ id, title, description, links[], meta{} }], meta{} }], meta{} }`

## 已知问题（排查中）

1. 点击侧边栏按钮无反应 —— 埋点日志：`sidebar button clicked` / `toggle ->` / `overlay render, open=`
2. 刷新页面后 Client 半不会自动恢复（官方设计），需在 Run 卡片重新激活

## 开发流程

1. 会话中 `cordis_define`（existing kbnb-2）粘贴 `src/host.js` / `src/client.js` 函数体
2. `cordis_run` update 切换
3. 稳定后整理为 bundle 发布版（参考 `plugins/hello` 结构）
