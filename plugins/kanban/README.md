# dsh-plugins-kanban

DSH 看板插件（动态插件开发版，热更新迭代中）。

## 能力

- **UI**：侧边栏「看板」入口（全屏页）→ 竖线分割列看板、拖拽排序/跨列、新建弹窗、编辑抽屉（720px，Notion 风格大标题，自动保存）、标签 chips、评论｜变更记录双栏、列配置弹窗、当前卡高亮
- **Agent 工具**（host 注册，10 个）：`kanban_view` / `get_card` / `search` / `recent` / `create` / `move` / `update` / `tags` / `comment` / `delete`；操作自动写入变更记录（`actor: "agent"`）
- **设置**：settings.section 配置数据目录（默认 `~/.dsh/kanban/board.json`，可指向 git 仓库）

## 目录

```
plugins/kanban/
├── build.mjs               # esbuild：TS/TSX → dist/client.js + dist/host.js（受限环境函数体）+ dist/submit.json
├── shims/                  # react / jsx-runtime shim（alias 到自由变量 React）
├── src/client/             # TSX 多文件：entry / page / drawer / create / columns / settings / styles
├── src/host/entry.ts       # RPC（kanban/load、save、set-data-dir）+ 10 个动态模型工具
├── scripts/verify-dist.mjs # vm 模拟受限环境验证产物（含工具注册断言）
└── dist/                   # 构建产物（gitignore）
```

## 开发

```bash
node build.mjs                 # 构建
node build.mjs --watch         # 监听
node scripts/verify-dist.mjs   # 验证
```

热更新：Code Mode 会话内 SDK 零粘贴（切块读入 submit.json → cordis_define → cordis_run update），详见根目录 skill。

## 数据模型

```json
{ "version": 1, "columns": [{ "id", "title", "cards": [{
    "id", "title", "description", "tags": ["..."],
    "comments": [{ "id", "text", "createdAt" }],
    "activity": [{ "id", "text", "at", "actor" }],   // actor: "手动调整" | "agent"
    "links": [], "meta": {}, "createdAt", "updatedAt"
}], "meta": {} }], "meta": {} }
```

## 已知问题

1. 刷新页面后 Client 半不会自动恢复（官方设计）——在 Run 卡片手动重新激活
2. 重启 dsh 进程后动态插件丢失——`kind: new` 重新定义，源码以本目录为准
