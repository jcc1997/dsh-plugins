// styles/editor.ts — 块富文本编辑器样式（工具栏/块类型/图片/待办）
export const editorCss = `
.kbnb-rt{padding:4px 0 8px}
/* Notion 式：编辑器无边框无背景（设计规范：禁 input 框式 UI） */
.kbnb-rt:focus-within{}
.kbnb-rt-toolbar{display:flex;align-items:center;gap:3px;flex-wrap:wrap;padding-bottom:6px;border-bottom:1px dashed var(--dsw-alias-border-l2);margin-bottom:4px}
.kbnb-rt-btn{background:none;border:none;cursor:pointer;font-size:12px;color:var(--dsw-alias-label-secondary);border-radius:6px;padding:4px 7px;font-family:inherit;line-height:1.4;transition:all 150ms cubic-bezier(.4, 0, .2, 1)}
.kbnb-rt-btn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.kbnb-rt-btn:disabled{opacity:.35;cursor:default;pointer-events:none}
.kbnb-rt-b{font-weight:700}
.kbnb-rt-i{font-style:italic}
.kbnb-rt-s{text-decoration:line-through}
.kbnb-rt-c{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
.kbnb-rt-sep{width:1px;height:16px;background:var(--dsw-alias-border-l2);margin:0 5px;flex:none}
.kbnb-rt-hint{margin-left:auto;font-size:11px;color:var(--dsw-alias-label-tertiary);padding-right:2px}
.kbnb-rt-empty{color:var(--dsw-alias-label-tertiary);font-size:13px;padding:10px 4px;cursor:text}
.kbnb-rt-block{display:flex;align-items:flex-start;gap:6px;padding:2px 4px;border-radius:6px;position:relative}
/* 悬浮行高亮（Notion 式）：默认无背景，hover/active 才显 */
.kbnb-rt-block:hover{background:var(--dsw-alias-interactive-bg-hover)}
.kbnb-rt-on{background:var(--dsw-alias-interactive-bg-hover)}
.kbnb-rt-editable{flex:1;min-width:0;outline:none;font-size:14px;line-height:1.7;word-break:break-word;padding:2px 0;color:var(--dsw-alias-label-primary)}
.kbnb-rt-editable code{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:4px;padding:0 4px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.9em}
.kbnb-rt-editable b,.kbnb-rt-editable strong{font-weight:600}
.kbnb-rt-h1{font-size:22px;font-weight:700;line-height:1.4}
.kbnb-rt-h2{font-size:18px;font-weight:700;line-height:1.4}
.kbnb-rt-h3{font-size:15px;font-weight:600;line-height:1.4}
.kbnb-rt-marker{flex:none;min-width:20px;text-align:right;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;line-height:1.9;font-size:13.5px}
.kbnb-rt-quote{border-left:3px solid var(--dsw-alias-border-l2);padding-left:10px;color:var(--dsw-alias-label-secondary)}
.kbnb-rt-code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12.5px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:6px;padding:8px 10px;white-space:pre-wrap;color:var(--dsw-alias-label-primary)}
.kbnb-rt-divider-wrap{display:block;padding:8px 4px 4px}
.kbnb-rt-divider{border:none;border-top:1px solid var(--dsw-alias-border-l2);margin:0}
.kbnb-rt-imgwrap{display:block;padding:4px}
.kbnb-rt-img{max-width:100%;max-height:340px;border-radius:8px;display:block;border:1px solid var(--dsw-alias-border-l2)}
.kbnb-rt-img-missing{color:var(--dsw-alias-label-tertiary);font-size:12px}
.kbnb-rt-remove{position:absolute;top:6px;right:6px;display:none;align-items:center;justify-content:center;width:22px;height:22px;border-radius:6px;border:none;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);cursor:pointer;font-size:14px;line-height:1;box-shadow:var(--dsw-shadow-lv2)}
.kbnb-rt-block:hover .kbnb-rt-remove{display:inline-flex}
.kbnb-rt-remove:hover{color:var(--dsw-alias-state-error-primary)}
.kbnb-rt-check{display:flex;align-items:flex-start;gap:8px}
.kbnb-rt-checkbox{flex:none;width:15px;height:15px;border:1px solid var(--dsw-alias-border-l2);border-radius:4px;margin-top:6px;cursor:pointer;background:var(--dsw-alias-bg-base);transition:all 150ms cubic-bezier(.4, 0, .2, 1);box-sizing:border-box}
.kbnb-rt-checkbox:hover{border-color:var(--dsw-alias-state-business-primary)}
.kbnb-rt-checkbox.kbnb-rt-checked{background:var(--dsw-alias-state-business-primary);border-color:var(--dsw-alias-state-business-primary)}
.kbnb-rt-done{color:var(--dsw-alias-label-tertiary);text-decoration:line-through}
`;
