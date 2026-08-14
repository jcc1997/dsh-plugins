# dsh-plugins UI 设计规范 v1

> 所有 dsh-plugins 插件 UI 必须遵守本规范。Tokens 在 `src/tokens.ts` 以 CSS 变量落地，
> 组件样式一律引用变量，**禁止硬编码颜色 / 间距 / 圆角 / 阴影**。

## 一、设计原则

1. **少即是多** — 一屏内不超过 1 个强调色（品牌蓝）。层次靠留白与字重表达，不靠堆边框。
2. **Notion 式轻表单** — 标题编辑无边框无背景；输入类控件聚焦时用 ring 而非变色边框。
3. **反馈即时** — hover 轻量（背景/边框变化），active 明确，拖拽有可见轨迹，保存有状态提示。
4. **一致性优先** — 所有组件共用同一套 token；同义操作（主按钮/次按钮/危险按钮）全局唯一形态。
5. **克制动效** — 仅过渡（150ms ease）与浮层出现（240ms）；不添加旋转/弹跳等装饰动画。

## 二、Tokens（src/tokens.ts）

| 类别 | 变量 | 值 | 用途 |
|---|---|---|---|
| 品牌 | `--kbnb-accent` | #2563eb | 主操作、选中、焦点 |
| 品牌 | `--kbnb-accent-hover` | #1d4ed8 | 主按钮 hover |
| 品牌 | `--kbnb-accent-soft` | rgba(37,99,235,.08) | 标签/激活底色 |
| 品牌 | `--kbnb-accent-ring` | rgba(37,99,235,.18) | focus ring、拖拽轨迹 |
| 中性 | `--kbnb-bg` / `--kbnb-bg-subtle` / `--kbnb-bg-hover` / `--kbnb-bg-active` | 白→浅灰四阶 | 页面/浮层/悬停/按下 |
| 文字 | `--kbnb-fg` / `--kbnb-fg-secondary` / `--kbnb-fg-tertiary` / `--kbnb-fg-quaternary` | 四阶 | 主文/次文/辅助/占位 |
| 边框 | `--kbnb-border` / `--kbnb-border-strong` | #e5e6eb / #d0d3da | 分隔/强分隔 |
| 语义 | `--kbnb-danger` / `--kbnb-danger-soft` / `--kbnb-success` | — | 危险/成功 |
| 圆角 | `--kbnb-radius-sm/md/lg/full` | 6/10/14/999px | 控件/卡片/浮层/胶囊 |
| 阴影 | `--kbnb-shadow-xs/sm/md/lg` | 四层 | 卡片/浮层/抽屉 |
| 字阶 | `--kbnb-font-xs…title` | 11→26px | 见下方阶梯 |
| 间距 | `--kbnb-space-1…7` | 4→32px | 4n 体系 |

### 字阶阶梯
| 用途 | 值 |
|---|---|
| 页面大标题（卡片编辑） | 26px / 700 |
| 列标题 / 弹窗标题 | 17px / 600 |
| 页面标题 | 16-17px / 600 |
| 卡片标题 | 15px / 600 |
| 正文 / 按钮 / 输入 | 13px |
| 辅助说明 | 12px |
| 时间戳 / 徽标 | 11px |

## 三、组件样式契约

| 组件 | 规范 |
|---|---|
| 主按钮（.kbnb-primary） | 蓝底白字，radius-md(10px)，padding 6px 14px；hover 深一档；disabled opacity .5 |
| 次按钮（.kbnb-btn） | 白底 + border；hover 浅灰底 |
| 危险按钮（.kbnb-danger） | 白底 + 红字红边；hover 红字加深 |
| 输入/文本域 | 白底 + border；**focus: border 不变 + box-shadow ring(accent-ring)** |
| 大标题输入（.kbnb-input-title） | 无边框无背景；26px/700；placeholder 用 tertiary |
| 卡片（.kbnb-card） | 白底、radius-lg(14px)、border、shadow-xs；hover: border 品牌色 + shadow-sm 微抬；active(选中): border 品牌色 + ring |
| 列 | 白底，列间 1px 竖线分隔；列头计数为灰底胶囊 |
| 弹窗（.kbnb-modal） | radius-lg、shadow-lg；遮罩 rgba(0,0,0,.35)；不点击遮罩关闭 |
| 抽屉（.kbnb-drawer） | 宽 720px、shadow-lg、左侧 1px 分隔线 |
| 评论气泡 | radius-md、浅灰底（bg-subtle） |
| 变更记录 | 时间戳 tabular-nums；操作者 11px 蓝色小徽章（accent-soft 底） |
| 空状态 | 居中，tertiary 文字 + 一句引导 |

## 四、交互状态

- **focus**：所有可聚焦控件 focus-visible 显示 accent-ring（2px 外圈），用 box-shadow 实现（不改边框，避免布局跳动）
- **hover**：可点元素 150ms 过渡；列表项浅灰底；卡片边框+阴影
- **拖拽**：拖动中卡片 opacity .5；落点显示 3px accent 插入线；目标列 outline accent
- **保存**：顶栏显示「保存中…」；失败红字错误条
- **切换**：编辑/预览、弹窗开关等用 240ms 过渡，不引入 JS 动画库
