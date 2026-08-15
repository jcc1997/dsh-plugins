// client/styles.ts — dsh-markdown-review 样式(全部走宿主 --dsw-* tokens,明暗自适应;禁硬编码色值/emoji)
export const mdrCss = `
/* ══ 工具卡 ══ */
.mdr-card{border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:10px 12px;background:var(--dsw-alias-bg-base);font-size:13px;color:var(--dsw-alias-label-primary)}
.mdr-card-head{display:flex;align-items:center;gap:8px;min-width:0}
.mdr-card-icon{flex:none;color:var(--dsw-alias-state-business-primary)}
.mdr-card-title{font-weight:600;flex:none}
.mdr-card-file{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}
.mdr-card-status{flex:none;font-size:11px;border-radius:999px;padding:1px 8px;border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary)}
.mdr-card-context{margin-top:6px;font-size:12px;color:var(--dsw-alias-label-secondary)}
.mdr-card-error{margin-top:6px;font-size:12px;color:var(--dsw-alias-state-error-primary)}
.mdr-card-muted{font-size:12px;color:var(--dsw-alias-label-tertiary)}
.mdr-btn{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border-radius:8px;padding:5px 12px;font-size:13px;cursor:pointer;font-family:inherit}
.mdr-btn:hover{background:var(--dsw-alias-interactive-bg-hover)}
.mdr-btn:disabled{opacity:.5;cursor:not-allowed}
.mdr-btn-primary{border-color:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-state-business-primary)}
.mdr-card-summary{margin-top:8px;display:flex;flex-direction:column;gap:6px}
.mdr-card-quote{background:var(--dsw-alias-bg-layer-2);border-left:3px solid var(--dsw-alias-state-business-primary);border-radius:6px;padding:6px 10px}
.mdr-card-quote-text{font-size:12px;color:var(--dsw-alias-label-primary);white-space:pre-wrap;word-break:break-word}
.mdr-card-quote-note{font-size:12px;color:var(--dsw-alias-label-secondary);margin-top:4px;white-space:pre-wrap;word-break:break-word}
.mdr-card-comment{font-size:12px;color:var(--dsw-alias-label-secondary);margin-top:2px;white-space:pre-wrap;word-break:break-word}

/* ══ 大浮窗 ══ */
.mdr-mask{position:fixed;inset:0;background:var(--dsw-alias-bg-mask-1);z-index:120;display:flex;align-items:center;justify-content:center}
.mdr-viewer{width:92vw;height:92vh;background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:14px;display:flex;flex-direction:column;overflow:hidden;box-shadow:var(--dsw-shadow-lv3)}
.mdr-viewer-head{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none}
.mdr-viewer-title{font-weight:600;font-size:14px;flex:none}
.mdr-viewer-path{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:var(--dsw-alias-label-tertiary);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.mdr-viewer-hint{flex:none;font-size:11px;color:var(--dsw-alias-label-tertiary)}
.mdr-icon-btn{border:none;background:none;cursor:pointer;font-size:16px;line-height:1;color:var(--dsw-alias-label-secondary);padding:4px;border-radius:6px}
.mdr-icon-btn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.mdr-viewer-body{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) 300px;position:relative}
.mdr-content{overflow-y:auto;padding:24px 28px;user-select:text;cursor:text;min-width:0}
.mdr-quotes{border-left:1px solid var(--dsw-alias-border-l2);overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:8px;min-width:0}
.mdr-quotes-title{font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary)}
.mdr-quote-item{position:relative;background:var(--dsw-alias-bg-layer-2);border-radius:8px;padding:8px 26px 8px 10px}
.mdr-quote-text{font-size:12px;color:var(--dsw-alias-label-primary);white-space:pre-wrap;word-break:break-word}
.mdr-quote-note{font-size:12px;color:var(--dsw-alias-state-business-primary);margin-top:4px;white-space:pre-wrap;word-break:break-word}
.mdr-quote-x{position:absolute;top:4px;right:4px}

/* ══ 划词弹出批注 ══ */
.mdr-pop{position:fixed;z-index:130;width:260px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:10px;box-shadow:var(--dsw-shadow-lv3);display:flex;flex-direction:column;gap:8px}
.mdr-pop-text{font-size:12px;color:var(--dsw-alias-label-secondary);border-left:3px solid var(--dsw-alias-state-business-primary);padding-left:8px;max-height:72px;overflow-y:auto;white-space:pre-wrap;word-break:break-word}
.mdr-pop-input{box-sizing:border-box;width:100%;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:12px;padding:6px 8px;resize:none;font-family:inherit}
.mdr-pop-btns{display:flex;justify-content:flex-end;gap:8px}

/* ══ 底部总评 ══ */
.mdr-viewer-foot{display:flex;align-items:flex-end;gap:10px;padding:12px 16px;border-top:1px solid var(--dsw-alias-border-l2);flex:none}
.mdr-comment-input{flex:1;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:13px;padding:8px 10px;resize:none;font-family:inherit;min-height:40px}

/* ══ markdown 渲染 ══ */
.mdr-content .mdr-h{font-weight:700;color:var(--dsw-alias-label-primary);margin:18px 0 8px;line-height:1.4}
.mdr-h1{font-size:22px}.mdr-h2{font-size:19px}.mdr-h3{font-size:16px}.mdr-h4{font-size:15px}.mdr-h5{font-size:14px}.mdr-h6{font-size:13px}
.mdr-p{margin:6px 0;line-height:1.7;color:var(--dsw-alias-label-primary)}
.mdr-b{font-weight:700}.mdr-i{font-style:italic}.mdr-del{text-decoration:line-through;color:var(--dsw-alias-label-tertiary)}
.mdr-inline-code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:6px;padding:1px 6px}
.mdr-pre{margin:10px 0;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:12px 14px;overflow-x:auto}
.mdr-pre code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:var(--dsw-alias-label-primary);white-space:pre}
.mdr-pre-lang{font-size:10px;color:var(--dsw-alias-label-tertiary);margin-bottom:6px}
.mdr-quote{border-left:3px solid var(--dsw-alias-border-l3);padding:4px 12px;color:var(--dsw-alias-label-secondary);margin:8px 0;line-height:1.7}
.mdr-ul,.mdr-ol{margin:8px 0;padding-left:22px;line-height:1.7}
.mdr-li{margin:2px 0}
.mdr-hr{border:none;border-top:1px solid var(--dsw-alias-border-l2);margin:14px 0}
.mdr-a{color:var(--dsw-alias-state-business-primary);text-decoration:none}
.mdr-a:hover{text-decoration:underline}
.mdr-table-wrap{overflow-x:auto;margin:10px 0}
.mdr-table{border-collapse:collapse;width:100%;font-size:13px}
.mdr-th,.mdr-td{border:1px solid var(--dsw-alias-border-l2);padding:6px 10px;text-align:left}
.mdr-th{background:var(--dsw-alias-bg-layer-2);font-weight:600}
`
