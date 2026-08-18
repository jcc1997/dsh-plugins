# dsh-plugins-4 — UC 验收用例（kanban UI 调整：模板卡片 / Gate 详情内联 / 去关联展示）

> 前置：RD（rd-confirmed）+ TD（td-confirmed）。经 md_doc_open 人审通过（打 uc-confirmed）后进 In Dev。
> 用例分「A. 构建级（本会话可验）」与「B. UI 级（重启 dsh + 刷新看板页后验收）」两组。

## A. 构建级（本会话）

### A-1 类型检查通过
- 步骤：`cd plugins/kanban && npx tsc --noEmit`。
- 期望：无类型错误（删除 onOpenTicket/usersOf 后无残留引用报错）。

### A-2 双产物构建 + 验证通过
- 步骤：`node build.mjs` -> `node scripts/verify-dist.mjs`。
- 期望：lib/index.js + lib/client.js 构建成功；两层冒烟通过（host import + client 真实执行，防 module is not defined 类回归）。

### A-3 无残留死引用
- 步骤：grep `usersOf|openTicketFromAnywhere|onOpenTicket` 于 plugins/kanban/src。
- 期望：除 board-view 的 `onOpenTicket`（看板视图自己的 props，保留）外，GatesView 相关死代码已清理。

## B. UI 级（重启 dsh + 刷新看板页后）

### B-1 模板列表为卡片样式（诉求 1）
- 前置：看板存在至少 1 条模板（无则新建一条）。
- 步骤：侧边栏进入「模板」视图。
- 期望：每个模板被卡片包裹（有背景、边框、圆角 12px、内边距）；hover 卡片边框品牌色 + 阴影微抬；点头部可展开编辑，编辑区仍在卡内（虚线分隔）；编辑态卡片边框品牌色强调。

### B-2 Gate 详情在选中卡内就地展开（诉求 2）
- 前置：门禁库存在至少 1 条 Gate（最好配置了 JSON config）。
- 步骤：进入「Gates」视图 -> 点击某张门禁卡。
- 期望：配置 JSON 在该卡 header 下方就地展开，该卡高亮（品牌色边框 + ring）；**不再**出现列表顶部详情面板；再点同一张卡收起；点另一张卡详情跟随切换。列表很长时无需滚回顶部。

### B-3 Gate 详情无关联展示（诉求 3）
- 步骤：展开任一 Gate 详情。
- 期望：详情里**不**出现「引用：…模板 / …Ticket」区块；「删除」按钮仍可用（点击不触发展开/收起）。

### B-4 回归：Ticket 抽屉 Gates 区块不受影响
- 步骤：打开任一 Ticket 抽屉，展开「Gates」区块。
- 期望：仍展示该卡挂载的门禁（触发/检查器/配置），样式正常。

## 通过口径

- A 组：A-1 ~ A-3 全过（本会话构建 + grep 校验）。
- B 组：B-1 ~ B-4 全过（用户重启 dsh 后，看板页人工验收）。
