// client/styles.ts — dsh-markdown-review 样式(严格按 packages/ui/DESIGN.md v2)
// 规则:直引宿主 --dsw-* tokens;圆角 小控件6/按钮输入8/卡片12/浮层14;间距 4n;正文 13px;
// 主按钮蓝底白字(hover deepseek-600,暗色 500);输入 focus 不改边框 + 2px accent ring;动效 150ms/浮层 240ms。
export const mdrCss = `
/* ══ 工具卡(对话流,与 pipeline 工具卡同款几何:padding 10/12 + margin 4 0 4 4 + gap 8) ══ */
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

/* ══ 按钮(对齐 kanban .kbnb-btn 契约) ══ */
.mdr-btn{background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:6px 14px;font-size:13px;cursor:pointer;color:var(--dsw-alias-label-primary);transition:all 150ms cubic-bezier(.4,0,.2,1);font-family:inherit}
.mdr-btn:hover{background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-border-l3)}
.mdr-btn:disabled{opacity:.5;cursor:default;pointer-events:none}
.mdr-btn:focus-visible{outline:none;box-shadow:0 0 0 2px rgba(65,118,230,.18)}
.mdr-btn-primary{background:var(--dsw-alias-state-business-primary);border-color:var(--dsw-alias-state-business-primary);color:#fff}
.mdr-btn-primary:hover{background:var(--dsw-static-deepseek-600);border-color:var(--dsw-static-deepseek-600)}
body[data-ds-dark-theme] .mdr-btn-primary:hover{background:var(--dsw-static-deepseek-500);border-color:var(--dsw-static-deepseek-500)}

/* ══ 大浮窗(浮层 radius 14 / shadow-lv3 / 遮罩宿主 token) ══ */
.mdr-mask{position:fixed;inset:0;background:var(--dsw-alias-bg-mask-1);z-index:120;display:flex;align-items:center;justify-content:center;animation:mdr-fade 240ms cubic-bezier(.4,0,.2,1)}
@keyframes mdr-fade{0%{opacity:0}100%{opacity:1}}
.mdr-viewer{width:min(1152px,94vw);height:min(768px,90vh);background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:14px;display:flex;flex-direction:column;overflow:hidden;box-shadow:var(--dsw-shadow-lv3)}
.mdr-viewer-head{display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none}
.mdr-viewer-title{font-weight:600;font-size:14px;flex:none}
.mdr-viewer-path{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:var(--dsw-alias-label-tertiary);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.mdr-viewer-hint{flex:none;font-size:11px;color:var(--dsw-alias-label-tertiary)}
.mdr-hint{padding:8px 16px;font-size:12px;color:var(--dsw-alias-state-warn-primary);border-bottom:1px solid var(--dsw-alias-border-l2);flex:none}
.mdr-submit-error{color:var(--dsw-alias-state-error-primary)}
.mdr-icon-btn{border:none;background:none;cursor:pointer;font-size:16px;line-height:1;color:var(--dsw-alias-label-secondary);padding:4px;border-radius:6px;transition:background 150ms cubic-bezier(.4,0,.2,1)}
.mdr-icon-btn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.mdr-icon-btn:disabled{opacity:.5;cursor:default;pointer-events:none}
.mdr-icon-confirm{color:var(--dsw-alias-state-business-primary)}
.mdr-viewer-body{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) 320px;position:relative}
.mdr-content{overflow-y:auto;padding:24px 28px;user-select:text;cursor:text;min-width:0}
.mdr-quotes{border-left:1px solid var(--dsw-alias-border-l2);overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:8px;min-width:0}
.mdr-quotes-title{font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary)}
.mdr-quote-item{position:relative;background:var(--dsw-alias-bg-layer-2);border-radius:8px;padding:12px 24px 12px 12px}
.mdr-quote-text{font-size:12px;color:var(--dsw-alias-label-primary);white-space:pre-wrap;word-break:break-word}
.mdr-quote-note{font-size:12px;color:var(--dsw-alias-state-business-primary);margin-top:4px;white-space:pre-wrap;word-break:break-word}
.mdr-quote-x{position:absolute;top:6px;right:6px}

/* ══ 划词批注(嵌入对应段落下方) ══ */
.mdr-editor-slot{display:block}
.mdr-editor{margin:12px 0;display:grid;grid-template-columns:minmax(0,1fr) minmax(240px,1.05fr);align-items:start;gap:12px}
.mdr-editor-quote{flex:1 1 55%;min-width:0;font-size:12px;color:var(--dsw-alias-label-secondary);border-left:3px solid var(--dsw-alias-state-business-primary);padding-left:8px;max-height:120px;overflow-y:auto;white-space:pre-wrap;word-break:break-word}

/* ══ 底部总评 ══ */
.mdr-viewer-foot{padding:12px 16px;border-top:1px solid var(--dsw-alias-border-l2);flex:none}
.mdr-foot-composer{width:100%}

/* ══ markdown 渲染(字号走官方字阶 13 基准) ══ */
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
.mdr-a{color:var(--dsw-alias-state-business-primary);text-decoration:none}
.mdr-a:hover{text-decoration:underline}
.mdr-table-wrap{overflow-x:auto;margin:12px 0}
.mdr-table{border-collapse:collapse;width:100%;font-size:13px}
.mdr-th,.mdr-td{border:1px solid var(--dsw-alias-border-l2);padding:8px 12px;text-align:left}
.mdr-th{background:var(--dsw-alias-bg-layer-2);font-weight:600}

/* ══ mermaid 图 ══ */
.mdr-mermaid{margin:12px 0;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:12px 16px;overflow-x:auto}
.mdr-mermaid-svg{display:flex;justify-content:center}
.mdr-mermaid-svg svg{max-width:100%;height:auto}
.mdr-mermaid-err .mdr-pre{margin:8px 0 0}
`
