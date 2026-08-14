## 文档结构更新（2026-08）

- **skill 重组**：`.agents/skills/dsh-dynamic-plugin-dev/SKILL.md` 已切换为正式 bundle 形态知识（包结构/host+client 接入/构建/HMR/发布/踩坑清单 P-H-C-B）；动态插件专用知识（受限环境/模板/SDK 零粘贴/动态踩坑/运行模型）隔离到同目录 `legacy-dynamic-plugin.md`，cordis 工具（define/run/inspect）仍可用但正式功能不依赖。
## 当前状态（正式形态挂载修复完成，2026-08）

- **正式形态全链路已打通（probe 实测）**：
  - 路由前缀：/api/* 被宿主 dsh-client-connection 的 prefix 路由劫持（bridge 到 apiProxy，返回 "not found"）→ 插件路由必须用自有前缀（/kanban-api/*、/git-api/sync），不要用 /api
  - **include 并发 apply 时序**：dsh 的 include 用 Promise.allSettled 并发 apply 全部 loader entries（不保证 layer 顺序）→ 插件同步 ctx.get('webServer') 可能拿到 undefined（路由静默缺失）→ 必须 export const inject = ['fs','webServer','tools'] 让 cordis 等服务就绪再激活
  - client bundle：esbuild cjs 产物需 banner 注入 `var module = { exports: {} }; var exports = module.exports;`（ModuleLoader factory 只提供 require 参数，否则 "module is not defined"）
  - client-modules 扫描：/plugins/<包名>/client.js 200 + __DSH_BOOT__ graph 含 dsh-kanban/dsh-git（扫描依赖 loader entry 的 fiber 建立，host apply 成功即进 graph）
  - 实测链路：POST /kanban-api/load 返回真实 board.json；save/git-sync 参数校验正常