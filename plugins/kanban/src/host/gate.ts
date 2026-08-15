// host/gate.ts — 门禁引擎（v4）：卡片行为（move/tags/archive）触发前检查
// 门禁挂在 card.gates（或经创建模板带入）。检查结果：{ ok, failed: [{name, reason}] }，不通过则拒绝动作。
// 条件类型：
//   mr-merged       关联的 GitHub MR 必须已合并（读 card refs：github-repo + github-mr；GitHub API 原生 fetch + GITHUB_TOKEN）
//   tag-required    卡片必须包含指定标签（config.tags）
//   field-nonempty  卡片字段非空（config.field，如 description）
import { CardGate } from '@dsh-plugins/ui'

export type GateAction = 'move' | 'tags' | 'archive'

export interface GateCheckDeps {
  /** 解析 GITHUB_TOKEN（宿主 credentials，ref 名 GITHUB_TOKEN） */
  getToken(): Promise<string | undefined>
}

export interface GateFailure {
  name: string
  kind: string
  reason: string
}

/** 匹配某动作应触发的门禁（on 相等；move 可限目标列 config.to） */
export function gatesFor(card: any, action: GateAction, extra?: { to?: string }): CardGate[] {
  const gates: CardGate[] = Array.isArray(card && card.gates) ? card.gates : []
  return gates.filter((g) => {
    if (g.on !== action) return false
    if (action === 'move' && g.config && typeof g.config.to === 'string' && g.config.to) {
      return String(g.config.to) === String(extra && extra.to)
    }
    return true
  })
}

/** 检查单个门禁；通过返回 null，否则返回失败原因 */
async function checkOne(gate: CardGate, card: any, deps: GateCheckDeps, extra?: { to?: string }): Promise<GateFailure | null> {
  if (gate.kind === 'tag-required') {
    const required: string[] = (gate.config && Array.isArray(gate.config.tags) ? gate.config.tags : []).map(String)
    const have: string[] = Array.isArray(card.tags) ? card.tags : []
    const missing = required.filter((t) => t && !have.includes(t))
    if (missing.length > 0) {
      return { name: gate.name || gate.kind, kind: gate.kind, reason: '缺少必需标签：' + missing.join(', ') }
    }
    return null
  }
  if (gate.kind === 'field-nonempty') {
    const field = String((gate.config && gate.config.field) || 'description')
    const val = card[field]
    if (typeof val !== 'string' || val.trim() === '') {
      return { name: gate.name || gate.kind, kind: gate.kind, reason: '字段「' + field + '」为空' }
    }
    return null
  }
  if (gate.kind === 'mr-linked') {
    const refs: any[] = Array.isArray(card.refs) ? card.refs : []
    const repoRef = refs.find((r) => r.kind === 'github-repo')
    const mrRefs = refs.filter((r) => r.kind === 'github-mr' && r.externalId)
    const snap = card.meta && card.meta.sync && card.meta.sync.github && card.meta.sync.github.snapshot
    const snapMrs = snap && Array.isArray(snap.mrs) ? snap.mrs : []
    if (!repoRef || !repoRef.externalId) {
      return { name: gate.name || gate.kind, kind: gate.kind, reason: '卡片未关联 GitHub 仓库（github-repo）' }
    }
    if (mrRefs.length === 0 && snapMrs.length === 0) {
      return { name: gate.name || gate.kind, kind: gate.kind, reason: '卡片未关联 MR（github-mr）——请先 git_link 建 MR 关联' }
    }
    return null
  }
  if (gate.kind === 'mr-merged') {
    const refs: any[] = Array.isArray(card.refs) ? card.refs : []
    const repoRef = refs.find((r) => r.kind === 'github-repo')
    const mrRefs = refs.filter((r) => r.kind === 'github-mr' && r.externalId)
    if (!repoRef || !repoRef.externalId) {
      return { name: gate.name || gate.kind, kind: gate.kind, reason: '卡片未关联 GitHub 仓库（github-repo）' }
    }
    if (mrRefs.length === 0) {
      return { name: gate.name || gate.kind, kind: gate.kind, reason: '卡片未关联 MR（github-mr）' }
    }
    const repo = String(repoRef.externalId)
    const token = await deps.getToken().catch(() => undefined)
    const headers: Record<string, string> = { Accept: 'application/vnd.github+json' }
    if (token) headers.Authorization = 'Bearer ' + token
    const unmerged: string[] = []
    for (const mr of mrRefs) {
      const n = String(mr.externalId).replace('#', '').trim()
      try {
        const res = await fetch('https://api.github.com/repos/' + encodeURIComponent(repo.split('/')[0]) + '/' + encodeURIComponent(repo.split('/')[1] || '') + '/pulls/' + encodeURIComponent(n), { headers })
        if (res.status === 404) { unmerged.push('#' + n + '（不存在）'); continue }
        if (res.status === 403 || res.status === 429) { unmerged.push('#' + n + '（API 限流/无权限）'); continue }
        const body: any = await res.json().catch(() => null)
        if (!body || body.merged !== true) unmerged.push('#' + n + (body && body.state === 'open' ? '（未合并）' : '（未合并）'))
      } catch (e) {
        unmerged.push('#' + n + '（查询失败：' + String((e as Error).message) + '）')
      }
    }
    if (unmerged.length > 0) {
      return { name: gate.name || gate.kind, kind: gate.kind, reason: 'MR 未全部合并：' + unmerged.join(', ') }
    }
    return null
  }
  return { name: gate.name || gate.kind, kind: gate.kind, reason: '未知门禁类型：' + gate.kind }
}

/** 检查卡片上匹配 action 的全部门禁；任一失败即拒绝 */
export async function checkGates(
  card: any,
  action: GateAction,
  deps: GateCheckDeps,
  extra?: { to?: string },
): Promise<{ ok: boolean; failed: GateFailure[] }> {
  const gates = gatesFor(card, action, extra)
  if (gates.length === 0) return { ok: true, failed: [] }
  const failed: GateFailure[] = []
  for (const g of gates) {
    const f = await checkOne(g, card, deps, extra)
    if (f) failed.push(f)
  }
  return { ok: failed.length === 0, failed }
}

/** 校验门禁定义（新增时输入合法性） */
export function validateGate(gate: any): string | null {
  if (!gate || typeof gate !== 'object') return '门禁定义缺失'
  if (!['mr-merged', 'mr-linked', 'tag-required', 'field-nonempty'].includes(gate.kind)) return '未知门禁类型：' + gate.kind
  if (!['move', 'tags', 'archive'].includes(gate.on)) return '未知触发行为：' + gate.on
  if (gate.kind === 'tag-required' && (!gate.config || !Array.isArray(gate.config.tags) || gate.config.tags.length === 0)) return 'tag-required 需要 config.tags 数组'
  if (gate.kind === 'field-nonempty' && (!gate.config || !gate.config.field)) return 'field-nonempty 需要 config.field'
  return null
}

/** 门禁默认配置（按 kind） */
export function gateDefaults(kind: string): Record<string, unknown> {
  if (kind === 'tag-required') return { tags: [] }
  if (kind === 'field-nonempty') return { field: 'description' }
  if (kind === 'mr-linked') return {}
  if (kind === 'mr-merged') return {}
  return {}
}
