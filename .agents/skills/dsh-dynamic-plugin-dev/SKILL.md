# dsh-plugins 插件开发（正式 bundle 形态）

> 插件开发已切换为**正式 bundle + HMR** 形态（2026-08 迁移完成）。动态插件（`cordis_define`）工具仍可用，但仅作会话内快速原型/调试通道；其完整专用知识（受限环境/模板/SDK 零粘贴/动态踩坑）已隔离到 [legacy-dynamic-plugin.md](legacy-dynamic-plugin.md)，**正式功能一律按本文件的正式形态写**。在 `dsh-plugins` 大仓开发插件前先加载本 skill。

## 零、当前形态与开发流

- **正式 bundle**：标准 cordis 模块 → esbuild 双产物（`lib/index.js` host + `lib/client.js` client）→ `dsh plugin --profile web add <路径>` 挂 profile → 重启生效、重启不丢、无需 cordis_define/批准。
- **开发 = 改源码 + HMR**：`node build.mjs --watch` 重写产物 → host 半由 `@deepseek-ai/cordis-plugin-hmr` 热重载；client 半由 `dsh-client-hmr`（web-app 内置）+ SSE rebuilt 帧热换（刷新页面即新 bundle）。**不再需要 cordis_define**，源码即真相。
- **cordis 工具保留**：`cordis_define` / `cordis_run` / `cordis_inspect_*` / `cordis_stop` / `cordis_undefine` 仍然可用（会话内动态原型/调试），但插件源码一律按正式形态写。
- 样板：本仓库 `plugins/kanban`（dsh-kanban）、`plugins/git`（dsh-git）已全量迁移；部署迁移规划见 `plugins/git/PLAN.md` §8（含社区样板 §8.6）。

## 一、正式 bundle 开发

### 1.1 包结构（样板：dsh-kanban / dsh-git）

```
plugins/kanban/
├── package.json      # name: dsh-kanban；main lib/index.js；exports（. / ./client / ./package.json）；
│                     #   files（lib、cordis.patch.yml）；dsh.bundle.patch + dsh.client{inject,platform:web}；
│                     #   peerDeps（@deepseek-ai/cordis、@deepseek-ai/dsh-tools）；workspace 包已内联进 bundle，不列 dependencies
├── cordis.patch.yml  # - insert: [{ id: kanban, name: dsh-kanban }]（行 name = 包名；loader 按包 main 解析 host 半）
├── src/index.ts      # host 半：标准 cordis 插件（export const name/inject/apply）
├── src/client/index.ts # client 半：标准 cordis 插件（export const name/inject/apply，ClientContext）
├── build.mjs         # esbuild 双产物（见 1.4）
├── scripts/verify-dist.mjs # node 冒烟（host import + client 真实执行，见 1.6）
└── lib/              # 构建产物（gitignore；npm pack 由 files 白名单带入）
```

### 1.2 host 半（src/index.ts）

```ts
import { defineTool } from '@deepseek-ai/dsh-tools'
export const name = 'kanban'
// ★ 必须声明全部宿主服务依赖：cordis 等所有服务就绪后才激活 apply
export const inject = ['fs', 'webServer', 'tools' /*, 'credentials', 'shell' ... */]
export function apply(ctx) {
  // 工具注册：defineTool + ctx.tools.register；parameters 需 DSL 适配（见坑 H2）
  // 数据通道：ctx.webServer.register({ kind:'exact', path:'/xxx-api/...', handler })（见坑 H1）
  // 跨插件服务：ctx.provide('kanban', {...})
  // 网络：node 原生 fetch（正式形态 node 环境，可直接带 header；见坑 H4）
}
```

- **宿主服务**：`fs`（board.json）、`webServer`（HTTP 路由）、`tools`（工具注册）、`credentials`（token）、`shell`（沙箱执行器——**不要用于网络**）、`web`（无 header fetch）等；运行时签名用 `cordis_inspect_query` → Service.listService。
- **跨插件服务/槽位契约**（kanban/git 之间）：`ctx.provide('kanban')`（getCard/updateCard/listCards）、`ctx.provide('git')`（isConfigured/claimTaskId/link/listMrs/sync/snapshot）、槽位 `kanban.card.actions` / `conversation.view`——与动态形态一致，见 legacy §八。

### 1.3 client 半（src/client/index.ts）

```ts
import React from 'react'
export const name = 'kanban'
export const inject = ['slots', 'sessions']
export function apply(ctx) {
  // 样式：document.createElement('style') 注入（正式形态无 styles 全局；data-plugin-css 幂等）
  // 数据通道：hostBridge = fetch('/xxx-api/...')（client 半在浏览器，fetch 可用）
  // 槽位：ctx.slots.inject('sidebar.footer.action', ...) 同动态形态；子槽位 children 声明同
}
```

- `ClientContext` = 完整 cordis Context（服务经 declaration merging 注入：slots/sessions/workspaces…）。
- **数据通道**：client 半 fetch host 的 webServer 路由（`/kanban-api/load` 等），替代动态形态的 host.call。
- 构建要求：**jsx: 'automatic'** + **ModuleLoader banner**（见 1.4 与坑 C1/C2）。

### 1.4 构建（build.mjs，esbuild 双产物）

```js
// host：ESM node；@deepseek-ai/* external（宿主解析）；@dsh-plugins/* 打进包
await build({ entryPoints: ['src/index.ts'], format: 'esm', platform: 'node', external: ['@deepseek-ai/*'], outfile: 'lib/index.js' })
// client：CJS browser + ModuleLoader 包装
await build({
  entryPoints: ['src/client/index.ts'],
  format: 'cjs', platform: 'browser',
  jsx: 'automatic',  // ★ JSX 编译为 jsx-runtime 调用（不依赖 React 全局标识符）
  external: ['react', 'react/jsx-runtime', 'react-dom', '@deepseek-ai/*'], // ModuleLoader seed 表提供 react 等
  banner: { js: 'var module = { exports: {} }; var exports = module.exports; window.__ModuleLoader__.load({ id: ' + JSON.stringify(pkg.name) + ', factory: (require) => {' },
  footer: { js: 'return module.exports; } });' },
  outfile: 'lib/client.js',
})
```

### 1.5 挂载 / HMR / 发布 / 验证

- **挂载**：`dsh plugin --profile web add /abs/path/to/plugin`（官方 CLI，自动改 profile package.json + bundles + 应用 bundle patch）。**禁止手改 profile patch 手动 insert**（坑 P1）。改 profile 前后必跑 `dsh --profile web --dump-config` 验证（坑 P2）。
- **HMR**：host 侧 profile 的 cordis.patch.yml 挂 `@deepseek-ai/cordis-plugin-hmr`（config.root 指向插件 src 目录）；client 侧 web-app 已内置 `dsh-client-hmr`（配合 build --watch）。
- **发布**：`npm run check`（typecheck + build + verify）→ `npm publish`（默认 latest；rc 用 `--tag next`）或 `npm pack` 挂 GitHub Release（tag v\*.*.* 触发 CI）。包名 `dsh-<name>`（无 -plugin 后缀，对齐官方 `@deepseek-ai/dsh-*` 与社区）。
- **验证**（scripts/verify-dist.mjs，两层）：① host：node import lib/index.js + mock ctx（fs/webServer/tools mock）断言工具数/路由/服务；② client：`new Function(clientJs)` 在 `global.window.__ModuleLoader__` mock 下执行，捕获 factory，用 createRequire 提供 external，断言导出 { name, inject, apply }（防 module is not defined 类回归）。
- **probe 实例**（改 host/路由后必做，不打扰运行中实例）：`dsh --profile web --port 0 --host 127.0.0.1` 后台起独立实例 → curl 验证 `/xxx-api/load` 等路由 + `/plugins/<包名>/client.js` 200 + `__DSH_BOOT__` graph 含包。

## 二、踩坑清单（正式形态，全部实测）

### P 挂载 / Profile（能直接干崩 dsh 启动）
P1. **bundle 插件禁止手动 insert**：`dsh plugin add` 已自动应用 bundle 的 cordis.patch.yml；再手动 insert 同插件 → 加载两份 → `service "xxx" has been registered at <Include>`，dsh 起不来。挂 bundle 一律官方 CLI。
P2. **改 profile 前先 `dsh --profile web --dump-config` 验证**（只打印配置树不启动）：暴露 patch 结构错误与重复层。**"我改个配置让你重启"是错误姿势——必须先本地验证再让用户重启**。
P3. **profile cordis.patch.yml 顶层格式**：顶层是 patch 指令数组（`- insert:` / `- remove:`）；初始 `[]` 与追加的 `- insert:` 混排 = 两个元素（第一个是空数组），结构错误。追加要替换整个 `[]` 行。

### H host 半
H1. **路由不能用 /api 前缀**：宿主 `dsh-client-connection` 用 `prefix: '/api'` 劫持整个 /api（bridge 到 apiProxy，无则 "not found"）——exact 路由注册了也匹配不到。插件路由用自有前缀（`/kanban-api/*`、`/git-api/sync`）。
H2. **include 并发 apply 时序**：dsh 的 include 用 Promise.allSettled 并发 apply 全部 loader entries（不保证 layer 顺序）→ apply 里同步 `ctx.get('webServer'/'credentials'/...)` 可能拿到 undefined（路由/凭据静默缺失，进程不报错）。**必须 `export const inject = [...]` 声明全部宿主服务依赖**，cordis 等服务就绪才激活。
H3. **defineTool 的 parameters 形状**：dsh-tools 的 ParameterSchemaSpec 是**直接属性映射**（`{ prop: { type, description, required?: true } }`），不是动态 DSL 的 `{ type:'object', properties, required }` 包装。注册前转换：把 properties 摊平 + required 转属性级 `required: true`。
H4. **shell 是沙箱执行器，不能用于网络**：`ctx.shell`（dsh-bash-sandbox）直接调用走 deployment policy，curl 无输出（status 0）；`ctx.web` 不能带 header（无法鉴权）。**正式形态 node 环境直接用原生 fetch**（带 Authorization header）。宿主的 bash 工具服务叫 `tool-bash`（消费 ctx.shell），inject 用 `shell` 不是 `bash`。
H5. **工具名 scope**：宿主 agent preset 可能注册同名工具（如 git_*）——host root scope 与 agent scope 允许同名（scope-filtered），不冲突。

### C client 半
C1. **jsx 必须 automatic**：build 默认 transform 模式把 JSX 编译成裸 `React.createElement`——**没有 import React 的文件**（如 @dsh-plugins/ui 的 icons.tsx，动态形态靠全局注入所以没事）→ 正式形态渲染时 `React is not defined`。`jsx: 'automatic'` 走 jsx-runtime（ModuleLoader seed 表里有 react/jsx-runtime）。
C2. **client bundle 需注入 module/exports**：esbuild CJS 产物引用 `module`/`exports`，而 ModuleLoader factory 只提供 `require` 参数 → `module is not defined`。banner 最前注入 `var module = { exports: {} }; var exports = module.exports;`。esbuild 无 `intro` 选项（那是 rollup 的）。
C3. **client-modules 扫描依赖 fiber**：`/plugins/<包名>/client.js` 由 dsh-client-modules serve（id = 包名，非 entry id）；扫描条件 `loader.entries() 中 options.name === 包名 && entry.fiber 已建立`——host apply 成功（fiber 建立）即进 `__DSH_BOOT__` graph。bundle 缺失（未构建）会整组失败。
C4. **ModuleLoader seed 表**（web 端 staticModules）：`react` / `react/jsx-runtime` / `react-dom` / `@deepseek-ai/cordis` / `@deepseek-ai/dsh-client-ui-slots` 等是平台词——client bundle 的 external 只能命中这些；其他包必须打进 bundle（build-time externals drift 会报 "missed the module table"）。

### B 构建 / 工程
B1. **esbuild external 用通配符字符串**（`'@deepseek-ai/*'`），不支持正则数组（报 "Expected value for external to be a string"）。
B2. **lib/ 产物 gitignore，npm pack 由 files 白名单带入**（与动态 dist/ 同理：源码即真相）。
B3. **workspace 依赖内联**：@dsh-plugins/*（ui、communication）必须打进 bundle（esbuild 默认 noExternal），package.json **不列 dependencies**——否则 profile link: 安装时 workspace:* 解析失败。
B4. **python3 -c + JSON.stringify 会把换行变字面 \n**（脚本语法错误）——多行脚本写成 .py 文件再执行，并检查 bash 退出码。
B5. **read 截断 write 回写**（通用）：`read({limit:N})` 后基于截断内容 write = 文件被截断。整文件 write 必须基于完整内容（limit 2000）；定点修改用 edit。
B6. **模板字符串嵌套反引号**（通用）：含反引号文本塞进模板串会炸，用行数组 push/join 规避。
B7. **verify 必须真实执行 client bundle**（模拟 window.__ModuleLoader__ + factory(require)），只 grep banner 抓不住 module is not defined 类回归。

## 三、宿主机制速查（源码级实测，省 token）

### 3.1 源码在哪

- **`vendor/deepseek-harness` 是 sparse submodule**：只有 client/ui-primitives 参考源码，**没有宿主核心**。
- **宿主真实实现在 DSH 运行时缓存**（pnpm dlx checkout，路径形如 `~/Library/Caches/pnpm/dlx/<hash>/node_modules/.pnpm/@deepseek-ai+...`）。常用包：
  - `@deepseek-ai/dsh-client-modules`：client bundle 服务（/plugins/<包名>/client.js + __DSH_BOOT__ graph + ModuleLoader 浏览器半）
  - `@deepseek-ai/dsh-client-hmr`：client HMR（node 半 stat-poll bundle + SSE /plugins/events；web-app 无条件挂载）
  - `@deepseek-ai/dsh-host-webserver`：`ctx.webServer`（exact/prefix 路由 + fallback；/api 被 client-connection 的 prefix 劫持）
  - `@deepseek-ai/dsh-tools`：`ctx.tools`（ToolRuntime.register(defineTool(...))）+ 工具 DSL
  - `@deepseek-ai/dsh-client-connection`：/api 网关（bridge 到 apiProxy）+ 浏览器 fetch/SSE 客户端
  - `@deepseek-ai/dsh-cordis-host-runner` / `dsh-cordis-client-runner`：动态插件 runner（legacy）
  - `@deepseek-ai/dsh-tool-cordis`：cordis 工具 + SERVICE_API（宿主服务目录 60 键）

### 3.2 HMR / client 加载机制

- client bundle 由 client-modules serve：`/plugins/<包名>/client.js?rev=<hash>`；`window.__DSH_BOOT__`（index.html 首 script）携带 graph（id=包名、inject 边、immediately）。
- client bundle 内容：`window.__ModuleLoader__.load({ id, factory: (require) => {...} })`；factory 的 require 命中 seed 表（react 等平台词）→ graph rows → 其他 bundle。
- HMR：build watch 重写 bundle → dsh-client-hmr node 半 stat-poll 到 rev 变化 → SSE rebuilt 帧 → 浏览器半 invalidate + prefetch + fiber 换。host 侧 `@deepseek-ai/cordis-plugin-hmr` watch 源码重载。
- **cordis 服务是全局 store（root isolate 键）**：任意插件 ctx.get 可见、重复 provide 抛错、停用自动失效。

### 3.3 槽位 / 会话联动

- 槽位：`slots.inject(key, () => slots.register({ name, id, order, label, children? }, Comp))`；子槽位声明（children）独占渲染授权（Declaring is claiming）；跨条目渲染走服务桥接（见 legacy §八）。
- `sidebar.footer.action`（侧边栏入口）、`conversation.view`（session scope，props.sessionId）、`settings.section` 等宿主槽位。
- client 侧 `sessions` 服务：open(id) 切换会话；`workspaces` 服务：connectWorkspace 等。

### 3.4 宿主服务目录（常用）

- `fs`（文件读写）、`credentials`（token，ref 名如 GITHUB_TOKEN，存储 ~/.dsh/.credentials.yaml）、`webServer`（HTTP 路由）、`tools`（工具注册）、`shell`（沙箱进程）、`web`（无 header fetch）、`timer`、`settings`、`storage`、`sessions`、`subagents`、`jobs`、`approval`、`sandbox` 等；准确签名用 `cordis_inspect_query`。

## 四、架构决策记录

- 看板入口：`sidebar.footer.action`（按钮 + 全屏页单组件），不用 overlay 槽位（hooks/联动问题）；页内左侧边栏（看板/归档/设置）。
- 数据：`~/.dsh/kanban/board.json` + config.json(dataDir)；卡片含 `tags[]`/`comments[]`/`activity[]`(带 actor)/`refs[]`/`meta{}`/`content[]`（富文本块）/`archivedFrom`；归档 = `board.archive[]`。
- 数据通道（正式形态）：host 半 webServer 路由（/kanban-api/*）+ client 半 fetch；agent 工具 ctx.tools；跨插件 ctx.provide 服务。
- 共享包：`packages/ui`（图标/工具函数/Modal/设计 tokens）、`packages/communication`（bus/rpc 双形态工厂，git 事件用）。
- 设计规范：`packages/ui/DESIGN.md`。样式直接引用宿主 `--dsw-*` tokens（明暗自动适配，禁硬编码、禁 emoji）。

## 五、动态插件（隔离）

- **工具保留**：`cordis_define` / `cordis_run` / `cordis_stop` / `cordis_undefine` / `cordis_inspect_*` 仍可调（会话内原型/调试）。
- **完整动态插件知识**（受限环境、模板、SDK 零粘贴、动态踩坑、运行模型、跨插件三通道）见 [legacy-dynamic-plugin.md](legacy-dynamic-plugin.md)。
- 通用编码坑（read 截断、模板字符串反引号、冒烟验证）两文件都有记录。