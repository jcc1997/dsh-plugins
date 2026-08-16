// styles/base.ts — 基础样式：页面骨架、顶栏、按钮、表单、弹窗、滚动条、宿主侧边栏入口
// 全部直接引用 DSH 宿主 tokens（--dsw-*，明暗主题自动适配），见 packages/ui/DESIGN.md
export const baseCss = `
/* ══ 页面骨架 ══ */
.kbnb-page{position:fixed;inset:0;background:var(--dsw-alias-bg-base);display:flex;flex-direction:column;z-index:60;color:var(--dsw-alias-label-primary);pointer-events:auto;min-height:0}

/* ══ 顶栏 ══ */
.kbnb-header{display:flex;align-items:center;gap:12px;padding:14px 20px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none;background:var(--dsw-alias-bg-base)}
.kbnb-back{width:30px;height:30px;display:inline-flex;align-items:center;justify-content:center;border-radius:6px}
.kbnb-title{font-size:16px;font-weight:600;letter-spacing:.2px}
.kbnb-stats{font-size:12px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;padding:2px 10px;background:var(--dsw-alias-bg-layer-2);border-radius:999px}
.kbnb-saving{font-size:12px;color:var(--dsw-alias-label-tertiary);transition:opacity 150ms cubic-bezier(.4, 0, .2, 1)}
.kbnb-header-actions{margin-left:auto;display:flex;gap:8px}

/* ══ 按钮(宿主胶囊契约 components.md §二:r18/h36/padding 0 14;icon 按钮 28×28 圆形) ══ */
.kbnb-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:none;border-radius:18px;height:36px;padding:0 14px;font-size:14px;line-height:22px;cursor:pointer;color:var(--dsw-alias-label-primary);background:transparent;font-family:inherit;transition:background 150ms cubic-bezier(.4, 0, .2, 1)}
.kbnb-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.kbnb-btn:disabled{cursor:not-allowed;opacity:.4}
.kbnb-btn:focus-visible{outline:none;box-shadow:0 0 0 2px color-mix(in srgb, var(--dsw-alias-state-business-primary) 18%, transparent)}
.kbnb-primary{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground)}
.kbnb-primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover)}
.kbnb-danger{color:var(--dsw-alias-state-error-primary)}
.kbnb-danger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-danger)}
.kbnb-icon-btn{width:28px;height:28px;background:none;border:none;cursor:pointer;padding:0;border-radius:50%;color:var(--dsw-alias-label-secondary);display:inline-flex;align-items:center;justify-content:center;transition:background 150ms cubic-bezier(.4, 0, .2, 1)}
.kbnb-icon-btn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.kbnb-icon-btn:disabled{opacity:.3;cursor:default}
.kbnb-icon-btn:focus-visible{outline:none;box-shadow:0 0 0 2px color-mix(in srgb, var(--dsw-alias-state-business-primary) 18%, transparent)}

/* ══ 错误条 ══ */
.kbnb-error{background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-alias-state-error-primary);padding:8px 16px;font-size:13px;border-bottom:1px solid var(--dsw-alias-state-error-secondary)}

/* ══ 表单 ══ */
.kbnb-field{display:block;margin-bottom:16px}
.kbnb-field-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.kbnb-field-label{font-size:12px;color:var(--dsw-alias-label-secondary)}
/* 输入零高亮(ADR-2):focus/hover 不改边框不加 ring,caret 品牌蓝 */
.kbnb-input{display:block;width:100%;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:6px 8px;font-size:13px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-family:inherit;caret-color:var(--dsw-alias-state-business-primary)}
.kbnb-input:focus-visible{outline:none}
.kbnb-input::placeholder{color:var(--dsw-alias-label-dimmed)}
.kbnb-textarea{display:block;width:100%;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:6px 8px;font-size:13px;min-height:160px;font-family:inherit;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);resize:vertical;caret-color:var(--dsw-alias-state-business-primary)}
.kbnb-textarea:focus-visible{outline:none}
.kbnb-textarea::placeholder{color:var(--dsw-alias-label-dimmed)}

/* ══ 弹窗 ══ */
.kbnb-mask{position:fixed;inset:0;background:var(--dsw-alias-bg-mask-1);display:flex;align-items:center;justify-content:center;z-index:70;pointer-events:auto}
.kbnb-modal{background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:14px;box-shadow:var(--dsw-shadow-lv3);width:560px;max-width:90vw;max-height:85vh;display:flex;flex-direction:column;overflow:hidden}
.kbnb-modal-head{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--dsw-alias-border-l2)}
.kbnb-modal-title{font-size:15px;font-weight:600}
.kbnb-modal-body{padding:16px;overflow-y:auto}
.kbnb-modal-body .kbnb-input-title-editable{margin-bottom:16px}
.kbnb-modal-foot{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}

/* ══ 加载 / 空状态 ══ */
.kbnb-loading{padding:60px;text-align:center;color:var(--dsw-alias-label-tertiary)}
.kbnb-empty{margin:80px auto;color:var(--dsw-alias-label-tertiary);font-size:13px;text-align:center;line-height:1.8}
.kbnb-empty::before{content:"";display:block;width:44px;height:3px;border-radius:2px;background:var(--dsw-alias-interactive-bg-active);margin:0 auto 16px}

/* ══ 滚动条 ══ */
.kbnb-page *::-webkit-scrollbar{width:8px;height:8px}
.kbnb-page *::-webkit-scrollbar-thumb{background:var(--dsw-alias-scrollbar-bg-l1);border-radius:999px;border:2px solid transparent;background-clip:content-box}
.kbnb-page *::-webkit-scrollbar-thumb:hover{background:var(--dsw-alias-scrollbar-hover-l1);background-clip:content-box;border:2px solid transparent}
.kbnb-page *::-webkit-scrollbar-track{background:transparent}

/* ══ 宿主侧边栏入口（官方类覆盖，保持既有布局修正） ══ */
/* 与宿主「设置」入口（sidebar.settings trigger）同尺寸：34px 高 / 12px 圆角 / 同 padding-margin */
.kbnb-side-btn{box-sizing:border-box;width:calc(100% + 8px);height:34px;color:var(--dsw-alias-label-primary);cursor:pointer;background:none;border:none;border-radius:12px;flex:none;align-items:center;gap:8px;margin:4px -4px;padding:6px 2px 6px 10px;font-family:inherit;font-size:14px;line-height:22px;display:inline-flex;overflow:hidden;transition:background 150ms cubic-bezier(.4, 0, .2, 1)}
.kbnb-side-btn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.kbnb-side-btn-on{color:var(--dsw-alias-state-business-primary)}
.kbnb-side-btn-on:hover{color:var(--dsw-alias-state-business-primary)}
/* 折叠轨模式：与设置同款 36px 圆形图标按钮 */
.kbnb-side-btn-rail{border-radius:50%;justify-content:center;gap:0;width:36px;height:36px;margin:8px 0 10px;padding:0}
.Nqubda_layer{width:auto;flex:1 1 auto;min-width:0}
.hHd-Xa_footerActions{flex-direction:column;gap:4px}
.hHd-Xa_collapsed .hHd-Xa_footerActions{flex-direction:column;width:auto;align-items:center}

/* 暗色适配全由 alias tokens 承担,不写主题分支(docs/ui-design 红线) */
`;
