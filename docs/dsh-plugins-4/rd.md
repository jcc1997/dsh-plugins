# dsh-plugins-4 — kanban UI 调整（模板卡片 / Gate 详情内联 / 去关联展示）RD

> 产出放 `docs/dsh-plugins-4/rd.md`，随 `workflow/dsh-plugins-4` 分支 MR 演进。
> 经 `md_doc_open` 人审通过（打 `rd-confirmed`）后 `git_create_mr` 并推进 TD。

## 1. 需求背景

- 一句话：看板插件「模板」与「Gates」两个管理视图存在三处交互/视觉问题，需要打磨：模板列表没有卡片视觉；Gate 选中后详情固定在顶部、长列表下体验差；Gate 详情展示了不必要的关联 Ticket 信息。
- 用户诉求原文（来自 Backlog 卡片）：
  1. kanban 中 templates 列表，应该用卡片 style 包裹每个 template。现在 UI 不对
  2. kanban 中 gate 选中后，展示详情在最顶部，这样交互不好，后续如果列表变长，还得滚动上去。
  3. kanban 中 gate 详情不用展示关联了哪个 ticket

## 2. 目标与非目标

| 目标 | 非目标 |
|---|---|
| 模板视图每个 template 以卡片样式呈现 | 不改建卡弹窗（create.tsx 模板是下拉选择，非列表） |
| Gate 选中后详情就近（选中卡内）展开，无需滚动 | 不改动 Ticket 抽屉内「Gates」区块（ticket→gate 关联展示保留） |
| Gate 详情移除「关联了哪些 Ticket/模板」展示 | 不改动门禁库数据模型 / 门禁检查逻辑 / 工具 |
| 清理因此产生的死代码 | 不做其它视图的样式重构 |

## 3. 范围

- 涉及模块 / 仓库：dsh-plugins / `plugins/kanban/`（client 半）
  - `src/client/page.tsx`（GatesView / TemplatesView / TemplateTicket / Gate 详情）
  - `src/client/styles/drawer.ts`（模板卡、门禁卡、门禁详情相关样式）
  - 顺带删除死代码：`usersOf`、`onOpenTicket` prop、`openTicketFromAnywhere`
- 涉及角色 / 调用方：看板 UI 使用者（人类 + agent 均可通过 UI 查看）
- 边界：纯前端展示层改动；数据（gateLibrary / templates）与后端逻辑零改动；构建产物 `lib/` 重建

## 4. 方案设计

### 4.1 可选方案（grill-me 之后收敛）

| 方案 | 思路 | 优点 | 缺点 | 结论 |
|---|---|---|---|---|
| A：Gate 详情卡片内内联展开 | 点击门禁卡就地展开配置 JSON，再点收起，选中卡高亮 | 完全无需滚动；与模板卡展开交互一致 | 网格内卡片高度变化有布局微移动（可接受） | **推荐（用户已选）** |
| B：右侧详情抽屉 | 点击后右侧滑出面板 | 列表不动、信息密度高 | 覆盖看板区域，多一层关闭交互 | 备选 |
| C：点击卡片正下方浮出面板 | 详情面板紧跟被点卡片 | 就近 | 网格布局被挤动，长列表仍需小幅滚动 | 不采用 |
| D：模板保持普通行 | 不做卡片视觉 | 改动最小 | 不满足诉求 1 | 不采用 |

- 决策依据：诉求 2 的本质是「选中后不要强迫用户滚回顶部」——卡片内内联展开是信息始终跟随焦点的最自然形态，且与现有模板展开交互保持一致；诉求 1 按设计规范（Kanban Ticket 卡片：bg-base + border-l2 + radius 12 + padding 上下14/左右16，hover 边框品牌色+阴影微抬）实现。
- 备选方案保留原因：若后续 Gate 配置信息量变大（长 JSON），可回退到方案 B 右侧抽屉。

### 4.2 详细设计

#### 4.2.1 模板列表卡片样式（诉求 1）

- 组件 `TemplateTicket` 的根元素 `section.kbnb-settings.kbnb-tpl-ticket` 补卡片样式：
  - `background: var(--dsw-alias-bg-base)`、`border: 1px solid var(--dsw-alias-border-l2)`、`border-radius: 12px`、`padding: 12px 14px 14px`、`box-shadow: var(--dsw-shadow-lv1)`
  - hover：边框品牌色 + `--dsw-shadow-lv2`（对齐门禁卡）
  - 编辑态（editing）：品牌色边框 + ring（`box-shadow: 0 0 0 1px var(--dsw-alias-state-business-primary)`），与 Gate 选中态一致
  - 外层纵向间距 `margin-bottom: 12px`（`kbnb-archive` 容器内堆叠）
- 卡内结构不变：header（可点开编辑）+ chips + 编辑区（`kbnb-tpl-edit` 虚线分隔保留）。

#### 4.2.2 Gate 详情卡片内内联展开（诉求 2）

- 删除顶部固定详情面板块（`detailId ? ... kbnb-gate-detail-panel ...`，page.tsx L403-437）。
- `kbnb-gates-grid` 内每个 `kbnb-gate-ticket` 卡片：
  - onClick 切换 `detailId`（点同一张收起、点另一张切换）
  - 选中卡加 `kbnb-gate-ticket-on`：品牌色边框 + ring
  - 选中卡在 header 下方内联渲染配置区：
    - 有配置：`pre.kbnb-gate-detail-pre` 展示 JSON（沿用现有样式）
    - 无配置：提示「无额外配置」
  - 分隔：配置区顶部 `border-top: 1px dashed var(--dsw-alias-border-l2)` + padding-top
- 删除按钮保留（stopPropagation，防止触发选中）。

#### 4.2.3 Gate 详情不展示关联 Ticket（诉求 3 + 死代码清理）

- 移除详情里的「引用：模板… + Ticket…」区块（`kbnb-gate-users`）。
- 连带删除死代码：
  - `GatesView` 的 `onOpenTicket` prop 与 `usersOf()`
  - `page.tsx` 的 `openTicketFromAnywhere()` 及调用处（传 `onOpenTicket`）
  - 不再使用的 CSS：`.kbnb-gates-ticketlink`、`.kbnb-gates-tickettitle`、`.kbnb-gates-col`、`.kbnb-gate-users`、`.kbnb-gate-users .kbnb-gates-ticketlink`
- 保留：`.kbnb-gate-detail*`（drawer-side 抽屉内仍在用）、门禁卡自身样式。

#### 4.2.4 兼容与迁移

- 纯展示改动，无数据结构变化；`lib/client.js` 重建后浏览器刷新即生效（HMR / rebuild）。
- pass 型改动不影响 agent 工具侧任何行为。

## 5. 影响面与风险

| 风险 | 影响 | 概率 | 缓解 |
|---|---|---|---|
| 误删仍被其它视图引用的 CSS 类 | 样式错乱 | 低 | 已 grep 全部 client 目录确认引用面；删除前再核 |
| 模板卡片改动影响现有编辑交互 | 编辑展开行为变化 | 低 | 保留原有 header 点击与编辑按钮；仅加容器样式 |
| Grid 内联展开导致布局跳动 | 观感 | 低 | 单卡高度变化，文档级可接受；选中态 ring 帮助定位 |

## 6. 验收口径（供 UC 阶段展开）

- A1 模板视图：每个 template 以卡片样式展示（回看有边框/圆角/背景/内边距），hover 有反馈；编辑展开仍在卡内。
- A2 Gates 视图：点击门禁卡，配置 JSON 在被点卡内就地展开且该卡高亮；再点收起；列表很长时选中详情无需滚回顶部。
- A3 Gates 详情：不再出现「引用：…模板 / …Ticket」关联展示；「删除」按钮仍可用。
- A4 无死代码 / 可构建：page.tsx 中 usersOf / onOpenTicket / openTicketFromAnywhere 已删除；`npm run check`（tsc + build + verify）通过。

## 7. 开放问题

- 无。
