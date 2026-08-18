# dsh-plugins-4 — TD 技术设计（kanban UI 调整：模板卡片 / Gate 详情内联 / 去关联展示）

> 真源：本文件。前置：RD 已 rd-confirmed（见 docs/dsh-plugins-4/rd.md）。经 md_doc_open 人审通过（打 td-confirmed）后进 UC。

## 1. 技术背景

- 三个诉求（RD §1）：①模板视图每个 template 无卡片视觉；②Gate 选中后详情固定在列表顶部、长列表需回滚；③Gate 详情展示关联 Ticket 是多余信息。
- 关键现状（client 半源码，当前 main）：
  - `src/client/page.tsx`：
    - `TemplatesView`（L465-527）+ `TemplateTicket`（L530-627）：根元素 `section.kbnb-settings.kbnb-tpl-ticket`，CSS 仅有 `display:flex;flex-direction:column;gap:8px`（styles/drawer.ts L15）——**无边框/背景/圆角/内边距 = 无卡片视觉**。
    - `GatesView`（L323-462）：`detailId` 状态控制详情；详情面板 `kbnb-gate-detail-panel`（L403-437）**渲染在 `kbnb-gates-grid` 之前**（JSX 顺序在顶部）；含 header（名称/元信息 + 关闭钮）+ 配置 JSON（L419-421）+ `kbnb-gate-users` 引用区块（L422-434，展示关联 模板/ticket）。
    - `usersOf(gateId)`（L346-358）仅被详情面板使用；`onOpenTicket` prop / `openTicketFromAnywhere`（L50-55）仅被该区块使用。
  - `src/client/styles/drawer.ts`：
    - `kbnb-tpl-ticket`（L15）、`kbnb-gate-ticket`（L46-47，**卡片已存在**：bg-base/border-l2/radius12/padding12/14/hover 品牌边+lv2 阴影——模板卡应对齐它的规格）、`kbnb-gate-detail-panel`（L50）、`kbnb-gate-users`（L52-53）、`kbnb-gates-ticketlink/tickettitle/col`（L4-6）。
  - `src/client/drawer-side.tsx`（L368-371）：Ticket 抽屉内「Gates」区块用 `kbnb-gate-detail/kbnb-gate-detail-row/-k/-pre`——**保留不动**（ticket→gate 视角）。
  - 设计规范：docs/ui-design/components.md §五 卡片（Kanban Ticket：bg-base + radius12 + border-l2 + shadow-lv1；hover 边框品牌色 + 阴影微抬；选中 = 边框品牌色 + ring）。
- 门禁/数据：纯展示改动；`board.gateLibrary` / `templates` 数据模型零改动。

## 2. 总体设计

```
模板视图（TemplatesView/TemplateTicket）
  `kbnb-tpl-ticket` 加卡片样式（对齐 `kbnb-gate-ticket` 规格）
  + 编辑态强调边框（品牌色 ring）
Gates 视图（GatesView）
  - 删除顶部 `kbnb-gate-detail-panel` 块
  - 点击门禁卡 -> detailId 切换 -> 配置 JSON 在卡内内联展开（`kbnb-gate-inline-detail`）
  - 选中卡 `kbnb-gate-ticket-on`（品牌色边框 + ring）
  - 删除 `kbnb-gate-users` 引用区块 + 死代码（usersOf/onOpenTicket/openTicketFromAnywhere）
```

## 3. 详细设计

### 3.1 模板卡片样式（诉求 1）——styles/drawer.ts + page.tsx（组件结构不变）

- styles/drawer.ts L15 替换为：
```css
.kbnb-tpl-ticket{display:flex;flex-direction:column;gap:8px;background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;padding:12px 14px;margin-bottom:12px;box-shadow:var(--dsw-shadow-lv1);transition:border-color 150ms cubic-bezier(.4,0,.2,1),box-shadow 150ms cubic-bezier(.4,0,.2,1)}
.kbnb-tpl-ticket:hover{border-color:var(--dsw-alias-state-business-primary);box-shadow:var(--dsw-shadow-lv2)}
.kbnb-tpl-ticket-editing{border-color:var(--dsw-alias-state-business-primary);box-shadow:0 0 0 1px var(--dsw-alias-state-business-primary)}
```
- page.tsx `TemplateTicket`：根元素类名按 `editing` 附加 `kbnb-tpl-ticket-editing`（编辑态强调）。组件内在结构（head 点击编辑、chips、`kbnb-tpl-edit` 虚线分隔）不动。

### 3.2 Gate 详情卡内内联展开（诉求 2）——page.tsx GatesView

- 删除 L403-437 整体顶部详情面板块（`detailId ? (() => {...})() : null`）。
- `kbnb-gates-grid` 卡片渲染改为：点击门禁卡 toggle `detailId`；选中卡附加 `kbnb-gate-ticket-on`；选中卡 header 下渲染 `kbnb-gate-inline-detail`：有配置则 `pre.kbnb-gate-detail-pre` 展示 JSON（复用 L49 既有样式），无配置则提示「无额外配置」；删除钮 `stopPropagation` 保留。
- styles/drawer.ts 新增：
```css
.kbnb-gate-ticket-on{border-color:var(--dsw-alias-state-business-primary);box-shadow:0 0 0 1px var(--dsw-alias-state-business-primary)}
.kbnb-gate-inline-detail{display:flex;flex-direction:column;gap:8px;border-top:1px dashed var(--dsw-alias-border-l2);padding-top:10px;margin-top:2px}
.kbnb-gate-detail-empty{font-size:12px;color:var(--dsw-alias-label-tertiary);padding:4px 0}
```

### 3.3 去关联展示 + 死代码清理（诉求 3）——page.tsx / styles/drawer.ts

- page.tsx：删除 `kbnb-gate-users` 区块（L422-434）；删除 `usersOf()`（L346-358）、`GatesView` 的 `onOpenTicket` prop（L323）、调用处 `openTicketFromAnywhere`（L50-55）与 L213 传参。
- styles/drawer.ts：删除已无引用的 `.kbnb-gates-ticketlink`（L4）、`.kbnb-gates-tickettitle`（L5）、`.kbnb-gates-col`（L6）、`.kbnb-gate-users`（L52-53）、`.kbnb-gate-detail-panel`（L50）、`.kbnb-gate-detail-head`（L51，面板已删除）。**保留** `.kbnb-gate-detail/*`（drawer-side 用）与 `.kbnb-gate-ticket .kbnb-gate-detail-pre`（L49，内联详情复用）。

### 3.4 兼容与迁移

- 无数据/接口变化；`lib/client.js` 重建后浏览器刷新即生效（client HMR / build --watch + refresh）。
- 不触碰 host 半（gate.ts / tools），agent 工具行为不变。

## 4. 测试计划

### 4.1 构建校验（本会话）
- `cd plugins/kanban && npx tsc --noEmit`（无类型错误）；
- `node build.mjs` -> `node scripts/verify-dist.mjs`（两层冒烟：host import + client 真实执行）；
- `node scripts/smoke-gate.mjs`（门禁冒烟不破坏）。

### 4.2 UI 手工验收（重启 dsh + 刷新看板页后）
- 见 UC 文档「验收用例」A1–A4。

## 5. 兼容与迁移
- 同 §3.4；无存量数据影响。

## 6. 开放问题
- 无。
