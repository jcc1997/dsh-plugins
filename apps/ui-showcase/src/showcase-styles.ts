// src/showcase-styles.ts — 展示页自身布局样式(仅开发服务使用)
export const showcaseCss = `
.sc-page{padding:24px 32px;max-width:1240px;margin:0 auto;font-family:var(--dsw-font-family, inherit);background:var(--dsw-alias-bg-base);min-height:100vh}
.sc-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}
.sc-head h2{font-size:16px;margin:0}
.sc-head .mdr-btn{display:inline-flex;align-items:center;gap:6px}
.sc-sec{margin-bottom:28px}
.sc-title{font-size:14px;font-weight:600;margin-bottom:12px;color:var(--dsw-alias-label-secondary)}
.sc-row{display:flex;gap:12px;align-items:center}
.sc-card-col{display:flex;flex-direction:column;gap:12px;max-width:640px}
.sc-md{border:1px solid var(--dsw-alias-border-l2);border-radius:12px;max-height:480px}
.sc-viewer-wrap{position:relative;height:640px;overflow:auto;border:1px dashed var(--dsw-alias-border-l2);border-radius:12px}
.sc-viewer-wrap .mdr-mask{position:relative;inset:auto;background:none;justify-content:flex-start}
.sc-viewer-wrap .mdr-viewer{width:100%;height:100%}
`
