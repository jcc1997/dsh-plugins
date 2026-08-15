# dsh-pipeline

DSH Pipeline 流水线插件（正式 bundle 形态）。类似 dify 的可复用 AI 流水线：把「视频转 mp3」「mp3 转文字」这类基本单元组装成「bilibili 视频总结」这样的完整流水线。

## 能力

- **Pipeline 管理**：侧边栏入口（同看板）打开全屏主界面；流水线列表**多列网格**；选中进入**独立编辑页面**（列表 / 编辑 / 运行与队列 / 说明）。
- **流水线图（dify 式）**：编辑页基于开源 **@xyflow/react（React Flow，与 dify 同源）** 渲染节点图——节点卡片（类型徽章/标题/配置摘要/删除）+ SVG 连线 + **边中点 + 插入节点** + 点击节点右侧面板编辑（标题/依赖/配置 JSON）；不支持拖拽节点，画布可平移缩放。
- **版本管理（npm 风格 semver）**：版本号形如 v1.0.1（major.minor.patch）。发布后版本不可变；最新版本是草稿，可编辑节点图；发布时按 patch/minor/major 升位。
- **atomic 与 combined**：atomic 是无依赖基础单元（可复用）；combined 引用已发布的 atomic 单元组合成完整流程（pipeline 节点 ref 支持 `<pipelineId>@<version>` / `@latest`）。
- **节点类型**：input / output / exec（shell 命令）/ fetch（HTTP）/ transform（JSON 转换）/ llm（大模型分析）/ pipeline（子流水线引用）。支持 {input.xxx} / {up.<nodeId>.<field>} 占位符串联数据。
- **运行与队列**：运行入队串行执行；「运行与队列」视图实时轮询进度、节点状态（pending/running/success/failed）、输出与错误，支持**按流水线筛选**。
- **常驻 dock 条（todo 式）**：对话流输入区上方常驻「流水线运行」列表（conversation.input.dock 槽位，宿主 todo 同款座位）——展示全部运行（运行中置顶）：状态点 + 名称 + 状态 + 进度 + run id + 详情跳转（打开主面板定位）；已完成的可点 × 移除（本地隐藏不删数据）；2s/8s 自适应轮询；宽度对齐宿主输入卡（TodoPanel 同款 calc 公式）。
- **面向 agent**：对话上下文 10 个 pipeline_* 工具——查 / 建 / 改 / 删 / 发布版本 / 运行 / 查进度 / 看队列 / 目录。
- **跨插件服务**：其他插件可经 ctx.get('pipeline') 调用 list / get / getPublished / run（同步阻塞）/ runAsync（入队）/ status / catalog。

## 数据

- 目录：~/.dsh/pipeline/pipeline.json（pipelines + 版本 + 运行记录 + 队列）
- 运行记录上限 200 条（自动裁剪）

## 已知限制 / 路线

- llm 节点当前为占位实现：沙箱环境启动子 agent 的能力延后实现（引擎已留 runLlm 注入点）。
- exec 节点依赖宿主 shell 沙箱执行器；未挂载时返回可读错误。
- 队列为进程内存 + 磁盘记录：重启后排队中的运行不会自动恢复执行（记录保留）。

## 开发

```bash
pnpm --filter dsh-pipeline check   # typecheck + build + verify
node build.mjs --watch             # HMR 开发
```

