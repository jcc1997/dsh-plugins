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
- `sidebar.footer.action`（侧边栏入口）、`conversation.view`（session scope，props.sessionId）、`settings.section`、`tool.call.toolview`（keyed，key=工具名，接管对话流工具卡）等宿主槽位。
- client 侧 `sessions` 服务：open(id) 切换会话；`workspaces` 服务：connectWorkspace 等。
- **插件 UI 四种模式（全屏页 / 会话 tab / 工具卡接管 / 注入他人槽位）+ 官方源码位置 + 代码例子 → 见 3.5**（开发 UI 前必读，勿重新考古）。

### 3.4 宿主服务目录（常用）

- `fs`（文件读写）、`credentials`（token，ref 名如 GITHUB_TOKEN，存储 ~/.dsh/.credentials.yaml）、`webServer`（HTTP 路由）、`tools`（工具注册）、`shell`（沙箱进程）、`web`（无 header fetch）、`timer`、`settings`、`storage`、`sessions`、`subagents`、`jobs`、`approval`、`sandbox` 等；准确签名用 `cordis_inspect_query`。

## 3.5 插件 UI 开发速查（模式 + 官方位置 + 代码例子，dsh-pipeline 实测沉淀）

> 需求分类 → 选模式：① 完整管理界面 → **A 全屏页面入口**；② 会话里持续看某数据 → **B 会话 tab**；
> ③ agent 调用你的工具时在对话流里展示卡片 → **C 工具卡片接管**（本次新发现，最重要）；
> ④ 往别人界面加按钮 → **D 注入他人槽位**（git 注入 kanban 的做法）。

### A. 全屏页面入口（sidebar.footer.action，kanban/pipeline 同款）

```tsx
// client/index.ts
export const inject = ['slots', 'sessions'] // sessions 可选：页面内 open(id) 跳会话
export function apply(ctx) {
  // ① 样式注入（幂等，见 1.3）
  const slots = ctx.get('slots')
  const host = makeHostBridge() // fetch → /xxx-api/*，见 1.3
  function Entry(props: { wide: boolean }) {
    const [open, setOpen] = React.useState(false)
    return <div>
      <button className="plp-side-btn" onClick={() => setOpen(!open)}>图标 + 名</button>
      {open ? <MyPage host={host} onClose={() => setOpen(false)} /> : null}
    </div>
  }
  slots.inject('sidebar.footer.action', () => slots.register(
    { name: 'sidebar.footer.action', id: 'mypkg', order: 11, label: () => '我的插件' },
    (props) => <Entry wide={props.wide} />,
  ))
}
```
- 全屏页 CSS 骨架：`.plp-page{position:fixed;inset:0;z-index:60;background:var(--dsw-alias-bg-base);display:flex;flex-direction:column}`（z-index 60 盖宿主，70 弹窗，kanban/pipeline 实测值）。
- 页内结构惯例：顶栏（返回键 + 标题 + 主按钮）→ body（左侧窄边栏导航 + 主区视图切换）→ 弹窗（`.plp-mask` + `.plp-modal`）。

### B. 会话 tab（conversation.view，session scope，kanban「任务」tab 同款）

```tsx
slots.inject('conversation.view', () => slots.register(
  { name: 'conversation.view', id: 'mypkg-tab', order: 20, label: () => '我的Tab' },
  (props: { sessionId?: string }) => <MyPanel sessionId={props.sessionId} host={host} />, // session scope 必得 sessionId
))
```
- 适合「当前会话关联数据」：如 kanban 任务卡；轮询用 setInterval + cleanup。

### C. 对话流工具卡片接管（tool.call.toolview keyed，★本次实测）

宿主官方扩展点：**按工具名接管某个工具在对话消息流中的渲染**（官方 bash/read/ask 卡片同机制）。key = 工具名；不注册则 fallback 通用卡片。

> **★ 重要修正（md-review 实测,别被旧结论误导）**：run_code 里通过 SDK `tools.xxx(...)` 调用宿主工具 = **真实工具调用,会在当前会话对话流渲染工具卡**,与模型直接调工具等价。且 **tools 桥按当前宿主工具注册表实时构建**——新装插件重启 dsh 后,`tools.<新工具>` 在当前会话立刻可调,**不需要新开会话**(本仓曾误判为「会话快照,必须重开」,错了;技能目录会刷新、tools 桥也是活的)。验证方法:`typeof tools.<name> === 'function'` 探测 + 打宿主路由(如 POST http://127.0.0.1:3080/<plugin-api>/…) 看 200/JSON 还是 405(405 = 插件没挂进 profile,`dsh plugin --profile web add <路径>` 解决)。
> **★ 阻塞式人机交互工具(md_doc_open 类)的调试教训**:从 run_code 发起后,若程序用 Promise.race 超时返回/显式取消,挂起会被清掉——用户随后在卡片上点「提交」会收到宿主拒绝,而若失败提示渲染在卡片层(被自己的大浮窗遮住),用户看到的就只是「提交无响应」。规则:① 失败提示必须渲染在用户正在看的浮窗内;② 真实演示时不要 race/取消,让工具一直挂着等提交(结果会落到该工具块,下一轮可从上下文读到)。

```tsx
// client/index.ts —— 注册（keyed 槽位 options 与 list 槽位不同！）
slots.inject('tool.call.toolview', () => slots.register(
  { name: 'tool.call.toolview', key: 'my_tool', locale: 'conversation' },
  MyToolCard,
))
// client/card.tsx —— 组件（只依赖官方契约字段，不 import 宿主内部）
function MyToolCard(props: { callId: string; toolName: string; block: any; inspect?: () => void; t?: any }) {
  const settled = 'kind' in props.block          // ★ running/settled 判别（官方同款写法）
  const args = settled ? safeParse(props.block.call?.argsRaw) : safeParse(props.block.argsRaw)
  // settled 时还有：block.content（结果文本块）、block.isError、block.meta、block.error?.code
  return <div className="plp-callcard">
    <span>{settled ? '完成' : '执行中…'}</span>
    <button onClick={() => { /* 跳你自己的页面，见「跳转联动」 */ }}>查看详情</button>
  </div>
}
```
- **block 两态**（dsh-client-runtime）：未结束 = RunningToolCall `{ callId, name, argsRaw(JSON 字符串), time, callView, subCalls }`；已结束 = ToolResultNode `{ kind:'tool-result', call(窗口截断时 null), content, isError, error:{name,code}, meta, resultView, subCalls }`。
- **meta 通道**（往卡片带结构化数据的正道）：host 工具 defineTool 的 output 里写
  `presentationMeta(args, value) => ({ run_id: ..., status: ... })`（纯函数、lossless JSON）→ 客户端 `block.meta` 拿到。
  注意 execute 返回值本身必须 lossless JSON（undefined 会被 dsh-tools 拒绝：报 "value is not lossless JSON"——pipeline 实测踩过，工具层统一 `JSON.parse(JSON.stringify(v))` 清洗）。
- **实时进度**：卡片内 fetch 自己 host 的路由轮询（如 /xxx-api/run-status），状态终态后停。
- **presentCall/presentResult**（可选增强）：defineTool 的可选字段，纯函数返回 `{card:'generic', title, rawInput}` / `{card:'generic', title, content:[{type:'text',text}]}`——工具卡片在「无接管/轨迹视图」等场景的文本展示。
- 接管后要自己渲染完整卡片（标题行 + 状态 + 内容），**不能 import 官方 ToolRow**（ui-tool 内部组件不在 ModuleLoader seed 表，external 不了，只能打进包——不划算）。

### D. 注入他人槽位（git → kanban 的做法）

对方插件声明子槽位并授权渲染（见下「children 声明」），你直接 `slots.inject('kanban.card.actions', () => slots.register({ name, id, order, label }, Comp))`；owner 会通过 `renderSlot('kanban.card.actions', { cardId, onSynced }, {})` 调用，props 由对方声明方定义（git 侧 owner props = `{cardId, onSynced}`）。

### 槽位 API 速记（dsh-client-ui-slots）

- **register(options, Component) → disposer**；options 按槽位 kind 不同：
  - list/single：`{ name, id, order, label?, children?, priority? }`（label 可函数；同 id 不同 priority 共存，最低 renders）
  - keyed：`{ name, key, locale?, priority? }`（locale = 翻译命名空间，如 'conversation'，声明后组件 props 注入 t 函数）
- **children 声明 = 独占渲染授权**（Declaring is claiming）：一个槽位只能一个声明者；声明后本条目 props 得到窄化的 `renderSlot(childKey, owner, opts)`。
- **组件 props 组成**（ComposedProps）：PropsRuntime（owner 供 share + keyed 的 key props + session scope 注入 `sessionId` + 全局注入） + locale 声明的 `t` + children 声明的 `renderSlot`。
- SlotKind：single / list / keyed / chain；SlotScope：root / session-maybe / session（session scope 组件必得 sessionId）。
- **跳转联动**（同插件内跨槽位跳转，pipeline 实测）：client 半同 bundle 共享模块级变量，写个 pub/sub（`registerOpenHandler(fn)` / `requestOpenRun(id)`），侧边栏 Entry mount 时注册 handler（setOpen(true)+定位 id），卡片按钮调用 request。不必走 cordis 事件。

### 官方源码 / 类型位置（全部在 DSH 运行时缓存，vendor submodule 没有）

| 主题 | 包 / 文件 |
|---|---|
| 槽位系统 API（SlotMap/register/PropsRuntime/SlotKind/KindOptions） | `@deepseek-ai/dsh-client-ui-slots/lib/types/index.d.ts` |
| **tool.call.toolview 契约**（keyed 声明 + ToolCallOwnerProps） | `@deepseek-ai/dsh-client-ui-tool/lib/types/client/contract/slots.d.ts` |
| 工具卡片两态（RunningToolCall/ToolResultNode/ToolCallBlock） | `@deepseek-ai/dsh-client-runtime/lib/types/client/sessions/conversation.d.ts` |
| defineTool 完整选项（presentCall/presentResult/presentationMeta/isConcurrencySafe） | `@deepseek-ai/dsh-tools/lib/types/schema.d.ts` |
| ToolCallView/ToolResultView 声明式视图 | `@deepseek-ai/dsh-tools/lib/types/presentation.d.ts` |
| **官方工具卡注册例子**（ask-question/bash/file-mutation/read/search 的 row + register 调用，照抄结构） | `@deepseek-ai/dsh-client-ui-tool/lib/client.js`（grep "tool.call.toolview"） |
| 官方图标/按钮/Modal（ic_ds_* 图标集） | `@deepseek-ai/dsh-client-ui-primitives`（本仓库 vendor/deepseek-harness 有同源参考，见 packages/ui） |
| 宿主 UI 包全景 | pnpm dlx checkout 下 `node_modules/.pnpm/` 里 `@deepseek-ai+dsh-client-ui-*` |

**省 token 检索法**：先 `grep -rn "槽位名/关键词" <包>/lib/types` 定位 .d.ts（类型即契约），再看 `lib/client.js` 里 grep 到的官方注册例子抄结构。client.js 是打包产物但可读（未压缩）。

### 沙箱内调用宿主能力：codeRuntime bindings（实测协议，kanban code 门禁已打通）

想给「沙箱里跑的代码」注入宿主/插件能力（如门禁代码里调 pipeline、git 服务），用宿主 `ctx.get('codeRuntime')`（run_code 同款 worker 沙箱）：

```ts
const rt = ctx.get('codeRuntime')
const result = await rt.run({
  program: 'const c = await gate.card({}); return { ok: true }',  // TS 风格,top-level await/return
  bindings: [{ global: 'gate', functions: {
    card: async (args) => lossless(card),     // 宿主函数,返回值必须 lossless JSON
    call: async (args) => lossless(await svc[args.method](...args.args)),
  } }],
})
// result: { value?, logs: string[], error?: { kind, message } }——失败是字段不是 rejection
```

**协议踩坑（worker.cjs 实测）**：①binding 只桥接**单个实参**——`gate.call('git','m')` 第二个参数会丢,一律**对象传参** `gate.call({service,method,args})`;②**无参调用被拒**（"binding arguments must be lossless JSON"）——`gate.card()` 必须写 `gate.card({})`;③binding 的 args 与返回值都必须是 lossless JSON;④隔离语义 = "containment not security"（worker 空环境 + heap/busy-time/wall-time 预算 + 可硬杀同步死循环）。
- 官方类型：`@deepseek-ai/dsh-code-runtime/lib/types/types.d.ts`（CodeRunRequest/CodeBindingFunction/CodeRunResult）；实现 `dsh-code-runtime-worker-thread/lib/worker.cjs`（SDK 桥接在 makeNamespaces）。
- bash-sandbox 的 shell spec 支持 `stdin`（载荷注入,hooks bridges 同款用法）/ `env` / `dshEnv`,但**没有**调宿主服务通道（沙箱网络受限）——需要「沙箱内调插件」就用 codeRuntime,不要用 bash。

## 四、架构决策记录

- 看板入口：`sidebar.footer.action`（按钮 + 全屏页单组件），不用 overlay 槽位（hooks/联动问题）；页内左侧边栏（看板/归档/设置/门禁/模板）。
- **门禁库 v6（kanban）**：门禁 = `board.gateLibrary[]` 独立实体（单独创建/配置），卡片与模板用 `gateIds[]` 勾选引用复用；旧内联 `gates[]`（含旧平铺 kind 格式）在 `normalizeBoard` 读取时自动迁入库（按 name+type+on+to 去重）并**清空内联副本**（防双重渲染/双重检查）。库删除工具（kanban_gate_delete）同时从卡片/模板摘除引用。模板工具支持 `gate_ids` + 兼容内联 `gates` 自动入库。客户端「门禁」页 = 库 CRUD + 引用关系；卡片抽屉从库下拉勾选挂载。
- **host 半冒烟测试模式（无 cordis 工具时）**：node 直连 `lib/index.js`——mock fs 用**临时目录前缀重写**（`resolve(p)` 把 `~/.dsh/<plugin>` 改写进 mkdtemp 目录，readText 抛 ENOENT 模拟缺文件），mock webServer 收集 route，`apply(ctx)` 后直接调 `registered[tool].execute(args)`；路由调用需自建 `async function* req`（读 body 用 for-await）+ `{writeHead,end}` 捕获响应。此模式可端到端验证数据迁移/工具/门禁检查，不碰真实数据。
- 数据：`~/.dsh/kanban/board.json` + config.json(dataDir)；卡片含 `tags[]`/`comments[]`/`activity[]`(带 actor)/`refs[]`/`meta{}`/`content[]`（富文本块）/`archivedFrom`；归档 = `board.archive[]`。
- 数据通道（正式形态）：host 半 webServer 路由（/kanban-api/*）+ client 半 fetch；agent 工具 ctx.tools；跨插件 ctx.provide 服务。
- 共享包：`packages/ui`（图标/工具函数/Modal/设计 tokens）、`packages/communication`（bus/rpc 双形态工厂，git 事件用）。
- **看板配置导入导出（kanban v7）**：只导形态不导数据——`kanban_export_config` 输出 `{schemaVersion:1, kanban:{columns:[标题], gates:[{name,on,to?,checker}], templates:[{name,description,tags,gates:[门禁名]}]}}`（门禁/模板按**名字**引用，天然可移植，不绑实例 id）；`kanban_import_config` **整体替换配置层**（列/门禁库/模板重建、id 重生成、门禁按名重解析），旧卡片全挪新板第一列并清 gateIds，导入前自动备份 `board.json.bak-<ts>`。schemaVersion 高于当前支持则拒绝。样例包 `workflow-template/`（只 README + workflow.json，格式与导出完全一致），安装一律走 agent 导入，不再有 install 脚本。
- 设计规范：`packages/ui/DESIGN.md`。样式直接引用宿主 `--dsw-*` tokens（明暗自动适配，禁硬编码、禁 emoji）。

## 五、动态插件（隔离）

- **工具保留**：`cordis_define` / `cordis_run` / `cordis_stop` / `cordis_undefine` / `cordis_inspect_*` 仍可调（会话内原型/调试）。
- **完整动态插件知识**（受限环境、模板、SDK 零粘贴、动态踩坑、运行模型、跨插件三通道）见 [legacy-dynamic-plugin.md](legacy-dynamic-plugin.md)。
- 通用编码坑（read 截断、模板字符串反引号、冒烟验证）两文件都有记录。