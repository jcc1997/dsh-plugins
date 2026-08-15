# dsh-plugins UI 设计规范

> 插件 UI 与宿主(deepseek-harness)视觉统一的权威规范。**规范即契约**: 任何插件的 UI 新增/修改,先在本规范确认或补充对应契约,再写代码。

## 文档地图(单一内容只在一处)

| 文档 | 内容 | 维护方式 |
| --- | --- | --- |
| [tokens.md](tokens.md) | tokens 语义索引: 162 个 token 按语义域分组,名称+用途+注意(**不复制值**) | 值查 `packages/ui/dsh/design-platform.css` 快照;宿主升级→sync 脚本→核对本文 |
| [style-guide.md](style-guide.md) | 设计风格指引九维: 原则/排版/色彩/间距/圆角/阴影/动效/图标/语气 + 交互通则 | 人工维护;规则变更记 ADR |
| [components.md](components.md) | 组件规范: 逐组件几何+色彩+状态+配方 + 交互细节契约 + ADR | 人工维护;宿主组件升级时实测更新 |

## 核心文件

- **tokens 快照(唯一来源)**: `packages/ui/dsh/design-platform.css` — 由 `node scripts/sync-host-tokens.mjs` 从 `vendor/deepseek-harness` submodule(`packages/client/ui-theme/src/styles/`)同步生成,**勿手改**。
- **宿主组件实测来源**: `vendor/deepseek-harness/packages/client/ui-primitives/src/*.module.css`(Button/Input/Modal/Menu/Pill 等)。
- **图标集**: `packages/ui/host/icons.ts`(直接 re-export 宿主 `ui-primitives/src/icons` 源码,70 个,零复制零漂移)。

## 工作流

1. 新增/修改组件样式 → 先补 components.md 契约 → 再写代码。
2. 宿主升级 → `git -C vendor/deepseek-harness fetch && git submodule update --init --recursive` → `node scripts/sync-host-tokens.mjs` → 核对 tokens.md 差异。
3. 偏离宿主默认或存在取舍 → 记 ADR(components.md §十)。
4. 代码评审: 子 agent 对照本规范逐条审核(禁项/白名单/配方)。
