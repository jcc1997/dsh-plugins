
// 看板全部样式（含 sidebar footer 布局覆盖）
export const kbnbCss = `.kbnb-page{position:fixed;inset:0;background:var(--dsw-alias-bg-base,#fff);display:flex;flex-direction:column;z-index:60;color:var(--dsw-alias-label-primary,#1f2329);pointer-events:auto}
.kbnb-header{display:flex;align-items:center;gap:12px;padding:10px 16px;border-bottom:1px solid var(--dsw-alias-border-l2,#e5e6eb);flex:none}
.kbnb-back{width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center}
.kbnb-title{font-size:16px;font-weight:600}
.kbnb-saving{font-size:12px;color:var(--dsw-alias-label-tertiary,#86909c)}
.kbnb-header-actions{margin-left:auto;display:flex;gap:8px}
.kbnb-btn{background:var(--dsw-alias-button-floating-fill,#fff);border:1px solid var(--dsw-alias-border-l2,#e5e6eb);border-radius:8px;padding:6px 12px;font-size:13px;cursor:pointer;color:var(--dsw-alias-label-primary,#1f2329)}
.kbnb-btn:hover{background:var(--dsw-alias-interactive-bg-hover,#f2f3f5)}
.kbnb-btn:disabled{opacity:.5;cursor:default}
.kbnb-primary{background:#2563eb;border-color:#2563eb;color:#fff}
.kbnb-primary:hover{background:#1d4ed8}
.kbnb-danger{color:#dc2626;border-color:#fecaca}
.kbnb-error{background:#fef2f2;color:#b91c1c;padding:8px 16px;font-size:13px}
.kbnb-board{flex:1;display:flex;gap:0;padding:16px 0 16px 16px;overflow-x:auto;align-items:flex-start}
.kbnb-empty{margin:60px auto;color:var(--dsw-alias-label-tertiary,#86909c);font-size:14px}
.kbnb-column{flex:0 0 260px;padding:0 16px;display:flex;flex-direction:column;max-height:100%;border-left:1px solid var(--dsw-alias-border-l2,#e5e6eb)}
.kbnb-column:first-child{border-left:none}
.kbnb-column-drop{outline:2px solid #2563eb;outline-offset:-2px;border-radius:4px}
.kbnb-column-head{display:flex;align-items:center;gap:8px;padding:2px 4px 10px;cursor:grab}
.kbnb-column-title{font-weight:700;font-size:17px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kbnb-column-count{font-size:12px;color:var(--dsw-alias-label-tertiary,#86909c)}
.kbnb-cards{display:flex;flex-direction:column;gap:10px;overflow-y:auto;flex:1;min-height:40px;padding-bottom:4px}
.kbnb-card{background:var(--dsw-alias-bg-base,#fff);border:1.5px solid var(--dsw-alias-border-l2,#e5e6eb);border-radius:12px;padding:14px 16px;cursor:pointer;user-select:none}
.kbnb-card:hover{border-color:#2563eb}
.kbnb-card-active{border-color:#2563eb;box-shadow:0 0 0 1px #2563eb}
.kbnb-card-drag{opacity:.5}
.kbnb-card-title{font-size:15px;font-weight:600;line-height:1.5;word-break:break-word}
.kbnb-card-desc{font-size:13px;color:var(--dsw-alias-label-secondary,#4e5969);margin-top:6px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.kbnb-add-card{background:none;border:none;cursor:pointer;color:var(--dsw-alias-label-secondary,#4e5969);font-size:13px;padding:10px 4px;border-radius:8px;text-align:left;flex:none}
.kbnb-add-card:hover{color:#2563eb}
.kbnb-drop-line{height:3px;background:#2563eb;border-radius:2px;margin:-2px 0}
.kbnb-icon-btn{background:none;border:none;cursor:pointer;padding:4px;border-radius:6px;color:var(--dsw-alias-label-secondary,#4e5969);display:inline-flex;align-items:center;justify-content:center}
.kbnb-icon-btn:hover{background:var(--dsw-alias-interactive-bg-hover,#e5e6eb);color:var(--dsw-alias-label-primary,#1f2329)}
.kbnb-icon-btn:disabled{opacity:.3;cursor:default}
.kbnb-mask{position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:70;pointer-events:auto}
.kbnb-modal{background:var(--dsw-alias-bg-base,#fff);border-radius:14px;box-shadow:0 8px 30px rgba(0,0,0,.15);width:480px;max-width:90vw;max-height:85vh;display:flex;flex-direction:column;overflow:hidden}
.kbnb-modal-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px 10px;border-bottom:1px solid var(--dsw-alias-border-l2,#e5e6eb)}
.kbnb-modal-title{font-size:15px;font-weight:600}
.kbnb-modal-body{padding:14px 16px 16px;overflow-y:auto}
.kbnb-modal-foot{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}
.kbnb-drawer-mask{position:fixed;inset:0;background:rgba(0,0,0,.2);z-index:70;pointer-events:auto;display:flex;justify-content:flex-end}
.kbnb-drawer{background:var(--dsw-alias-bg-base,#fff);border-left:1px solid var(--dsw-alias-border-l2,#e5e6eb);width:720px;max-width:94vw;height:100%;display:flex;flex-direction:column;box-shadow:-8px 0 30px rgba(0,0,0,.08)}
.kbnb-drawer-body{flex:1;overflow-y:auto;padding:20px 24px}
.kbnb-title-row{display:flex;align-items:flex-start;gap:8px;margin-bottom:10px}
.kbnb-title-row .kbnb-icon-btn{flex:none;margin-top:4px}
.kbnb-input-title{display:block;width:100%;box-sizing:border-box;border:none;background:none;font-size:26px;font-weight:700;line-height:1.35;padding:0;outline:none;color:var(--dsw-alias-label-primary,#1f2329);font-family:inherit}
.kbnb-input-title::placeholder{color:var(--dsw-alias-label-tertiary,#86909c);font-weight:500}
.kbnb-toolbar{display:flex;align-items:center;gap:10px;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--dsw-alias-border-l2,#e5e6eb)}
.kbnb-status{display:inline-flex;align-items:center;gap:8px}
.kbnb-status-label{font-size:12px;color:var(--dsw-alias-label-secondary,#4e5969)}
.kbnb-status-select{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2,#e5e6eb);border-radius:8px;padding:5px 10px;font-size:13px;background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#1f2329);cursor:pointer;max-width:200px}
.kbnb-field{display:block;margin-bottom:14px}
.kbnb-field-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}
.kbnb-field-label{font-size:12px;color:var(--dsw-alias-label-secondary,#4e5969)}
.kbnb-switch{display:inline-flex;border:1px solid var(--dsw-alias-border-l2,#e5e6eb);border-radius:8px;overflow:hidden}
.kbnb-switch button{background:none;border:none;cursor:pointer;font-size:12px;padding:4px 12px;color:var(--dsw-alias-label-secondary,#4e5969)}
.kbnb-switch .kbnb-switch-on{background:#2563eb;color:#fff}
.kbnb-input{display:block;width:100%;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2,#e5e6eb);border-radius:8px;padding:8px 10px;font-size:13px;background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#1f2329)}
.kbnb-textarea{display:block;width:100%;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2,#e5e6eb);border-radius:8px;padding:8px 10px;font-size:13px;min-height:160px;font-family:inherit;background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#1f2329)}
.kbnb-preview{border:1px solid var(--dsw-alias-border-l2,#e5e6eb);border-radius:8px;padding:12px;font-size:13px;line-height:1.6;color:var(--dsw-alias-label-primary,#1f2329);background:var(--dsw-alias-bg-base,#fafafa)}
.kbnb-preview-scroll{max-height:280px;overflow-y:auto}
.kbnb-preview h1{font-size:18px;margin:4px 0}
.kbnb-preview h2{font-size:16px;margin:4px 0}
.kbnb-preview h3{font-size:14px;margin:4px 0}
.kbnb-preview ul{margin:4px 0;padding-left:20px}
.kbnb-preview a{color:#2563eb}
.kbnb-drawer-split{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:6px;align-items:start}
.kbnb-drawer-split .kbnb-section{margin-top:0;border-top:none;padding-top:0}
.kbnb-spacer{flex:1}
.kbnb-section{margin-top:18px;border-top:1px solid var(--dsw-alias-border-l2,#e5e6eb);padding-top:12px;min-width:0}
.kbnb-section-title{font-size:13px;font-weight:600;margin-bottom:8px;color:var(--dsw-alias-label-secondary,#4e5969)}
.kbnb-section-empty{font-size:12px;color:var(--dsw-alias-label-tertiary,#86909c);padding:4px 0 8px}
.kbnb-comment{background:var(--dsw-alias-bg-base,#f5f6f7);border-radius:10px;padding:8px 12px;margin-bottom:8px}
.kbnb-comment-text{font-size:13px;line-height:1.5;white-space:pre-wrap;word-break:break-word}
.kbnb-comment-time{font-size:11px;color:var(--dsw-alias-label-tertiary,#86909c);margin-top:4px}
.kbnb-comment-input{display:flex;gap:8px;margin-top:10px}
.kbnb-comment-input .kbnb-input{flex:1}
.kbnb-activity{display:flex;gap:6px;font-size:12px;padding:3px 0;color:var(--dsw-alias-label-secondary,#4e5969);align-items:baseline}
.kbnb-activity-time{flex:none;color:var(--dsw-alias-label-tertiary,#86909c);font-variant-numeric:tabular-nums}
.kbnb-activity-actor{flex:none;color:#2563eb;background:rgba(37,99,235,.08);border-radius:4px;padding:0 5px;font-size:11px;white-space:nowrap}
.kbnb-activity-text{min-width:0;word-break:break-word}
.kbnb-columns-panel{display:flex;flex-direction:column;gap:8px}
.kbnb-column-row{display:flex;gap:8px;align-items:center}
.kbnb-column-row-btns{display:flex;gap:2px;flex:none}
.kbnb-column-row .kbnb-input{flex:1}
.kbnb-columns-add{display:flex;gap:8px;margin-top:12px}
.kbnb-columns-add .kbnb-input{flex:1}
.kbnb-hint{font-size:12px;color:var(--dsw-alias-label-secondary,#4e5969);margin:0 0 10px;line-height:1.5}
.kbnb-settings-row{display:flex;gap:10px;align-items:center;margin-top:10px}
.kbnb-settings-msg{font-size:12px;color:var(--dsw-alias-state-success-primary,#16a34a)}
.kbnb-loading{padding:40px;text-align:center;color:var(--dsw-alias-label-tertiary,#86909c)}
.kbnb-side-btn{box-sizing:border-box;width:100%;height:49px;color:var(--dsw-alias-label-primary,#1f2329);cursor:pointer;background:none;border:none;border-radius:12px;align-items:center;gap:8px;padding:0 8px 0 6px;font-family:inherit;font-size:14px;display:inline-flex;overflow:hidden;line-height:20px}
.kbnb-side-btn:hover{background:var(--dsw-alias-interactive-bg-hover,#f2f3f5);color:var(--dsw-alias-label-primary,#1f2329)}
.kbnb-side-btn-on{color:var(--dsw-alias-state-success-primary,#16a34a)}
.Nqubda_layer{width:auto;flex:1 1 auto;min-width:0}
.hHd-Xa_footerActions{flex-direction:column;gap:4px}
.hHd-Xa_collapsed .hHd-Xa_footerActions{flex-direction:column;width:auto;align-items:center}`;
