// client/styles.ts — dsh-markdown-review 样式(整体重写,分层与组件一一对应)
// 规则(DESIGN.md v2):直引宿主 --dsw-* tokens;圆角 6/8/12/14(Composer 对齐宿主主输入框 22);
// 间距 4n;正文 13px;输入零高亮(caret 品牌蓝);按钮类 focus-visible ring;动效 150ms/浮层 240ms;
// 所有弹性/网格子项补 min-width:0 防溢出。
export const mdrCss = `
/* ══ §2 对话流工具卡(与 pipeline 工具卡同款几何) ══ */
.mdr-card{border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-base);padding:10px 12px;margin:4px 0 4px 4px;display:flex;flex-direction:column;gap:8px;font-size:13px;color:var(--dsw-alias-label-primary);min-width:0}
.mdr-card-head{display:flex;align-items:center;gap:8px;min-width:0}
.mdr-card-icon{flex:none;color:var(--dsw-alias-state-business-primary)}
.mdr-card-title{font-weight:600;flex:none}
.mdr-card-file{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}
.mdr-card-status{flex:none;font-size:11px;border-radius:999px;padding:1px 8px;border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary)}
.mdr-card-context{font-size:12px;color:var(--dsw-alias-label-secondary)}
.mdr-card-error{font-size:12px;color:var(--dsw-alias-state-error-primary)}
.mdr-card-muted{font-size:12px;color:var(--dsw-alias-label-tertiary)}
.mdr-card-summary{display:flex;flex-direction:column;gap:8px}
.mdr-card-quote{background:var(--dsw-alias-bg-layer-2);border-left:3px solid var(--dsw-alias-state-business-primary);border-radius:8px;padding:8px 12px}
.mdr-card-quote-text{font-size:12px;color:var(--dsw-alias-label-primary);white-space:pre-wrap;word-break:break-word}
.mdr-card-quote-note{font-size:12px;color:var(--dsw-alias-label-secondary);margin-top:4px;white-space:pre-wrap;word-break:break-word}
.mdr-card-comment{font-size:12px;color:var(--dsw-alias-label-secondary);margin-top:4px;white-space:pre-wrap;word-break:break-word}

/* ══ 按钮(对齐 kanban .kbnb-btn;icon 按钮走 mdr-icon-btn) ══ */
.mdr-btn{background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:6px 14px;font-size:13px;cursor:pointer;color:var(--dsw-alias-label-primary);transition:all 150ms cubic-bezier(.4,0,.2,1);font-family:inherit}
.mdr-btn:hover{background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-border-l3)}
.mdr-btn:disabled{opacity:.5;cursor:default;pointer-events:none}
.mdr-btn:focus-visible{outline:none;box-shadow:0 0 0 2px rgba(65,118,230,.18)}
.mdr-btn-primary{background:var(--dsw-alias-state-business-primary);border-color:var(--dsw-alias-state-business-primary);color:#fff}
.mdr-btn-primary:hover{background:var(--dsw-static-deepseek-600);border-color:var(--dsw-static-deepseek-600)}
body[data-ds-dark-theme] .mdr-btn-primary:hover{background:var(--dsw-static-deepseek-500);border-color:var(--dsw-static-deepseek-500)}
/* icon 按钮(§2.2:宿主同款 28×28 圆形 + hover 背景,glyph 16) */
.mdr-icon-btn{width:28px;height:28px;border:none;background:none;cursor:pointer;padding:0;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-secondary);transition:background 150ms cubic-bezier(.4,0,.2,1)}
.mdr-icon-btn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.mdr-icon-btn:disabled{opacity:.5;cursor:default;pointer-events:none}
.mdr-icon-btn:focus-visible{outline:none;box-shadow:0 0 0 2px rgba(65,118,230,.18)}
.mdr-icon-confirm{color:var(--dsw-alias-state-business-primary)}
.mdr-icon-confirm:hover{color:var(--dsw-alias-state-business-primary)}

/* ══ §3 大浮窗 ══ */
.mdr-mask{position:fixed;inset:0;background:var(--dsw-alias-bg-mask-1);z-index:120;display:flex;align-items:center;justify-content:center;animation:mdr-fade 240ms cubic-bezier(.4,0,.2,1)}
@keyframes mdr-fade{0%{opacity:0}100%{opacity:1}}
.mdr-viewer{width:min(1152px,94vw);height:min(768px,90vh);background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:14px;display:flex;flex-direction:column;overflow:hidden;box-shadow:var(--dsw-shadow-lv3)}
.mdr-viewer-head{display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none}
.mdr-viewer-title{font-weight:600;font-size:14px;flex:none}
.mdr-viewer-path{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:var(--dsw-alias-label-tertiary);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.mdr-viewer-hint{flex:none;font-size:11px;color:var(--dsw-alias-label-tertiary)}
.mdr-hint{padding:8px 16px;font-size:12px;color:var(--dsw-alias-state-warn-primary);border-bottom:1px solid var(--dsw-alias-border-l2);flex:none}
.mdr-submit-error{color:var(--dsw-alias-state-error-primary)}

/* 主体两栏:左 = md 内容(上)+ 总评输入(下);右 = 审批内容 */
.mdr-viewer-body{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) 320px}
.mdr-main{display:flex;flex-direction:column;min-width:0;min-height:0;overflow:hidden}
.mdr-content{flex:1;min-height:0;overflow-y:auto;padding:24px 28px;user-select:text;cursor:text;min-width:0}
.mdr-main-input{flex:none;padding:12px 16px}
.mdr-main-input .cmp-composer{width:100%}
.mdr-quotes{overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:8px;min-width:0}
.mdr-quotes-title{font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary)}
.mdr-quote-item{position:relative;background:var(--dsw-alias-bg-layer-2);border-radius:8px;padding:12px 28px 12px 12px}
.mdr-quote-text{font-size:12px;color:var(--dsw-alias-label-primary);white-space:pre-wrap;word-break:break-word}
.mdr-quote-note{font-size:12px;color:var(--dsw-alias-state-business-primary);margin-top:4px;white-space:pre-wrap;word-break:break-word}
.mdr-quote-x{position:absolute;top:4px;right:4px}

/* ══ §4 划词批注框(嵌段落下方;左:选中原文 / 右:批注输入) ══ */
.mdr-editor-slot{display:block}
.mdr-editor{margin:12px 0;display:grid;grid-template-columns:minmax(0,1fr) minmax(240px,1.05fr);align-items:start;gap:12px;min-width:0;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);border-radius:8px;padding:12px}
.mdr-editor .cmp-composer{min-width:0}
.mdr-editor-quote{min-width:0;font-size:12px;color:var(--dsw-alias-label-secondary);border-left:3px solid var(--dsw-alias-state-business-primary);padding-left:8px;max-height:120px;overflow-y:auto;white-space:pre-wrap;word-break:break-word}

/* ══ markdown 渲染(官方字阶,13 基准) ══ */
.mdr-content .mdr-h{font-weight:700;color:var(--dsw-alias-label-primary);margin:20px 0 8px;line-height:1.4}
.mdr-h1{font-size:22px}.mdr-h2{font-size:19px}.mdr-h3{font-size:16px}.mdr-h4{font-size:15px}.mdr-h5{font-size:14px}.mdr-h6{font-size:13px}
.mdr-p{margin:8px 0;line-height:1.7;color:var(--dsw-alias-label-primary)}
.mdr-b{font-weight:700}.mdr-i{font-style:italic}.mdr-del{text-decoration:line-through;color:var(--dsw-alias-label-tertiary)}
.mdr-inline-code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:6px;padding:1px 6px}
.mdr-pre{margin:12px 0;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:12px 16px;overflow-x:auto}
.mdr-pre code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:var(--dsw-alias-label-primary);white-space:pre}
.mdr-pre-lang{font-size:11px;color:var(--dsw-alias-label-tertiary);margin-bottom:8px}
.mdr-quote{border-left:3px solid var(--dsw-alias-border-l3);padding:4px 12px;color:var(--dsw-alias-label-secondary);margin:8px 0;line-height:1.7}
.mdr-ul,.mdr-ol{margin:8px 0;padding-left:24px;line-height:1.7}
.mdr-li{margin:4px 0}
.mdr-hr{border:none;border-top:1px solid var(--dsw-alias-border-l2);margin:16px 0}
.mdr-img{max-width:100%;height:auto;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);display:inline-block;vertical-align:middle}
.mdr-a{color:var(--dsw-alias-state-business-primary);text-decoration:none}
.mdr-a:hover{text-decoration:underline}
.mdr-table-wrap{overflow-x:auto;margin:12px 0}
.mdr-table{border-collapse:collapse;width:100%;font-size:13px}
.mdr-th,.mdr-td{border:1px solid var(--dsw-alias-border-l2);padding:8px 12px;text-align:left}
.mdr-th{background:var(--dsw-alias-bg-layer-2);font-weight:600}

/* ══ mermaid ══ */
.mdr-mermaid{margin:12px 0;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:12px 16px;overflow-x:auto}
.mdr-mermaid-svg{display:flex;justify-content:center}
.mdr-mermaid-svg svg{max-width:100%;height:auto}
.mdr-mermaid-err .mdr-pre{margin:8px 0 0}
`
