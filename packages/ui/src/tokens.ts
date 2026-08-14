// 共享设计 Tokens（CSS 变量）：所有 dsh-plugins 插件统一使用，禁止组件内硬编码颜色/间距/圆角
// 命名前缀 --kbnb-*（kanban 起源名，作为通用前缀保留），避免污染宿主全局样式
export const designTokensCss = `
:root{
  /* ── 色彩：品牌 ── */
  --kbnb-accent:#2563eb;
  --kbnb-accent-hover:#1d4ed8;
  --kbnb-accent-soft:rgba(37,99,235,.08);
  --kbnb-accent-ring:rgba(37,99,235,.18);

  /* ── 色彩：中性（浅色主题） ── */
  --kbnb-bg:#ffffff;
  --kbnb-bg-subtle:#f7f8fa;
  --kbnb-bg-hover:#f2f3f5;
  --kbnb-bg-active:#e8eaed;
  --kbnb-fg:#1f2329;
  --kbnb-fg-secondary:#4e5969;
  --kbnb-fg-tertiary:#86909c;
  --kbnb-fg-quaternary:#c9cdd4;
  --kbnb-border:#e5e6eb;
  --kbnb-border-strong:#d0d3da;

  /* ── 色彩：语义 ── */
  --kbnb-danger:#dc2626;
  --kbnb-danger-hover:#b91c1c;
  --kbnb-danger-soft:#fef2f2;
  --kbnb-success:#16a34a;

  /* ── 圆角 ── */
  --kbnb-radius-sm:6px;
  --kbnb-radius-md:10px;
  --kbnb-radius-lg:14px;
  --kbnb-radius-full:999px;

  /* ── 阴影（层次从低到高） ── */
  --kbnb-shadow-xs:0 1px 2px rgba(0,0,0,.04);
  --kbnb-shadow-sm:0 1px 3px rgba(0,0,0,.06),0 1px 2px rgba(0,0,0,.04);
  --kbnb-shadow-md:0 4px 12px rgba(0,0,0,.08);
  --kbnb-shadow-lg:0 12px 40px rgba(0,0,0,.14);

  /* ── 字阶 ── */
  --kbnb-font-xs:11px;
  --kbnb-font-sm:12px;
  --kbnb-font-base:13px;
  --kbnb-font-md:15px;
  --kbnb-font-lg:17px;
  --kbnb-font-xl:20px;
  --kbnb-font-title:26px;

  /* ── 间距（4n 体系） ── */
  --kbnb-space-1:4px;
  --kbnb-space-2:8px;
  --kbnb-space-3:12px;
  --kbnb-space-4:16px;
  --kbnb-space-5:20px;
  --kbnb-space-6:24px;
  --kbnb-space-7:32px;

  /* ── 动效 ── */
  --kbnb-ease:150ms cubic-bezier(.4,0,.2,1);
  --kbnb-ease-slow:240ms cubic-bezier(.4,0,.2,1);
}
`;
