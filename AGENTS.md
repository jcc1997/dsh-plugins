# AGENTS.md — dsh-plugins 仓库工作规则

本仓库是 DSH 插件开发仓。任何在本仓库内工作的 agent 会话先读本节，再按职责分工决定看哪份文档。

## 文档职责分工（先确认再动手）

| 文档 | 读者 | 内容 |
|---|---|---|
| README.md | 外部用户/新贡献者 | 项目介绍：是什么、能力、怎么装。**不写开发过程** |
| AGENTS.md（本文件） | 在仓库内工作的 agent | 工作规则、流程、红线 |
| .agents/skills/dsh-dynamic-plugin-dev/SKILL.md | 开发动态插件的 agent | 受限环境约束、代码模板、踩坑清单、编译管线、省 token 流程、宿主源码/跨插件联动速查（§七）。**开发前必须加载** |
| docs/ui-design/（tokens.md / style-guide.md / components.md） | 写 UI 的 agent | 设计规范：与 DSH 宿主统一、tokens 索引、风格指引、组件契约、交互细节、ADR |
| packages/ui/host/design-platform.css | 写 UI 的 agent | DSH 官方设计 tokens 权威色板快照（sync 脚本从 vendor submodule 同步） |
| plugins/<name>/README.md | 该插件的使用者/维护者 | 该插件当前状态：能力、目录、数据模型、已知问题。**不是开发过程流水账** |

## Skills 加载说明

仓库内 `.agents/skills/` 下的 skill（workflow、grill-me、dsh-dynamic-plugin-dev 等）**不是默认自动加载进每个会话**。

- 标准模式、Code 模式、workflow 模式等预设会挂载 `@deepseek-ai/dsh-skill-filesystem` + `@deepseek-ai/dsh-tool-skill`，模型才能看到 `<available_skills>` 目录，并能用 `skill` 工具按名加载；极简模式没有 skill 工具，因此不会加载项目内 skills。
- 如果当前会话工具列表里没有 `skill` 工具，说明该会话没有启用 skill 目录；此时即使看到 `/grill-me` 这样的写法，也不会自动注入 skill 内容。
- 不要假设 workflow / grill-me 等 skill 已加载。要使用某个 skill，先确认当前会话有 `skill` 工具并调用它加载；或切换到标准模式 / Code 模式 / workflow 模式等带 skill 的预设。

## 动态插件开发流程（热更新）

1. **工具门槛（两条件都满足才热更新）**：① 会话需为**创造模式**（creation mode）——`cordis_define` / `cordis_run` / `cordis_inspect_*` 是创造模式才提供的工具；② 需 **Code Mode**（`DSH_TOOLS_MODE=code`，开启 `run_code`，SDK 零粘贴切块读 submit.json 用）。缺一即拒绝热更新：产物每次全量进上下文 ≈50KB+（见 skill 第零节）。要么要求用户重开合适模式的会话，要么改走组合插件文件引用
2. 改源码 `plugins/<name>/src/` → `node build.mjs` → `node scripts/verify-dist.mjs`
3. SDK 零粘贴：run_code 内切块读入 `dist/submit.json` → `tools.cordis_define` → `tools.cordis_run`（产物不进上下文）
4. 激活成功（`cordis_inspect_self` 确认 currentPackageId）后提交 git

## 红线

1. **UI 样式一律走宿主 tokens**：直接引用 `--dsw-*`（明暗主题自动适配），禁止自建别名层、禁止硬编码颜色/间距/圆角（见 docs/ui-design/）
2. **禁止 emoji**：UI 任何位置不出现 emoji
3. **文档纪律**：README 只写对外介绍；开发过程/踩坑写进 skill；插件现状写进插件 README。提交前确认改动涉及文档时文档同步更新
4. **源码即真相**：`dist/` 产物 gitignore；一切以 `src/` 为准，动态插件会话内存态重启即失，务必及时提交源码
5. **共享优先**：跨插件复用的代码进 `packages/ui`（tokens/图标/工具函数/组件），不要在插件内复制

## 提交规范

- 类型前缀：`feat` / `fix` / `docs` / `refactor` / `chore`
- 单行信息，中文，概括改动（例：`feat(kanban): 新增 kanban_ticket_tags 工具`）
- 文档与代码同 PR/同 commit 保持同步