// styles/index.ts — 看板全部样式汇总（按模块拆分，拼接后经 styles.insert 注入）
// 设计规范见 packages/ui/DESIGN.md：直接引用宿主 --dsw-* tokens，禁止硬编码颜色/间距
import { baseCss } from './base'
import { boardCss } from './board'
import { drawerCss } from './drawer'
import { editorCss } from './editor'

export const kbnbCss = baseCss + boardCss + drawerCss + editorCss
