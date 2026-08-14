## 当前状态（正式形态挂载修复完成，2026-08）

- **正式形态全链路已打通（probe 实测）**：
  - 路由前缀：/api/* 被宿主 dsh-client-connection 的 prefix 路由劫持（bridge 到 apiProxy，返回 "not found"）→ 插件路由必须用自有前缀（/kanban-api/*、/git-api/sync），不要用 /api
  - **include 并发 apply 时序**：dsh 的 include 用 Promise.allSettled 并发 apply 全部 loader entries（不保证 layer 顺序）→ 插件同步 ctx.get('webServer') 可能拿到 undefined（路由静默缺失）→ 必须 export const inject = ['fs','webServer','tools'] 让 cordis 等服务就绪再激活
  - client bundle：esbuild cjs 产物需 banner 注入 `var module = { exports: {} }; var exports = module.exports;`（ModuleLoader factory 只提供 require 参数，否则 "module is not defined"）
  - client-modules 扫描：/plugins/<包名>/client.js 200 + __DSH_BOOT__ graph 含 dsh-kanban/dsh-git（扫描依赖 loader entry 的 fiber 建立，host apply 成功即进 graph）
  - 实测链路：POST /kanban-api/load 返回真实 board.json；save/git-sync 参数校验正常
- **待用户重启验证**：web 侧边栏「看板」入口（bundle 形态）、19+7 工具、HMR 开发模式（build --watch 热重载）
- **注意**：宿主静态 git_* 7 个工具（agent preset）与 bundle 同名——host root scope 与 agent scope 允许同名（scope-filtered），不冲突

## 当前状态（正式 bundle 形态迁移完成，2026-08）

- **插件已从动态形态迁移为正式 bundle 形态**（动态插件废弃）：
  - dsh-kanban / dsh-git：标准 cordis 模块（lib/index.js host + lib/client.js client/ModuleLoader）、dsh.bundle+dsh.client 声明、cordis.patch.yml、peerDeps（@deepseek-ai/cordis、@deepseek-ai/dsh-tools）
  - 数据通道：host 半 ctx.webServer.register 暴露 /api/kanban/*、/api/git/sync；client 半 fetch 调用（替代 host.call）；agent 工具 ctx.tools.register(defineTool(...))（parameters 需 DSL 适配：直接属性映射 + required 属性级注解）
  - 已挂载 web profile（link: 本地），cordis.patch.yml 加了 @deepseek-ai/cordis-plugin-hmr（host HMR）+ web-app 自带 dsh-client-hmr（client HMR，配合 build --watch）
  - 开发模式：改 src → node build.mjs（或 --watch）→ host 自动重载 / client 经 SSE rebuilt 帧热换，**不再需要 cordis_define/批准，重启不丢**
- **待验证（用户重启 dsh 后）**：侧边栏「看板」入口；19 个 kanban_* + 7 个 git_* 工具注册；/api/kanban/load 等路由；HMR 链路（改源码自动重载）
- **迁移踩坑**：esbuild external 用通配符字符串（正则报错）；无 intro 选项；python3 -c + JSON.stringify 会把换行变字面 \n（脚本须写文件执行）；defineTool 的 parameters 形状与动态 DSL 不同；profile link: 安装时 workspace:* 依赖无法解析（已把 @dsh-plugins/* 打进 bundle 并移除 dependencies）
