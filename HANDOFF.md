## 当前状态（v3 迭代，2026-08）

- **kanban v3（本会话已完成并热更新激活 kbnb-6/pkg-36，冒烟测试全通过）**：
  - **激活事故复盘**：首次 run（kbnb-5）报 `service "kanban" has been registered`——宿主进程残留旧会话 kanban 插件（占服务名+16 旧工具）；cordis_stop 查 kbnb-1~4 均不存在（会话隔离），需在 UI 停掉旧 Run 或等旧会话清理后重试。用户删除 kbnb-5 后注册表自动清空，重定义 kbnb-6 即成功。**教训：报重复注册先查工具注册表（Tool.listTools）确认残留是否还在，别去猜插件 id**
  - **冒烟验证**：create(content 块) → archive → list_archived/search(archived)/get_card(archived+contentText) → unarchive → view(group_by=repo) 2 组 → search(repo=) → delete，全部 ok
  - **归档**：卡片抽屉「归档」→ board.archive（隐藏移出看板）；页内左侧边栏「归档」列表（原列/归档时间）→ 恢复（回原列或第一列）/永久删除/清空归档；agent 工具 kanban_archive / kanban_unarchive / kanban_list_archived；search 支持 archived=true；getCard/服务 getCard/updateCard 覆盖归档卡
  - **页内左侧边栏**：看板 / 归档 / 设置（设置页内嵌，原 settings.section 保留）
  - **groupby**：UI 顶栏「分组」= 不分组 | Git 仓库（按 github-repo ref 分泳道，未关联归末组，组内拖拽，跨组忽略）；agent 侧 kanban_view(group_by=repo) 分组返回 + kanban_search(repo=...) 筛选
  - **布局**：页面上下撑满、列间竖线拉到底、每列独立纵向滚动、看板横向滚动（分组模式按组横向滚动）
  - **富文本 content（自研块编辑器，零依赖）**：card.content = KanbanBlock[]（text/h1/h2/h3/bullet/ordered/check/quote/code/divider/image，text 存内联 HTML）；工具栏 B/I/S/行内代码/H1-H3/列表/待办/引用/代码块/分割线/图片（粘贴或文件 → FileReader → dataURL）；标题/描述改 contentEditable（无 input 边框），描述单行纯文本无预览
  - **关键坑（本会话实测）**：① client 半闭包只遮蔽 setTimeout/setInterval/clearTimeout/clearInterval/fetch/require/process/Buffer —— document/window/FileReader 是环境全局可用（旧 skill 说"无 document/window"过时）；② cordis_define 的 code 用模板字符串时小心反引号；③ SDK 读段文件要取 r.stdout.text（不是 r.stdout），段文件末尾 \n 需先剔除再 JSON.parse；④ 动态 client 不能装开源富文本编辑器（无 import/timer），自研 contentEditable + execCommand 方案最稳；⑤ 拖拽列头在分组模式禁用（跨组无意义）
- **未做**：M4 本地 git 命令/MR 创建；正式部署（bundle 化）不变

# HANDOFF — 跨会话交接状态

> 用途：动态插件是会话态，对话记忆不跨会话；**本文件 + git 历史 = 持久上下文**。