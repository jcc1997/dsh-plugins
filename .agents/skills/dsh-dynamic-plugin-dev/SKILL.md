# dsh-dynamic-plugin-dev

DSH 动态插件（cordis_define）开发经验总结：受限环境约束、踩坑记录、TS 编译管线用法。所有在 `dsh-plugins` 大仓开发插件的会话都应先加载本 skill。

## 适用场景

在 DSH 会话中用 `cordis_define`/`cordis_run` 开发/迭代插件（热更新），或在大仓 `plugins/*` 写新插件。

## 零、硬性规则（违反 = 烧 token）

**Code Mode 未启用时，直接拒绝 cordis_define 热更新开发。**

判定方法：模型当前能否直接调用 `run_code`？
- 能（工具列表只有 run_code）→ Code Mode 已启用，走 SDK 流程（见下）
- 不能（工具是 bash/read/edit 等独立形态）→ **拒绝热更新迭代**，要求用户先以 `DSH_TOOLS_MODE=code` 重启 dsh 再继续；或改用组合插件文件引用（cordis.yml 引用 dist 产物，零上下文但要重启进程）

### 为什么（雷霆大坑记录）

2026-08 实测：cordis_define 的 code 参数必须内联在模型工具调用中，产物 31KB **每次 define 全量进入模型上下文**。切段/拼接/read 截断绕行（`tools.read` 2000 字符/行截断、手工拼接易错、17 次读取）进一步放大消耗。一次迭代 ≈ 50KB+ 上下文。**Code Mode SDK 是本坑的唯一解**：产物从磁盘读入程序，模型只写几行代码 + 路径，几十 KB 零进入上下文。跑通验证：kbnb-1/pkg-1。

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
8. **产物必须直接导出插件对象（不是 factory 函数）**：runner 期望执行结果就是 `{ name, apply }` 对象。entry 写 `export default makePlugin()`（模块加载时调用），不能写 `export default makePlugin`（导出函数）——否则 `__KB__.default` 是函数，host 激活报 `Invalid effect`。
9. **TS 重写时别丢 styles.insert**：从手写 JS 迁移到 TS 时，CSS 必须放进 `styles.ts` 并在 apply 里 `styles.insert(kbnbCss)` 调用——漏掉则整个插件无样式（按钮不可见/布局乱）。编译产物要 grep 校验 CSS 字符串存在。
10. **插件状态在会话内存**：`cordis_inspect_self` 可读源码；重启进程即失。代码要同步到大仓 `plugins/<name>/src/`。

## 二点五、插件导出形态

- **静态 bundle 插件**（官方 basic 教程）：function / object / class 三种形态均可，function 最常用
- **动态插件**（cordis_define 的 code）：runner 直接取执行结果，**必须返回插件对象** `{ name, apply }`；导出函数会报 `Invalid effect`（实测 pkg-13）。TS 入口写 `export default makePlugin()`（模块加载时执行），不要 `export default makePlugin`

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
- **省 token 流程（Code Mode SDK，首选）**：以 `DSH_TOOLS_MODE=code` 启动后，在 `run_code` 程序里用 `tools.bash`（python json.dumps + fold 折行）从磁盘无损读取 dist 产物 → `tools.cordis_define` → `tools.cordis_run`。产物完全不经过模型上下文。模板：`scripts/sdk-define-template.mjs`
- 注意：SDK 的 `tools.read` 有 2000 字符/行截断，读大文件必须用 bash+python+fold 方案；重启进程后旧动态插件丢失，需 `kind: new` 重新定义

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
## 六、动态模型工具（agent 可调用）— harness.defineTool 正确形状（实测 kbnb-1/pkg-11）

Host 用 `harness.defineTool` + `harness.registerTool(ctx, tool)` 注册模型工具；注册放进 `ctx.effect(() => harness.registerTool(...))` 保证 stop/update 自动移除。

**options 各字段顶层平级**（不是嵌套！盲试 5 次踩坑）：

```js
harness.defineTool({
  name: 'kanban_view',            // 顶层
  description: '...',
  parameters: {                    // 顶层：JSON-Schema 包装 {type:'object', properties, required}
    type: 'object', properties: { ... }, required: [...],
  },
  execute: async (args, exec) => ({ ok: true, ... }),  // 业务执行，返回必须 JSON 兼容
  output: {                        // 顶层：输出定义
    schema: { type: 'object', additionalProperties: true },  // ★ object 必须显式 additionalProperties！缺省报 unsupported JSON schema
    render: (args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],  // 必须返回内容块数组 [{type:'text',text}]
    presentationMeta: (args, value) => ({...}),  // 可选
  },
})
```

雷区（已实测）：
1. 字段**嵌套错误**（parameters 放进 schema 里）→ `parameters must be a ParameterSchemaSpec object`
2. `output.schema` 为 `{type:'object'}` 缺 `additionalProperties` → `unsupported JSON schema: additionalProperties must be explicitly true or false`
3. render 必须返回**内容块数组**，不是字符串（`assertRenderedContent`）
4. 参数 properties 值用 `{type:'string', description}` 即可；数组用 `{type:'array', items:{type:'string'}}`
5. `ctx.effect(cb)` 在宿主真实环境存在，但 verify-dist 的 mock ctx 要自己补 effect 方法
6. 工具名全局注册，用 `kanban_` 前缀防冲突；注册后 `Tool.listTools` 立即可见（含当前会话）
7. 操作日志 actor 字段：UI 手动 = "手动调整"，agent 工具 = "agent"（host 端 appendActivity 内联实现，不依赖 ui 包）
