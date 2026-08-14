# AGENTS.md — dsh-plugins 仓库工作规则

本仓库是 DSH 插件开发仓。任何在本仓库内工作的 agent 会话先读本节，再按职责分工决定看哪份文档。

## 文档职责分工（先确认再动手）

| 文档 | 读者 | 内容 |
|---|---|---|
| README.md | 外部用户/新贡献者 | 项目介绍：是什么、能力、怎么装。**不写开发过程** |
| AGENTS.md（本文件） | 在仓库内工作的 agent | 工作规则、流程、红线 |
| .agents/skills/dsh-dynamic-plugin-dev/SKILL.md | 开发动态插件的 agent | 受限环境约束、代码模板、踩坑清单、编译管线、省 token 流程、宿主源码/跨插件联动速查（§七）。**开发前必须加载** |
| packages/ui/DESIGN.md | 写 UI 的 agent | 设计规范：与 DSH 宿主统一、tokens、组件契约、间距契约 |
| packages/ui/dsh/design-platform.css | 写 UI 的 agent | DSH 官方设计 tokens 权威色板（抽取自 dsh-client-ui-theme） |
| plugins/<name>/README.md | 该插件的使用者/维护者 | 该插件当前状态：能力、目录、数据模型、已知问题。**不是开发过程流水账** |

## 动态插件开发流程（热更新）

1. **Code Mode 门槛**：未以 `DSH_TOOLS_MODE=code` 启动时，**拒绝 cordis_define 热更新**（产物每次全量进上下文 ≈50KB+，见 skill 第零节）。要么要求用户重启开 Code Mode，要么改走组合插件文件引用
2. 改源码 `plugins/<name>/src/` → `node build.mjs` → `node scripts/verify-dist.mjs`
3. SDK 零粘贴：run_code 内切块读入 `dist/submit.json` → `tools.cordis_define` → `tools.cordis_run`（产物不进上下文）
4. 激活成功（`cordis_inspect_self` 确认 currentPackageId）后提交 git

## 红线

1. **UI 样式一律走宿主 tokens**：直接引用 `--dsw-*`（明暗主题自动适配），禁止自建别名层、禁止硬编码颜色/间距/圆角（见 DESIGN.md）
2. **禁止 emoji**：UI 任何位置不出现 emoji
3. **文档纪律**：README 只写对外介绍；开发过程/踩坑写进 skill；插件现状写进插件 README。提交前确认改动涉及文档时文档同步更新
4. **源码即真相**：`dist/` 产物 gitignore；一切以 `src/` 为准，动态插件会话内存态重启即失，务必及时提交源码
5. **共享优先**：跨插件复用的代码进 `packages/ui`（tokens/图标/工具函数/组件），不要在插件内复制

## 提交规范

- 类型前缀：`feat` / `fix` / `docs` / `refactor` / `chore`
- 单行信息，中文，概括改动（例：`feat(kanban): 新增 kanban_tags 工具`）
- 文档与代码同 PR/同 commit 保持同步