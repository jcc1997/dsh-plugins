// host/board.ts — 看板数据层：board.json 读写 + 卡片/列/归档/富文本内容操作（纯函数）
// 供 host/tools.ts（19 个 agent 工具）与 host/entry.ts（RPC/服务）共用；不依赖 harness/ctx。

export interface FsLike {
  resolve(path: string, opts?: { cwd?: string; signal?: unknown }): Promise<{ targetKey: string; displayPath: string }>
  readText(target: { targetKey: string }, signal?: unknown): Promise<string>
  writeText(target: { targetKey: string }, content: string, expected?: unknown, signal?: unknown, sandboxPolicy?: { mode: string }): Promise<unknown>
}

export const DEFAULT_DIR = '/Users/jinchao.chen/.dsh/kanban'
export const CONFIG_FILE = 'config.json'
export const BOARD_FILE = 'board.json'
export const WRITE_POLICY = { mode: 'danger-full-access' }
export const ACTOR_AGENT = 'agent'

/** 宿主会话标题缓存（session_projcache.json）；解析会话关联的真实名称用 */
export const SESSION_CACHE_DIR = '/Users/jinchao.chen/.dsh/storages'
export const SESSION_CACHE_FILE = 'session_projcache.json'

/** 读宿主会话标题表：sessionId → 会话标题（缺失/未生成返回空表；失败不阻塞调用方） */
export async function sessionTitleMap(fs: FsLike): Promise<Record<string, string>> {
  try {
    const target = await fs.resolve(SESSION_CACHE_DIR + '/' + SESSION_CACHE_FILE)
    const text = await fs.readText(target)
    const data = JSON.parse(text)
    const sessions = data && data.tables && data.tables.sessions
    if (!sessions || typeof sessions !== 'object') return {}
    const map: Record<string, string> = {}
    for (const id of Object.keys(sessions)) {
      const holder = sessions[id]
      const val = holder && holder.rows && holder.rows.title && holder.rows.title.val
      if (typeof val === 'string' && val.trim()) map[id] = val
    }
    return map
  } catch {
    return {}
  }
}

/** 把 Ticket 的会话关联 ref.display 解析为真实会话名（仅覆盖占位「本会话」/空值，尊重手动命名） */
export function decorateSessionRefs(ticket: any, titles: Record<string, string>): void {
  const refs: any[] = Array.isArray(ticket && ticket.refs) ? ticket.refs : []
  for (const r of refs) {
    if (!r || r.kind !== 'session' || !r.externalId) continue
    const name = titles[String(r.externalId)]
    if (name && (!r.display || r.display === '本会话')) r.display = name
  }
}

/** 整板会话关联名称补齐（load / get 出口统一处理，避免多处重复读宿主缓存） */
export async function decorateBoardSessionRefs(fs: FsLike, board: any): Promise<void> {
  if (!board) return
  const titles = await sessionTitleMap(fs)
  for (const col of board.columns || []) {
    for (const t of col.tickets || []) decorateSessionRefs(t, titles)
  }
  for (const t of board.archive || []) decorateSessionRefs(t, titles)
}

/** 缺板时的新板：3 个默认列 + 空归档 + 空模板（version 4 = 门禁/创建模板模型） */
export function defaultBoard(): any {
  const cols = ['待办', '进行中', '完成']
  return {
    version: 4,
    columns: cols.map((title) => ({ id: 'c' + Math.random().toString(36).slice(2, 10), title, tickets: [], meta: {} })),
    archive: [],
    templates: [],
    meta: {},
  }
}

/** 读板后归一化：补齐 v6 门禁库字段；内联 gates → 门禁库 + gateIds 引用（旧数据兼容） */
export function normalizeBoard(board: any): any {
  if (!board) return board
  if (!Array.isArray(board.archive)) board.archive = []
  if (!Array.isArray(board.templates)) board.templates = []
  if (!Array.isArray(board.gateLibrary)) board.gateLibrary = []
  const lib: any[] = board.gateLibrary
  const ensureGate = (g: any): string => {
    // 入库去重：同名 + 同 checker.type + 同 on + 同 to → 复用；否则新增
    if (!g.id || typeof g.id !== 'string') g.id = 'g' + Math.random().toString(36).slice(2, 10)
    const type = g.checker ? g.checker.type : g.kind
    const hit = lib.find((x) => x.name === g.name && (x.checker ? x.checker.type : x.kind) === type && x.on === g.on && String(x.to || '') === String(g.to || ''))
    if (hit) return hit.id
    lib.push(g)
    return g.id
  }
  const migrateHolder = (holder: any) => {
    if (!holder) return
    if (!Array.isArray(holder.gateIds)) holder.gateIds = []
    if (Array.isArray(holder.gates) && holder.gates.length > 0) {
      for (const g of holder.gates) {
        const id = ensureGate(g)
        if (!holder.gateIds.includes(id)) holder.gateIds.push(id)
      }
      // 内联已入库 + 引用已建 → 清掉内联副本，避免库引用与内联双重渲染/双重检查
      holder.gates = []
    }
  }
  for (const col of board.columns || []) {
    // 旧数据兼容：cards → tickets（破坏性升级后仅做读取兜底，避免旧 board.json 直接报错）
    if (!Array.isArray(col.tickets) && Array.isArray(col.cards)) col.tickets = col.cards
    if (!Array.isArray(col.tickets)) col.tickets = []
    delete col.cards
    for (const ticket of col.tickets) migrateHolder(ticket)
  }
  for (const ticket of board.archive || []) migrateHolder(ticket)
  for (const tpl of board.templates || []) migrateHolder(tpl)
  return board
}

export function now(): string {
  try { return new Date().toISOString() } catch { return '' }
}

export function safeId(prefix: string): string {
  try { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8) } catch { return prefix + Math.floor(Math.random() * 1e9).toString(36) }
}

/** 追加变更记录（agent 操作统一 actor="agent"；UI 走 client 侧 appendActivity=手动调整） */
export function appendActivity(ticket: any, text: string): void {
  if (!ticket.activity) ticket.activity = []
  ticket.activity.push({ id: safeId('a'), text, at: now(), actor: ACTOR_AGENT })
}

/** 读数据目录配置（config.json 的 dataDir，缺失/损坏 → 默认目录） */
export async function resolveDataDir(fs: FsLike): Promise<string> {
  try {
    const cfgTarget = await fs.resolve(DEFAULT_DIR + '/' + CONFIG_FILE)
    const text = await fs.readText(cfgTarget)
    const cfg = JSON.parse(text)
    if (cfg && typeof cfg.dataDir === 'string' && cfg.dataDir.length > 0) return cfg.dataDir
  } catch {
    /* 缺失/损坏 → 默认目录 */
  }
  return DEFAULT_DIR
}

export async function readBoard(fs: FsLike, dataDir: string): Promise<any | null> {
  try {
    const target = await fs.resolve(dataDir + '/' + BOARD_FILE)
    const text = await fs.readText(target)
    return normalizeBoard(JSON.parse(text))
  } catch {
    return null
  }
}

export async function writeBoard(fs: FsLike, dataDir: string, board: unknown): Promise<void> {
  const target = await fs.resolve(dataDir + '/' + BOARD_FILE)
  await fs.writeText(target, JSON.stringify(board, null, 2), undefined, undefined, WRITE_POLICY)
}

/** 读-改-写原子操作：fn 返回 null 表示失败（如卡片不存在）；board 自动补齐 archive */
export async function mutateBoard(fs: FsLike, fn: (board: any) => any): Promise<any> {
  try {
    const dataDir = await resolveDataDir(fs)
    const board = normalizeBoard((await readBoard(fs, dataDir)) || defaultBoard())
    const result = fn(board)
    if (result === null) return { ok: false, error: 'not found' }
    await writeBoard(fs, dataDir, board)
    return { ok: true, ...(result || {}) }
  } catch (e) {
    return { ok: false, error: String(e && (e as Error).message ? (e as Error).message : e) }
  }
}

/** 按 id 找卡片（仅活动列） */
export function findTicketGlobal(board: any, ticketId: string): { col: any; ticket: any } | null {
  for (const col of board.columns || []) {
    const ticket = (col.tickets || []).find((k: any) => k.id === ticketId)
    if (ticket) return { col, ticket }
  }
  return null
}

/** 按 id 找卡片（含归档；命中归档时 col=null、archived=true） */
export function findTicketAny(board: any, ticketId: string): { col: any; ticket: any; archived: boolean } | null {
  const hit = findTicketGlobal(board, ticketId)
  if (hit) return { col: hit.col, ticket: hit.ticket, archived: false }
  const ticket = (board.archive || []).find((k: any) => k.id === ticketId)
  if (ticket) return { col: null, ticket, archived: true }
  return null
}

/** 按列名或列 id 解析列；status 缺省 → 第一列 */
export function resolveColumn(board: any, status?: string): any {
  if (!status) return (board.columns || [])[0]
  return (board.columns || []).find((c: any) => c.id === status || c.title === status) || null
}

/** 卡片概要（agent 工具返回的轻量视图）；col=null 表示归档 */
export function ticketSummary(ticket: any, col: any): any {
  return {
    id: ticket.id,
    title: ticket.title,
    status: col ? col.title : '归档',
    column_id: col ? col.id : null,
    tags: ticket.tags || [],
    updatedAt: ticket.updatedAt,
    createdAt: ticket.createdAt,
  }
}

/** content 归一化：数组 → 清洗后的块数组；字符串 → 单文本块；其他 → 空 */
export function normalizeContent(raw: any): any[] {
  if (Array.isArray(raw)) {
    const out: any[] = []
    for (const b of raw) {
      if (b && typeof b === 'object' && typeof b.type === 'string') {
        out.push({
          id: typeof b.id === 'string' && b.id ? b.id : safeId('blk'),
          type: b.type,
          text: typeof b.text === 'string' ? b.text : '',
          ...(typeof b.url === 'string' ? { url: b.url } : {}),
          ...(typeof b.checked === 'boolean' ? { checked: b.checked } : {}),
        })
      }
    }
    return out
  }
  if (typeof raw === 'string' && raw.trim()) return [{ id: safeId('blk'), type: 'text', text: raw }]
  return []
}

/** 富文本块数组 → 纯文本（keyword 匹配 / agent 展示用） */
export function contentText(ticket: any): string {
  const blocks = Array.isArray(ticket.content) ? ticket.content : []
  return blocks
    .map((b: any) => {
      if (b.type === 'image') return b.url ? '[图片]' : ''
      if (b.type === 'divider') return '---'
      const t = typeof b.text === 'string' ? b.text.replace(/<[^>]+>/g, ' ').trim() : ''
      return (b.type === 'check' ? (b.checked ? '[x] ' : '[ ] ') : '') + t
    })
    .filter((s: string) => s)
    .join('\n')
}

/** 卡片的 git 仓库（github-repo ref externalId），无则空串（分组/筛选用） */
export function ticketRepo(ticket: any): string {
  const refs: any[] = Array.isArray(ticket.refs) ? ticket.refs : []
  const r = refs.find((x) => x.kind === 'github-repo')
  return r && r.externalId ? String(r.externalId) : ''
}
