# tokens 索引（语义域分组全量枚举）

> **唯一来源**: `packages/ui/dsh/design-platform.css`(由 `node scripts/sync-host-tokens.mjs` 从 `vendor/deepseek-harness` submodule 同步,勿手改)。
> 本文件只写「语义 → token 名 + 用途 + 注意」,**不复制任何值**;取值一律查快照文件。
> 宿主升级后: 更新 submodule → 重跑 sync 脚本 → 核对本文件(新增/删除 token 时同步修订)。
> 全部 token 共 162 个(static 73 + alias 78 + specific 11),浅色/深色由宿主 `data-ds-dark-theme` 自动切换,插件样式**一律不写媒体查询**。

## 一、static 色板(73)

> 原始色板,仅作取值参考与 alias 的构成原料。**插件样式禁止直接使用 static 色板**,一律走 alias 语义层;确无 alias 可用时,先补 alias 再使用(记 ADR)。

### 1.1 neutral 灰阶(16)

| token | 用途 | 注意 |
| --- | --- | --- |
| `--dsw-static-neutral-00` ~ `-1000` | 全灰阶色板(50/100/150/200/250/300/400/500/550/600/700/800/850/900/1000) | 00 最浅、1000 最深;仅作取值参考 |
| `--dsw-static-neutral-50/100/…` | 灰阶各档 | 明暗主题下相同值,不做主题判断 |

### 1.2 neutral-bluish 冷灰(19)

| token | 用途 | 注意 |
| --- | --- | --- |
| `--dsw-static-neutral-bluish-00` ~ `-950`(含 60/75/150/250/750/850/875 等档) | 带蓝相的冷灰阶,宿主浅色主题底色体系 | 明暗主题通用 |

### 1.3 deepseek 品牌蓝(11)

| token | 用途 | 注意 |
| --- | --- | --- |
| `--dsw-static-deepseek-500` | 品牌蓝主色(按钮 hover 深色主题用 500) | 65,118,230 一系 |
| `--dsw-static-deepseek-600` | 品牌蓝 hover(浅色主题按钮 hover) | 见 §组件规范 按钮 |
| `--dsw-static-deepseek-700-delete` | 删除专用深蓝 | 名字带 delete,勿用于常规 |
| `--dsw-static-deepseek-50/100/200/300/400/450/800/900` | 品牌蓝阶 | 仅取值参考 |

### 1.4 功能色(27)

| token | 用途 | 注意 |
| --- | --- | --- |
| `--dsw-static-blue-*`(12) | 通用蓝阶(50/50p/75/100/300/400/450/500/600/800/900/950) | 50p = 50% 透明度蓝 |
| `--dsw-static-green-*`(4) | 成功绿阶(100/400/500/900) | |
| `--dsw-static-red-*`(6) | 危险红阶(50/100/400/500/600/900) | |
| `--dsw-static-amber-*`(5) | 警告琥珀阶(100/400/500/600/900) | |

## 二、alias 语义层(78)

> 插件样式**只允许**使用本层与 §三 specific 层。所有 alias 已按明暗主题正确取值,插件不做主题分支。

### 2.1 文字 label(9)

| token | 用途 | 注意 |
| --- | --- | --- |
| `--dsw-alias-label-primary` | 主文字(标题/正文/默认前景) | 最常用 |
| `--dsw-alias-label-secondary` | 次文字(次级信息) | |
| `--dsw-alias-label-tertiary` | 辅助文字(说明/路径/元信息) | |
| `--dsw-alias-label-dimmed` | 占位/禁用级文字 | placeholder |
| `--dsw-alias-label-caption` | 说明文字(小字) | 与字阶 11 配合 |
| `--dsw-alias-label-primary-foreground` | 主按钮上文字(primary fill 之上的前景) | 按钮 primary 专用 |
| `--dsw-alias-label-primary-inverted` | 反色主文字(深底场景) | |
| `--dsw-alias-label-primary-bluish` | 蓝相主文字 | 冷调场景 |
| `--dsw-alias-label-primary-dimmed` | 主文字降级态 | hover 减弱等 |

### 2.2 边框 border(8)

| token | 用途 | 注意 |
| --- | --- | --- |
| `--dsw-alias-border-l1` | 最轻边框(工具卡/浮层细线) | |
| `--dsw-alias-border-l2` | 常规边框(输入框/卡片/分隔) | 最常用 |
| `--dsw-alias-border-l2-darkmode-thin` | 深色模式细边框(输入框专用) | 见 §组件规范 Composer,ADR-6 |
| `--dsw-alias-border-l3` | 强边框(hover/强调) | |
| `--dsw-alias-border-l4` | 最强边框(选中态) | |
| `--dsw-alias-border-inverted` / `-inverted2` | 反色边框(深底场景) | |

### 2.3 背景 bg(13)

| token | 用途 | 注意 |
| --- | --- | --- |
| `--dsw-alias-bg-base` | 页面/浮层基础底 | 最常用 |
| `--dsw-alias-bg-layer-1/2/3` | 次级底(气泡/代码块/清单项逐级加深) | layer-2 常用(代码块/评论) |
| `--dsw-alias-bg-overlay` | 浮层覆盖底 | |
| `--dsw-alias-bg-skeleton` | 骨架屏占位底 | |
| `--dsw-alias-bg-mask-1/2/3` | 蒙层(1 常规遮罩,2/3 加深) | 浮层遮罩用 mask-1 |
| `--dsw-alias-bg-mask-drop` | 拖放区蒙层 | |
| `--dsw-alias-bg-mask-photo` | 图片查看蒙层 | |
| `--dsw-alias-bg-module-platform` | 模块平台底 | |
| `--dsw-alias-bg-multi-select` | 多选底 | |

### 2.4 品牌 brand(4)

| token | 用途 | 注意 |
| --- | --- | --- |
| `--dsw-alias-brand-primary` | 品牌主色(浅色主题=近黑 bluish-1000;**勿当链接色**,链接用 state-business-primary,宿主实测) | |
| `--dsw-alias-brand-primary-invert` | 反色品牌主色 | |
| `--dsw-alias-brand-text` | 品牌文字 | |
| `--dsw-alias-brand-primary-new-colorprimary-new-color` | 品牌新主色(宿主命名遗留,慎用) | 名字含 new-color,待宿主清理 |

### 2.5 按钮 button(12)

| token | 用途 | 注意 |
| --- | --- | --- |
| `--dsw-alias-button-primary-fill` | primary 按钮底 | 见 §组件规范 按钮 |
| `--dsw-alias-button-primary-hover` | primary 按钮 hover 底 | |
| `--dsw-alias-button-primary-dimmed` | primary 按钮降级底 | |
| `--dsw-alias-button-tool-bar-fill` / `-hover` | 工具栏按钮底/hover | toolbar 变体 |
| `--dsw-alias-button-tool-bar-fill-invisible` | 工具栏隐形按钮底 | |
| `--dsw-alias-button-contrast-fill` | 高对比按钮底 | |
| `--dsw-alias-button-elevated-fill` | 浮起按钮底 | |
| `--dsw-alias-button-floating-fill` / `-hover` | 悬浮按钮底/hover | |
| `--dsw-alias-button-ghost-active-fill` / `-hover` / `-border` | ghost 激活态底/hover/边框 | |
| `--dsw-alias-button-info-fill` / `-hover` | 信息按钮底/hover | |

### 2.6 交互 interactive(5)

| token | 用途 | 注意 |
| --- | --- | --- |
| `--dsw-alias-interactive-bg-hover` | hover 背景(icon 按钮/ghost/列表项) | 宿主交互节奏标配 |
| `--dsw-alias-interactive-bg-active` | active 按下背景 | |
| `--dsw-alias-interactive-bg-hover-danger` | 危险 hover 背景 | |
| `--dsw-alias-interactive-bg-hover-accent` | 强调 hover 背景 | |
| `--dsw-alias-interactive-bg-hover-solid` | 实色 hover 背景 | |

### 2.7 状态 state(13)

| token | 用途 | 注意 |
| --- | --- | --- |
| `--dsw-alias-state-business-primary` | 业务主色(选中/caret/主操作) | caret 色即它 |
| `--dsw-alias-state-business-tertiary` | 业务次色 | |
| `--dsw-alias-state-error-primary` | 错误主色 | |
| `--dsw-alias-state-error-secondary` | 错误次色(边框) | |
| `--dsw-alias-state-success-primary` / `-secondary` / `-tertiary` | 成功主/次/三级 | |
| `--dsw-alias-state-warn-primary` / `-secondary` / `-tertiary` / `-label` | 警告主/次/三级/文字 | |

### 2.8 markdown 专属(8)

| token | 用途 | 注意 |
| --- | --- | --- |
| `--dsw-alias-markdown-inline-code` | 行内代码底 | |
| `--dsw-alias-markdown-code-block` / `-banner` | 代码块底/横幅 | |
| `--dsw-alias-markdown-code-segment-selected` / `-unselected` | 代码段选中/未选中 | |
| `--dsw-alias-markdown-citation` | 引用块 | |
| `--dsw-alias-markdown-placeholder` | markdown 占位 | |
| `--dsw-alias-markdown-tag` | markdown 标签 | |

### 2.9 滚动条 scrollbar(4)

| token | 用途 | 注意 |
| --- | --- | --- |
| `--dsw-alias-scrollbar-bg-l1` / `-l2` | 滚动条轨道底 | |
| `--dsw-alias-scrollbar-hover-l1` / `-l2` | 滚动条 hover | |

### 2.10 浮层杂项(2)

| token | 用途 | 注意 |
| --- | --- | --- |
| `--dsw-alias-toast-bg` | toast 底 | |
| `--dsw-alias-tooltip-bg` | tooltip 底 | |

## 三、specific 组件专用层(11)

> 宿主特定组件专用,插件**原则上不引用**(组件形态未对齐宿主时禁止使用,会漂移);确有同款场景再引用并记 ADR。

| token | 宿主场景 | 插件可用性 |
| --- | --- | --- |
| `--dsw-specific-input-major` | 主输入框底(Composer 同款) | ✅ 可用(ADR-6) |
| `--dsw-specific-bubble` / `-highlight` | 对话气泡底/高亮 | 待定 |
| `--dsw-specific-login-input` | 登录输入框 | ❌ |
| `--dsw-specific-menu` | 菜单底 | 待定 |
| `--dsw-specific-selector` | 选择器底 | 待定 |
| `--dsw-specific-sidebar-fill` | 侧边栏底 | ❌ |
| `--dsw-specific-sidebar-nav-item-active` / `-accent` / `-hover` | 侧边栏导航项态 | ❌ |
| `--dsw-specific-tip` | 提示条 | 待定 |

## 四、使用红线

1. **禁硬编码色值**(hex/rgb/named);唯一例外:主按钮文字 `#fff`(宿主同款,见 §组件规范)。
2. **禁直接使用 static 色板**(§一);全部走 alias 语义层。
3. **禁自建别名层**:不定义 `--dsh-*` 包装 `--dsw-*` 的中间变量,直接引用。
4. **禁主题分支**:不写 `data-ds-dark-theme` 媒体查询,alias 已含主题。
5. 需要新语义时:先查 §二 是否已有;确无 → 在快照中找合适 static 值 → 记 ADR 并补充本表。
