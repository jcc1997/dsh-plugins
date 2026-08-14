## 当前状态（正式 bundle 形态迁移完成，2026-08）

- **插件已从动态形态迁移为正式 bundle 形态**（动态插件废弃）：
  - dsh-kanban / dsh-git：标准 cordis 模块（lib/index.js host + lib/client.js client/ModuleLoader）、dsh.bundle+dsh.client 声明、cordis.patch.yml、peerDeps（@deepseek-ai/cordis、@deepseek-ai/dsh-tools）
  - 数据通道：host 半 ctx.webServer.register 暴露 /api/kanban/*、/api/git/sync；client 半 fetch 调用（替代 host.call）；agent 工具 ctx.tools.register(defineTool(...))（parameters 需 DSL 适配：直接属性映射 + required 属性级注解）
  - 已挂载 web profile（link: 本地），cordis.patch.yml 加了 @deepseek-ai/cordis-plugin-hmr（host HMR）+ web-app 自带 dsh-client-hmr（client HMR，配合 build --watch）
  - 开发模式：改 src → node build.mjs（或 --watch）→ host 自动重载 / client 经 SSE rebuilt 帧热换，**不再需要 cordis_define/批准，重启不丢**
- **待验证（用户重启 dsh 后）**：侧边栏「看板」入口；19 个 kanban_* + 7 个 git_* 工具注册；/api/kanban/load 等路由；HMR 链路（改源码自动重载）
- **迁移踩坑**：esbuild external 用通配符字符串（正则报错）；无 intro 选项；python3 -c + JSON.stringify 会把换行变字面 \n（脚本须写文件执行）；defineTool 的 parameters 形状与动态 DSL 不同；profile link: 安装时 workspace:* 依赖无法解析（已把 @dsh-plugins/* 打进 bundle 并移除 dependencies）

## 当前状态（v3 迭代，2026-08）

- **kanban v3（本会话已完成并热更新激活 kbnb-6/pkg-36，冒烟测试全通过）**：
  - **激活事故复盘**：首次 run（kbnb-5）报 `service "kanban" has been registered`——宿主进程残留旧会话 kanban 插件（占服务名+16 旧工具）；cordis_stop 查 kbnb-1~4 均不存在（会话隔离），需在 UI 停掉旧 Run 或等旧会话清理后重试。用户删除 kbnb-5 后注册表自动清空，重定义 kbnb-6 即成功。**教训：报重复注册先查工具注册表（Tool.listTools）确认残留是否还在，别去猜插件 id**
  - **冒烟验证**：create(content 块) → archive → list_archived/search(archived)/get_card(archived+contentText) → unarchive → view(group_by=repo) 2 组 → search(repo=) → delete，全部 ok
  - **归档**：卡片抽屉「归档」→ board.archive（隐藏移出看板）；页内左侧边栏「归档」列表（原列/归档时间）→ 恢复（回原列或第一列）/永久删除/清空归档；agent 工具 kanban_archive / kanban_unarchive / kanban_list_archived；search 支持 archived=true；getCard/服务 getCard/updateCard 覆盖归档卡
  - **页内左侧边栏**：看板 / 归档 / 设置（设置页内嵌，原 settings.section 保留）
  - **groupby**：UI 顶栏「分组」= 不分组 | Git 仓库（按 github-repo ref 分泳道，未关联归末组，组内拖拽，跨组忽略）；agent 侧 kanban_view(group_by=repo) 分组返回 + kanban_search(repo=...) 筛选