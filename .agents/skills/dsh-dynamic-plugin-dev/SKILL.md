# dsh-dynamic-plugin-dev

DSH 动态插件（`cordis_define` / `cordis_run`）开发技能：受限环境约束、可直接抄的代码模板、踩坑清单、TS 编译管线、省 token 流程。在 `dsh-plugins` 大仓开发插件前先加载本 skill。

## 零、硬性规则（违反 = 烧 token）

**两个模式缺一即拒绝 cordis_define 热更新开发。**

判定（看会话工具列表）：
- ① **创造模式（creation mode）**：工具列表里有 `cordis_define` / `cordis_run` / `cordis_inspect_*` → 满足
- ② **Code Mode**：工具列表里有 `run_code`（`DSH_TOOLS_MODE=code` 启动）→ 满足，走 SDK 零粘贴流程（§五）
- 缺任一 → 拒绝热更新；让用户重开"创造模式 + Code Mode"的会话，或改用组合插件文件引用（cordis.yml 引用产物，零上下文但要重启进程）

原因（雷霆大坑）：cordis_define 的 code 参数必须内联进模型工具调用，产物 ~30KB **每次 define 全量进上下文**；手工切段/拼接/read 截断（2000 字符/行）进一步放大消耗，一次迭代 ≈ 50KB+。Code Mode SDK 下产物从磁盘读入程序，模型只写路径，几十 KB 零进上下文（实测 kbnb-1/pkg-1 跑通）。

## 一、受限环境速查（代码运行环境）

| | Host | Client |
|---|---|---|
| 可用 | `ctx`(get/on/once/provide/effect)、`harness`(handle/defineTool/registerTool)、`console`、btoa/atob、TextEncoder | `React`(createElement + hooks)、`host.call`、`styles.insert`、`ctx`、`console` |
| 禁用 | import/require、process、fs、os；**ctx.emit**（发事件） | import/require、**setTimeout/setInterval/clearTimeout/clearInterval/fetch**（遮蔽成抛错 trap）、process/Buffer（void 0）、JSX、**ctx.emit**（发事件） |

关键约束：
- **无 JSX**：用 `React.createElement` 或 TSX 编译管线（§四）
- **hooks 只在组件渲染函数内**：slot 渲染函数被当普通函数调用，直接调 hooks 返回 undefined → 必须 `() => React.createElement(Comp)` 包一层
- **无跨组件 store**：动态 occupant 间订阅不可靠，单组件 `useState` 即可
- **document/window/FileReader/URL 等浏览器全局可用（2026-08 源码级实测，旧文档说"无 document/window"是错的）**：client 半闭包参数只遮蔽 `setTimeout/setInterval/clearTimeout/clearInterval/fetch/require`（+ process/Buffer=undefined），其余环境全局照常取到。因此 contentEditable 富文本、FileReader 读图（dataURL）、window.confirm 都能用；但**任何对 setTimeout 等 6 名的裸引用都会抛错**（走 ctx.timer 或不用）。拖拽定位仍建议 `evt.currentTarget.getBoundingClientRect()`
- **Date/Math/JSON 可用**，仍建议 try/catch 兜底
- **动态插件产物必须导出插件对象**（模块加载时 `export default makePlugin()`），导出函数会报 `Invalid effect`

### 事件 / timer 白名单（2026-08 源码级实测，通信方式根本约束）

- **ctx 动词白名单**（host/client 两半同款）：`effect / on / once / provide` + timer 系（timeout/interval/setTimeout/setInterval/throttle/debounce，需 inject `timer` 后可用）。
- **`ctx.emit` 不在白名单 —— 动态插件不能发事件**。跨插件"事件推送"物理不可行：只能 `ctx.on/once` 监听宿主事件（50 个：credentials/updated、tools/change、session/*、slots/changed…），不能 emit 给别的插件。跨插件通知 = 服务（provide/get）+ 私有 RPC（harness.handle/host.call）+ 槽位 owner props 回调。**别再尝试突破**（白名单逐字核对 + ctx.remote 桥不可达）。
- **受限是动态插件专属（重要）**：上述限制全部来自 `dsh-cordis-*-runner` 的沙箱白名单（模型挂载、随时热更新的代码不能绕过守卫链），**不是平台不支持**——cordis 核心有完整 `ctx.emit`，正式 bundle 插件（profile `dsh.profile.bundles` 挂载）无沙箱：emit/timer/import 全部可用。迁移路径见 plugins/git/PLAN.md §8。
- **`setTimeout` 等 timer 全局在动态 client 半不可用**：在组件 effect 里直接用 → 渲染时崩溃（`setTimeout is not available in a dynamic client half`）。要防抖/定时 → 组件外（apply 内）用 `ctx.timer.debounce/throttle`，或干脆去掉防抖（变更即存 + 首帧跳过）。

## 二、标准模板（直接抄）

### 2.1 最小 client 插件（sidebar 入口 + 全屏页）

```tsx
// src/client/entry.tsx
import React, { useState } from 'react'
import { kbnbCss } from './styles'
declare const host: { call(m: string, a?: unknown): Promise<any> }
declare const styles: { insert(css: string): unknown }

function makePlugin() {
  return {
    name: 'kanban',
    apply(ctx) {
      styles.insert(kbnbCss) // ★ 漏掉 = 整个插件无样式（实测坑）
      const slots = ctx.get('slots')
      if (!slots) return
      slots.inject('sidebar.footer.action', () =>
        slots.register(
          { name: 'sidebar.footer.action', id: 'kanban', order: 10, label: () => '看板' },
          (props: { wide: boolean }) => React.createElement(KanbanEntry, { wide: props.wide }),
        ),
      )
    },
  }
}
function KanbanEntry(props: { wide: boolean }) {
  const [open, setOpen] = useState(false)
  return React.createElement('div', null,
    React.createElement('button', { className: 'kbnb-side-btn', onClick: () => setOpen(!open) }, '看板'),
    open ? React.createElement(KanbanPage, { host, onClose: () => setOpen(false) }) : null,
  )
}
export default makePlugin() // ★ 模块加载时执行，导出对象
```

### 2.2 最小 host 插件（RPC + 动态工具）

```ts
// src/host/entry.ts
declare const harness: { handle(m: string, h: (a: unknown) => unknown): void }
function makePlugin() {
  return {
    name: 'kanban',
    apply(ctx) {
      // client ↔ host 私有 RPC
      harness.handle('kanban/load', async () => ({ board: { version: 1, columns: [] } }))
      // 动态模型工具（§2.3）
      ctx.effect(() => harness.registerTool(ctx, harness.defineTool(toolDef)))
    },
  }
}
export default makePlugin()
```

### 2.3 动态模型工具（harness.defineTool，实测 kbnb-1/pkg-11）

**各字段顶层平级**（parameters 不在 schema 里！盲试 5 次踩坑）：

```js
const toolDef = {
  name: 'kanban_create', // 顶层；用 kanban_ 前缀防全局冲突
  description: '新建卡片。title 必填；status 为列名或列 id。',
  parameters: { // 顶层：JSON-Schema 包装
    type: 'object',
    properties: {
      title: { type: 'string', description: '卡片标题（必填）' },
      status: { type: 'string', description: '列名或列 id' },
      tags: { type: 'array', items: { type: 'string' }, description: '标签' },
    },
    required: ['title'],
  },
  execute: async (args) => ({ ok: true, card_id: 'k1' }), // 业务逻辑，返回必须 JSON 兼容
  output: { // 顶层：输出定义
    schema: { type: 'object', additionalProperties: true }, // ★ object 必须显式 additionalProperties
    render: (args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }], // ★ 内容块数组
    presentationMeta: (args, value) => ({ /* 可选 */ }),
  },
}
```

## 三、踩坑清单（全部实测）

### 构建 / 产物
1. **esbuild iife + external react → `require("react")`**：alias react → 本地 shim（引用自由变量 `React`），jsx-runtime 同理
2. **官方 primitives 整包 3.3MB**（katex/shiki）：不要 import 包，从 `vendor/deepseek-harness` submodule（sparse checkout）提取图标源码
3. **产物必须含 `return __KB__.default;`**：iife 产物只是赋值，追加 return 才是函数体
4. **TS 重写丢 styles.insert**：编译后 grep 校验 CSS 字符串存在于产物

### 运行 / 生命周期
5. **动态插件必须导出对象**（`export default makePlugin()`），导出函数 → `Invalid effect`
6. **刷新页面不自动恢复 Client 半**（官方设计）：Run 卡片手动重新激活
7. **重启进程丢动态插件**：`kind: existing` 失败 → 用 `kind: new` 重新定义；代码同步到大仓 `plugins/<name>/src/`
8. **registerTool 要放 `ctx.effect()` 里**：stop/update 自动移除；verify-dist 的 mock ctx 要自己补 effect

### UI / 布局
9. **按钮不可见**：sidebar 按钮被 Cordis 面板挤掉 → 内容宽 + `flex:none`，后插入 CSS 覆盖官方类（`.Nqubda_layer{width:auto;flex:1 1 auto}`、`.hHd-Xa_footerActions{flex-direction:column}`，同特异性后者胜）
10. **hooks 在 slot 渲染函数里返回 undefined**：包一层真组件 `() => React.createElement(Comp)`
11. **overlay 槽位跨组件 store 失效**：单组件架构（按钮 + 全屏页同组件 `useState` 切换）

### 动态工具注册
12. **parameters 嵌套进 schema** → `parameters must be a ParameterSchemaSpec object`
13. **output.schema 缺 additionalProperties** → `unsupported JSON schema: additionalProperties must be explicitly true or false`
14. **render 返回字符串** → 必须 `[{ type: 'text', text }]` 内容块数组
15. **操作日志 actor**：UI 手动 = "手动调整"，agent 工具 = "agent"（host 内联 appendActivity，不依赖 ui 包）

### 通信方式（2026-08 实测，根本性）
16. **`ctx.emit` 被白名单禁用（不能发事件）**：动态插件只能 `ctx.on/once` 监听宿主事件；跨插件通知走服务/私有 RPC/回调（PLAN §2.3 + §一白名单）。不要为"形式上用事件"加复杂度——服务调用已是实时。
17. **动态 client 半无 timer 全局**：组件 effect 里用 `setTimeout` → 渲染槽位时崩溃（会话 tab 实测 `conversation.view` 渲染崩溃）。自动保存防抖改为"变更即存 + 卡片切换首帧跳过"；需要真定时 → apply 内 `ctx.timer.debounce`。
18. **子槽位声明独占渲染授权（Declaring is claiming）**：`children: { 'kanban.card.actions': { kind:'list', scope:'root' } }` 声明后，只有该条目（sidebar）组件 props 有 `renderSlot`，其他条目（如会话 tab 的 conversation.view）**不能**渲染此槽位（再声明报 already declared）。跨条目渲染槽位内容 → 改走服务桥接：kanban host 加 `harness.handle('kanban/git-sync')` → `ctx.get('git').sync(cardId)`。
19. **工具名全局唯一冲突**：宿主进程残留旧会话注册的 `kanban_view` 等 → 新 run 报 `tool "kanban_view" is already registered`。停掉旧 Run（UI/cordis_stop）再激活即可，非源码问题。
20. **切块读 submit.json 前必须 `mkdir -p` 段目录**：段文件缺失 → 读回空串 → cordis_define 传空代码 → `Host half returned undefined`（看似产物问题实为脚本问题）。

## 四、TS 编译管线

```
plugins/<name>/
├── package.json      # devDeps: esbuild, typescript, react, @dsh-plugins/ui
├── build.mjs         # TS/TSX → dist/client.js + dist/host.js（受限环境函数体，自动生成 submit.json）
├── shims/react.js + shims/jsx-runtime.js   # esbuild alias 'react' → 自由变量 React
├── src/client/*.tsx  # 多文件 TSX（entry/page/drawer/...）
├── src/host/entry.ts
├── dist/             # 产物（gitignore）
└── scripts/verify-dist.mjs  # vm 模拟受限环境验证（React/host/fs/ctx mock）
```

```bash
node build.mjs                 # 构建（产物 dist/client.js + dist/host.js + dist/submit.json）
node build.mjs --watch         # 监听重编译
node scripts/verify-dist.mjs   # 验证产物可加载（含工具注册数断言）
```

关键配置（build.mjs）：`format:'iife'` + `globalName` + `alias react→shims` + `minify` + loader 空化字体/svg + 产物末尾追加 `return __KB__.default;`。

## 五、SDK 零粘贴流程（Code Mode，首选）

1. 改源码 → `node build.mjs` → `node scripts/verify-dist.mjs`
2. 在 `run_code` 程序里（产物全程不进模型上下文）：
   - 切块：python 读 `dist/submit.json` 按 7000 字符写 /tmp 段文件（避开 bash 输出截断）
   - 读入：循环 `tools.bash({command:'cat 段文件'})` 拼接 → `JSON.parse`
   - 定义：`tools.cordis_define({ plugin:{kind:'existing', pluginId}, code:{host, client} })`
   - 更新：`tools.cordis_run({ pluginId, packageId, mode:'update' })`
3. 注意：SDK 的 `tools.read` 2000 字符/行截断，读大文件必须用 bash+python+fold
4. **读段文件两个坑（2026-08 实测）**：① bash 结果取 `r.stdout.text`（不是 `r.stdout`，对象拼接会变 "[object Object]"）；② 段文件末尾带换行，拼接后先 `.replace(/\n/g, "")` 再 JSON.parse（JSON.stringify 不会产生裸换行，剔除安全）

## 六、架构决策记录

- 看板入口：`sidebar.footer.action`（按钮 + 全屏页单组件），不用 overlay 槽位（hooks/联动问题）
- 设置页：`settings.section`；数据读写走 host RPC（动态插件无 schemastery schema）
- 数据：`~/.dsh/kanban/board.json` + config.json(dataDir)；卡片含 `tags[]`/`comments[]`/`activity[]`(带 actor)/`links[]`/`meta{}`
- 共享包：`packages/ui` —— 官方图标提取 + 工具函数 + Modal + 官方规范 css（`dsh/design-platform.css`）
- 设计规范：`packages/ui/DESIGN.md`。**样式直接引用宿主 `--dsw-*` tokens**（明暗主题自动适配，禁止自建别名层、禁止硬编码）

## 七、宿主源码与跨插件联动速查（2025-08 + 2026-08 源码实测，省 token）

**不要再重复发现以下事实**；需要宿主机制细节时先看本节，运行时签名用 cordis_inspect_query。

### 7.1 源码在哪

- **`vendor/deepseek-harness` 是 sparse submodule**：只含 `packages/client/ui-primitives`（图标/组件/markdown 源码参考），**没有宿主核心**，别在里面找 host/runner/tools。
- **宿主真实实现在 DSH 运行时缓存**（pnpm dlx checkout，路径形如 `~/Library/Caches/pnpm/dlx/<hash>/node_modules/.pnpm/@deepseek-ai+dsh-web-app@0.1.0-rc.6_*/node_modules/@deepseek-ai/...`）。会话运行时上下文会给出该 checkout 的绝对路径。常用包：
  - `@deepseek-ai/dsh-cordis-host-runner`：动态插件宿主半 —— VM 沙箱、ctx 门面白名单、`harness.handle/defineTool/registerTool` 守卫、动态插件注册表（lib/types/registry.js）
  - `@deepseek-ai/dsh-cordis-client-runner`：动态插件客户端半 —— 门面、`host.call`、slots/theme 守卫、模块装载
  - `@deepseek-ai/dsh-tool-cordis`：cordis_define/run/stop/undefine/inspect 工具 + 宿主服务目录 SERVICE_API（60 键）
  - `@deepseek-ai/dsh-code-runtime-worker-thread`：run_code 执行器（本会话程序就跑在里面）

### 7.2 动态插件运行模型

- **两半架构**：宿主半（Node 进程内 VM sandbox）负责工具注册/RPC/服务/数据；客户端半（浏览器）负责 UI（React + slots）。`cordis_define` 一次提交两个 code（host/client）。
- **同会话动态插件共享同一 cordis 组合**：run 以子 fiber 挂到宿主组合的 group ctx 下 → 服务与事件在同一 cordis app 内互通（跨插件联动的前提）。
- **`apply(ctx)` 收到的是 ctx 门面（façade）而非真实 ctx**：白名单动词 + 声明服务；框架内部（root/fiber/registry/extend/plugin…）刻意隐藏；任何服务返回值若是 cordis Context 会被拒。
- **宿主门面白名单**：`effect / on / once / provide / timeout / interval / setTimeout / setInterval / throttle / debounce` + `ctx.tools`（register + 只读 schemas/get）+ `ctx.get(name)`（任意读）+ inject 声明的服务属性访问。timer 系动词需先 `inject: ['timer']`。
- **客户端门面同款** + `slots`/`theme` 常规 UI 服务；`host.call` 只能调**本插件** harness.handle 注册的 handler。
- **inject 必须用对象形式**：`{ name, inject: ['fs', ...], apply(ctx) }`；纯函数形式没有声明点 → 拿不到任何服务。provider 缺失时 cordis park 该 fiber（挂起等待服务出现，`cordis_inspect_self` 可查 waitingFor）。
- **动态插件是会话态**：重启进程丢失（需重新 `cordis_define`）；刷新页面后 Client 半不自动恢复（官方设计）。

### 7.3 跨插件联动：可用三通道

| 通道 | 用法 | 说明 |
|---|---|---|
| **服务（唯一正路）** | `ctx.provide(name, svc)` 暴露（对其他包可见）；`ctx.get(name)` 读任意已注册服务（含宿主服务，kanban 在用 `ctx.get('fs')`）；`inject: ['name']` 声明式消费 | 跨插件读写、RPC、通知都走这里；同会话动态插件之间、动态↔宿主服务都通 |
| **事件（仅监听）** | `ctx.on / ctx.once` 监听宿主事件：`slots/changed`、`credentials/updated`、tool 注册变更、`session/*`、`subagent/*`… | 动态插件**不能发事件**（见 7.4） |
| **UI 槽位** | `ctx.slots.inject(key, () => ctx.slots.register({ name, id, order, label }, Comp))` | 任意插件可向任意 slot key 注册条目（order 排序、unload 级联清理）→ 跨插件 UI（如 git 向 kanban 槽位注册 sync 按钮）可行 |

### 7.4 跨插件联动：刻意受限

- **工具调用**：`ctx.tools` 是只读门面（schemas/get 只返回元数据），**禁止**插件代码直接调用其他插件的工具 execute（防绕过 ToolRuntime 守卫链：身份保护、策略、monotonic 守卫、结果规范化）→ 插件间协作走服务，不走工具。
- **`ctx.emit` 不在白名单**（源码逐字确认）：动态插件不能主动发事件 → 发布-订阅用自定义服务方法（provider 暴露 `subscribe/notify`）或服务返回值 + UI await 刷新。宿主事件仅监听（50 个）。
- **`harness.handle` / `host.call` 每插件私有**（client↔host 配对），跨插件 RPC 也要走服务。
- **工具名/服务名全局唯一**：`kanban_` / `git_` 前缀惯例。
- **子槽位声明独占渲染授权（Declaring is claiming，2026-08 实测）**：某条目 `children` 声明子槽位后，仅该条目组件 props 有 `renderSlot`；另一条目（如会话 tab）引用同一子槽位 → `already declared`。跨条目渲染槽位内容 → 服务桥接：kanban host 加 `harness.handle('kanban/git-sync')` 内部 `ctx.get('git').sync(cardId)`，会话 tab 按钮走 `host.call('kanban/git-sync')`。

### 7.5 宿主服务目录（常用）

- 完整目录（60 键）在 `dsh-tool-cordis` 的 SERVICE_API；运行时用 `cordis_inspect_query` → `Service.listService` 查准确方法签名。
- 与业务插件直接相关：`fs`（文件读写）、`web`（HTTP，沙箱内 fetch 被拒时的替代）、`credentials`（凭证/token）、`shell`（进程，沙箱内 require/child_process 被拒时的替代）、`timer`（定时器）、`tools`（工具注册表）、`settings`、`storage`、`llm`、`sessions`、`subagents`、`jobs`、`approval`、`sandbox` 等。
- 沙箱内全局替代：`fetch` → `ctx.web`；`require` → inject fs/web/shell；Node timers → inject timer。

### 7.6 cordis 工具（模型可调，7 个）

- 查询：`cordis_inspect_list` / `cordis_inspect_query` / `cordis_inspect_self`（Service.listService、Event.listEvents、Slots.listSubTree、Tools、Builtin）
- 生命周期：`cordis_define` / `cordis_run` / `cordis_stop` / `cordis_undefine`
- `cordis_define` 产物每次全量进上下文 ≈50KB+ → Code Mode 门槛（§零）。

### 7.7 省钱路径

- 需要宿主服务/事件/槽位/工具的**准确签名**时，运行时优先 `cordis_inspect_list` + `cordis_inspect_query`，不要 grep 编译产物。
- 本节的完整论证与 git 插件联动方案见 `plugins/git/PLAN.md` §2（调研结论）与 §5（服务/槽位契约）。

### 7.8 会话联动（2026-08 实测，conversation.view / sessions）

- **client 侧 `sessions` 服务**：`open(id)` 切换当前会话（会话关联跳转用）；另有 openSubagent/fork/search 等。host 侧 `sessions.list()/get(id)` 可列会话。
- **`conversation.view` 槽位**：list / **scope: session**（组件 props 收 `sessionId`）——注册 `{ name:'conversation.view', id:'kanban-task', order, label }` 即在会话视图环加 tab（chat/trajectory 旁）。
- **会话关联数据模型**：ref kind `session`（platform: dsh，externalId = sessionId）；client 过滤 `cardsBySession` 按 refs 匹配当前 sessionId。
- **注意**：conversation.view 等 session-scope 槽位渲染的是常驻组件，内部别用 timer 全局（§一/坑 17）；数据读写走 `kanban/load` / `kanban/save` RPC（跨会话共享 board.json）。