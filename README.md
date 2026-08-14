# dsh-plugins — DSH 插件大仓

DeepSeek Harness（DSH）插件开发仓库，双形态并存：

| 形态 | 用途 | 发布 | 开发方式 |
|---|---|---|---|
| **发布版 bundle**（`plugins/hello` 模板） | 正式安装分发 | npm / tarball，`dsh plugin add` | 官方规范：ESM 模块 + cordis.patch.yml，无需编译 |
| **动态插件**（`plugins/kanban` 管线） | 会话内热更新迭代 | 不进 npm，`cordis_define` 即时加载 | TS/TSX 源码 + esbuild 管线 + Code Mode SDK 零粘贴 |

> 开发前先加载 skill：`.agents/skills/dsh-dynamic-plugin-dev`（受限环境约束 + 代码模板 + 踩坑清单 + 编译管线）。

## 仓库结构

```
dsh-plugins/
├── package.json + pnpm-workspace.yaml   # workspace 根
├── plugins/
│   ├── hello/         # 发布版示例插件（官方规范：Config schema + 工具）
│   └── kanban/        # 动态插件：TS 源码 + esbuild 管线 + 10 个 agent 工具
├── packages/ui/       # 共享包 @dsh-plugins/ui：design tokens + 图标 + 工具函数 + 组件
│   └── DESIGN.md      # UI 设计规范（原则 + tokens + 组件契约 + 间距契约）
├── vendor/deepseek-harness/   # 官方仓库 submodule（sparse checkout，图标源码来源）
└── .agents/skills/dsh-dynamic-plugin-dev/  # 动态插件开发 skill
```

## kanban 动态插件能力总览

### UI（`sidebar.footer.action` 入口，全屏看板页）
- 看板：竖线分隔列、拖拽排序/跨列移动、当前卡高亮、空状态引导
- 卡片：新建弹窗（Notion 风格大标题）、编辑抽屉（720px，自动保存）、标签 chips、评论｜变更记录双栏
- 日志：创建/更新/状态变更/标签/评论全记录，含时间与操作者（`手动调整` / `agent`）
- 设置：`settings.section` 配置数据目录（`~/.dsh/kanban/board.json`，可指向 git 仓库同步）

### Agent 工具（host 注册，模型可直接调用）

**查询**
| 工具 | 说明 |
|---|---|
| `kanban_view` | 看板全览：所有列 + 卡片概要 |
| `kanban_get_card` | 单卡完整详情（含评论、变更记录） |
| `kanban_search` | 条件查询：keyword + status（列名/id）+ tags 组合 |
| `kanban_recent` | 最近改动（updatedAt 倒序，默认 10） |

**操作**
| 工具 | 说明 |
|---|---|
| `kanban_create` | 新建卡片（title 必填，可带 status/description/tags） |
| `kanban_move` | 移动状态（列名或列 id） |
| `kanban_update` | 更新标题/描述（实际变化才记日志） |
| `kanban_tags` | 增减标签（add/remove 数组） |
| `kanban_comment` | 添加评论 |
| `kanban_delete` | 删除卡片（不可恢复） |

所有操作自动写入变更记录（`actor: "agent"`），与 UI 手动操作（`actor: "手动调整"`）同源可追溯。

## 开发动态插件（快速开始）

``bash
# 1. 初始化 submodule（图标源）
git submodule update --init
# 2. 安装依赖
pnpm install
# 3. 改源码（plugins/kanban/src/client/*.tsx、src/host/entry.ts）
# 4. 构建 + 验证
cd plugins/kanban && node build.mjs && node scripts/verify-dist.mjs
# 5. 热更新（Code Mode 会话内）
#    run_code 程序里 SDK 零粘贴：切块读入 submit.json → cordis_define → cordis_run update
```

**Code Mode 硬性规则**：未以 `DSH_TOOLS_MODE=code` 启动时，拒绝 cordis_define 热更新（产物每次全量进上下文 ≈ 50KB+/次）。详见 skill 第零节。

## 发布版 bundle 插件（官方形态）

以 `plugins/hello` 为模板：`cp plugins/hello/{cordis.patch.yml,package.json} plugins/my-plugin/`，入口导出 `name` / `Config`(可省) / `apply(ctx, config)`。

``bash
dsh plugin --profile web add ./plugins/hello        # 本地目录
pnpm --filter dsh-plugins-hello pack               # tarball 分发
dsh plugin --profile web add dsh-plugins-hello     # npm 发布后
dsh --profile web --dump-config                    # 验证组合层
```

> 安装后重启 dsh web 进程生效；插件不随仓库自动分发。

## 参考

- [官方开发文档](https://github.com/deepseek-ai/deepseek-harness/tree/master/docs/user/develop)
- [Your first plugin](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/index.md)
- [Build a tool](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/tool.md)
- [Package and install](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.md)
- [UI 设计规范（packages/ui/DESIGN.md）](packages/ui/DESIGN.md)
