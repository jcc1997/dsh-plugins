# dsh-plugins UI 设计规范 v2

> 所有 dsh-plugins 插件 UI 必须遵守本规范。
> **第一原则：与 DSH 宿主规范统一** —— 插件运行在 DeepSeek Harness 里，视觉语言、色彩、字号、圆角、交互节奏必须跟随宿主，而不是自创一套。

## 〇、与 DSH 宿主规范的统一（最高优先）

DSH 宿主在运行时注入完整的官方设计 tokens（`--dsw-static-*` 色板 + `--dsw-alias-*` 语义层 + `--dsw-shadow-lv*`），并随 `body[data-ds-dark-theme]` **自动切换明暗主题**。权威定义已抽取到 `packages/ui/dsh/design-platform.css`（来源：`@deepseek-ai/dsh-client-ui-theme`，MIT）。

**规则**：
1. **优先引用宿主变量**：插件样式直接用 `--dsw-alias-*` / `--dsw-static-*`，明暗主题自动适配，无需自管主题
2. **不设自研别名层**：样式直接写 `var(--dsw-*)`，不定义中间变量（历史上有 `--kbnb-*` 别名层，已删除——宿主变量名语义已足够清晰，多一层只会增加间接）
3. **宿主没有的语义才自建**：自建值必须取色于官方色板（`--dsw-static-*`），禁止任意色值；自建项（如 accent 的 soft/ring 半透明）以官方色板换算
4. **组件形态对齐官方**：圆角按官方实测（小控件 6 / 按钮输入 8 / 卡片 12 / 浮层 14）；阴影用 `--dsw-shadow-lv2/lv3`；正文基准字号 13px（`--dsw-font-xs-13`）
5. **可对照官方组件源码**：`vendor/deepseek-harness/packages/client/ui-primitives/src/*.module.css`（Button/Input/Modal 等）是官方实现，样式拿不准时照抄其取值

## 一、设计原则

1. **少即是多** — 一屏内不超过 1 个强调色（品牌色 = 官方 deepseek 蓝）。层次靠留白与字重表达，不靠堆边框。
2. **Notion 式轻表单** — 标题编辑无边框无背景；输入类控件聚焦时用 ring 而非变色边框。
3. **反馈即时** — hover 轻量（背景/边框变化），active 明确，拖拽有可见轨迹，保存有状态提示。
4. **一致性优先** — 所有组件共用同一套 token；同义操作（主按钮/次按钮/危险按钮）全局唯一形态。
5. **克制动效** — 仅过渡（150ms ease）与浮层出现（240ms）；不添加旋转/弹跳等装饰动画。

## 二、Tokens（直接引用宿主 `--dsw-*`）

| 类别 | 变量 | 用途 |
|---|---|---|---|
| 品牌 | `--dsw-alias-state-business-primary` | 主操作、选中、焦点（浅色 = deepseek-500，深色自动切换） |
| 品牌 | `--dsw-static-deepseek-600` | 主按钮 hover |
| 品牌 | 官方色板换算 rgba(65,118,230,.08/.18) | 标签底色 / focus ring、拖拽轨迹 |
| 中性 | `--dsw-alias-bg-base` | 页面 / 浮层 |
| 中性 | `--dsw-static-neutral-bluish-50` | 浅灰底（评论气泡等） |
| 中性 | `--dsw-alias-interactive-bg-hover/active` | 悬停 / 按下 |
| 文字 | `--dsw-alias-label-primary / secondary / tertiary` | 主文 / 次文 / 辅助 |
| 边框 | `--dsw-alias-border-l2` / `--dsw-static-neutral-bluish-300` | 分隔 / 强分隔 |
| 语义 | `--dsw-alias-state-error/success-primary` | 危险 / 成功 |
| 圆角 | 官方实测 6 / 8 / 12 / 14px | 控件 / 按钮输入 / 卡片 / 浮层 |
| 阴影 | 自定 xs/sm / `--dsw-shadow-lv2` / `lv3` | 卡片 / 浮层 / 抽屉 |
| 字阶 | 官方体系（正文基准 13px） | 11→26px |
| 间距 | 4n 体系 | 4→32px |

完整色板与明暗值：`packages/ui/dsh/design-platform.css`（浅色 `:root` + 深色 `body[data-ds-dark-theme]` 两段）。

### 间距契约（组件级，统一遵守，禁止随手写任意值）
| 场景 | 值 |
|---|---|
| 看板区四边 | 16px（对称，不留白边） |
| 顶栏 | 纵向 14px / 横向 20px |
| 列宽 | 272px；列内卡片距列边缘 16px |
| 列头 | 与卡片内容左对齐；下方 12px |
| 卡片之间 | 12px |
| 卡片内边距 | 上下 14px / 左右 16px |
| 抽屉内边距 | 上下 20px / 左右 24px |
| 弹窗内边距 | 16px；表单元素之间 ≥16px |
| 区块（评论/日志） | 上间距 20px + 顶边线 + 内部上距 12px |
| 双栏（评论｜变更记录） | 列间距 24px |
| 表单控件之间 | 16px；标签与控件之间 8px |
| 列表项（活动行） | 行内 5px，虚线分隔 |

## 三、组件样式契约
| 组件 | 规范 |
|---|---|
| 主按钮（.kbnb-primary） | 品牌蓝底白字，radius-md(8px)，padding 6px 14px；hover 深一档；disabled opacity .5 |
| 次按钮（.kbnb-btn） | 白底 + border-l2；hover 浅灰底（interactive-bg-hover） |
| 危险按钮（.kbnb-danger） | 白底 + 红字红边；hover 红字加深 + danger-soft 底 |
| 输入/文本域 | 白底 + border-l2；**focus: 边框不变 + ring(accent-ring 2px)** |
| 大标题输入（.kbnb-input-title） | 无边框无背景；26px/700；placeholder 用 tertiary |
| 卡片（.kbnb-card） | 白底、radius-lg(12px)、border-l2、shadow-xs；hover: border 品牌色 + shadow-sm 微抬；active(选中): border 品牌色 + ring |
| 列 | 白底，列间 1px 竖线分隔；列头计数为灰底胶囊 |
| 弹窗（.kbnb-modal） | radius-xl(14px)、shadow-lg；遮罩 rgba(0,0,0,.35)；不点击遮罩关闭 |
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