// styles/drawer.ts — 抽屉与详情样式：左右分栏、contentEditable 标题/描述、状态栏、标签、评论、变更记录、关联、Git 卡、会话工作台
export const drawerCss = `
/* ══ 抽屉 ══ */
.kbnb-drawer-mask{position:fixed;inset:0;background:var(--dsw-alias-bg-mask-1);z-index:70;pointer-events:auto;display:flex;justify-content:flex-end}
.kbnb-drawer{background:var(--dsw-alias-bg-base);border-left:1px solid var(--dsw-alias-border-l2);width:980px;max-width:96vw;height:100%;display:flex;flex-direction:column;box-shadow:var(--dsw-shadow-lv3)}
.kbnb-drawer-body{flex:1;overflow-y:auto;padding:20px 28px}
/* 左右分栏：左列主内容（标题/描述/内容/评论）+ 右列固定侧栏（状态/标签/关联/变更记录） */
.kbnb-drawer-grid{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:28px;align-items:start}
.kbnb-drawer-main{min-width:0}
.kbnb-drawer-side{min-width:0;display:flex;flex-direction:column;gap:0}
.kbnb-drawer-side .kbnb-toolbar{margin-top:0}
.kbnb-drawer-side .kbnb-tag-row{margin-bottom:14px}
.kbnb-drawer-side .kbnb-section{margin-top:16px}

/* ══ 大标题（Notion 式，contentEditable 无边框）与一句话描述 ══ */
.kbnb-title-row{display:flex;align-items:flex-start;gap:8px;margin-bottom:16px}
.kbnb-title-row .kbnb-icon-btn{flex:none;margin-top:4px}
.kbnb-input-title-editable{display:block;width:100%;box-sizing:border-box;border:none;background:none;font-size:26px;font-weight:700;line-height:1.35;padding:0;outline:none;color:var(--dsw-alias-label-primary);font-family:inherit;word-break:break-word;min-height:36px}
.kbnb-input-desc-editable{display:block;width:100%;box-sizing:border-box;border:none;background:none;font-size:14px;line-height:1.6;padding:2px 0;outline:none;color:var(--dsw-alias-label-secondary);font-family:inherit;min-height:24px}
/* contentEditable 占位符（空态类由 onInput 切换，比 :empty 更稳） */
.kbnb-editable-empty::before{content:attr(data-placeholder);color:var(--dsw-alias-label-dimmed);pointer-events:none;font-weight:400}

/* ══ 工具/状态栏 ══ */
.kbnb-toolbar{display:flex;align-items:center;gap:12px;margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid var(--dsw-alias-border-l2)}
.kbnb-status{display:inline-flex;align-items:center;gap:8px}
.kbnb-status-label{font-size:12px;color:var(--dsw-alias-label-secondary)}
.kbnb-status-select{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:5px 10px;font-size:13px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);cursor:pointer;max-width:200px;font-family:inherit;transition:all 150ms cubic-bezier(.4, 0, .2, 1)}
.kbnb-status-select:hover{border-color:var(--dsw-alias-border-l3)}
.kbnb-status-select:focus-visible{outline:none;box-shadow:0 0 0 2px rgba(65, 118, 230, .18)}
.kbnb-spacer{flex:1}

/* ══ 区块（评论/变更记录） ══ */
.kbnb-section{margin-top:20px;border-top:1px solid var(--dsw-alias-border-l2);padding-top:12px;min-width:0}
.kbnb-section-title{font-size:13px;font-weight:600;margin-bottom:8px;color:var(--dsw-alias-label-secondary);display:flex;align-items:center;gap:8px}
.kbnb-section-count{font-size:11px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);border-radius:999px;padding:1px 8px;border:1px solid var(--dsw-alias-border-l2)}
.kbnb-section-empty{font-size:12px;color:var(--dsw-alias-label-tertiary);padding:6px 0 10px}
.kbnb-comment{background:var(--dsw-alias-bg-layer-2);border-radius:8px;padding:9px 12px;margin-bottom:8px;border:1px solid var(--dsw-alias-border-l2)}
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
.kbnb-column-row:hover{background:var(--dsw-alias-interactive-bg-hover)}
.kbnb-column-row-btns{display:flex;gap:2px;flex:none}
.kbnb-column-row .kbnb-input{flex:1}
.kbnb-columns-add{display:flex;gap:8px;margin-top:12px}
.kbnb-columns-add .kbnb-input{flex:1}

/* ══ 外部关联（refs） ══ */
/* 按钮形态的关联链接（session）：去浏览器默认按钮样式 */
button.kbnb-ref-link{background:none;border:none;padding:0;font:inherit;cursor:pointer;text-align:left}
.kbnb-refs-row{gap:6px;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--dsw-alias-border-l2)}
.kbnb-refs-row .kbnb-field-label{flex:none}
.kbnb-refs-empty{font-size:12px;color:var(--dsw-alias-label-tertiary)}
.kbnb-ref{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:999px;padding:2px 8px;line-height:1.6;white-space:nowrap;max-width:100%}
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
/* Git 关联卡片 + 外部关联卡片 */
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
.kbnb-git-mr{display:flex;align-items:center;gap:8px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:6px 10px;min-width:0}
.kbnb-git-mr-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:var(--dsw-alias-label-primary);text-decoration:none}
.kbnb-git-mr-title:hover{color:var(--dsw-alias-state-business-primary);text-decoration:underline}
.kbnb-git-mr-updated{flex:none;font-size:11px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}
.kbnb-git-status{display:flex;align-items:center;flex-wrap:wrap;gap:8px;border-top:1px dashed var(--dsw-alias-border-l2);padding-top:8px;margin-top:4px}
.kbnb-git-status-muted{font-size:11px;color:var(--dsw-alias-label-tertiary)}
.kbnb-git-status-branch{font-size:11px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);border-radius:999px;padding:1px 8px}
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
.kbnb-ref-row{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:5px 10px;margin-bottom:6px;min-width:0}
.kbnb-ref-row .kbnb-ref-kind{flex:none;color:var(--dsw-alias-state-business-primary);font-size:11px}
.kbnb-ref-row .kbnb-ref-link{color:var(--dsw-alias-state-business-primary);text-decoration:none;min-width:0;overflow:hidden;text-overflow:ellipsis}
.kbnb-ref-row .kbnb-ref-link:hover{text-decoration:underline}
.kbnb-ref-row .kbnb-ref-text{min-width:0;overflow:hidden;text-overflow:ellipsis}

/* ══ 会话 Task 工作台（conversation.view tab）：左侧列表 + 右侧内嵌详情 ══ */
.kbnb-session-tasks{height:100%;display:grid;grid-template-columns:300px minmax(0,1fr);color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base)}
.kbnb-session-side{display:flex;flex-direction:column;gap:10px;padding:14px;border-right:1px solid var(--dsw-alias-border-l2);overflow-y:auto;min-width:0}
.kbnb-session-side-head{display:flex;align-items:center;gap:8px}
.kbnb-session-tasks-title{font-size:14px;font-weight:600}
.kbnb-session-tasks-hint{font-size:12px;color:var(--dsw-alias-label-tertiary)}
.kbnb-session-tasks-empty{font-size:13px;color:var(--dsw-alias-label-tertiary);line-height:1.7;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:14px 16px}
.kbnb-session-tasks-list{display:flex;flex-direction:column;gap:8px}
.kbnb-session-task{display:flex;flex-direction:column;align-items:flex-start;gap:4px;text-align:left;background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:10px 14px;cursor:pointer;font-family:inherit;color:var(--dsw-alias-label-primary);transition:all 150ms cubic-bezier(.4, 0, .2, 1);width:100%}
.kbnb-session-task:hover{border-color:var(--dsw-alias-state-business-primary);background:var(--dsw-alias-interactive-bg-hover)}
.kbnb-session-task-on{border-color:var(--dsw-alias-state-business-primary);background:var(--dsw-alias-interactive-bg-hover);box-shadow:0 0 0 1px var(--dsw-alias-state-business-primary)}
.kbnb-session-task-title{width:100%;font-size:14px;font-weight:500;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kbnb-session-task-status{font-size:11px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);border-radius:999px;padding:2px 10px}
.kbnb-session-task-time{font-size:11px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}
.kbnb-session-main{min-width:0;overflow-y:auto}
.kbnb-session-main-empty{padding:60px 20px;text-align:center;color:var(--dsw-alias-label-tertiary)}
/* CardDetail 内嵌形态（无抽屉外壳）：滚动 + 两列 */
.kbnb-card-detail{flex:1;overflow-y:auto;padding:20px 28px;min-width:0}
.kbnb-session-main .kbnb-card-detail{height:100%;box-sizing:border-box}
`;