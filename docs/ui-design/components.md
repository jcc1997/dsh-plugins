# 组件规范（Component Spec）

> 每个组件 = 几何 + 色彩(token 名) + 状态 + CSS 配方。配方只允许引用 tokens.md 的语义层。
> 值一律以宿主实测为准;与宿主同款的组件照抄宿主 CSS Modules 实测(标注来源文件)。
> 漂移标注: 已废弃的自创形态标注 ⚠漂移,禁止新代码使用,后续重构移除。

## 一、总则

- 配方必须完整(可直接落地),不允许「参考宿主」式省略。
- 交互状态四件套: hover / active / focus-visible / disabled,逐组件给全。
- 组件契约新增/修改 → 先改本文档再写代码;实现与契约不一致以契约为准。

## 二、按钮 Button

> 来源实测: 宿主 `ui-primitives/src/Button.module.css`(1:155 Figma 实例)。⚠旧版自创方角(r8/padding 6px 14px/font 13)已漂移,禁止使用,后续重构。

### 2.1 几何

| 尺寸 | 高度 | 字号/行高 | padding | 圆角 | gap |
| --- | --- | --- | --- | --- | --- |
| md(默认) | 36px | 14/22 | 0 14px | 18px 胶囊 | 4px |
| sm(紧凑) | 28px | 12/18 | 0 10px | 14px | 4px |
| icon-only | 28×28 容器,glyph 16 | — | 0 | 50% | — |

```css
.btn{display:inline-flex;align-items:center;justify-content:center;gap:4px;border:none;border-radius:18px;cursor:pointer;font-size:14px;line-height:22px;color:var(--dsw-alias-label-primary);background:transparent;padding:0 14px;font-family:inherit;transition:background 150ms cubic-bezier(.4,0,.2,1)}
.btn-sm{height:28px;font-size:12px;line-height:18px;padding:0 10px;border-radius:14px}
.btn:disabled{cursor:not-allowed;opacity:.4}
```

### 2.2 变体

| 变体 | 底 | 前景 | hover | active |
| --- | --- | --- | --- | --- |
| primary | `--dsw-alias-button-primary-fill` | `--dsw-alias-label-primary-foreground` | `--dsw-alias-button-primary-hover` | 同 hover |
| ghost(默认) | transparent | label-primary | `--dsw-alias-interactive-bg-hover` | `--dsw-alias-interactive-bg-active` |
| outline | transparent | label-primary | interactive-bg-hover | interactive-bg-active |
| toolbar | `--dsw-alias-button-tool-bar-fill` | label-primary | `--dsw-alias-button-tool-bar-hover` | 同 hover |

```css
.btn-primary{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground)}
.btn-primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover)}
.btn-ghost:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.btn-ghost:active:not(:disabled){background:var(--dsw-alias-interactive-bg-active)}
.btn-outline{border:1px solid var(--dsw-alias-border-l2);background:transparent}
.btn-outline:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.btn-toolbar{background:var(--dsw-alias-button-tool-bar-fill)}
.btn-toolbar:hover:not(:disabled){background:var(--dsw-alias-button-tool-bar-hover)}
```

- focus-visible: `outline:none;box-shadow:0 0 0 2px rgba(65,118,230,.18)`(全部变体)。
- 危险操作: 不用独立 danger 变体(宿主无),用 ghost + 危险色文字 `--dsw-alias-state-error-primary`,hover 用 `interactive-bg-hover-danger`(⚠旧 .btn-danger 漂移)。
- 图标+文字: 图标 glyph 16,前置(左),gap 4。
- 禁用: opacity .4 + not-allowed;**不改变布局**。

## 三、icon 按钮

> 来源实测: 宿主 Icon_container 28×28。⚠旧自创已漂移(24×24 紧凑型),禁新代码使用。

```css
.icon-btn{width:28px;height:28px;border:none;background:none;cursor:pointer;padding:0;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-secondary);transition:background 150ms cubic-bezier(.4,0,.2,1)}
.icon-btn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.icon-btn:disabled{opacity:.5;cursor:default;pointer-events:none}
.icon-btn:focus-visible{outline:none;box-shadow:0 0 0 2px rgba(65,118,230,.18)}
```

- glyph 一律 16(`Icon*Outline16` 系列);confirm 变体文字色 `--dsw-alias-state-business-primary`。
- **hover 必须有背景变化**——宿主交互节奏;清单项内删除钮绝对定位 `top:4px;right:4px`(ADR-1)。

## 四、输入与 Composer

- **输入零高亮**(ADR-2): focus/hover 不改边框不加 ring,`caret-color:var(--dsw-alias-state-business-primary)`,光标即反馈。
- 普通输入: bg-base + border-l2 + radius 8 + padding 6px 8px + placeholder dimmed。
- **Composer**(带操作按钮的输入,公共组件 `packages/ui/src/composer.tsx`):
  - 容器: `border:1px solid var(--dsw-alias-border-l2-darkmode-thin,var(--dsw-alias-border-l2));background:var(--dsw-specific-input-major,var(--dsw-alias-bg-base));border-radius:22px;padding:4px 16px`(宿主主输入框同款;ADR-6)
  - textarea: 无边框无背景无 outline、上下 padding 4px、max-height 160px 内部滚动、caret 品牌蓝
  - 取消/确认 icon 按钮内嵌: 单行 → 同行右侧;多行 → 输入撑满、按钮落容器内最下面一行右对齐(ADR-3)
- **交互**: Enter 提交/发送,Shift+Enter 换行;Esc 无副作用(不关闭容器);发送后清空输入、焦点保持。
- **紧凑规格(compact)**: 批注等内嵌小输入用 `compact`(radius 10、padding 2px 10px、font 12/18、icon 按钮 24×24);单行按钮贴右、多行自动展开按钮落底部(ADR-10)。

## 五、卡片

- 看板卡片: bg-base + radius 12 + border-l2 + shadow-lv1;hover 边框品牌色 + 阴影微抬;选中 = 边框品牌色 + ring。
- 对话流工具卡(★宿主工具卡同款): `border:1px solid var(--dsw-alias-border-l1);border-radius:12px;padding:10px 12px;margin:4px 0 4px 4px;flex column;gap:8px`,不加阴影(ADR-5)。
- 卡片内边距: 上下 14px / 左右 16px。

## 六、浮层(弹窗/查看器/抽屉)

- 遮罩 `--dsw-alias-bg-mask-1` + 240ms 渐入;**蒙层点击不关闭**,仅显式按钮/Esc 关闭(ADR-4)。
- 本体: bg-base + border-l2 + radius 14 + shadow-lv3;查看器 `min(1152px,94vw) × min(768px,90vh)`,弹窗 560。
- 头部契约: 左 = 标题(14/600)+ 路径(12 mono tertiary,`flex:1` ellipsis);右 = icon 关闭钮(28×28+hover 背景);下边框 l2;hint/错误条 `padding:8px 16px`。
- 抽屉: 内边距上下 20 / 左右 24;关闭 = 右上 icon 按钮 + Esc。
- 双栏: 左主区 / 右 320px 侧栏,子容器一律 `min-width:0` 防溢出。
- **交互**: Esc 关闭;确认类按钮 Enter 触发;浮层内 Tab 循环不逃逸到页面。

## 七、其他组件

- 状态胶囊: 11px + radius 999px + padding 1px 8px;文字用 state-* 语义色。
- 评论气泡: radius 8 + bg-layer-2;变更记录: 时间 tabular-nums、操作者 11px 蓝徽章。
- 空状态: 居中 + tertiary + 一句引导;无图标。
- 链接: `--dsw-alias-state-business-primary`(宿主 markdown 链接实测 MarkdownText.module.css),hover underline;focus-visible ring。
- 滚动条: 容器内部滚动,scrollbar tokens(见 tokens.md §2.9)。

## 八、交互状态总表

| 控件 | hover | active | focus-visible | disabled |
| --- | --- | --- | --- | --- |
| 按钮(全变体) | 底变化(变体表) | 底加深 | 2px accent ring | opacity .4 |
| icon 按钮 | 背景变化 + 文字升档 | 按下 | 2px accent ring | opacity .5 |
| 输入/Composer | **无变化** | 无 | **无变化**(零高亮) | — |
| 看板卡片 | 边框品牌色+阴影微抬 | — | 选中 ring | — |
| 链接 | underline | — | ring | — |

## 九、交互细节契约(键盘/操作)

> 全局通则见 style-guide.md §十;此处逐组件定死。

1. **Composer/输入**: Enter=提交发送;Shift+Enter=换行;发送成功清空并保持焦点;失败保留内容+错误提示。
2. **浮层/弹窗/查看器**: Esc=关闭;遮罩点击不关闭;Ctrl/Cmd+Enter=确认(有确认按钮时)。
3. **icon 按钮**: 提供 title/aria-label(纯图标无障碍);Tab 可达。
4. **清单/列表**: 删除项 hover 显示删除钮;点击删除需二次确认(confirm 浮层或撤销)。
5. **表单**: Tab 顺序=视觉顺序;提交按钮 Enter 触发(非 textarea 时)。
6. **长列表**: 键盘上下键移动焦点(可选,有列表语义时);滚动不劫持页面。
7. **破坏性操作**: danger 确认按钮用 ghost+错误色;确认文案明确说出对象(「删除卡片 X」)。
8. **批注/引用类操作**: 划词批注为**内嵌在对应块下方的批注框**(文档流,无层级/遮挡问题;灰底 markdown-code-block 淡灰+上下边框横向拉满;引用文字带**原文行号**纯文字,块级 data-mdr-line 1-based,格式 `划中文字#L12`,随批注提交便于 agent 回原文定位;compact 输入,Enter 添加,取消关闭)(ADR-10/11)。

## 十、决策记录(ADR)

| # | 决策 | 原因 | 替代方案(否决) |
| --- | --- | --- | --- |
| ADR-1 | icon 按钮 28×28 圆形+hover 背景,glyph 16 | 宿主侧边栏 icon 按钮同款 | 24×24 紧凑型(漂移);padding+radius 6 自创(漂移) |
| ADR-2 | 输入零高亮,caret 品牌蓝 | 光标即反馈,高亮干扰阅读 | focus ring(漂移) |
| ADR-3 | Composer 内嵌按钮: 单行右侧/多行底部 | 避免多行右上角空置遮挡 | 右下角悬浮(遮挡);独立于输入框外(破坏形态) |
| ADR-4 | 蒙层点击不关闭,仅显式按钮/Esc | 防误触 | 点蒙层关闭(漂移) |
| ADR-5 | 工具卡几何 padding 10/12 + margin 4 0 4 4 + border-l1 | 宿主工具卡实测同款 | padding 12/16 无 margin(不齐) |
| ADR-6 | Composer = 宿主主输入框同款(l2-darkmode-thin + input-major + r22) | 用户要求参考宿主主输入框 | 常规 l2 + r8(不统一) |
| ADR-7 | 按钮契约 = 宿主 Button.module.css 实测(胶囊/两档/四变体/disabled .4) | 宿主统一最高原则,旧方角自创漂移 | 方角 r8 + 6/14 padding(漂移,废弃) |
| ADR-8 | tokens 单一来源 = design-platform.css 快照(sync 脚本从 submodule 同步) | 同一内容只在一处,宿主升级可复现 | 手工维护/宿主即来源(不可复现) |
| ADR-9 | 间距 = 宿主实测归纳档位表,非自创 4n | 宿主无 spacing token,值散在组件 CSS | 4n 体系(与实测冲突,部分漂移) |
| ADR-10 | compact 输入规格:radius 10/padding 2 10/font 12/icon 24;grow 单行用精确高度(lineHeight+padding)消除底部余量 | 批注等内嵌小输入需克制 | 常规 Composer(r22 胶囊,过大) |
| ADR-11 | 批注**回退为内嵌文档流**(试过跟随选区浮窗:层级/滚动跟随/遮挡复杂度高,插件场景不值得);灰底 markdown-code-block(bluish-50)+上下边框拉满;行号=划中文字#L7 纯文字 | 内嵌简单可靠,无层级问题 | 浮窗(复杂度高,已试,否决) |
