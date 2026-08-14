// 共享设计 Tokens（CSS 变量）：与 DSH 宿主规范统一（--dsw-*，见 dsh/design-platform.css）
// 原则：优先引用宿主运行时注入的 --dsw-* 变量（明暗主题自动跟随），--kbnb-* 仅是语义别名层；
// 宿主没有的语义才自建，且取值必须来自官方色板（--dsw-static-*）。禁止硬编码任意颜色/间距/圆角。
export const designTokensCss = `
:root{
  /* ── 品牌（官方 deepseek 色板，浅色 = deepseek-500） ── */
  --kbnb-accent: var(--dsw-alias-state-business-primary, #2563eb);
  --kbnb-accent-hover: var(--dsw-static-deepseek-600, #1d4ed8);
  --kbnb-accent-soft: rgba(65, 118, 230, .08);
  --kbnb-accent-ring: rgba(65, 118, 230, .18);

  /* ── 中性（宿主 alias 语义层） ── */
  --kbnb-bg: var(--dsw-alias-bg-base, #ffffff);
  --kbnb-bg-subtle: var(--dsw-static-neutral-bluish-50, #f7f8fa);
  --kbnb-bg-hover: var(--dsw-alias-interactive-bg-hover, #f2f3f5);
  --kbnb-bg-active: var(--dsw-alias-interactive-bg-active, #e8eaed);
  --kbnb-fg: var(--dsw-alias-label-primary, #1f2329);
  --kbnb-fg-secondary: var(--dsw-alias-label-secondary, #4e5969);
  --kbnb-fg-tertiary: var(--dsw-alias-label-tertiary, #86909c);
  --kbnb-fg-quaternary: var(--dsw-static-neutral-bluish-400, #c9cdd4);
  --kbnb-border: var(--dsw-alias-border-l2, #e5e6eb);
  --kbnb-border-strong: var(--dsw-static-neutral-bluish-300, #d0d3da);

  /* ── 语义（宿主状态色） ── */
  --kbnb-danger: var(--dsw-alias-state-error-primary, #dc2626);
  --kbnb-danger-hover: var(--dsw-static-red-900, #b91c1c);
  --kbnb-danger-soft: var(--dsw-static-red-50, #fef2f2);
  --kbnb-success: var(--dsw-alias-state-success-primary, #16a34a);

  /* ── 圆角（官方组件实测：小控件 6 / 按钮输入 8 / 卡片 12 / 浮层 14） ── */
  --kbnb-radius-sm: 6px;
  --kbnb-radius-md: 8px;
  --kbnb-radius-lg: 12px;
  --kbnb-radius-xl: 14px;
  --kbnb-radius-full: 999px;

  /* ── 阴影（宿主层级 lv1-3，lv3 官方组件在用） ── */
  --kbnb-shadow-xs: 0 1px 2px rgba(0, 0, 0, .04);
  --kbnb-shadow-sm: 0 1px 3px rgba(0, 0, 0, .06), 0 1px 2px rgba(0, 0, 0, .04);
  --kbnb-shadow-md: var(--dsw-shadow-lv2, 0 4px 12px rgba(0, 0, 0, .08));
  --kbnb-shadow-lg: var(--dsw-shadow-lv3, 0 12px 40px rgba(0, 0, 0, .14));

  /* ── 字阶（官方字号体系，--dsw-font-xs-13 = 13px 正文基准） ── */
  --kbnb-font-xs: 11px;
  --kbnb-font-sm: 12px;
  --kbnb-font-base: 13px;
  --kbnb-font-md: 15px;
  --kbnb-font-lg: 17px;
  --kbnb-font-xl: 20px;
  --kbnb-font-title: 26px;

  /* ── 间距（4n 体系） ── */
  --kbnb-space-1: 4px;
  --kbnb-space-2: 8px;
  --kbnb-space-3: 12px;
  --kbnb-space-4: 16px;
  --kbnb-space-5: 20px;
  --kbnb-space-6: 24px;
  --kbnb-space-7: 32px;

  /* ── 动效（官方交互节奏） ── */
  --kbnb-ease: 150ms cubic-bezier(.4, 0, .2, 1);
  --kbnb-ease-slow: 240ms cubic-bezier(.4, 0, .2, 1);
}
`;
