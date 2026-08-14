// styles/base.ts — 基础样式：页面骨架、顶栏、按钮、表单、弹窗、滚动条、宿主侧边栏入口
// 全部直接引用 DSH 宿主 tokens（--dsw-*，明暗主题自动适配），见 packages/ui/DESIGN.md
export const baseCss = `
/* ══ 页面骨架 ══ */
.kbnb-page{position:fixed;inset:0;background:var(--dsw-alias-bg-base);display:flex;flex-direction:column;z-index:60;color:var(--dsw-alias-label-primary);pointer-events:auto;min-height:0}

/* ══ 顶栏 ══ */
.kbnb-header{display:flex;align-items:center;gap:12px;padding:14px 20px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none;background:var(--dsw-alias-bg-base)}
.kbnb-back{width:30px;height:30px;display:inline-flex;align-items:center;justify-content:center;border-radius:6px}
.kbnb-title{font-size:17px;font-weight:600;letter-spacing:.2px}
.kbnb-stats{font-size:12px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;padding:2px 10px;background:var(--dsw-alias-bg-layer-2);border-radius:999px}
.kbnb-saving{font-size:12px;color:var(--dsw-alias-label-tertiary);transition:opacity 150ms cubic-bezier(.4, 0, .2, 1)}
.kbnb-header-actions{margin-left:auto;display:flex;gap:8px}

/* ══ 按钮 ══ */
.kbnb-btn{background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:6px 14px;font-size:13px;cursor:pointer;color:var(--dsw-alias-label-primary);transition:all 150ms cubic-bezier(.4, 0, .2, 1);font-family:inherit}
.kbnb-btn:hover{background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-border-l3)}
.kbnb-btn:disabled{opacity:.5;cursor:default;pointer-events:none}
.kbnb-btn:focus-visible{outline:none;box-shadow:0 0 0 2px rgba(65, 118, 230, .18)}
.kbnb-primary{background:var(--dsw-alias-state-business-primary);border-color:var(--dsw-alias-state-business-primary);color:#fff}
.kbnb-primary:hover{background:var(--dsw-static-deepseek-600);border-color:var(--dsw-static-deepseek-600)}
.kbnb-danger{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-secondary)}
.kbnb-danger:hover{background:var(--dsw-alias-interactive-bg-hover-danger);border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary)}
.kbnb-icon-btn{background:none;border:none;cursor:pointer;padding:5px;border-radius:6px;color:var(--dsw-alias-label-secondary);display:inline-flex;align-items:center;justify-content:center;transition:all 150ms cubic-bezier(.4, 0, .2, 1)}
.kbnb-icon-btn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.kbnb-icon-btn:disabled{opacity:.3;cursor:default}

/* ══ 错误条 ══ */
.kbnb-error{background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-alias-state-error-primary);padding:8px 16px;font-size:13px;border-bottom:1px solid var(--dsw-alias-state-error-secondary)}

/* ══ 表单 ══ */
.kbnb-field{display:block;margin-bottom:16px}
.kbnb-field-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.kbnb-field-label{font-size:12px;color:var(--dsw-alias-label-secondary)}
.kbnb-input{display:block;width:100%;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:8px 10px;font-size:13px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);transition:all 150ms cubic-bezier(.4, 0, .2, 1);font-family:inherit}
.kbnb-input:hover{border-color:var(--dsw-alias-border-l3)}
.kbnb-input:focus-visible{outline:none;border-color:var(--dsw-alias-state-business-primary);box-shadow:0 0 0 2px rgba(65, 118, 230, .18)}
.kbnb-input::placeholder{color:var(--dsw-alias-label-dimmed)}
.kbnb-textarea{display:block;width:100%;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:8px 10px;font-size:13px;min-height:160px;font-family:inherit;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);transition:all 150ms cubic-bezier(.4, 0, .2, 1);resize:vertical}
.kbnb-textarea:hover{border-color:var(--dsw-alias-border-l3)}
.kbnb-textarea:focus-visible{outline:none;border-color:var(--dsw-alias-state-business-primary);box-shadow:0 0 0 2px rgba(65, 118, 230, .18)}
.kbnb-textarea::placeholder{color:var(--dsw-alias-label-dimmed)}

/* ══ 弹窗 ══ */
.kbnb-mask{position:fixed;inset:0;background:var(--dsw-alias-bg-mask-1);display:flex;align-items:center;justify-content:center;z-index:70;pointer-events:auto}
.kbnb-modal{background:var(--dsw-alias-bg-base);border-radius:14px;box-shadow:var(--dsw-shadow-lv3);width:480px;max-width:90vw;max-height:85vh;display:flex;flex-direction:column;overflow:hidden}
.kbnb-modal-head{display:flex;align-items:center;justify-content:space-between;padding:16px 16px 12px;border-bottom:1px solid var(--dsw-alias-border-l2)}
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
.kbnb-side-btn{box-sizing:border-box;width:100%;height:49px;color:var(--dsw-alias-label-primary);cursor:pointer;background:none;border:none;border-radius:8px;align-items:center;gap:8px;padding:0 8px 0 6px;font-family:inherit;font-size:13px;display:inline-flex;overflow:hidden;line-height:20px;transition:background 150ms cubic-bezier(.4, 0, .2, 1)}
.kbnb-side-btn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.kbnb-side-btn-on{color:var(--dsw-alias-state-business-primary)}
.kbnb-side-btn-on:hover{color:var(--dsw-alias-state-business-primary)}
.Nqubda_layer{width:auto;flex:1 1 auto;min-width:0}
.hHd-Xa_footerActions{flex-direction:column;gap:4px}
.hHd-Xa_collapsed .hHd-Xa_footerActions{flex-direction:column;width:auto;align-items:center}

/* ══ 暗色主题适配段（官方模式：body[data-ds-dark-theme] 覆盖；品牌蓝改为亮蓝 deepseek-400 系，保持与 alias state-business-primary 一致） ══ */
body[data-ds-dark-theme] .kbnb-btn:focus-visible,
body[data-ds-dark-theme] .kbnb-input:focus-visible,
body[data-ds-dark-theme] .kbnb-textarea:focus-visible,
body[data-ds-dark-theme] .kbnb-status-select:focus-visible{box-shadow:0 0 0 2px rgba(103, 158, 254, .25)}
body[data-ds-dark-theme] .kbnb-primary:hover{background:var(--dsw-static-deepseek-500);border-color:var(--dsw-static-deepseek-500)}
body[data-ds-dark-theme] .kbnb-tag,
body[data-ds-dark-theme] .kbnb-activity-actor,
body[data-ds-dark-theme] .kbnb-arch-col,
body[data-ds-dark-theme] .kbnb-add-card:hover{background:rgba(103, 158, 254, .12)}
body[data-ds-dark-theme] .kbnb-drop-line{box-shadow:0 0 6px rgba(103, 158, 254, .3)}
body[data-ds-dark-theme] .kbnb-arch-row{box-shadow:none}
body[data-ds-dark-theme] .kbnb-card-active{box-shadow:0 0 0 1px var(--dsw-alias-state-business-primary),0 2px 8px rgba(0, 0, 0, .45)}
`;
