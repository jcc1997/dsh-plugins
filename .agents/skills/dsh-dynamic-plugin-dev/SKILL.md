# dsh-dynamic-plugin-dev

DSH 动态插件（cordis_define）开发经验总结：受限环境约束、踩坑记录、TS 编译管线用法。所有在 `dsh-plugins` 大仓开发插件的会话都应先加载本 skill。

## 适用场景

在 DSH 会话中用 `cordis_define`/`cordis_run` 开发/迭代插件（热更新），或在大仓 `plugins/*` 写新插件。

## 一、受限环境铁律（动态插件代码）

Host/Client 代码都是**纯 JS 函数体**，在受限执行环境运行：

| 平台 | 可用 | 不可用（会崩） |
|---|---|---|
| Host | `ctx`(get/on/provide/effect)、`harness`(handle/defineTool/registerTool)、`console`、`btoa`/`atob`、TextEncoder/Decoder | `process`、`require`/`import`、`fs` 模块、`os` |
| Client | `React`(createElement/useState/useEffect)、`host.call`、`styles.insert`、`ctx`、`console` | `import`/`require`、`window`、`document`、`localStorage`、`fetch` |

- **React 无 JSX、无 jsx-runtime**：必须 `React.createElement`；TSX 需经编译管线（见下）
- **禁止 `window.prompt/confirm`**：一律用 React 内联弹窗
- **hooks 只能放在组件渲染函数内**：slots 的渲染函数被当普通函数调用，直接在里面调 hooks 返回 undefined；必须 `() => React.createElement(MyComponent)` 包一层
- **不要跨组件共享状态 store**：动态 occupant 之间无法可靠联动（实测 store 订阅在 overlay 组件里失效）。同组件内 `useState` 即可，或将来用最简单事件发射器
- **DOM 可用能力**：事件回调里 `evt.currentTarget.getBoundingClientRect()`/`children`/`getAttribute` 可用（不需要 document 全局）——拖拽插入定位、布局测量都靠它
- **`Date`/`Math` 可用**（实测 OK），但代码里做 try/catch 兜底更稳
- **无键盘全局监听**（无 document）：Esc 关闭等需求用显式按钮

## 二、踩坑记录（按出现顺序）

1. **按钮渲染了但不可见**：`sidebar.footer.action` 与 Cordis 面板（`.Nqubda_layer{flex:none;width:100%}`）并排时，自己 `width:100% + padding`（无 border-box）被挤出。修复：按钮内容宽度 + `flex:none`；覆盖官方类名 `.Nqubda_layer{width:auto;flex:1 1 auto}` 让出空间；`footerActions` 覆盖为 `flex-direction:column` 竖排（我们后插入 CSS，同特异性后者胜）。
2. **点击无反应 + `open=undefined`**：overlay 渲染函数体内直接调用 hooks（`useStore()`）→ 非组件上下文 → useState 返回 undefined → 永远 null。修复：包真组件。
3. **跨组件 store 联动失效**：`store.subscribe(setV)` 在 overlay 组件里点击后返回 undefined（机制未完全查明）。修复：单组件架构（按钮+全屏页面同一组件，`useState` 切换）。
4. **刷新页面后插件显示停止/黄色**：官方设计——刷新**不会自动恢复 Client 半**（架构文档明说）。需要在 Run 卡片手动重新激活。不是 bug。
5. **动态插件无法 import 官方图标库**：`dsh-client-ui-primitives` 是标准 ESM 但受限环境禁 import；且 npm 包不含 src。解法：submodule sparse checkout `vendor/deepseek-harness` 取 `packages/client/ui-primitives/src/icons/index.tsx`，提取所需图标到共享包（MIT）。
6. **esbuild iife + external react 生成 `require("react")`**：受限环境无 require → 运行报错。解法：`alias: { 'react': shims/react.js, 'react/jsx-runtime': shims/jsx-runtime.js }`，shim 引用自由变量 `React`（受限环境 closure 注入）。
7. **primitives 整包打包 3.3MB**：katex/shiki 等依赖全进来。解法：不要 import primitives 包，把图标源码提取到本地共享包。
8. **产物必须直接导出插件对象（不是 factory 函数）**：runner 期望执行结果就是 。entry 写 （模块加载时调用），不能 ——否则  是函数，host 报 。
9. **插件状态在会话内存**：`cordis_inspect_self` 可读源码；重启进程即失。代码要同步到大仓 `plugins/<name>/src/`。

## 三、TS 编译管线（推荐开发方式）

大仓 `plugins/<name>/` 标准结构：

```
plugins/kanban/
├── package.json      # devDeps: esbuild, typescript, react, @dsh-plugins/ui
├── tsconfig.json
├── build.mjs         # TS → dist/client.js + dist/host.js（受限环境函数体）
├── shims/
│   ├── react.js          # export default React（自由变量）
│   └── jsx-runtime.js    # jsx/jsxs/Fragment → React.createElement
├── src/
│   ├── client/       # 多文件 TSX（entry/page/drawer/columns/settings...）
│   └── host/entry.ts
├── dist/             # 产物（gitignore）
└── scripts/verify-dist.mjs  # vm 模拟受限环境验证产物
```

- 构建：`pnpm --filter dsh-plugins-kanban build`（产物 `dist/client.js` + `dist/host.js`）
- watch：`pnpm --filter dsh-plugins-kanban watch`
- 验证：`node scripts/verify-dist.mjs`（vm context 提供 React/host/fs mock，模拟受限环境加载）
- 产物格式：`var __KB__ = (() => {...})(); return __KB__.default;` —— 无 import、无 require
- 上线：把 `dist/client.js`/`dist/host.js` 内容作为 `cordis_define` 的 `code.client`/`code.host`（JSON 转义）

**共享包**：`packages/ui`（`@dsh-plugins/ui`）——官方图标（ic_ds_*）+ 工具函数 + 通用组件。新插件直接 import，构建时 esbuild 引用 workspace 源码 tree-shake。图标来源：`vendor/deepseek-harness`（submodule，`git submodule update --init` 拉取）。

## 四、开发/迭代流程

1. 改 `src/client/*.tsx` 或 `src/host/entry.ts`
2. `pnpm --filter dsh-plugins-kanban build`（或 watch 自动）
3. `node scripts/verify-dist.mjs` 确认产物可加载
4. 会话中 `cordis_define`（existing pluginId）粘贴产物 → `cordis_run` update
5. 同步 `dist` 说明到大仓 git（产物可提交，便于审计）

## 五、架构决策记录

- 看板入口：`sidebar.footer.action`（按钮 + 全屏页面单组件），不用 overlay 槽位（hooks 联动问题）
- 数据目录：`settings.section` 设置页（id 'kanban'），读写走 host RPC（动态插件无 schemastery schema，无法注册真 settings namespace；发布版 bundle 用真 schema）
- 数据：`~/.dsh/kanban/board.json` + config.json(dataDir)；卡片结构含 `links[]`/`meta{}`/`comments[]`/`activity[]` 扩展位
- 图标：官方 ic_ds_* 集（提取）+ 自绘补齐（IconBoard）
