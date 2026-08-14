// git 插件宿主半（M2 骨架）：git 服务 + agent 工具
// 能力：git_configure（远端 repo / 本地路径 / token）、git_claim_task_id（[ID] 约定）、
//       git_link（带验证关联）、git_list_mrs / git_sync（GitHub API + [ID] 自动关联）、git_status
// 数据：~/.dsh/git/config.json；凭证走宿主 credentials（ref 名 GITHUB_TOKEN）；
//       GitHub API 优先 bash(curl)+token，退化 ctx.web 匿名抓取；卡片读写走跨插件 kanban 服务
interface FsLike {
  resolve(path: string, opts?: { cwd?: string; signal?: unknown }): Promise<{ targetKey: string; displayPath?: string }>
  readText(target: { targetKey: string }, signal?: unknown): Promise<string>
  writeText(target: { targetKey: string }, content: string, expected?: unknown, signal?: unknown, sandboxPolicy?: { mode: string }): Promise<unknown>
}
interface CredLike {
  resolve(ref: string): Promise<{ value: string; source: string } | undefined>
  describe(ref: string): Promise<{ configured: boolean; writable: boolean }>
  set(ref: string, value: string): Promise<void>
  unset(ref: string): Promise<void>
}
interface BashLike {
  run(spec: { command: string; workdir: string; timeoutMs: number; stdoutMaxBytes: number; env?: Record<string, string>; sandboxPolicy?: { mode: string } }): Promise<{ exitCode: number | null; stdout: { text: string; truncated: boolean } }>
}
interface WebLike {
  fetch(req: { url: string }, signal?: unknown): Promise<{ statusCode: number; body: { kind: string; content: string }; truncated: boolean }>
}
interface KanbanLike {
  getCard(cardId: string): Promise<any | null>
  updateCard(cardId: string, patch: any): Promise<{ ok: boolean; error?: string }>
  listCards(): Promise<Array<{ id: string; title: string; taskId: string | null }>>
}
interface HarnessLike {
  handle(method: string, handler: (args: unknown) => unknown): void
  defineTool(definition: unknown): unknown
  registerTool(ctx: unknown, tool: unknown): () => void
}
declare const harness: HarnessLike

const TOKEN_REF = 'GITHUB_TOKEN'
const DEFAULT_DIR = '/Users/jinchao.chen/.dsh/git'
const CONFIG_FILE = 'config.json'
const WRITE_POLICY = { mode: 'danger-full-access' }
// [ID] 约定：taskId 格式 <repo-name>-<int>（PLAN §5.5）
const TASK_ID_RE = /^([A-Za-z0-9_.-]+)-([0-9]+)$/
const MR_ID_RE = /\[([A-Za-z0-9_.-]+-[0-9]+)\]/g

function makePlugin() {
  return {
    name: 'git',
    apply(ctx: { get(name: string): unknown; provide(name: string, value: unknown): unknown; effect(cb: () => unknown): unknown }) {
      const fs = ctx.get('fs') as FsLike | undefined
      const credentials = ctx.get('credentials') as CredLike | undefined
      const bash = (ctx.get('bash') as BashLike | undefined) || (ctx.get('shell') as BashLike | undefined)
      const web = ctx.get('web') as WebLike | undefined
      // kanban 服务按调用时懒解析（可能后激活）
      const kanbanSvc = () => ctx.get('kanban') as KanbanLike | undefined

      function now(): string {
        try { return new Date().toISOString() } catch { return '' }
      }

      /* ── 配置 ── */
      async function readConfig(): Promise<any> {
        if (!fs) return {}
        try {
          const target = await fs.resolve(DEFAULT_DIR + '/' + CONFIG_FILE)
          return JSON.parse(await fs.readText(target))
        } catch { return {} }
      }
      async function writeConfig(cfg: any): Promise<void> {
        if (!fs) throw new Error('fs service unavailable')
        const target = await fs.resolve(DEFAULT_DIR + '/' + CONFIG_FILE)
        await fs.writeText(target, JSON.stringify(cfg, null, 2), undefined, undefined, WRITE_POLICY)
      }

      /* ── GitHub API：bash(curl)+token 优先，退化 ctx.web 匿名 ── */
      async function ghFetch(owner: string, repo: string, apiPath: string): Promise<{ ok: boolean; data?: any; httpStatus?: number; error?: string }> {
        const url = 'https://api.github.com/repos/' + encodeURIComponent(owner) + '/' + encodeURIComponent(repo) + '/' + apiPath
        let token: string | undefined
        if (credentials) {
          try {
            const resolved = await credentials.resolve(TOKEN_REF)
            if (resolved && resolved.value) token = resolved.value
          } catch { token = undefined }
        }
        if (bash) {
          try {
            const auth = token ? ' -H "Authorization: Bearer $GITHUB_TOKEN"' : ''
            const cmd = 'curl -sS -H "Accept: application/vnd.github+json"' + auth + ' -w "\n%{http_code}" ' + JSON.stringify(url)
            const spec: any = { command: cmd, workdir: '/', timeoutMs: 20000, stdoutMaxBytes: 4000000, sandboxPolicy: WRITE_POLICY }
            if (token) spec.env = { GITHUB_TOKEN: token }
            const res = await bash.run(spec)
            const text = (res.stdout && res.stdout.text) || ''
            const lines = text.split('\n')
            const status = parseInt(lines[lines.length - 1], 10) || 0
            const body = lines.slice(0, -1).join('\n').trim()
            if (!body) return { ok: false, error: 'empty response (status ' + status + ')' }
            const data = JSON.parse(body)
            if (status >= 200 && status < 300) return { ok: true, data, httpStatus: status }
            return { ok: false, httpStatus: status, error: (data && (data.message || JSON.stringify(data))) || 'HTTP ' + status }
          } catch (e) {
            return { ok: false, error: 'api error: ' + String(e && (e as Error).message ? (e as Error).message : e) }
          }
        }
        if (web) {
          try {
            const res = await web.fetch({ url })
            const bodyText = res.body && res.body.content ? res.body.content : ''
            if (res.statusCode >= 200 && res.statusCode < 300) {
              let data: any = null
              try { data = JSON.parse(bodyText) } catch { data = null }
              if (data) return { ok: true, data, httpStatus: res.statusCode }
              return { ok: false, error: 'web fallback returned non-JSON (status ' + res.statusCode + ')' }
            }
            return { ok: false, httpStatus: res.statusCode, error: 'HTTP ' + res.statusCode }
          } catch (e) {
            return { ok: false, error: 'web fetch failed: ' + String(e && (e as Error).message ? (e as Error).message : e) }
          }
        }
        return { ok: false, error: 'no network capability (inject bash or web)' }
      }

      /* ── [ID] 解析 ── */
      function parseTaskIds(text: string): string[] {
        const out: string[] = []
        if (!text) return out
        MR_ID_RE.lastIndex = 0
        let m: RegExpExecArray | null
        while ((m = MR_ID_RE.exec(text)) !== null) {
          const id = m[1]
          if (TASK_ID_RE.test(id) && !out.includes(id)) out.push(id)
        }
        return out
      }
      function normalizeTaskId(id: string): string {
        return String(id || '').toLowerCase()
      }

      /* ── 仓库解析：卡片 refs → 配置 → 入参 ── */
      function repoFromCard(card: any): { owner: string; name: string } | null {
        const refs: any[] = card && Array.isArray(card.refs) ? card.refs : []
        for (const r of refs) {
          if (r.kind === 'github-repo' && r.externalId) {
            const parts = String(r.externalId).split('/')
            if (parts.length === 2 && parts[0] && parts[1]) return { owner: parts[0], name: parts[1] }
          }
        }
        return null
      }
      function branchFromCard(card: any): string | null {
        const refs: any[] = card && Array.isArray(card.refs) ? card.refs : []
        for (const r of refs) if (r.kind === 'github-branch' && r.display) return r.display
        return null
      }
      function taskIdOf(card: any): string | null {
        const meta = card && card.meta && typeof card.meta === 'object' ? card.meta : {}
        return meta.taskId ? String(meta.taskId) : null
      }

      /* ── 认领 taskId（[ID] 约定：<repo-name>-<int>） ── */
      async function claimTaskId(cardId: string): Promise<any> {
        const kanban = kanbanSvc()
        if (!kanban) return { ok: false, error: 'kanban service unavailable（先激活 kanban 插件）' }
        const card = await kanban.getCard(cardId)
        if (!card) return { ok: false, error: 'card not found: ' + cardId }
        const existing = taskIdOf(card)
        if (existing) return { ok: true, card_id: cardId, taskId: existing, reused: true }
        const repo = repoFromCard(card)
        const repoName = repo ? repo.name : (await readConfig()).repo ? (await readConfig()).repo.name : 'task'
        let max = 0
        try {
          const all = await kanban.listCards()
          for (const c of all || []) {
            const tid = c.taskId ? String(c.taskId) : ''
            const m = TASK_ID_RE.exec(tid)
            if (m && m[1].toLowerCase() === String(repoName).toLowerCase()) max = Math.max(max, parseInt(m[2], 10) || 0)
          }
        } catch { max = 0 }
        const taskId = repoName + '-' + (max + 1)
        const res = await kanban.updateCard(cardId, { meta: { taskId }, activity: '认领任务 ID：' + taskId })
        if (!res.ok) return { ok: false, error: res.error || 'updateCard failed' }
        return { ok: true, card_id: cardId, taskId, reused: false }
      }

      /* ── 关联（带验证） ── */
      async function linkRef(cardId: string, spec: any): Promise<any> {
        const kanban = kanbanSvc()
        if (!kanban) return { ok: false, error: 'kanban service unavailable（先激活 kanban 插件）' }
        const kind = spec && spec.kind ? String(spec.kind).trim() : ''
        const ext = spec && spec.external_id !== undefined ? String(spec.external_id).trim() : ''
        if (!kind) return { ok: false, error: 'kind is required' }
        if (!ext) return { ok: false, error: 'external_id is required' }
        if (kind === 'local-repo' && fs) {
          try { await fs.resolve(ext) } catch { return { ok: false, error: 'local path not readable: ' + ext } }
        }
        if (kind === 'github-repo') {
          const parts = ext.split('/')
          if (parts.length !== 2 || !parts[0] || !parts[1]) return { ok: false, error: 'github-repo external_id 需为 owner/repo 格式' }
        }
        const card = await kanban.getCard(cardId)
        if (!card) return { ok: false, error: 'card not found: ' + cardId }
        const refs: any[] = Array.isArray(card.refs) ? card.refs.map((r: any) => ({ ...r })) : []
        if (refs.some((r) => r.kind === kind && r.externalId === ext)) return { ok: false, error: 'ref already exists: ' + kind + ' ' + ext }
        const ref: any = {
          id: 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
          kind,
          platform: spec.platform ? String(spec.platform) : kind.split('-')[0],
          externalId: ext,
          url: spec.url !== undefined && String(spec.url).trim() ? String(spec.url).trim() : '',
          display: spec.display !== undefined && String(spec.display).trim() ? String(spec.display).trim() : '',
          meta: spec.meta && typeof spec.meta === 'object' ? spec.meta : {},
          createdAt: now(),
        }
        refs.push(ref)
        const res = await kanban.updateCard(cardId, { refs, activity: '添加关联：' + kind + ' ' + ext })
        if (!res.ok) return { ok: false, error: res.error || 'updateCard failed' }
        return { ok: true, card_id: cardId, ref_id: ref.id, kind, externalId: ext }
      }

      /* ── 拉 MR 列表（含 [ID] 解析） ── */
      async function listMrs(cardId: string | undefined, owner?: string, name?: string): Promise<any> {
        let o = owner, n = name
        let card: any = null
        if (cardId) {
          const kanban = kanbanSvc()
          if (kanban) card = await kanban.getCard(cardId)
          const repo = repoFromCard(card)
          if (repo && !o) { o = repo.owner; n = repo.name }
        }
        if (!o || !n) {
          const cfg = await readConfig()
          if (cfg.repo && cfg.repo.owner && cfg.repo.name) { o = o || cfg.repo.owner; n = n || cfg.repo.name }
        }
        if (!o || !n) return { ok: false, error: 'no repo configured（git_configure 或卡片 github-repo 关联）' }
        const gh = await ghFetch(o, n, 'pulls?state=open&per_page=50')
        if (!gh.ok) return { ok: false, error: gh.error || 'github api failed' }
        const items: any[] = Array.isArray(gh.data) ? gh.data : []
        const mrs = items.map((p: any) => {
          const title = p.title || ''
          return {
            number: p.number,
            title,
            state: p.state || 'open',
            url: p.html_url || '',
            updatedAt: p.updated_at || '',
            mergeable: p.mergeable === undefined ? null : p.mergeable,
            taskIds: parseTaskIds(title),
          }
        })
        const taskId = taskIdOf(card)
        return { ok: true, repo: { owner: o, name: n }, open: mrs.length, mrs, matched: taskId ? mrs.filter((m) => m.taskIds.some((t: string) => normalizeTaskId(t) === normalizeTaskId(taskId))) : [] }
      }

      /* ── 同步：拉取 + [ID] 自动关联 + 写回 meta.sync.github 信封 ── */
      async function syncCard(cardId: string): Promise<any> {
        const kanban = kanbanSvc()
        if (!kanban) return { ok: false, error: 'kanban service unavailable（先激活 kanban 插件）' }
        const card = await kanban.getCard(cardId)
        if (!card) return { ok: false, error: 'card not found: ' + cardId }
        const repo = repoFromCard(card)
        let o = repo ? repo.owner : undefined
        let n = repo ? repo.name : undefined
        if (!o || !n) {
          const cfg = await readConfig()
          if (cfg.repo && cfg.repo.owner && cfg.repo.name) { o = cfg.repo.owner; n = cfg.repo.name }
        }
        if (!o || !n) return { ok: false, error: 'no repo configured（git_configure 或先关联 github-repo）' }
        const gh = await ghFetch(o, n, 'pulls?state=open&per_page=50')
        const taskId = taskIdOf(card)
        const branch = branchFromCard(card)
        if (!gh.ok) {
          const env: any = { version: 1, lastSyncAt: null, error: gh.error || 'github api failed', snapshot: null }
          await kanban.updateCard(cardId, { meta: { sync: { github: env } }, activity: '同步失败：' + (gh.error || 'github api failed') })
          return { ok: false, error: gh.error || 'github api failed', syncedAt: null }
        }
        const items: any[] = Array.isArray(gh.data) ? gh.data : []
        const mrs = items.map((p: any) => ({
          number: p.number,
          title: p.title || '',
          state: p.state || 'open',
          url: p.html_url || '',
          updatedAt: p.updated_at || '',
          mergeable: p.mergeable === undefined ? null : p.mergeable,
          taskIds: parseTaskIds(p.title || ''),
        }))
        // [ID] 自动关联：匹配本卡 taskId 的 MR → 补 github-mr refs（去重）
        let linked = 0
        const refs: any[] = Array.isArray(card.refs) ? card.refs.map((r: any) => ({ ...r })) : []
        if (taskId) {
          for (const m of mrs) {
            if (!m.taskIds.some((t: string) => normalizeTaskId(t) === normalizeTaskId(taskId))) continue
            if (refs.some((r) => r.kind === 'github-mr' && r.externalId === String(m.number))) continue
            refs.push({
              id: 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
              kind: 'github-mr',
              platform: 'github',
              externalId: String(m.number),
              url: m.url,
              display: m.title,
              meta: { state: m.state },
              createdAt: now(),
            })
            linked++
          }
        }
        const envelope = {
          version: 1,
          lastSyncAt: now(),
          error: null,
          snapshot: { repo: { owner: o, name: n, branch: branch || null }, mrs },
        }
        const patch: any = { meta: { sync: { github: envelope } }, activity: '同步 GitHub MR（open ' + mrs.length + '）' }
        if (linked > 0) patch.refs = refs
        const res = await kanban.updateCard(cardId, patch)
        if (!res.ok) return { ok: false, error: res.error || 'updateCard failed' }
        return { ok: true, card_id: cardId, syncedAt: envelope.lastSyncAt, taskId, open_mrs: mrs.length, linked_mrs: linked, matched_mrs: taskId ? mrs.filter((m) => m.taskIds.some((t: string) => normalizeTaskId(t) === normalizeTaskId(taskId))).map((m) => m.number) : [] }
      }

      /* ── 状态快照 ── */
      async function snapshot(cardId: string): Promise<any> {
        const kanban = kanbanSvc()
        if (!kanban) return { ok: false, error: 'kanban service unavailable' }
        const card = await kanban.getCard(cardId)
        if (!card) return { ok: false, error: 'card not found: ' + cardId }
        const sync = card.meta && card.meta.sync && card.meta.sync.github ? card.meta.sync.github : null
        return { ok: true, card_id: cardId, taskId: taskIdOf(card), sync }
      }

      /* ── 跨插件服务（M3 sync 按钮 / 适配层用） ── */
      ctx.provide('git', {
        isConfigured: async () => {
          const cfg = await readConfig()
          const tokenConfigured = credentials ? (await credentials.describe(TOKEN_REF).catch(() => ({ configured: false, writable: false }))).configured : false
          return { configured: !!(cfg.repo && cfg.repo.owner && cfg.repo.name) || tokenConfigured, repo: cfg.repo || null, tokenConfigured }
        },
        claimTaskId,
        link: async (cardId: string, spec: any) => linkRef(cardId, spec),
        listMrs: async (cardId: string) => listMrs(cardId),
        sync: async (cardId: string) => syncCard(cardId),
        snapshot: async (cardId: string) => snapshot(cardId),
      })

      /* ── 工具 ── */
      const P = (properties: any, required: string[] = []) => ({ type: 'object', properties, required })
      const STR = (description: string) => ({ type: 'string', description })
      const outputOf = (description: string) => ({ schema: { type: 'object', additionalProperties: true }, render: (args: unknown, value: unknown) => [{ type: 'text', text: description + '\n' + JSON.stringify(value, null, 2) }] })

      const defs: any[] = [
        {
          name: 'git_configure',
          description: '配置 git 插件：远端 GitHub 仓库（owner/repo）、本地仓库路径、GitHub token（写入宿主 credentials，ref 名 GITHUB_TOKEN，不落卡片不落盘明文）。任一字段可选。',
          parameters: P({
            owner: STR('GitHub 仓库 owner（可选）'),
            repo: STR('GitHub 仓库名（可选，与 owner 成对）'),
            local_path: STR('本地仓库路径（可选，验证可读后存入配置）'),
            token: STR('GitHub token（可选，设置后存入凭证；不传则仅查询是否已配置）'),
          }),
          execute: async (args: any) => {
            const cfg = await readConfig()
            const owner = args.owner !== undefined && String(args.owner).trim() ? String(args.owner).trim() : undefined
            const name = args.repo !== undefined && String(args.repo).trim() ? String(args.repo).trim() : undefined
            if ((owner && !name) || (!owner && name)) return { ok: false, error: 'owner 与 repo 需成对提供' }
            if (owner && name) cfg.repo = { owner, name }
            if (args.local_path !== undefined && String(args.local_path).trim()) {
              if (!fs) return { ok: false, error: 'fs service unavailable' }
              try { await fs.resolve(String(args.local_path).trim()) } catch { return { ok: false, error: 'local path not readable: ' + args.local_path } }
              cfg.localPath = String(args.local_path).trim()
            }
            await writeConfig(cfg)
            let tokenConfigured = false
            if (args.token !== undefined && String(args.token).trim()) {
              if (!credentials) return { ok: false, error: 'credentials service unavailable' }
              await credentials.set(TOKEN_REF, String(args.token).trim())
              tokenConfigured = true
            } else if (credentials) {
              tokenConfigured = (await credentials.describe(TOKEN_REF).catch(() => ({ configured: false }))).configured
            }
            return { ok: true, repo: cfg.repo || null, localPath: cfg.localPath || null, tokenConfigured }
          },
          output: outputOf('配置结果'),
        },
        {
          name: 'git_claim_task_id',
          description: '为卡片认领自动关联 ID（[ID] 约定，格式 <repo-name>-<int>，如 dsh-plugins-1）。已有 taskId 则原样返回；同 repo 递增。MR 标题携带 [taskId] 即可被 git_sync 自动关联。',
          parameters: P({ card_id: STR('卡片 id') }, ['card_id']),
          execute: async (args: any) => claimTaskId(String(args.card_id)),
          output: outputOf('taskId 认领结果'),
        },
        {
          name: 'git_link',
          description: '为卡片建立带验证的外部关联（写入卡片 refs）：github-repo（owner/repo，验证格式）、github-branch、github-mr、local-repo（验证路径可读）。',
          parameters: P({
            card_id: STR('卡片 id'),
            kind: STR('引用类型：github-repo / github-branch / github-mr / local-repo'),
            external_id: STR('提供方侧 ID：owner/repo、branch 名、MR 号、本地路径'),
            platform: STR('提供方键，缺省从 kind 前缀推导'),
            url: STR('可点击链接（可选）'),
            display: STR('展示文本（可选，branch 名 / MR 标题）'),
            meta: { type: 'object', additionalProperties: true, description: '提供方轻量信息（可选）' },
          }, ['card_id', 'kind', 'external_id']),
          execute: async (args: any) => linkRef(String(args.card_id), args),
          output: outputOf('关联结果'),
        },
        {
          name: 'git_list_mrs',
          description: '列出仓库 open MR（GitHub PR）。仓库来源：卡片 github-repo 关联 > git_configure 配置。返回 MR 列表与标题中解析出的 [taskId]。',
          parameters: P({
            card_id: STR('卡片 id（可选；用于从卡片解析仓库）'),
            owner: STR('仓库 owner（可选，覆盖卡片/配置）'),
            repo: STR('仓库名（可选，覆盖卡片/配置）'),
          }),
          execute: async (args: any) => listMrs(args.card_id ? String(args.card_id) : undefined, args.owner ? String(args.owner) : undefined, args.repo ? String(args.repo) : undefined),
          output: outputOf('MR 列表'),
        },
        {
          name: 'git_sync',
          description: '同步卡片关联仓库的 open MR 状态：拉取 GitHub PR → 按 [ID] 约定自动关联本卡 taskId 的 MR（补 github-mr refs）→ 写回卡片 meta.sync.github 快照信封（version/lastSyncAt/error/snapshot）。',
          parameters: P({ card_id: STR('卡片 id') }, ['card_id']),
          execute: async (args: any) => syncCard(String(args.card_id)),
          output: outputOf('同步结果'),
        },
        {
          name: 'git_status',
          description: '查看卡片当前 git 同步状态：taskId、关联 refs、meta.sync.github 信封（上次同步时间 / 错误 / 快照）。',
          parameters: P({ card_id: STR('卡片 id') }, ['card_id']),
          execute: async (args: any) => snapshot(String(args.card_id)),
          output: outputOf('同步状态'),
        },
      ]
      for (const d of defs) {
        ctx.effect(() => harness.registerTool(ctx, harness.defineTool(d)))
      }
    },
  }
}

export default makePlugin()
