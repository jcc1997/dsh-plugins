// styles/board.ts — 看板区样式：页内左侧边栏、看板布局（撑满/竖线/独立滚动）、列/卡片、分组泳道、归档视图、设置
export const boardCss = `
/* ══ 主体：左侧边栏 + 主区 ══ */
.kbnb-body{flex:1;display:flex;min-height:0;overflow:hidden}
.kbnb-app-side{flex:none;width:188px;border-right:1px solid var(--dsw-alias-border-l2);padding:12px 10px;display:flex;flex-direction:column;gap:4px;background:var(--dsw-alias-bg-base);min-height:0;overflow-y:auto}
.kbnb-nav-item{display:flex;align-items:center;gap:9px;padding:8px 10px;border-radius:8px;border:none;background:none;cursor:pointer;color:var(--dsw-alias-label-secondary);font-size:13px;font-family:inherit;transition:background 150ms cubic-bezier(.4, 0, .2, 1),color 150ms cubic-bezier(.4, 0, .2, 1)}
.kbnb-nav-item:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.kbnb-nav-on{background:var(--dsw-alias-interactive-bg-active);color:var(--dsw-alias-state-business-primary);font-weight:600}
.kbnb-nav-on:hover{background:var(--dsw-alias-interactive-bg-active);color:var(--dsw-alias-state-business-primary)}
.kbnb-nav-icon{flex:none;color:currentColor}
.kbnb-nav-label{flex:1;text-align:left;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kbnb-nav-badge{font-size:11px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);border-radius:999px;padding:1px 8px;border:1px solid var(--dsw-alias-border-l2);font-variant-numeric:tabular-nums;flex:none}
.kbnb-main{flex:1;min-width:0;display:flex;flex-direction:column;min-height:0;overflow:hidden}

/* ══ 看板工具行（分组/列配置） ══ */
.kbnb-board-toolbar{display:flex;align-items:center;gap:12px;padding:8px 16px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none;background:var(--dsw-alias-bg-base)}

/* ══ 看板区（横向滚动；列间竖线拉到底；每列独立纵向滚动） ══ */
.kbnb-board{flex:1;min-height:0;display:flex;gap:0;padding:0 12px 0 0;overflow-x:auto;align-items:stretch}
.kbnb-board-groups{flex-direction:column;overflow:auto;padding:0;align-items:stretch}

/* ══ 分组（swimlane：组头 + 组内列行，组内横向滚动） ══ */
.kbnb-group{display:flex;flex-direction:column;min-height:0;flex:1 1 0;min-height:170px;border-bottom:1px solid var(--dsw-alias-border-l2)}
.kbnb-group:last-child{border-bottom:none}
.kbnb-group-single{flex:1 1 auto;border-bottom:none;min-height:0}
.kbnb-group-head{flex:none;display:flex;align-items:center;gap:8px;padding:7px 16px;border-bottom:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-interactive-bg-hover)}
.kbnb-group-title{font-size:13px;font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kbnb-group-count{font-size:11px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:999px;padding:1px 8px;font-variant-numeric:tabular-nums;flex:none}
.kbnb-group-row{flex:1;display:flex;overflow-x:auto;align-items:stretch;min-height:0}

/* ══ 列（竖线分割，拉到底；内部卡片区独立滚动） ══ */
.kbnb-column{flex:0 0 272px;padding:12px 14px 10px;display:flex;flex-direction:column;min-height:0;border-left:1px solid var(--dsw-alias-border-l2)}
.kbnb-board > .kbnb-column:first-child,.kbnb-group-row > .kbnb-column:first-child{border-left:none}
.kbnb-column-drop{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:-2px;border-radius:8px}
.kbnb-column-head{display:flex;align-items:center;gap:8px;padding:0 0 12px;cursor:default;flex:none}
.kbnb-column-title{font-weight:600;font-size:15px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;letter-spacing:.2px}
.kbnb-column-count{font-size:11px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);border-radius:999px;padding:2px 9px;font-variant-numeric:tabular-nums;border:1px solid var(--dsw-alias-border-l2)}

/* ══ 卡片（title + 标签 + 一句话描述，单行省略） ══ */
.kbnb-cards{display:flex;flex-direction:column;gap:10px;overflow-y:auto;flex:1;min-height:40px;padding:6px 0 4px}
.kbnb-card{width:244px;max-width:100%;box-sizing:border-box;background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;padding:12px 14px;cursor:pointer;user-select:none;transition:border-color 150ms cubic-bezier(.4, 0, .2, 1),box-shadow 150ms cubic-bezier(.4, 0, .2, 1)}
.kbnb-card:hover{border-color:var(--dsw-alias-state-business-primary)}
.kbnb-card-active{border-color:var(--dsw-alias-state-business-primary);box-shadow:0 0 0 1px var(--dsw-alias-state-business-primary),var(--dsw-shadow-lv2)}
.kbnb-card-drag{opacity:.5;transform:none}
.kbnb-card-title{font-size:15px;font-weight:600;line-height:1.5;word-break:break-word}
.kbnb-card-desc{font-size:13px;color:var(--dsw-alias-label-secondary);margin-top:6px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.kbnb-card-tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:8px}
.kbnb-tag{display:inline-flex;align-items:center;gap:4px;font-size:11px;color:var(--dsw-alias-state-business-primary);background:var(--dsw-alias-interactive-bg-hover-accent);border-radius:999px;padding:2px 8px;line-height:1.6;white-space:nowrap}
.kbnb-tag-removable{cursor:pointer;transition:all 150ms cubic-bezier(.4, 0, .2, 1)}
.kbnb-tag-removable:hover{background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-alias-state-error-primary)}
.kbnb-tag-x{font-size:12px;line-height:1;opacity:.7}
.kbnb-tag-row{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--dsw-alias-border-l2)}
.kbnb-tag-row .kbnb-field-label{flex:none}
.kbnb-tag-input{width:120px;padding:4px 10px;font-size:12px;border-radius:999px;flex:none}
.kbnb-add-card{background:none;border:none;cursor:pointer;color:var(--dsw-alias-label-tertiary);font-size:13px;padding:10px 0;border-radius:8px;text-align:left;flex:none;transition:all 150ms cubic-bezier(.4, 0, .2, 1);font-family:inherit}
.kbnb-add-card:hover{color:var(--dsw-alias-state-business-primary);background:var(--dsw-alias-interactive-bg-hover-accent)}
.kbnb-drop-line{height:3px;background:var(--dsw-alias-state-business-primary);border-radius:2px;margin:-2px 0;box-shadow:0 0 6px rgba(65, 118, 230, .18);flex:none}

/* ══ 归档视图 ══ */
.kbnb-archive{flex:1;overflow-y:auto;padding:16px 20px;min-width:0}
.kbnb-archive-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}
.kbnb-archive-title{font-size:15px;font-weight:600}
.kbnb-archive-list{display:flex;flex-direction:column;gap:10px}
.kbnb-arch-row{display:flex;align-items:center;gap:14px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;padding:12px 16px;background:var(--dsw-alias-bg-base)}
.kbnb-arch-info{flex:1;min-width:0}
.kbnb-arch-title{font-size:14px;font-weight:600;word-break:break-word}
.kbnb-arch-desc{font-size:12px;color:var(--dsw-alias-label-secondary);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.kbnb-arch-meta{display:flex;flex-wrap:wrap;gap:10px;margin-top:5px;font-size:11px;color:var(--dsw-alias-label-tertiary)}
.kbnb-arch-col{color:var(--dsw-alias-state-business-primary);background:var(--dsw-alias-interactive-bg-hover-accent);border-radius:999px;padding:1px 8px}
.kbnb-arch-time{font-variant-numeric:tabular-nums}
.kbnb-arch-actions{display:flex;gap:8px;flex:none}

/* ══ 设置页 ══ */
.kbnb-hint{font-size:12px;color:var(--dsw-alias-label-secondary);margin:0 0 10px;line-height:1.6}
.kbnb-settings-row{display:flex;gap:10px;align-items:center;margin-top:10px}
.kbnb-settings-msg{font-size:12px;color:var(--dsw-alias-state-success-primary)}
.kbnb-settings-title{font-size:14px;font-weight:600;margin:24px 0 10px}
.kbnb-settings-cols{margin-top:24px;padding-top:16px;border-top:1px solid var(--dsw-alias-border-l2)}
`;
