
// 看板全部样式：先注入共享 design tokens，再定义组件样式（一律引用变量，见 packages/ui/DESIGN.md）
import { designTokensCss } from '@dsh-plugins/ui'

export const kbnbCss = designTokensCss + `
/* ══ 页面骨架 ══ */
.kbnb-page{position:fixed;inset:0;background:var(--kbnb-bg);display:flex;flex-direction:column;z-index:60;color:var(--kbnb-fg);pointer-events:auto}

/* ══ 顶栏 ══ */
.kbnb-header{display:flex;align-items:center;gap:var(--kbnb-space-3);padding:12px var(--kbnb-space-5);border-bottom:1px solid var(--kbnb-border);flex:none;background:var(--kbnb-bg)}
.kbnb-back{width:30px;height:30px;display:inline-flex;align-items:center;justify-content:center;border-radius:var(--kbnb-radius-sm)}
.kbnb-title{font-size:var(--kbnb-font-lg);font-weight:600;letter-spacing:.2px}
.kbnb-stats{font-size:var(--kbnb-font-sm);color:var(--kbnb-fg-tertiary);font-variant-numeric:tabular-nums;padding:2px 10px;background:var(--kbnb-bg-subtle);border-radius:var(--kbnb-radius-full)}
.kbnb-saving{font-size:var(--kbnb-font-sm);color:var(--kbnb-fg-tertiary);transition:opacity var(--kbnb-ease)}
.kbnb-header-actions{margin-left:auto;display:flex;gap:var(--kbnb-space-2)}

/* ══ 按钮 ══ */
.kbnb-btn{background:var(--kbnb-bg);border:1px solid var(--kbnb-border);border-radius:var(--kbnb-radius-md);padding:6px 14px;font-size:var(--kbnb-font-base);cursor:pointer;color:var(--kbnb-fg);transition:all var(--kbnb-ease);font-family:inherit}
.kbnb-btn:hover{background:var(--kbnb-bg-hover);border-color:var(--kbnb-border-strong)}
.kbnb-btn:disabled{opacity:.5;cursor:default;pointer-events:none}
.kbnb-btn:focus-visible{outline:none;box-shadow:0 0 0 2px var(--kbnb-accent-ring)}
.kbnb-primary{background:var(--kbnb-accent);border-color:var(--kbnb-accent);color:#fff}
.kbnb-primary:hover{background:var(--kbnb-accent-hover);border-color:var(--kbnb-accent-hover)}
.kbnb-danger{color:var(--kbnb-danger);border-color:rgba(220,38,38,.35)}
.kbnb-danger:hover{background:var(--kbnb-danger-soft);border-color:var(--kbnb-danger);color:var(--kbnb-danger-hover)}
.kbnb-icon-btn{background:none;border:none;cursor:pointer;padding:5px;border-radius:var(--kbnb-radius-sm);color:var(--kbnb-fg-secondary);display:inline-flex;align-items:center;justify-content:center;transition:all var(--kbnb-ease)}
.kbnb-icon-btn:hover{background:var(--kbnb-bg-hover);color:var(--kbnb-fg)}
.kbnb-icon-btn:disabled{opacity:.3;cursor:default}

/* ══ 错误条 ══ */
.kbnb-error{background:var(--kbnb-danger-soft);color:var(--kbnb-danger);padding:8px var(--kbnb-space-4);font-size:var(--kbnb-font-base);border-bottom:1px solid rgba(220,38,38,.2)}

/* ══ 看板区 ══ */
.kbnb-board{flex:1;display:flex;gap:0;padding:var(--kbnb-space-4) 0 var(--kbnb-space-4) var(--kbnb-space-4);overflow-x:auto;align-items:flex-start}
.kbnb-empty{margin:80px auto;color:var(--kbnb-fg-tertiary);font-size:var(--kbnb-font-base);text-align:center;line-height:1.8}
.kbnb-empty::before{content:"";display:block;width:44px;height:3px;border-radius:2px;background:var(--kbnb-bg-active);margin:0 auto 16px}

/* ══ 列 ══ */
.kbnb-column{flex:0 0 264px;padding:0 var(--kbnb-space-4);display:flex;flex-direction:column;max-height:100%;border-left:1px solid var(--kbnb-border)}
.kbnb-column:first-child{border-left:none}
.kbnb-column-drop{outline:2px solid var(--kbnb-accent);outline-offset:-2px;border-radius:var(--kbnb-radius-md)}
.kbnb-column-head{display:flex;align-items:center;gap:var(--kbnb-space-2);padding:2px 4px 12px;cursor:grab}
.kbnb-column-title{font-weight:700;font-size:var(--kbnb-font-lg);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;letter-spacing:.2px}
.kbnb-column-count{font-size:var(--kbnb-font-xs);color:var(--kbnb-fg-secondary);background:var(--kbnb-bg-subtle);border-radius:var(--kbnb-radius-full);padding:2px 9px;font-variant-numeric:tabular-nums;border:1px solid var(--kbnb-border)}

/* ══ 卡片 ══ */
.kbnb-cards{display:flex;flex-direction:column;gap:10px;overflow-y:auto;flex:1;min-height:40px;padding-bottom:4px}
.kbnb-card{background:var(--kbnb-bg);border:1px solid var(--kbnb-border);border-radius:var(--kbnb-radius-lg);padding:14px var(--kbnb-space-4);cursor:pointer;user-select:none;box-shadow:var(--kbnb-shadow-xs);transition:border-color var(--kbnb-ease),box-shadow var(--kbnb-ease),transform var(--kbnb-ease)}
.kbnb-card:hover{border-color:var(--kbnb-accent);box-shadow:var(--kbnb-shadow-sm);transform:translateY(-1px)}
.kbnb-card-active{border-color:var(--kbnb-accent);box-shadow:0 0 0 1px var(--kbnb-accent),var(--kbnb-shadow-sm)}
.kbnb-card-drag{opacity:.5;transform:none}
.kbnb-card-title{font-size:var(--kbnb-font-md);font-weight:600;line-height:1.5;word-break:break-word}
.kbnb-card-desc{font-size:var(--kbnb-font-base);color:var(--kbnb-fg-secondary);margin-top:6px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.kbnb-add-card{background:none;border:none;cursor:pointer;color:var(--kbnb-fg-tertiary);font-size:var(--kbnb-font-base);padding:10px 6px;border-radius:var(--kbnb-radius-md);text-align:left;flex:none;transition:all var(--kbnb-ease);font-family:inherit}
.kbnb-add-card:hover{color:var(--kbnb-accent);background:var(--kbnb-accent-soft)}
.kbnb-drop-line{height:3px;background:var(--kbnb-accent);border-radius:2px;margin:-2px 0;box-shadow:0 0 6px var(--kbnb-accent-ring)}

/* ══ 遮罩 / 弹窗 ══ */
.kbnb-mask{position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:70;pointer-events:auto}
.kbnb-modal{background:var(--kbnb-bg);border-radius:var(--kbnb-radius-lg);box-shadow:var(--kbnb-shadow-lg);width:480px;max-width:90vw;max-height:85vh;display:flex;flex-direction:column;overflow:hidden}
.kbnb-modal-head{display:flex;align-items:center;justify-content:space-between;padding:14px var(--kbnb-space-4) 12px;border-bottom:1px solid var(--kbnb-border)}
.kbnb-modal-title{font-size:var(--kbnb-font-md);font-weight:600}
.kbnb-modal-body{padding:var(--kbnb-space-4);overflow-y:auto}
.kbnb-modal-foot{display:flex;justify-content:flex-end;gap:var(--kbnb-space-2);margin-top:var(--kbnb-space-4)}

/* ══ 抽屉 ══ */
.kbnb-drawer-mask{position:fixed;inset:0;background:rgba(0,0,0,.25);z-index:70;pointer-events:auto;display:flex;justify-content:flex-end}
.kbnb-drawer{background:var(--kbnb-bg);border-left:1px solid var(--kbnb-border);width:720px;max-width:94vw;height:100%;display:flex;flex-direction:column;box-shadow:var(--kbnb-shadow-lg)}
.kbnb-drawer-body{flex:1;overflow-y:auto;padding:var(--kbnb-space-5) var(--kbnb-space-6)}

/* 大标题（Notion 式） */
.kbnb-title-row{display:flex;align-items:flex-start;gap:var(--kbnb-space-2);margin-bottom:var(--kbnb-space-3)}
.kbnb-title-row .kbnb-icon-btn{flex:none;margin-top:4px}
.kbnb-input-title{display:block;width:100%;box-sizing:border-box;border:none;background:none;font-size:var(--kbnb-font-title);font-weight:700;line-height:1.35;padding:0;outline:none;color:var(--kbnb-fg);font-family:inherit}
.kbnb-input-title::placeholder{color:var(--kbnb-fg-quaternary);font-weight:500}

/* 工具/状态栏 */
.kbnb-toolbar{display:flex;align-items:center;gap:var(--kbnb-space-3);margin-bottom:var(--kbnb-space-4);padding-bottom:14px;border-bottom:1px solid var(--kbnb-border)}
.kbnb-status{display:inline-flex;align-items:center;gap:var(--kbnb-space-2)}
.kbnb-status-label{font-size:var(--kbnb-font-sm);color:var(--kbnb-fg-secondary)}
.kbnb-status-select{box-sizing:border-box;border:1px solid var(--kbnb-border);border-radius:var(--kbnb-radius-md);padding:5px 10px;font-size:var(--kbnb-font-base);background:var(--kbnb-bg);color:var(--kbnb-fg);cursor:pointer;max-width:200px;font-family:inherit;transition:all var(--kbnb-ease)}
.kbnb-status-select:hover{border-color:var(--kbnb-border-strong)}
.kbnb-status-select:focus-visible{outline:none;box-shadow:0 0 0 2px var(--kbnb-accent-ring)}

/* ══ 表单 ══ */
.kbnb-field{display:block;margin-bottom:var(--kbnb-space-4)}
.kbnb-field-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--kbnb-space-2)}
.kbnb-field-label{font-size:var(--kbnb-font-sm);color:var(--kbnb-fg-secondary)}
.kbnb-switch{display:inline-flex;border:1px solid var(--kbnb-border);border-radius:var(--kbnb-radius-md);overflow:hidden;background:var(--kbnb-bg-subtle)}
.kbnb-switch button{background:none;border:none;cursor:pointer;font-size:var(--kbnb-font-sm);padding:4px 12px;color:var(--kbnb-fg-secondary);transition:all var(--kbnb-ease);font-family:inherit}
.kbnb-switch .kbnb-switch-on{background:var(--kbnb-bg);color:var(--kbnb-accent);font-weight:600;box-shadow:var(--kbnb-shadow-xs)}
.kbnb-input{display:block;width:100%;box-sizing:border-box;border:1px solid var(--kbnb-border);border-radius:var(--kbnb-radius-md);padding:8px 10px;font-size:var(--kbnb-font-base);background:var(--kbnb-bg);color:var(--kbnb-fg);transition:all var(--kbnb-ease);font-family:inherit}
.kbnb-input:hover{border-color:var(--kbnb-border-strong)}
.kbnb-input:focus-visible{outline:none;border-color:var(--kbnb-accent);box-shadow:0 0 0 2px var(--kbnb-accent-ring)}
.kbnb-input::placeholder{color:var(--kbnb-fg-quaternary)}
.kbnb-textarea{display:block;width:100%;box-sizing:border-box;border:1px solid var(--kbnb-border);border-radius:var(--kbnb-radius-md);padding:8px 10px;font-size:var(--kbnb-font-base);min-height:160px;font-family:inherit;background:var(--kbnb-bg);color:var(--kbnb-fg);transition:all var(--kbnb-ease);resize:vertical}
.kbnb-textarea:hover{border-color:var(--kbnb-border-strong)}
.kbnb-textarea:focus-visible{outline:none;border-color:var(--kbnb-accent);box-shadow:0 0 0 2px var(--kbnb-accent-ring)}
.kbnb-textarea::placeholder{color:var(--kbnb-fg-quaternary)}

/* ══ Markdown 预览 ══ */
.kbnb-preview{border:1px solid var(--kbnb-border);border-radius:var(--kbnb-radius-md);padding:12px;font-size:var(--kbnb-font-base);line-height:1.7;color:var(--kbnb-fg);background:var(--kbnb-bg-subtle)}
.kbnb-preview-scroll{max-height:280px;overflow-y:auto}
.kbnb-preview h1{font-size:var(--kbnb-font-xl);margin:6px 0}
.kbnb-preview h2{font-size:var(--kbnb-font-lg);margin:6px 0}
.kbnb-preview h3{font-size:var(--kbnb-font-md);margin:6px 0}
.kbnb-preview ul{margin:6px 0;padding-left:20px}
.kbnb-preview a{color:var(--kbnb-accent)}

/* ══ 双栏（评论 | 变更记录） ══ */
.kbnb-drawer-split{display:grid;grid-template-columns:1fr 1fr;gap:var(--kbnb-space-6);margin-top:var(--kbnb-space-2);align-items:start}
.kbnb-drawer-split .kbnb-section{margin-top:0;border-top:none;padding-top:0}
.kbnb-spacer{flex:1}
.kbnb-section{margin-top:var(--kbnb-space-5);border-top:1px solid var(--kbnb-border);padding-top:var(--kbnb-space-3);min-width:0}
.kbnb-section-title{font-size:var(--kbnb-font-base);font-weight:600;margin-bottom:var(--kbnb-space-2);color:var(--kbnb-fg-secondary);display:flex;align-items:center;gap:var(--kbnb-space-2)}
.kbnb-section-count{font-size:var(--kbnb-font-xs);color:var(--kbnb-fg-secondary);background:var(--kbnb-bg-subtle);border-radius:var(--kbnb-radius-full);padding:1px 8px;border:1px solid var(--kbnb-border)}
.kbnb-section-empty{font-size:var(--kbnb-font-sm);color:var(--kbnb-fg-tertiary);padding:6px 0 10px}
.kbnb-comment{background:var(--kbnb-bg-subtle);border-radius:var(--kbnb-radius-md);padding:9px 12px;margin-bottom:var(--kbnb-space-2);border:1px solid var(--kbnb-border)}
.kbnb-comment-text{font-size:var(--kbnb-font-base);line-height:1.55;white-space:pre-wrap;word-break:break-word}
.kbnb-comment-time{font-size:var(--kbnb-font-xs);color:var(--kbnb-fg-tertiary);margin-top:4px}
.kbnb-comment-input{display:flex;gap:var(--kbnb-space-2);margin-top:var(--kbnb-space-3)}
.kbnb-comment-input .kbnb-input{flex:1}
.kbnb-activity{display:flex;gap:var(--kbnb-space-1);font-size:var(--kbnb-font-sm);padding:4px 0;color:var(--kbnb-fg-secondary);align-items:baseline;border-bottom:1px dashed var(--kbnb-border)}
.kbnb-activity:last-child{border-bottom:none}
.kbnb-activity-time{flex:none;color:var(--kbnb-fg-tertiary);font-variant-numeric:tabular-nums}
.kbnb-activity-actor{flex:none;color:var(--kbnb-accent);background:var(--kbnb-accent-soft);border-radius:var(--kbnb-radius-sm);padding:0 5px;font-size:var(--kbnb-font-xs);white-space:nowrap}
.kbnb-activity-text{min-width:0;word-break:break-word}

/* ══ 列配置 ══ */
.kbnb-columns-panel{display:flex;flex-direction:column;gap:var(--kbnb-space-2)}
.kbnb-column-row{display:flex;gap:var(--kbnb-space-2);align-items:center;padding:4px;border-radius:var(--kbnb-radius-md);transition:background var(--kbnb-ease)}
.kbnb-column-row:hover{background:var(--kbnb-bg-subtle)}
.kbnb-column-row-btns{display:flex;gap:2px;flex:none}
.kbnb-column-row .kbnb-input{flex:1}
.kbnb-columns-add{display:flex;gap:var(--kbnb-space-2);margin-top:var(--kbnb-space-3)}
.kbnb-columns-add .kbnb-input{flex:1}

/* ══ 设置页 ══ */
.kbnb-hint{font-size:var(--kbnb-font-sm);color:var(--kbnb-fg-secondary);margin:0 0 10px;line-height:1.6}
.kbnb-settings-row{display:flex;gap:10px;align-items:center;margin-top:10px}
.kbnb-settings-msg{font-size:var(--kbnb-font-sm);color:var(--kbnb-success)}

/* ══ 加载 ══ */
.kbnb-loading{padding:60px;text-align:center;color:var(--kbnb-fg-tertiary)}

/* ══ 滚动条 ══ */
.kbnb-page *::-webkit-scrollbar{width:8px;height:8px}
.kbnb-page *::-webkit-scrollbar-thumb{background:var(--kbnb-fg-quaternary);border-radius:var(--kbnb-radius-full);border:2px solid transparent;background-clip:content-box}
.kbnb-page *::-webkit-scrollbar-thumb:hover{background:var(--kbnb-fg-tertiary);background-clip:content-box;border:2px solid transparent}
.kbnb-page *::-webkit-scrollbar-track{background:transparent}

/* ══ 侧边栏入口（官方类覆盖，保持既有布局修正） ══ */
.kbnb-side-btn{box-sizing:border-box;width:100%;height:49px;color:var(--kbnb-fg);cursor:pointer;background:none;border:none;border-radius:var(--kbnb-radius-md);align-items:center;gap:var(--kbnb-space-2);padding:0 8px 0 6px;font-family:inherit;font-size:var(--kbnb-font-base);display:inline-flex;overflow:hidden;line-height:20px;transition:background var(--kbnb-ease)}
.kbnb-side-btn:hover{background:var(--kbnb-bg-hover);color:var(--kbnb-fg)}
.kbnb-side-btn-on{color:var(--kbnb-accent)}
.kbnb-side-btn-on:hover{color:var(--kbnb-accent)}
.Nqubda_layer{width:auto;flex:1 1 auto;min-width:0}
.hHd-Xa_footerActions{flex-direction:column;gap:4px}
.hHd-Xa_collapsed .hHd-Xa_footerActions{flex-direction:column;width:auto;align-items:center}
`;
