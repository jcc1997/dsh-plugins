# dsh-dynamic-plugin-dev

DSH 动态插件（`cordis_define` / `cordis_run`）开发技能：受限环境约束、可直接抄的代码模板、踩坑清单、TS 编译管线、省 token 流程。在 `dsh-plugins` 大仓开发插件前先加载本 skill。

## 零、硬性规则（违反 = 烧 token）

**Code Mode 未启用时，拒绝 cordis_define 热更新开发。**

判定：模型能否直接调用 `run_code`？
- 能 → Code Mode 已启用，走 SDK 零粘贴流程（§五）
- 不能 → 拒绝热更新；让用户以 `DSH_TOOLS_MODE=code` 重启 dsh，或改用组合插件文件引用（cordis.yml 引用产物，零上下文但要重启进程）

原因（雷霆大坑）：cordis_define 的 code 参数必须内联进模型工具调用，产物 ~30KB **每次 define 全量进上下文**；手工切段/拼接/read 截断（2000 字符/行）进一步放大消耗，一次迭代 ≈ 50KB+。Code Mode SDK 下产物从磁盘读入程序，模型只写路径，几十 KB 零进上下文（实测 kbnb-1/pkg-1 跑通）。

## 一、受限环境速查（代码运行环境）

| | Host | Client |
|---|---|---|
| 可用 | `ctx`(get/on/provide/effect)、`harness`(handle/defineTool/registerTool)、`console`、btoa/atob、TextEncoder | `React`(createElement + hooks)、`host.call`、`styles.insert`、`ctx`、`console` |
| 禁用 | import/require、process、fs、os | import/require、window、document、localStorage、fetch、JSX |

关键约束：
- **无 JSX**：用 `React.createElement` 或 TSX 编译管线（§四）
- **hooks 只在组件渲染函数内**：slot 渲染函数被当普通函数调用，直接调 hooks 返回 undefined → 必须 `() => React.createElement(Comp)` 包一层
- **无跨组件 store**：动态 occupant 间订阅不可靠，单组件 `useState` 即可
- **无 document/window**：拖拽定位用 `evt.currentTarget.getBoundingClientRect()`；Esc 关闭等用显式按钮
- **Date/Math/JSON 可用**，仍建议 try/catch 兜底
- **动态插件产物必须导出插件对象**（模块加载时 `export default makePlugin()`），导出函数会报 `Invalid effect`

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

## 六、架构决策记录

- 看板入口：`sidebar.footer.action`（按钮 + 全屏页单组件），不用 overlay 槽位（hooks/联动问题）
- 设置页：`settings.section`；数据读写走 host RPC（动态插件无 schemastery schema）
- 数据：`~/.dsh/kanban/board.json` + config.json(dataDir)；卡片含 `tags[]`/`comments[]`/`activity[]`(带 actor)/`links[]`/`meta{}`
- 共享包：`packages/ui` —— 官方图标提取 + 工具函数 + Modal + 官方规范 css（`dsh/design-platform.css`）
- 设计规范：`packages/ui/DESIGN.md`。**样式直接引用宿主 `--dsw-*` tokens**（明暗主题自动适配，禁止自建别名层、禁止硬编码）