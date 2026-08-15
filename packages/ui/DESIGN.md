# dsh-plugins UI 设计规范 v3

> **规范即契约**:任何插件的 UI 新增/修改,先在本规范确认或补充对应契约,再写代码。
> 每条规则必须**可判定**:组件契约给出完整 CSS 配方(精确到 token 与数值);全局红线可脚本化(见 §五)。
> 凡偏离宿主默认或存在取舍的样式,必须在 §四 记决策记录(ADR),说明原因与替代方案。

## 〇、定位与流程

1. **规范优先**:新增组件/样式前,先补 §二 对应条目,再实现;实现与契约不一致时以契约为准。
2. **宿主统一(最高原则)**:插件运行在 DeepSeek Harness 内,视觉语言/色彩/字号/圆角/节奏跟随宿主;宿主有同款实现的,照抄其取值,不自创。
3. **决策留痕**:任何「为什么这样定」的结论写入 §四 ADR,防止后人改回错误形态。
4. 版本:v3(2026-08)——较 v2 新增 icon 按钮、浮层头部、对话流工具卡、Composer 契约与 ADR;§三输入规则改为零高亮。

## 一、基础层(宿主 tokens 使用规则)

### 1.1 色彩
- 一律 `var(--dsw-*)`,**禁硬编码色值**(hex/rgb/named)。唯一例外:主按钮文字 `#fff`(与宿主一致)。
- 语义档位:
  - 文字:`--dsw-alias-label-primary` 主文 / `secondary` 次文 / `tertiary` 辅助 / `dimmed` 占位 / `caption` 说明;
  - 边框:`--dsw-alias-border-l1` 轻 / `l2` 常规分隔与输入框 / `l3` hover 与强分隔 / `l2-darkmode-thin` 输入框专用(见 §2.3);
  - 背景:`--dsw-alias-bg-base` 页面与浮层 / `bg-layer-2` 次级底(代码块/气泡/清单项)/ `interactive-bg-hover` 悬停底 / `interactive-bg-hover-danger` 危险悬停底;
  - 状态:`--dsw-alias-state-business-primary` 主操作/选中/caret;`state-error-primary` / `state-success-primary` 语义色。
- 暗色红线:禁静态浅色底做 hover/常态背景;品牌蓝半透明 ring 仅按钮 focus,用 `rgba(65,118,230,.18)`。

### 1.2 字阶(官方体系,正文基准 13px)
11 caption / 12 辅助 / 13 正文 / 14 次标题 / 15-16 标题 / 19-22 大标题 / 26 页面大标题。

### 1.3 圆角白名单
`6` 小控件(胶囊除外)· `8` 按钮/输入/代码块/气泡 · `12` 卡片 · `14` 浮层 · `22` Composer 输入(宿主主输入框同款)· `999px` 胶囊 · `50%` icon 按钮。**白名单之外禁用**。

### 1.4 阴影
`--dsw-shadow-lv1` 看板卡片 · `lv2` 输入浮起/小浮层 · `lv3` 浮层/抽屉。对话流工具卡不加阴影。

### 1.5 间距(4n 体系)
4/8/12/16/20/24/28/32。唯一例外:按钮 padding `6px 14px`(官方按钮实测)、表格单元格 `8px 12px`、引用条 3px。

| 场景 | 值 |
|---|---|
| 看板区四边 | 16px |
| 顶栏 | 纵向 14px / 横向 20px |
| 卡片内边距 | 上下 14px / 左右 16px |
| 抽屉内边距 | 上下 20px / 左右 24px |
| 弹窗内边距 | 16px;表单元素之间 ≥16px |
| 表单控件之间 | 16px;标签与控件 8px |
| 浮层头部/底部 | 纵向 12px / 横向 16px |

### 1.6 动效
过渡 150ms `cubic-bezier(.4,0,.2,1)`;浮层出现 240ms;状态指示动画仅 loading(纯 CSS)。

## 二、组件契约(完整配方)

### 2.1 按钮
```css
.btn{background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:6px 14px;font-size:13px;cursor:pointer;color:var(--dsw-alias-label-primary);transition:all 150ms cubic-bezier(.4,0,.2,1);font-family:inherit}
.btn:hover{background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-border-l3)}
.btn:disabled{opacity:.5;cursor:default;pointer-events:none}
.btn:focus-visible{outline:none;box-shadow:0 0 0 2px rgba(65,118,230,.18)}
.btn-primary{background:var(--dsw-alias-state-business-primary);border-color:var(--dsw-alias-state-business-primary);color:#fff}
.btn-primary:hover{background:var(--dsw-static-deepseek-600);border-color:var(--dsw-static-deepseek-600)}
body[data-ds-dark-theme] .btn-primary:hover{background:var(--dsw-static-deepseek-500);border-color:var(--dsw-static-deepseek-500)}
.btn-danger{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-secondary)}
.btn-danger:hover{background:var(--dsw-alias-interactive-bg-hover-danger);border-color:var(--dsw-alias-state-error-primary)}
```

### 2.2 icon 按钮(★v3 新增;宿主同款)
所有图标操作按钮(浮层关闭 / Composer 取消·确认 / 清单项删除)统一规格,glyph 一律 16(`Icon*Outline16` 系列):

```css
.icon-btn{width:28px;height:28px;border:none;background:none;cursor:pointer;padding:0;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-secondary);transition:background 150ms cubic-bezier(.4,0,.2,1)}
.icon-btn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.icon-btn:disabled{opacity:.5;cursor:default;pointer-events:none}
.icon-btn:focus-visible{outline:none;box-shadow:0 0 0 2px rgba(65,118,230,.18)}
.icon-btn-confirm{color:var(--dsw-alias-state-business-primary)}
.icon-btn-confirm:hover{color:var(--dsw-alias-state-business-primary)}
```
- **hover 必须要有背景变化**(`interactive-bg-hover`),这是宿主交互节奏;
- 清单项内的删除钮绝对定位 `top:4px;right:4px`。ADR-1。

### 2.3 输入与 Composer(★v3 修订)
- **输入零高亮**:focus/hover 均不改边框、不加 ring,`caret-color:var(--dsw-alias-state-business-primary)`(宿主同款),光标即反馈。ADR-2。
- 普通输入:`bg-base + border-l2`、radius 8、padding `6px 8px`、placeholder `dimmed`。
- **Composer(带操作按钮的输入)**,公共组件 `packages/ui/src/composer.tsx`(`Composer` + `composerCss`):
  - 容器:`box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2-darkmode-thin, var(--dsw-alias-border-l2));background:var(--dsw-specific-input-major, var(--dsw-alias-bg-base));border-radius:22px;padding:4px 16px`(宿主主输入框同款;ADR-6);
  - textarea:无边框无背景无 outline、上下 padding 4px、max-height 160px 内部滚动、caret 品牌蓝;
  - **取消/确认用 icon 按钮(§2.2)内嵌容器**:单行 → 按钮在输入右侧同行;输入增多自动增高变多行 → 输入横向撑满、按钮落到容器内最下面一行(右对齐)。ADR-3。

### 2.4 卡片
- 看板卡片:bg-base、radius 12、border-l2、shadow-lv1;hover 边框品牌色 + 阴影微抬;选中 = 边框品牌色 + ring。
- 对话流工具卡(★v3 新增):`border:1px solid var(--dsw-alias-border-l1);border-radius:12px;padding:10px 12px;margin:4px 0 4px 4px;flex column;gap:8px`,不加阴影(与宿主工具卡观感一致;ADR-5)。

### 2.5 浮层(弹窗/查看器)(★v3 增补头部契约)
- 遮罩 `--dsw-alias-bg-mask-1` + 240ms 渐入;**蒙层点击不关闭**,仅显式按钮关闭。ADR-4。
- 浮层本体:bg-base、border-l2、radius 14、shadow-lv3;查看器 `min(1152px,94vw) × min(768px,90vh)`,弹窗 560。
- **头部契约**:左 = 标题(14/600)+ 路径(12 mono tertiary,`flex:1` ellipsis);右 = icon 关闭钮(§2.2,28×28 + hover 背景);下边框 l2;hint/错误条 `padding:8px 16px`(warn/error 色)。
- 双栏内容:左主区 / 右 320px 侧栏,子容器一律 `min-width:0` 防溢出。

### 2.6 其他组件(继承 v2,换算为 token)
- 评论气泡:radius 8、bg-layer-2;变更记录:时间 tabular-nums、操作者 11px 蓝徽章;
- 空状态:居中、tertiary + 一句引导;状态胶囊:11px、999px、padding 1px 8px。

## 三、交互状态表

| 控件 | hover | active | focus-visible | disabled |
|---|---|---|---|---|
| 按钮(主/次/危险) | 背景/边框变化 | 按下态 | 2px accent ring | opacity .5 |
| icon 按钮 | **背景变化**(interactive-bg-hover) | 按下态 | 2px accent ring | opacity .5 |
| 输入 / Composer | **无变化** | 无 | **无变化**(零高亮) | — |
| 看板卡片 | 边框品牌色 + 阴影微抬 | 选中 ring | — | — |
| 链接 | underline | — | — | — |

## 四、决策记录(ADR)

| # | 决策 | 原因 | 替代方案(否决) |
|---|---|---|---|
| ADR-1 | icon 按钮 28×28 圆形 + hover 背景,glyph 16 | 宿主侧边栏 icon 按钮同款,混排一致 | 24×24 紧凑型(与宿主不齐);padding+radius 6 自创(kanban 旧款,已列为漂移) |
| ADR-2 | 输入零高亮(无 ring/无边框变色),caret 品牌蓝 | 团队偏好:光标即反馈,高亮框干扰阅读;caret 色与宿主一致 | focus ring(kanban/pipeline 旧款,已列为漂移) |
| ADR-3 | Composer 内嵌按钮:单行右侧 / 多行输入横向撑满、按钮落容器内最下面一行 | grill 确认:避免多行时右上角空置与遮挡 | 按钮恒在右下角悬浮(遮挡输入);按钮恒独立于输入框外(破坏内嵌形态) |
| ADR-4 | 浮层蒙层点击不关闭 | 防误触,关闭只走显式按钮 | 点蒙层关闭(kanban 抽屉旧行为,已列为漂移) |
| ADR-5 | 对话流工具卡几何:padding 10/12 + margin 4 0 4 4 + border-l1 | pipeline 工具卡实测形态,与宿主工具卡观感一致 | padding 12/16 无 margin(与流内其他卡片不齐) |
| ADR-6 | Composer 输入边框/底/22 圆角 = 宿主主窗口输入卡同款(border-l2-darkmode-thin + input-major) | 用户要求参考宿主主输入框 | 常规 l2 底 + 8 圆角(观感不统一) |

## 五、合规校验与 known-drift

### 5.1 可脚本化检查(建议进 CI lint)
1. 禁硬编码颜色(hex/rgb()/命名色,除主按钮字 `#fff`);
2. 禁 emoji/图标字符(图标一律 svg);
3. 间距白名单:padding/margin/gap 仅 4n + 例外(按钮 `6px 14px`、表格 `8px 12px`、引用条 3px、胶囊 1px);
4. 圆角白名单:`6/8/12/14/22/999px/50%`;
5. 输入类选择器禁出现 `:focus` 边框/ring 规则(零高亮)。

### 5.2 known-drift(已存在、待迁移;新代码禁止模仿)
- kanban `.kbnb-icon-btn`(padding 5px/radius 6px/无 hover 背景)→ 迁移至 §2.2;
- kanban 抽屉蒙层点击关闭 → 迁移至 ADR-4;
- kanban/pipeline 输入 focus ring → 迁移至 §2.3 零高亮;
- pipeline 工具卡输出块 padding 6px 10px → 迁移至 4n(8px 12px)。
