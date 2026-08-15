# HANDOFF — 跨会话接手速览

> 本文件供跨会话接手的 agent 先读（AGENTS.md 职责表声明）。更新于 2026-08-15。

## 当前状态

- 分支：`main`（近期提交集中在 UI 规范 / markdown-review / pipeline 重构）。
- 工作区应保持干净；提交规范见 AGENTS.md（feat/fix/docs/refactor/chore + 中文单行）。

## 重建与激活

```sh
pnpm install
git submodule update --init --recursive   # vendor/deepseek-harness（sparse: ui-primitives + ui-theme + runtime-diagnostics/invariants）
node scripts/sync-host-tokens.mjs          # tokens 快照（packages/ui/host/design-platform.css）
pnpm --filter dsh-markdown-review build    # 插件产物（lib/）
pnpm --filter dsh-pipeline build
cd apps/ui-showcase && pnpm dev            # 组件 showcase（http://127.0.0.1:5173，含暗黑 toggle/左侧导航）
```

宿主侧：插件经 `dsh plugin --profile web add <插件路径>` 挂载；改 host 半代码后需重启 dsh。

## 关键事实速查

- **UI 规范**：`docs/ui-design/`（tokens.md / style-guide.md / components.md + ADR 1-11），tokens 唯一来源 `packages/ui/host/design-platform.css`（勿手改，跑 sync 脚本）。
- **宿主桥**：`packages/ui/host/`（icons.ts 直接 re-export vendor 图标集，零复制零漂移）。
- **宿主槽位**（详见 skill §3.5，五种模式）：sidebar.footer.action（全屏入口）/ conversation.view（会话 tab）/ tool.call.toolview（工具卡接管）/ **conversation.input.dock**（todo 式常驻条，宽度用宿主 TodoPanel 同款 calc 公式）/ 注入他人槽位。
- **已知坑**：宿主浅色主题 `bg-layer-*` 全为白（嵌套区分用 markdown-inline-code 浅灰）；`--dsw-alias-brand-primary` 浅色=近黑（链接用 state-business-primary）；主按钮近黑反色是宿主语义；esbuild minify 中文转 \uXXXX。

## 下一步建议

- review 并 refactor `plugins/kanban`（第三个插件，按钮漂移等共性问题预计同样存在）。
- pipeline dock 条后续可考虑：运行中进度细化、折叠态记忆。
