
// 看板全部样式：直接引用 DSH 宿主官方 tokens（--dsw-*，明暗主题自动适配），见 packages/ui/DESIGN.md
export const kbnbCss = `
/* ══ 页面骨架 ══ */
.kbnb-page{position:fixed;inset:0;background:var(--dsw-alias-bg-base);display:flex;flex-direction:column;z-index:60;color:var(--dsw-alias-label-primary);pointer-events:auto}

/* ══ 顶栏 ══ */
.kbnb-header{display:flex;align-items:center;gap:12px;padding:14px 20px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none;background:var(--dsw-alias-bg-base)}
.kbnb-back{width:30px;height:30px;display:inline-flex;align-items:center;justify-content:center;border-radius:6px}
.kbnb-title{font-size:17px;font-weight:600;letter-spacing:.2px}
.kbnb-stats{font-size:12px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;padding:2px 10px;background:var(--dsw-static-neutral-bluish-50);border-radius:999px}
.kbnb-saving{font-size:12px;color:var(--dsw-alias-label-tertiary);transition:opacity 150ms cubic-bezier(.4, 0, .2, 1)}
.kbnb-header-actions{margin-left:auto;display:flex;gap:8px}

/* ══ 按钮 ══ */
.kbnb-btn{background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:6px 14px;font-size:13px;cursor:pointer;color:var(--dsw-alias-label-primary);transition:all 150ms cubic-bezier(.4, 0, .2, 1);font-family:inherit}
.kbnb-btn:hover{background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-static-neutral-bluish-300)}
.kbnb-btn:disabled{opacity:.5;cursor:default;pointer-events:none}
.kbnb-btn:focus-visible{outline:none;box-shadow:0 0 0 2px rgba(65, 118, 230, .18)}
.kbnb-primary{background:var(--dsw-alias-state-business-primary);border-color:var(--dsw-alias-state-business-primary);color:#fff}
.kbnb-primary:hover{background:var(--dsw-static-deepseek-600);border-color:var(--dsw-static-deepseek-600)}
.kbnb-danger{color:var(--dsw-alias-state-error-primary);border-color:rgba(220,38,38,.35)}
.kbnb-danger:hover{background:var(--dsw-static-red-50);border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-static-red-900)}
.kbnb-icon-btn{background:none;border:none;cursor:pointer;padding:5px;border-radius:6px;color:var(--dsw-alias-label-secondary);display:inline-flex;align-items:center;justify-content:center;transition:all 150ms cubic-bezier(.4, 0, .2, 1)}
.kbnb-icon-btn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.kbnb-icon-btn:disabled{opacity:.3;cursor:default}

/* ══ 错误条 ══ */
.kbnb-error{background:var(--dsw-static-red-50);color:var(--dsw-alias-state-error-primary);padding:8px 16px;font-size:13px;border-bottom:1px solid rgba(220,38,38,.2)}

/* ══ 看板区 ══ */
.kbnb-board{flex:1;display:flex;gap:0;padding:16px;overflow-x:auto;align-items:flex-start}
.kbnb-empty{margin:80px auto;color:var(--dsw-alias-label-tertiary);font-size:13px;text-align:center;line-height:1.8}
.kbnb-empty::before{content:"";display:block;width:44px;height:3px;border-radius:2px;background:var(--dsw-alias-interactive-bg-active);margin:0 auto 16px}

/* ══ 列 ══ */
.kbnb-column{flex:0 0 272px;padding:0 16px;display:flex;flex-direction:column;max-height:100%;border-left:1px solid var(--dsw-alias-border-l2)}
.kbnb-column:first-child{border-left:none}
.kbnb-column-drop{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:-2px;border-radius:8px}
.kbnb-column-head{display:flex;align-items:center;gap:8px;padding:0 0 12px;cursor:grab}
.kbnb-column-title{font-weight:700;font-size:17px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;letter-spacing:.2px}
.kbnb-column-count{font-size:11px;color:var(--dsw-alias-label-secondary);background:var(--dsw-static-neutral-bluish-50);border-radius:999px;padding:2px 9px;font-variant-numeric:tabular-nums;border:1px solid var(--dsw-alias-border-l2)}

/* ══ 卡片 ══ */
.kbnb-cards{display:flex;flex-direction:column;gap:12px;overflow-y:auto;flex:1;min-height:40px;padding:8px 0 6px}
.kbnb-card{background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;padding:14px 16px;cursor:pointer;user-select:none;box-shadow:0 1px 2px rgba(0, 0, 0, .04);transition:border-color 150ms cubic-bezier(.4, 0, .2, 1),box-shadow 150ms cubic-bezier(.4, 0, .2, 1)}
.kbnb-card:hover{border-color:var(--dsw-alias-state-business-primary);box-shadow:0 1px 3px rgba(0, 0, 0, .06), 0 1px 2px rgba(0, 0, 0, .04)}
.kbnb-card-active{border-color:var(--dsw-alias-state-business-primary);box-shadow:0 0 0 1px var(--dsw-alias-state-business-primary),0 1px 3px rgba(0, 0, 0, .06), 0 1px 2px rgba(0, 0, 0, .04)}
.kbnb-card-drag{opacity:.5;transform:none}
.kbnb-card-title{font-size:15px;font-weight:600;line-height:1.5;word-break:break-word}
.kbnb-card-desc{font-size:13px;color:var(--dsw-alias-label-secondary);margin-top:6px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.kbnb-card-tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:8px}
.kbnb-tag{display:inline-flex;align-items:center;gap:4px;font-size:11px;color:var(--dsw-alias-state-business-primary);background:rgba(65, 118, 230, .08);border-radius:999px;padding:2px 8px;line-height:1.6;white-space:nowrap}
.kbnb-tag-removable{cursor:pointer;transition:all 150ms cubic-bezier(.4, 0, .2, 1)}
.kbnb-tag-removable:hover{background:var(--dsw-static-red-50);color:var(--dsw-alias-state-error-primary)}
.kbnb-tag-x{font-size:12px;line-height:1;opacity:.7}
.kbnb-tag-row{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--dsw-alias-border-l2)}
.kbnb-tag-row .kbnb-field-label{flex:none}
.kbnb-tag-input{width:120px;padding:4px 10px;font-size:12px;border-radius:999px;flex:none}
.kbnb-add-card{background:none;border:none;cursor:pointer;color:var(--dsw-alias-label-tertiary);font-size:13px;padding:10px 0;border-radius:8px;text-align:left;flex:none;transition:all 150ms cubic-bezier(.4, 0, .2, 1);font-family:inherit}
.kbnb-add-card:hover{color:var(--dsw-alias-state-business-primary);background:rgba(65, 118, 230, .08)}
.kbnb-drop-line{height:3px;background:var(--dsw-alias-state-business-primary);border-radius:2px;margin:-2px 0;box-shadow:0 0 6px rgba(65, 118, 230, .18)}

/* ══ 遮罩 / 弹窗 ══ */
.kbnb-mask{position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:70;pointer-events:auto}
.kbnb-modal{background:var(--dsw-alias-bg-base);border-radius:14px;box-shadow:var(--dsw-shadow-lv3);width:480px;max-width:90vw;max-height:85vh;display:flex;flex-direction:column;overflow:hidden}
.kbnb-modal-head{display:flex;align-items:center;justify-content:space-between;padding:16px 16px 12px;border-bottom:1px solid var(--dsw-alias-border-l2)}
.kbnb-modal-title{font-size:15px;font-weight:600}
.kbnb-modal-body{padding:16px;overflow-y:auto}
.kbnb-modal-body .kbnb-input-title{margin-bottom:16px}
.kbnb-modal-foot{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}

/* ══ 抽屉 ══ */
.kbnb-drawer-mask{position:fixed;inset:0;background:rgba(0,0,0,.25);z-index:70;pointer-events:auto;display:flex;justify-content:flex-end}
.kbnb-drawer{background:var(--dsw-alias-bg-base);border-left:1px solid var(--dsw-alias-border-l2);width:720px;max-width:94vw;height:100%;display:flex;flex-direction:column;box-shadow:var(--dsw-shadow-lv3)}
.kbnb-drawer-body{flex:1;overflow-y:auto;padding:20px 24px}

/* 大标题（Notion 式） */
.kbnb-title-row{display:flex;align-items:flex-start;gap:8px;margin-bottom:16px}
.kbnb-title-row .kbnb-icon-btn{flex:none;margin-top:4px}
.kbnb-input-title{display:block;width:100%;box-sizing:border-box;border:none;background:none;font-size:26px;font-weight:700;line-height:1.35;padding:0;outline:none;color:var(--dsw-alias-label-primary);font-family:inherit}
.kbnb-input-title::placeholder{color:var(--dsw-static-neutral-bluish-400);font-weight:500}

/* 工具/状态栏 */
.kbnb-toolbar{display:flex;align-items:center;gap:12px;margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid var(--dsw-alias-border-l2)}
.kbnb-status{display:inline-flex;align-items:center;gap:8px}
.kbnb-status-label{font-size:12px;color:var(--dsw-alias-label-secondary)}
.kbnb-status-select{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:5px 10px;font-size:13px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);cursor:pointer;max-width:200px;font-family:inherit;transition:all 150ms cubic-bezier(.4, 0, .2, 1)}
.kbnb-status-select:hover{border-color:var(--dsw-static-neutral-bluish-300)}
.kbnb-status-select:focus-visible{outline:none;box-shadow:0 0 0 2px rgba(65, 118, 230, .18)}

/* ══ 表单 ══ */
.kbnb-field{display:block;margin-bottom:16px}
.kbnb-field-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.kbnb-field-label{font-size:12px;color:var(--dsw-alias-label-secondary)}
.kbnb-switch{display:inline-flex;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;overflow:hidden;background:var(--dsw-static-neutral-bluish-50)}
.kbnb-switch button{background:none;border:none;cursor:pointer;font-size:12px;padding:4px 12px;color:var(--dsw-alias-label-secondary);transition:all 150ms cubic-bezier(.4, 0, .2, 1);font-family:inherit}
.kbnb-switch .kbnb-switch-on{background:var(--dsw-alias-bg-base);color:var(--dsw-alias-state-business-primary);font-weight:600;box-shadow:0 1px 2px rgba(0, 0, 0, .04)}
.kbnb-input{display:block;width:100%;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:8px 10px;font-size:13px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);transition:all 150ms cubic-bezier(.4, 0, .2, 1);font-family:inherit}
.kbnb-input:hover{border-color:var(--dsw-static-neutral-bluish-300)}
.kbnb-input:focus-visible{outline:none;border-color:var(--dsw-alias-state-business-primary);box-shadow:0 0 0 2px rgba(65, 118, 230, .18)}
.kbnb-input::placeholder{color:var(--dsw-static-neutral-bluish-400)}
.kbnb-textarea{display:block;width:100%;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:8px 10px;font-size:13px;min-height:160px;font-family:inherit;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);transition:all 150ms cubic-bezier(.4, 0, .2, 1);resize:vertical}
.kbnb-textarea:hover{border-color:var(--dsw-static-neutral-bluish-300)}
.kbnb-textarea:focus-visible{outline:none;border-color:var(--dsw-alias-state-business-primary);box-shadow:0 0 0 2px rgba(65, 118, 230, .18)}
.kbnb-textarea::placeholder{color:var(--dsw-static-neutral-bluish-400)}

/* ══ Markdown 预览 ══ */
.kbnb-preview{border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:12px;font-size:13px;line-height:1.7;color:var(--dsw-alias-label-primary);background:var(--dsw-static-neutral-bluish-50)}
.kbnb-preview-scroll{max-height:280px;overflow-y:auto}
.kbnb-preview h1{font-size:20px;margin:6px 0}
.kbnb-preview h2{font-size:17px;margin:6px 0}
.kbnb-preview h3{font-size:15px;margin:6px 0}
.kbnb-preview ul{margin:6px 0;padding-left:20px}
.kbnb-preview a{color:var(--dsw-alias-state-business-primary)}

/* ══ 双栏（评论 | 变更记录） ══ */
.kbnb-drawer-split{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:8px;align-items:start}
.kbnb-drawer-split .kbnb-section{margin-top:0;border-top:none;padding-top:0}
.kbnb-spacer{flex:1}
.kbnb-section{margin-top:20px;border-top:1px solid var(--dsw-alias-border-l2);padding-top:12px;min-width:0}
.kbnb-section-title{font-size:13px;font-weight:600;margin-bottom:8px;color:var(--dsw-alias-label-secondary);display:flex;align-items:center;gap:8px}
.kbnb-section-count{font-size:11px;color:var(--dsw-alias-label-secondary);background:var(--dsw-static-neutral-bluish-50);border-radius:999px;padding:1px 8px;border:1px solid var(--dsw-alias-border-l2)}
.kbnb-section-empty{font-size:12px;color:var(--dsw-alias-label-tertiary);padding:6px 0 10px}
.kbnb-comment{background:var(--dsw-static-neutral-bluish-50);border-radius:8px;padding:9px 12px;margin-bottom:8px;border:1px solid var(--dsw-alias-border-l2)}
.kbnb-comment-text{font-size:13px;line-height:1.55;white-space:pre-wrap;word-break:break-word}
.kbnb-comment-time{font-size:11px;color:var(--dsw-alias-label-tertiary);margin-top:4px}
.kbnb-comment-input{display:flex;gap:8px;margin-top:12px}
.kbnb-comment-input .kbnb-input{flex:1}
.kbnb-activity{display:flex;gap:4px;font-size:12px;padding:5px 0;color:var(--dsw-alias-label-secondary);align-items:baseline;border-bottom:1px dashed var(--dsw-alias-border-l2)}
.kbnb-activity:last-child{border-bottom:none}
.kbnb-activity-time{flex:none;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}
.kbnb-activity-actor{flex:none;color:var(--dsw-alias-state-business-primary);background:rgba(65, 118, 230, .08);border-radius:6px;padding:0 5px;font-size:11px;white-space:nowrap}
.kbnb-activity-text{min-width:0;word-break:break-word}

/* ══ 列配置 ══ */
.kbnb-columns-panel{display:flex;flex-direction:column;gap:8px}
.kbnb-column-row{display:flex;gap:8px;align-items:center;padding:4px;border-radius:8px;transition:background 150ms cubic-bezier(.4, 0, .2, 1)}
.kbnb-column-row:hover{background:var(--dsw-static-neutral-bluish-50)}
.kbnb-column-row-btns{display:flex;gap:2px;flex:none}
.kbnb-column-row .kbnb-input{flex:1}
.kbnb-columns-add{display:flex;gap:8px;margin-top:12px}
.kbnb-columns-add .kbnb-input{flex:1}

/* ══ 设置页 ══ */
.kbnb-hint{font-size:12px;color:var(--dsw-alias-label-secondary);margin:0 0 10px;line-height:1.6}
.kbnb-settings-row{display:flex;gap:10px;align-items:center;margin-top:10px}
.kbnb-settings-msg{font-size:12px;color:var(--dsw-alias-state-success-primary)}


/* ══ 外部关联（refs） ══ */
.kbnb-refs-row{gap:6px;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--dsw-alias-border-l2)}
.kbnb-refs-row .kbnb-field-label{flex:none}
.kbnb-refs-empty{font-size:12px;color:var(--dsw-alias-label-tertiary)}
.kbnb-ref{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--dsw-alias-label-primary);background:var(--dsw-static-neutral-bluish-50);border:1px solid var(--dsw-alias-border-l2);border-radius:999px;padding:2px 8px;line-height:1.6;white-space:nowrap;max-width:100%}
.kbnb-ref-kind{flex:none;color:var(--dsw-alias-state-business-primary);font-size:11px}
.kbnb-ref-link{color:var(--dsw-alias-state-business-primary);text-decoration:none;min-width:0;overflow:hidden;text-overflow:ellipsis}
.kbnb-ref-link:hover{text-decoration:underline}
.kbnb-ref-text{min-width:0;overflow:hidden;text-overflow:ellipsis}
.kbnb-ref-x{font-size:12px;line-height:1;opacity:.7;cursor:pointer;flex:none}
.kbnb-ref-x:hover{color:var(--dsw-alias-state-error-primary)}
.kbnb-ref-add{display:flex;flex-wrap:wrap;gap:6px;width:100%;margin-top:2px}
.kbnb-ref-kind-select{width:150px;flex:none;padding:4px 8px;font-size:12px}
.kbnb-ref-ext{flex:1 1 180px;min-width:120px;padding:4px 8px;font-size:12px}
.kbnb-ref-display{flex:1 1 140px;min-width:100px;padding:4px 8px;font-size:12px}
.kbnb-ref-url{flex:1 1 200px;min-width:140px;padding:4px 8px;font-size:12px}
.kbnb-ref-add .kbnb-btn{padding:4px 12px;font-size:12px;flex:none}
/* ══ Git 关联卡片（G6/G7）+ 外部关联卡片 ══ */
.kbnb-card-actions{display:inline-flex;align-items:center;gap:8px}
.kbnb-git-card,.kbnb-refs-card{margin-bottom:16px;padding:14px 16px;border-radius:12px;cursor:default}
.kbnb-card-sec-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}
.kbnb-card-sec-title{font-size:13px;font-weight:600;color:var(--dsw-alias-label-secondary)}
.kbnb-git-repo{display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:8px}
.kbnb-git-repo-label{flex:none;font-size:12px;color:var(--dsw-alias-label-tertiary)}
.kbnb-git-repo-name{font-weight:600;color:var(--dsw-alias-state-business-primary);text-decoration:none;min-width:0;overflow:hidden;text-overflow:ellipsis}
.kbnb-git-repo-name:hover{text-decoration:underline}
.kbnb-git-repo-missing{font-size:12px;color:var(--dsw-alias-label-tertiary)}
.kbnb-git-mrs{display:flex;flex-direction:column;gap:6px;margin-bottom:8px}
.kbnb-git-mrs-label{font-size:12px;color:var(--dsw-alias-label-tertiary)}
.kbnb-git-mr{display:flex;align-items:center;gap:8px;background:var(--dsw-static-neutral-bluish-50);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:6px 10px;min-width:0}
.kbnb-git-mr-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:var(--dsw-alias-label-primary);text-decoration:none}
.kbnb-git-mr-title:hover{color:var(--dsw-alias-state-business-primary);text-decoration:underline}
.kbnb-git-mr-updated{flex:none;font-size:11px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}
.kbnb-git-status{display:flex;align-items:center;flex-wrap:wrap;gap:8px;border-top:1px dashed var(--dsw-alias-border-l2);padding-top:8px;margin-top:4px}
.kbnb-git-status-muted{font-size:11px;color:var(--dsw-alias-label-tertiary)}
.kbnb-git-status-branch{font-size:11px;color:var(--dsw-alias-label-secondary);background:var(--dsw-static-neutral-bluish-50);border-radius:999px;padding:1px 8px}
.kbnb-git-empty{font-size:12px;color:var(--dsw-alias-label-tertiary);line-height:1.6}
.kbnb-mr-badge{display:inline-flex;align-items:center;gap:6px;font-size:12px;border-radius:999px;padding:2px 10px;line-height:1.6;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);flex:none}
.kbnb-mr-number{font-weight:600;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums}
.kbnb-mr-state{font-size:11px;text-transform:capitalize}
.kbnb-mr-open .kbnb-mr-state{color:var(--dsw-alias-state-success-primary)}
.kbnb-mr-merged .kbnb-mr-state{color:var(--dsw-alias-state-business-primary)}
.kbnb-mr-closed .kbnb-mr-state{color:var(--dsw-alias-state-error-primary)}
.kbnb-mr-synced{font-size:11px;color:var(--dsw-alias-label-tertiary)}
.kbnb-mr-error{font-size:11px;color:var(--dsw-alias-state-error-primary);width:100%}
.kbnb-refs-card .kbnb-refs-empty{font-size:12px;color:var(--dsw-alias-label-tertiary);margin-bottom:8px}
.kbnb-ref-row{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--dsw-alias-label-primary);background:var(--dsw-static-neutral-bluish-50);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:5px 10px;margin-bottom:6px;min-width:0}
.kbnb-ref-row .kbnb-ref-kind{flex:none;color:var(--dsw-alias-state-business-primary);font-size:11px}
.kbnb-ref-row .kbnb-ref-link{color:var(--dsw-alias-state-business-primary);text-decoration:none;min-width:0;overflow:hidden;text-overflow:ellipsis}
.kbnb-ref-row .kbnb-ref-link:hover{text-decoration:underline}
.kbnb-ref-row .kbnb-ref-text{min-width:0;overflow:hidden;text-overflow:ellipsis}
.kbnb-ref-x{font-size:12px;line-height:1;opacity:.7;cursor:pointer;flex:none}
.kbnb-ref-x:hover{color:var(--dsw-alias-state-error-primary)}
.kbnb-ref-add{display:flex;flex-wrap:wrap;gap:6px;width:100%;margin-top:8px}
.kbnb-ref-kind-select{width:150px;flex:none;padding:4px 8px;font-size:12px}
.kbnb-ref-ext{flex:1 1 180px;min-width:120px;padding:4px 8px;font-size:12px}
.kbnb-ref-display{flex:1 1 140px;min-width:100px;padding:4px 8px;font-size:12px}
.kbnb-ref-url{flex:1 1 200px;min-width:140px;padding:4px 8px;font-size:12px}
.kbnb-ref-add .kbnb-btn{padding:4px 12px;font-size:12px;flex:none}

/* ══ 加载 ══ */
.kbnb-loading{padding:60px;text-align:center;color:var(--dsw-alias-label-tertiary)}

/* ══ 滚动条 ══ */
.kbnb-page *::-webkit-scrollbar{width:8px;height:8px}
.kbnb-page *::-webkit-scrollbar-thumb{background:var(--dsw-static-neutral-bluish-400);border-radius:999px;border:2px solid transparent;background-clip:content-box}
.kbnb-page *::-webkit-scrollbar-thumb:hover{background:var(--dsw-alias-label-tertiary);background-clip:content-box;border:2px solid transparent}
.kbnb-page *::-webkit-scrollbar-track{background:transparent}

/* ══ 侧边栏入口（官方类覆盖，保持既有布局修正） ══ */
.kbnb-side-btn{box-sizing:border-box;width:100%;height:49px;color:var(--dsw-alias-label-primary);cursor:pointer;background:none;border:none;border-radius:8px;align-items:center;gap:8px;padding:0 8px 0 6px;font-family:inherit;font-size:13px;display:inline-flex;overflow:hidden;line-height:20px;transition:background 150ms cubic-bezier(.4, 0, .2, 1)}
.kbnb-side-btn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.kbnb-side-btn-on{color:var(--dsw-alias-state-business-primary)}
.kbnb-side-btn-on:hover{color:var(--dsw-alias-state-business-primary)}
.Nqubda_layer{width:auto;flex:1 1 auto;min-width:0}
.hHd-Xa_footerActions{flex-direction:column;gap:4px}
.hHd-Xa_collapsed .hHd-Xa_footerActions{flex-direction:column;width:auto;align-items:center}
`;