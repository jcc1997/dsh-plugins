## 文档结构更新（2026-08）

- **skill 重组**：`.agents/skills/dsh-dynamic-plugin-dev/SKILL.md` 已切换为正式 bundle 形态知识（包结构/host+client 接入/构建/HMR/发布/踩坑清单 P-H-C-B）；动态插件专用知识（受限环境/模板/SDK 零粘贴/动态踩坑/运行模型）隔离到同目录 `legacy-dynamic-plugin.md`，cordis 工具（define/run/inspect）仍可用但正式功能不依赖。
## kanban 门禁 + 创建模板（v4，2026-08）

- **门禁**：卡片挂行为门禁（move/tags/archive 触发，不通过拒绝动作）。条件类型 mr-merged（查 GitHub API + GITHUB_TOKEN）/ tag-required / field-nonempty。host 引擎 `plugins/kanban/src/host/gate.ts`；工具层 card.ts/archive.ts 动作前检查；UI 动作前调 /kanban-api/gate-check（board-hook gateCheck），抽屉「门禁」区块增删。
- **创建模板**：board.templates（description/tags/content/gates 预设），kanban_create(template=) + 创建弹窗下拉预填；4 个 kanban_template_* 工具。
- 工具总数 19 → 27（verify-dist 断言已更新）；`node scripts/smoke-gate.mjs` 端到端冒烟（模板建卡→门禁拦截→放行→显式覆盖）PASS；probe 实测 load 含 templates + gate-check 路由 200。
- 数据模型：board version 4（normalizeBoard 兼容旧板，卡片补 gates[]、板补 templates[]）；ui 包 types.ts 加 CardGate/CardTemplate。

## 新增 pipeline 插件（dsh-pipeline，2026-08）

- **位置**：`plugins/pipeline/`，正式 bundle 形态（host `lib/index.js` + client `lib/client.js` + cordis.patch.yml），与 kanban/git 同构。
- **已全部验证通过**：`pnpm --filter dsh-pipeline check`（typecheck + build + verify-dist：10 工具 / 8 路由 / pipeline 服务 / client ModuleLoader 真实执行）+ `node scripts/smoke-engine.mjs`（端到端：建 atomic → 更新节点 → 发布 0.2.0 → combined 引用 @latest → 发布 0.1.1 → 跨插件服务同步运行 → 输出正确）。
- **结构**：`src/host/models.ts`（类型+semver）、`store.ts`（~/.dsh/pipeline/pipeline.json CRUD+版本）、`engine.ts`（DAG 拓扑执行+节点 runner+RunQueue 队列）、`tools.ts`（10 个 pipeline_* 工具）、`index.ts`（路由 /pipeline-api/* + ctx.provide('pipeline')）；`src/client/`（入口+page+editor+styles）。
- **待办**：① 尚未 `dsh plugin --profile web add` 挂载（用户侧操作）；② llm 节点为占位（沙箱子 agent 延后，引擎已留 runLlm 注入点）；③ exec 节点依赖宿主 shell 沙箱执行器。
- **数据**：`~/.dsh/pipeline/pipeline.json`（pipelines+versions+runs+queue，runs 上限 200 自动裁剪）。

## 当前状态（正式形态挂载修复完成，2026-08）

- **正式形态全链路已打通（probe 实测）**：
  - 路由前缀：/api/* 被宿主 dsh-client-connection 的 prefix 路由劫持（bridge 到 apiProxy，返回 "not found"）→ 插件路由必须用自有前缀（/kanban-api/*、/git-api/sync），不要用 /api
  - **include 并发 apply 时序**：dsh 的 include 用 Promise.allSettled 并发 apply 全部 loader entries（不保证 layer 顺序）→ 插件同步 ctx.get('webServer') 可能拿到 undefined（路由静默缺失）→ 必须 export const inject = ['fs','webServer','tools'] 让 cordis 等服务就绪再激活
  - client bundle：esbuild cjs 产物需 banner 注入 `var module = { exports: {} }; var exports = module.exports;`（ModuleLoader factory 只提供 require 参数，否则 "module is not defined"）
  - client-modules 扫描：/plugins/<包名>/client.js 200 + __DSH_BOOT__ graph 含 dsh-kanban/dsh-git（扫描依赖 loader entry 的 fiber 建立，host apply 成功即进 graph）
  - 实测链路：POST /kanban-api/load 返回真实 board.json；save/git-sync 参数校验正常