// client/board-util.ts — 看板纯函数（无 hooks）：content 归一化 + git 仓库提取
// 与 host/board.ts 的 normalizeContent/cardRepo 语义一致（两端各自独立实现，避免跨包依赖）
import { safeId } from '@dsh-plugins/ui'
import { KanbanBlock } from '@dsh-plugins/ui'

/** content 归一化：数组清洗；字符串转单文本块 */
export function normalizeContent(raw: unknown): KanbanBlock[] {
  if (Array.isArray(raw)) {
    const out: KanbanBlock[] = []
    for (const b of raw) {
      if (b && typeof b === 'object' && typeof (b as any).type === 'string') {
        out.push({
          id: typeof (b as any).id === 'string' && (b as any).id ? (b as any).id : safeId('blk'),
          type: (b as any).type,
          text: typeof (b as any).text === 'string' ? (b as any).text : '',
          ...(typeof (b as any).url === 'string' ? { url: (b as any).url } : {}),
          ...(typeof (b as any).checked === 'boolean' ? { checked: (b as any).checked } : {}),
        })
      }
    }
    return out
  }
  if (typeof raw === 'string' && raw.trim()) return [{ id: safeId('blk'), type: 'text', text: raw }]
  return []
}

/** 卡片的 git 仓库（github-repo ref externalId），无则空串（分组/筛选用） */
export function cardRepoOf(card: any): string {
  const refs: any[] = Array.isArray(card.refs) ? card.refs : []
  const r = refs.find((x) => x.kind === 'github-repo')
  return r && r.externalId ? String(r.externalId) : ''
}
