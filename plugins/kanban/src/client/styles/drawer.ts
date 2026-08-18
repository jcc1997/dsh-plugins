// styles/drawer.ts — 抽屉与详情样式：左右分栏、contentEditable 标题/描述、状态栏、标签、评论、变更记录、关联、Git 卡、会话工作台
export const drawerCss = `
/* ══ 门禁/模板视图 ══ */
.kbnb-settings-title-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.kbnb-settings-empty{padding:24px 0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.8}
.kbnb-tpl-row{display:flex;align-items:center;gap:12px;justify-content:space-between}
.kbnb-tpl-main{min-width:0;flex:1}
.kbnb-tpl-name{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary)}
.kbnb-tpl-desc{display:block;font-size:12px;color:var(--dsw-alias-label-secondary);margin-top:2px}

/* ══ 模板卡片（v6）：卡片展示 + 点击展开编辑 ══ */
.kbnb-tpl-ticket{display:flex;flex-direction:column;gap:8px;background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;padding:12px 14px;margin-bottom:12px;box-shadow:var(--dsw-shadow-lv1);transition:border-color 150ms cubic-bezier(.4,0,.2,1),box-shadow 150ms cubic-bezier(.4,0,.2,1)}
.kbnb-tpl-ticket:hover{border-color:var(--dsw-alias-state-business-primary);box-shadow:var(--dsw-shadow-lv2)}
.kbnb-tpl-ticket-editing{border-color:var(--dsw-alias-state-business-primary);box-shadow:0 0 0 1px var(--dsw-alias-state-business-primary)}
.kbnb-tpl-ticket-head{display:flex;align-items:flex-start;gap:12px;justify-content:space-between;cursor:pointer;border-radius:8px;padding:6px;margin:0 -6px;transition:background 150ms cubic-bezier(.4,0,.2,1)}
.kbnb-tpl-ticket-head:hover{background:var(--dsw-alias-interactive-bg-hover)}
.kbnb-tpl-ticket-btns{flex:none;display:flex;gap:6px}
.kbnb-tpl-chips{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.kbnb-tag-gate{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.kbnb-tpl-edit{display:flex;flex-direction:column;gap:10px;border-top:1px dashed var(--dsw-alias-border-l2);padding-top:10px;margin-top:2px}
.kbnb-tpl-edit-btns{display:flex;gap:8px}

/* ══ 门禁详情(点击行展开) ══ */
.kbnb-gate-row-click{cursor:pointer;border-radius:6px;padding:4px 6px;margin:0 -6px}
.kbnb-gate-row-click:hover{background:var(--dsw-alias-interactive-bg-hover)}
.kbnb-gate-detail{background:var(--dsw-alias-bg-layer-2);border-radius:8px;padding:10px 12px;margin:2px 0 6px;display:flex;flex-direction:column;gap:6px}
.kbnb-gate-detail-row{display:flex;gap:8px;font-size:12px;color:var(--dsw-alias-label-primary)}
.kbnb-gate-detail-k{color:var(--dsw-alias-label-tertiary);min-width:40px;flex:none}
.kbnb-gate-detail-pre{margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;white-space:pre-wrap;word-break:break-all;max-height:160px;overflow-y:auto}

/* ══ 门禁卡（v4）：挂在此卡上的行为门禁 ══ */
.kbnb-gates-ticket{display:flex;flex-direction:column;gap:6px;width:100%;box-sizing:border-box;margin-bottom:16px}
.kbnb-gate-row{display:flex;align-items:center;gap:8px;font-size:12px;padding:4px 0}
.kbnb-gate-name{font-weight:600;color:var(--dsw-alias-label-primary);flex:none;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kbnb-gate-meta{flex:none;font-size:11px;color:var(--dsw-alias-label-tertiary)}
.kbnb-gate-summary{flex:1;min-width:0;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kbnb-gate-add{display:flex;flex-direction:column;gap:8px}
.kbnb-gate-add-empty{flex-direction:row;align-items:center;gap:10px;font-size:12px;color:var(--dsw-alias-label-tertiary)}

/* ══ Gates 视图（v6）：卡片网格展示 ══ */
.kbnb-gate-form-row{display:flex;align-items:center;gap:8px}
.kbnb-gate-form-row .kbnb-input{flex:1}
.kbnb-gate-add-panel{display:flex;flex-direction:column;gap:10px;background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;padding:14px 16px;margin-bottom:12px}
.kbnb-gates-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;align-items:start}
.kbnb-gate-ticket{display:flex;flex-direction:column;gap:8px;background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;padding:12px 14px;cursor:pointer;transition:border-color 150ms cubic-bezier(.4,0,.2,1),box-shadow 150ms cubic-bezier(.4,0,.2,1)}
.kbnb-gate-ticket:hover{border-color:var(--dsw-alias-state-business-primary);box-shadow:var(--dsw-shadow-lv2)}
.kbnb-gate-ticket-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}
.kbnb-gate-ticket .kbnb-gate-detail-pre{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:8px 10px}
.kbnb-gate-ticket-on{border-color:var(--dsw-alias-state-business-primary);box-shadow:0 0 0 1px var(--dsw-alias-state-business-primary)}
.kbnb-gate-inline-detail{display:flex;flex-direction:column;gap:8px;border-top:1px dashed var(--dsw-alias-border-l2);padding-top:10px;margin-top:2px}
.kbnb-gate-detail-empty{font-size:12px;color:var(--dsw-alias-label-tertiary);padding:4px 0}
.kbnb-gate-del{flex:none}
.kbnb-gate-checks{display:flex;flex-direction:column;gap:6px}
.kbnb-gate-check{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--dsw-alias-label-primary);cursor:pointer}
.kbnb-gate-check-meta{font-size:11px;color:var(--dsw-alias-label-tertiary)}
.kbnb-gate-checks-inline{flex-direction:row;flex-wrap:wrap;margin-top:8px}

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
.kbnb-status-select:focus-visible{outline:none;box-shadow:0 0 0 2px color-mix(in srgb, var(--dsw-alias-state-business-primary) 18%, transparent)}
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
.kbnb-activity-actor{flex:none;color:var(--dsw-alias-state-business-primary);background:var(--dsw-alias-interactive-bg-hover-accent);border-radius:6px;padding:0 5px;font-size:11px;white-space:nowrap}
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
.kbnb-ticket-actions{display:inline-flex;align-items:center;gap:8px}
.kbnb-git-ticket,.kbnb-refs-ticket{width:100%;box-sizing:border-box;margin-bottom:16px;padding:14px 16px;border-radius:12px;cursor:default}
.kbnb-ticket-sec-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}
.kbnb-ticket-sec-title{font-size:13px;font-weight:600;color:var(--dsw-alias-label-secondary)}
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
.kbnb-refs-ticket .kbnb-refs-empty{font-size:12px;color:var(--dsw-alias-label-tertiary);margin-bottom:8px}
.kbnb-ref-row{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:5px 10px;margin-bottom:6px;min-width:0}
.kbnb-ref-row .kbnb-ref-kind{flex:none;color:var(--dsw-alias-state-business-primary);font-size:11px}
.kbnb-ref-row .kbnb-ref-link{color:var(--dsw-alias-state-business-primary);text-decoration:none;min-width:0;overflow:hidden;text-overflow:ellipsis}
.kbnb-ref-row .kbnb-ref-link:hover{text-decoration:underline}
.kbnb-ref-row .kbnb-ref-text{min-width:0;overflow:hidden;text-overflow:ellipsis}

/* ══ 会话 Ticket 工作台（conversation.view tab）：悬浮可折叠左侧列表 + 右侧详情占满 ══ */
.kbnb-session-tasks{position:relative;height:100%;overflow:hidden;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base)}
.kbnb-session-main{width:100%;height:100%;min-width:0;overflow-y:auto}
.kbnb-session-side{position:absolute;top:12px;left:12px;width:300px;height:360px;max-height:calc(100% - 24px);z-index:20;display:flex;flex-direction:column;gap:10px;padding:40px 14px 14px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-base);box-shadow:var(--dsw-shadow-lv2);overflow:hidden}
.kbnb-session-side-collapsed{display:none}
.kbnb-session-side-head{display:flex;align-items:center;justify-content:space-between;gap:8px;flex:none}
.kbnb-session-side-toggle{position:absolute;top:12px;left:12px;z-index:22;font-size:12px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:999px;padding:4px 10px;cursor:pointer;font-family:inherit;box-shadow:var(--dsw-shadow-lv2);transition:all 150ms cubic-bezier(.4,0,.2,1)}
.kbnb-session-side-toggle:hover{border-color:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-state-business-primary)}
.kbnb-session-tasks-title{font-size:14px;font-weight:600}
.kbnb-session-tasks-hint{font-size:12px;color:var(--dsw-alias-label-tertiary)}
.kbnb-session-tasks-empty{font-size:13px;color:var(--dsw-alias-label-tertiary);line-height:1.7;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:14px 16px}
.kbnb-session-tasks-list{display:flex;flex-direction:column;gap:8px;flex:1;min-height:0;overflow-y:auto}
.kbnb-session-task{display:flex;flex-direction:column;align-items:flex-start;gap:4px;text-align:left;background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:10px 14px;cursor:pointer;font-family:inherit;color:var(--dsw-alias-label-primary);transition:all 150ms cubic-bezier(.4, 0, .2, 1);width:100%}
.kbnb-session-task:hover{border-color:var(--dsw-alias-state-business-primary);background:var(--dsw-alias-interactive-bg-hover)}
.kbnb-session-task-on{border-color:var(--dsw-alias-state-business-primary);background:var(--dsw-alias-interactive-bg-hover);box-shadow:0 0 0 1px var(--dsw-alias-state-business-primary)}
.kbnb-session-task-title{width:100%;font-size:14px;font-weight:500;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kbnb-session-task-status{font-size:11px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);border-radius:999px;padding:2px 10px}
.kbnb-session-task-time{font-size:11px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}
.kbnb-session-main-empty{padding:60px 20px;text-align:center;color:var(--dsw-alias-label-tertiary)}
/* TicketDetail 内嵌形态（无抽屉外壳）：滚动 + 两列 */
.kbnb-ticket-detail{flex:1;overflow-y:auto;padding:20px 28px;min-width:0}
.kbnb-session-main .kbnb-ticket-detail{height:100%;box-sizing:border-box}
`;