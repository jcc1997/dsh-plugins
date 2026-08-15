// styles/index.ts — pipeline 全部样式（单文件，直接引用宿主 --dsw-* tokens）
export const plpCss = `
/* ══ 页面骨架 ══ */
.plp-page{position:fixed;inset:0;background:var(--dsw-alias-bg-base);display:flex;flex-direction:column;z-index:60;color:var(--dsw-alias-label-primary);pointer-events:auto;min-height:0}
.plp-body{flex:1;display:flex;min-height:0}
.plp-loading{padding:60px;text-align:center;color:var(--dsw-alias-label-tertiary)}

/* ══ 顶栏 ══ */
.plp-header{display:flex;align-items:center;gap:12px;padding:14px 20px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none;background:var(--dsw-alias-bg-base)}
.plp-title{font-size:17px;font-weight:600;letter-spacing:.2px}
.plp-saving{font-size:12px;color:var(--dsw-alias-label-tertiary)}
.plp-header-actions{margin-left:auto;display:flex;gap:8px}

/* ══ 左侧导航 ══ */
.plp-app-side{width:220px;flex:none;border-right:1px solid var(--dsw-alias-border-l2);padding:12px;display:flex;flex-direction:column;gap:4px;background:var(--dsw-alias-bg-base)}
.plp-nav-item{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;border:none;background:none;cursor:pointer;color:var(--dsw-alias-label-primary);font-size:13px;font-family:inherit;text-align:left;transition:background 150ms cubic-bezier(.4,0,.2,1)}
.plp-nav-item:hover{background:var(--dsw-alias-interactive-bg-hover)}
.plp-nav-on{background:var(--dsw-alias-interactive-bg-active);color:var(--dsw-alias-state-business-primary)}
.plp-nav-label{flex:1}
.plp-nav-badge{font-size:11px;color:var(--dsw-alias-label-tertiary);background:var(--dsw-alias-bg-layer-2);border-radius:999px;padding:1px 8px;font-variant-numeric:tabular-nums}
.plp-nav-section{font-size:11px;color:var(--dsw-alias-label-tertiary);padding:12px 10px 4px;letter-spacing:.5px}

/* ══ 主区 ══ */
.plp-main{flex:1;min-width:0;overflow-y:auto;padding:20px 24px}
.plp-main-editor{padding:0;overflow:hidden;display:flex;flex-direction:column}

/* ══ 表单 ══ */
.plp-field{display:block;margin-bottom:16px}
.plp-field-label{font-size:12px;color:var(--dsw-alias-label-secondary);display:block;margin-bottom:8px}
.plp-input{display:block;width:100%;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:8px 10px;font-size:13px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);transition:all 150ms cubic-bezier(.4,0,.2,1);font-family:inherit}
.plp-input:focus-visible{outline:none;border-color:var(--dsw-alias-state-business-primary);box-shadow:0 0 0 2px rgba(65,118,230,.18)}
.plp-input::placeholder{color:var(--dsw-alias-label-dimmed)}
.plp-textarea{display:block;width:100%;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:8px 10px;font-size:13px;min-height:90px;font-family:inherit;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);resize:vertical;transition:all 150ms cubic-bezier(.4,0,.2,1)}
.plp-textarea:focus-visible{outline:none;border-color:var(--dsw-alias-state-business-primary);box-shadow:0 0 0 2px rgba(65,118,230,.18)}
.plp-select{display:block;width:100%;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:8px 10px;font-size:13px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-family:inherit}

/* ══ 按钮 ══ */
.plp-btn{background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:6px 14px;font-size:13px;cursor:pointer;color:var(--dsw-alias-label-primary);transition:all 150ms cubic-bezier(.4,0,.2,1);font-family:inherit;display:inline-flex;align-items:center;gap:6px}
.plp-btn:hover{background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-border-l3)}
.plp-btn:disabled{opacity:.5;cursor:default;pointer-events:none}
.plp-primary{background:var(--dsw-alias-state-business-primary);border-color:var(--dsw-alias-state-business-primary);color:#fff}
.plp-primary:hover{background:var(--dsw-static-deepseek-600);border-color:var(--dsw-static-deepseek-600)}
.plp-danger{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-secondary)}
.plp-danger:hover{background:var(--dsw-alias-interactive-bg-hover-danger);border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary)}
.plp-icon-btn{background:none;border:none;cursor:pointer;padding:5px;border-radius:6px;color:var(--dsw-alias-label-secondary);display:inline-flex;align-items:center;justify-content:center;transition:all 150ms cubic-bezier(.4,0,.2,1)}
.plp-icon-btn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}

/* ══ 错误条 ══ */
.plp-error{background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-alias-state-error-primary);padding:8px 16px;font-size:13px;border-radius:8px;margin-bottom:12px}

/* ══ 列表 / 卡片 ══ */
.plp-row{display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;margin-bottom:12px;background:var(--dsw-alias-bg-base);cursor:pointer;transition:all 150ms cubic-bezier(.4,0,.2,1)}
.plp-row:hover{border-color:var(--dsw-alias-state-business-primary);box-shadow:var(--dsw-shadow-lv2)}
.plp-row-main{flex:1;min-width:0}
.plp-row-title{font-size:14px;font-weight:600}
.plp-row-desc{font-size:12px;color:var(--dsw-alias-label-secondary);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.plp-row-meta{font-size:11px;color:var(--dsw-alias-label-tertiary);margin-top:4px;display:flex;gap:8px;flex-wrap:wrap}
.plp-badge{font-size:11px;padding:1px 8px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary)}
.plp-badge-kind{background:var(--dsw-alias-interactive-bg-active);color:var(--dsw-alias-state-business-primary)}
.plp-version{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:var(--dsw-alias-state-business-primary)}

/* ══ 弹窗 ══ */
.plp-mask{position:fixed;inset:0;background:var(--dsw-alias-bg-mask-1);display:flex;align-items:center;justify-content:center;z-index:70;pointer-events:auto}
.plp-modal{background:var(--dsw-alias-bg-base);border-radius:14px;box-shadow:var(--dsw-shadow-lv3);width:520px;max-width:90vw;max-height:85vh;display:flex;flex-direction:column;overflow:hidden}
.plp-modal-head{display:flex;align-items:center;justify-content:space-between;padding:16px 16px 12px;border-bottom:1px solid var(--dsw-alias-border-l2)}
.plp-modal-title{font-size:15px;font-weight:600}
.plp-modal-body{padding:16px;overflow-y:auto}
.plp-modal-foot{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}

/* ══ 节点编辑器 ══ */
.plp-nodes{border:1px solid var(--dsw-alias-border-l2);border-radius:12px;overflow:hidden}
.plp-node{display:flex;align-items:flex-start;gap:10px;padding:12px 14px;border-bottom:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base)}
.plp-node:last-child{border-bottom:none}
.plp-node-left{flex:1;min-width:0}
.plp-node-type{font-size:11px;font-weight:600;color:var(--dsw-alias-state-business-primary);text-transform:uppercase;letter-spacing:.5px}
.plp-node-title{font-size:13px;font-weight:600;margin-top:2px}
.plp-node-config{margin-top:8px;display:flex;flex-direction:column;gap:6px}
.plp-node-input{box-sizing:border-box;width:100%;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:6px 8px;font-size:12px;font-family:inherit;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary)}
.plp-node-input:focus-visible{outline:none;border-color:var(--dsw-alias-state-business-primary)}
.plp-node-remove{align-self:center}

/* ══ 版本条 ══ */
.plp-ver-row{display:flex;align-items:center;gap:8px;padding:10px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;margin-bottom:8px;cursor:pointer;flex-wrap:nowrap;min-width:0;transition:border-color 150ms cubic-bezier(.4,0,.2,1)}
.plp-ver-row:hover{border-color:var(--dsw-alias-state-business-primary)}
.plp-ver-row-sel{border-color:var(--dsw-alias-state-business-primary);box-shadow:0 0 0 1px var(--dsw-alias-state-business-primary)}
.plp-ver-row .plp-ver-chip{flex:none}
.plp-ver-row .plp-ver-latest{flex:none;white-space:nowrap}
.plp-ver-row .plp-ver-meta{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.plp-ver-row .plp-icon-btn{flex:none;padding:3px}
.plp-ver-banner{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border:1px solid var(--dsw-alias-state-business-primary);border-radius:10px;background:var(--dsw-alias-interactive-bg-hover-accent);font-size:12px;margin-bottom:12px;flex:none}
.plp-graph-inner{position:absolute;inset:0;padding-top:44px}
/* 只读版本：banner 占正常文档流，画布区域改为 flex 撑满剩余高度，不再绝对定位遮挡 banner 下半部分 */
.plp-graph-scroll-ro .plp-graph-inner{position:relative;inset:auto;flex:1;min-height:480px}
.plp-ver-chip{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;font-weight:600}
.plp-ver-published{color:var(--dsw-alias-state-success-primary)}
.plp-ver-draft{color:var(--dsw-alias-label-tertiary)}
.plp-ver-meta{font-size:11px;color:var(--dsw-alias-label-tertiary);flex:1}
.plp-ver-latest{font-size:10px;color:var(--dsw-alias-state-business-primary);border:1px solid var(--dsw-alias-state-business-primary);border-radius:999px;padding:0 6px}

/* ══ 运行监控 ══ */
.plp-run{display:flex;align-items:center;gap:12px;padding:10px 14px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;margin-bottom:8px;background:var(--dsw-alias-bg-base);cursor:pointer}
.plp-run:hover{border-color:var(--dsw-alias-state-business-primary)}
.plp-run-sel{border-color:var(--dsw-alias-state-business-primary);box-shadow:var(--dsw-shadow-lv2)}
.plp-run-status{width:9px;height:9px;border-radius:50%;flex:none}
.plp-st-queued{background:var(--dsw-alias-label-tertiary)}
.plp-st-running{background:var(--dsw-alias-state-warn-primary);animation:sandbox-pulse 1.2s ease-in-out infinite}
.plp-st-success{background:var(--dsw-alias-state-success-primary)}
.plp-st-failed{background:var(--dsw-alias-state-error-primary)}
.plp-st-cancelled{background:var(--dsw-alias-label-dimmed)}
@keyframes sandbox-pulse{0%,100%{opacity:1}50%{opacity:.35}}
.plp-run-main{flex:1;min-width:0}
.plp-run-title{font-size:13px;font-weight:600}
.plp-run-meta{font-size:11px;color:var(--dsw-alias-label-tertiary);display:flex;gap:8px;margin-top:2px}
.plp-run-id{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}

/* ══ 进度条 ══ */
.plp-progress{height:5px;border-radius:3px;background:var(--dsw-alias-bg-layer-2);overflow:hidden;margin:6px 0}
.plp-progress-fill{height:100%;background:var(--dsw-alias-state-business-primary);border-radius:3px;transition:width 300ms cubic-bezier(.4,0,.2,1)}

/* ══ 节点运行态详情 ══ */
.plp-node-state{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;margin-bottom:6px;background:var(--dsw-alias-bg-layer-1);font-size:12px}
.plp-node-state-dot{width:7px;height:7px;border-radius:50%;flex:none}
.plp-node-state-name{flex:1}
.plp-node-state-err{color:var(--dsw-alias-state-error-primary);font-size:11px;margin-top:2px}
.plp-node-out{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--dsw-alias-label-secondary);margin-top:2px;white-space:pre-wrap;word-break:break-all}

/* ══ 空状态 / 区块标题 ══ */
.plp-empty{margin:80px auto;color:var(--dsw-alias-label-tertiary);font-size:13px;text-align:center;line-height:1.8}
.plp-empty::before{content:"";display:block;width:44px;height:3px;border-radius:2px;background:var(--dsw-alias-interactive-bg-active);margin:0 auto 16px}
.plp-section-title{font-size:13px;font-weight:600;margin:4px 0 12px}
.plp-stack{display:flex;flex-direction:column;gap:8px}
.plp-kv{display:flex;gap:8px;font-size:12px;margin-bottom:6px}
.plp-kv-key{color:var(--dsw-alias-label-secondary);min-width:80px;flex:none}
.plp-kv-val{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;word-break:break-all}
.plp-pre{background:var(--dsw-alias-bg-layer-2);border-radius:8px;padding:10px 12px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;white-space:pre-wrap;word-break:break-all;max-height:320px;overflow-y:auto}

/* ══ 滚动条 ══ */
.plp-page *::-webkit-scrollbar{width:8px;height:8px}
.plp-page *::-webkit-scrollbar-thumb{background:var(--dsw-alias-scrollbar-bg-l1);border-radius:999px;border:2px solid transparent;background-clip:content-box}
.plp-page *::-webkit-scrollbar-track{background:transparent}

/* ══ 状态徽章色（对话流卡片复用） ══ */
.plp-sess-st-queued{color:var(--dsw-alias-label-tertiary)}
.plp-sess-st-running{color:var(--dsw-alias-state-warn-primary);background:var(--dsw-alias-state-warn-secondary)}
.plp-sess-st-success{color:var(--dsw-alias-state-success-primary);background:var(--dsw-alias-state-success-secondary)}
.plp-sess-st-failed{color:var(--dsw-alias-state-error-primary);background:var(--dsw-alias-state-error-secondary)}
.plp-sess-st-cancelled{color:var(--dsw-alias-label-dimmed)}

/* ══ 对话流工具卡片（tool.call.toolview） ══ */
.plp-callcard{border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-base);padding:10px 12px;margin:4px 0 4px 4px;display:flex;flex-direction:column;gap:8px;min-width:0}
.plp-callcard-head{display:flex;align-items:center;gap:8px;min-width:0}
.plp-callcard-icon{color:var(--dsw-alias-label-tertiary);flex:none}
.plp-callcard-title{font-size:13px;font-weight:600;flex:none}
.plp-callcard-runid{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.plp-callcard-status{font-size:11px;padding:1px 8px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);flex:none}
.plp-callcard-spacer{flex:1}
.plp-callcard-inspect{flex:none;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);cursor:pointer;border-radius:999px;padding:2px 8px;font-size:11px;line-height:16px;font-family:inherit}
.plp-callcard-inspect:hover{background:var(--dsw-alias-interactive-bg-hover-solid);color:var(--dsw-alias-label-primary)}
.plp-callcard-progress{display:flex;align-items:center;gap:10px}
.plp-callcard-progress-text{flex:none;font-size:11px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}
.plp-callcard-error{font-size:12px;color:var(--dsw-alias-state-error-primary);word-break:break-all}
.plp-callcard-output{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);border-radius:8px;padding:6px 10px;white-space:pre-wrap;word-break:break-all;max-height:120px;overflow-y:auto}
.plp-callcard-foot{display:flex;justify-content:flex-start}
.plp-callcard-go{flex:none;border:1px solid var(--dsw-alias-state-business-primary);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-state-business-primary);cursor:pointer;border-radius:999px;padding:2px 10px;font-size:11px;line-height:16px;font-family:inherit}
.plp-callcard-go:hover{background:var(--dsw-alias-interactive-bg-hover-accent)}

/* ══ 列表多列网格 ══ */
.plp-list-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px;align-items:start}
.plp-list-grid .plp-row{margin-bottom:0}

/* ══ 编辑器页面布局 ══ */
.plp-editor{flex:1;display:flex;flex-direction:column;min-height:0}
.plp-editor-basic{border-bottom:1px solid var(--dsw-alias-border-l2);padding:8px 20px}
.plp-basic-toggle{display:inline-flex;align-items:center;gap:6px;background:none;border:none;cursor:pointer;color:var(--dsw-alias-label-secondary);font-size:12px;font-family:inherit;padding:4px 0}
.plp-basic-toggle:hover{color:var(--dsw-alias-label-primary)}
.plp-basic-grid{display:grid;grid-template-columns:1fr 2fr 200px 1fr;gap:16px;padding:8px 0 12px}
.plp-editor-body{flex:1;position:relative;min-height:0}
.plp-graph-scroll{position:absolute;inset:0;overflow:auto;padding:16px;display:flex;flex-direction:column}
.plp-graph-scroll .plp-rf-wrap{flex:1;min-height:480px}
.plp-editor-side{position:absolute;top:12px;right:12px;bottom:12px;width:320px;z-index:5;display:flex;flex-direction:column;background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:14px;box-shadow:var(--dsw-shadow-lv3);overflow:hidden}
.plp-side-head{display:flex;align-items:center;justify-content:space-between;padding:12px 12px 10px 16px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none}
.plp-side-title{font-size:13px;font-weight:600}
.plp-side-body{flex:1;overflow-y:auto;padding:16px}
.plp-panel-empty{padding:32px 16px;text-align:center;font-size:12px;line-height:2;color:var(--dsw-alias-label-tertiary);border:1px dashed var(--dsw-alias-border-l2);border-radius:12px;margin-bottom:16px}
.plp-ver-block{margin-top:20px}

/* ══ 浮窗侧栏 ══ */
.plp-editor-side .plp-panel-empty{margin-bottom:0}

/* ══ React Flow 容器与节点卡片 ══ */
.plp-rf-wrap{width:100%;height:100%;position:relative}
.plp-rf-wrap .react-flow{background:var(--dsw-alias-bg-base)}
.plp-rf-wrap .react-flow__edge-path{stroke:var(--dsw-alias-state-business-primary);stroke-width:1.8}
.plp-rf-wrap .react-flow__arrowhead polyline,.plp-rf-wrap .react-flow__arrowhead polygon,.plp-rf-wrap .react-flow__arrowhead path{fill:var(--dsw-alias-state-business-primary);stroke:var(--dsw-alias-state-business-primary)}
.plp-rf-handle{opacity:0;pointer-events:none;border:none;background:transparent;width:10px;height:10px}
.plp-rf-wrap .react-flow__node{width:320px}
.plp-rf-node{width:320px;box-sizing:border-box;background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;padding:10px 12px 6px;display:flex;flex-direction:column;gap:6px;cursor:pointer;position:relative;box-shadow:var(--dsw-shadow-lv2);transition:border-color 150ms cubic-bezier(.4,0,.2,1),box-shadow 150ms cubic-bezier(.4,0,.2,1)}
.plp-rf-node:hover{border-color:var(--dsw-alias-state-business-primary)}
.plp-rf-node-sel{border-color:var(--dsw-alias-state-business-primary);box-shadow:0 0 0 2px rgba(65,118,230,.18),var(--dsw-shadow-lv2)}
.plp-rf-node-head{display:flex;align-items:center;gap:6px;min-width:0}
.plp-rf-node-title{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.plp-rf-node-spacer{flex:1}
.plp-rf-node-summary{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--dsw-alias-label-tertiary);background:var(--dsw-alias-bg-layer-2);border-radius:6px;padding:4px 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.plp-rf-node-foot{display:flex;align-items:center;gap:4px;font-size:11px;color:var(--dsw-alias-label-tertiary)}
.plp-graph-type{font-size:10px;font-weight:600;padding:1px 6px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);flex:none;letter-spacing:.3px}
.plp-graph-type-input{background:var(--dsw-alias-state-success-secondary);color:var(--dsw-alias-state-success-primary)}
.plp-graph-type-output{background:var(--dsw-alias-state-warn-secondary);color:var(--dsw-alias-state-warn-label)}
.plp-graph-type-llm{background:var(--dsw-alias-interactive-bg-hover-accent);color:var(--dsw-alias-state-business-primary)}
.plp-graph-type-pipeline{background:var(--dsw-static-blue-100);color:var(--dsw-static-blue-900)}
.plp-graph-type-exec{background:var(--dsw-static-amber-100);color:var(--dsw-static-amber-900)}
.plp-graph-type-fetch{background:var(--dsw-static-green-100);color:var(--dsw-static-green-900)}
.plp-graph-deps{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.plp-graph-del{background:none;border:none;cursor:pointer;color:var(--dsw-alias-label-dimmed);font-size:15px;line-height:1;padding:2px 5px;border-radius:6px;flex:none}
.plp-graph-del:hover{background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-alias-state-error-primary)}
.plp-graph-move{background:none;border:none;cursor:pointer;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1;padding:2px 5px;border-radius:6px;flex:none}
.plp-graph-move:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.plp-graph-move:disabled{opacity:.3;cursor:default}
.plp-rf-port{position:absolute;left:50%;width:10px;height:10px;border-radius:50%;background:var(--dsw-alias-bg-base);border:2px solid var(--dsw-alias-state-business-primary);transform:translateX(-50%)}
.plp-rf-port-in{top:-6px}
.plp-rf-port-out{bottom:-6px}
.plp-rf-edge-add{width:20px;height:20px;border-radius:50%;border:1px dashed var(--dsw-alias-state-business-primary);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-state-business-primary);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;font-family:inherit}
.plp-rf-edge-add:hover{background:var(--dsw-alias-state-business-primary);color:#fff}
.plp-rf-hint{font-size:11px;color:var(--dsw-alias-label-tertiary);margin-left:10px}

/* ══ 类型选择网格 ══ */
.plp-type-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.plp-type-cell{display:flex;flex-direction:column;gap:4px;align-items:flex-start;padding:10px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-base);cursor:pointer;font-family:inherit;text-align:left;transition:border-color 150ms cubic-bezier(.4,0,.2,1)}
.plp-type-cell:hover{border-color:var(--dsw-alias-state-business-primary)}
.plp-type-desc{font-size:11px;color:var(--dsw-alias-label-tertiary)}

/* ══ 节点编辑面板 ══ */
.plp-nodepanel{display:flex;flex-direction:column;gap:4px}
.plp-dep-list{max-height:150px;overflow-y:auto;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:4px}
.plp-dep-item{display:flex;align-items:center;gap:6px;padding:4px 6px;border-radius:6px;font-size:12px;cursor:pointer}
.plp-dep-item:hover{background:var(--dsw-alias-interactive-bg-hover)}
.plp-dep-item input{margin:0}
.plp-dep-name{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.plp-dep-id{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;color:var(--dsw-alias-label-tertiary)}
.plp-cfg-hint{font-size:11px;color:var(--dsw-alias-label-tertiary);white-space:pre-wrap;word-break:break-all;background:var(--dsw-alias-bg-layer-2);border-radius:8px;padding:8px 10px;margin-top:6px}

/* ══ 宿主侧边栏入口（与「设置」入口同尺寸：34px 高 / 12px 圆角 / 同 padding-margin） ══ */
.plp-side-btn{box-sizing:border-box;width:calc(100% + 8px);height:34px;color:var(--dsw-alias-label-primary);cursor:pointer;background:none;border:none;border-radius:12px;flex:none;align-items:center;gap:8px;margin:4px -4px;padding:6px 2px 6px 10px;font-family:inherit;font-size:14px;line-height:22px;display:inline-flex;overflow:hidden;transition:background 150ms cubic-bezier(.4,0,.2,1)}
.plp-side-btn:hover{background:var(--dsw-alias-interactive-bg-hover)}
.plp-side-btn-on{color:var(--dsw-alias-state-business-primary)}
/* 折叠轨模式：与设置同款 36px 圆形图标按钮 */
.plp-side-btn-rail{border-radius:50%;justify-content:center;gap:0;width:36px;height:36px;margin:8px 0 10px;padding:0}
.plp-nav-icon{flex:none}

/* ══ 暗色主题适配 ══ */
body[data-ds-dark-theme] .plp-input:focus-visible,
body[data-ds-dark-theme] .plp-textarea:focus-visible,
body[data-ds-dark-theme] .plp-node-input:focus-visible{box-shadow:0 0 0 2px rgba(103,158,254,.25)}
body[data-ds-dark-theme] .plp-primary:hover{background:var(--dsw-static-deepseek-500);border-color:var(--dsw-static-deepseek-500)}
body[data-ds-dark-theme] .plp-rf-node-sel{box-shadow:0 0 0 2px rgba(103,158,254,.3),var(--dsw-shadow-lv2)}
`

/** React Flow 主题变量覆盖：对齐宿主 --dsw-* tokens（明暗自动适配） */
export const xyflowThemeCss = `
.react-flow{--xy-background-color:var(--dsw-alias-bg-base);--xy-edge-stroke:var(--dsw-alias-state-business-primary);--xy-edge-stroke-width:1.8;--xy-node-background-color:var(--dsw-alias-bg-base);--xy-node-border:var(--dsw-alias-border-l2);--xy-node-color:var(--dsw-alias-label-primary);--xy-handle-background-color:var(--dsw-alias-state-business-primary);--xy-controls-button-background-color:var(--dsw-alias-bg-base);--xy-controls-button-background-color-hover:var(--dsw-alias-interactive-bg-hover);--xy-controls-button-color:var(--dsw-alias-label-secondary);--xy-controls-button-color-hover:var(--dsw-alias-label-primary);--xy-controls-button-border-color:var(--dsw-alias-border-l2);--xy-attribution-background-color:transparent}
.react-flow__edge-path{stroke:var(--dsw-alias-state-business-primary) !important}
.react-flow__arrowhead path,.react-flow__arrowhead polyline{fill:var(--dsw-alias-state-business-primary) !important;stroke:var(--dsw-alias-state-business-primary) !important}
.react-flow__controls{border:1px solid var(--dsw-alias-border-l2);border-radius:8px;overflow:hidden;box-shadow:var(--dsw-shadow-lv2)}
`