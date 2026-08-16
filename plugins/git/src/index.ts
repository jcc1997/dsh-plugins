// git 插件宿主半（正式 bundle 形态）：git 服务 + agent 工具
// 能力：git_configure（远端 repo / 本地路径 / token）、git_claim_task_id（[ID] 约定）、
//       git_link（带验证关联）、git_list_mrs / git_sync / git_merge_pr（GitHub API + [ID] 自动关联）
// 数据：~/.dsh/git/config.json；凭证走宿主 credentials（ref 名 GITHUB_TOKEN）；
//       GitHub API 优先 bash(curl)+token，退化 ctx.web 匿名抓取；卡片读写走跨插件 kanban 服务
// 接入点（正式形态）：ctx.tools.register(defineTool(...)) 注册 agent 工具；
//       ctx.webServer.register 暴露 /api/git/sync（client 同步按钮通道）；
//       ctx.provide('git') 跨插件服务；createComm(env:'deployed-host') 走 ctx.emit 事件
// 本文件由动态形态迁移而来：业务逻辑（GitHub API / [ID] / 同步信封）零改动
import { createComm } from '@dsh-plugins/communication'

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
  getCardStatus?(cardId: string): Promise<{ status: string; archived: boolean } | null>
  moveCard?(cardId: string, target: string, activityText?: string): Promise<{ ok: boolean; error?: string }>
}
const TOKEN_REF = 'GITHUB_TOKEN'
const DEFAULT_DIR = '/Users/jinchao.chen/.dsh/git'
const CONFIG_FILE = 'config.json'
const WRITE_POLICY = { mode: 'danger-full-access' }
// [ID] 约定：taskId 格式 <repo-name>-<int>（PLAN §5.5）
const TASK_ID_RE = /^([A-Za-z0-9_.-]+)-([0-9]+)$/
const MR_ID_RE = /\[([A-Za-z0-9_.-]+-[0-9]+)\]/g

// 工具定义官方包（正式形态：宿主已装 @deepseek-ai/dsh-tools，bundle 时 external，node ESM 解析）
import { defineTool } from '@deepseek-ai/dsh-tools'

// 宿主服务形状（正式形态：完整 cordis Context + 宿主服务注入）
interface GitCtx {
  get(name: string): unknown
  provide(name: string, value: unknown): unknown
  effect(cb: () => unknown): unknown
}

// 声明服务依赖：cordis 等待全部就绪后才激活 apply（宿主 include 并发 apply，
// webServer/credentials/bash 等宿主行可能晚于本插件；不 inject 会拿到 undefined）
export const inject = ['fs', 'webServer', 'tools', 'credentials', 'shell']

export function apply(ctx: GitCtx) {
      // 通信协议：部署形态（createComm env:'deployed-host' → bus 走 ctx.emit/on）
      const comm = createComm({ env: 'deployed-host', ctx: ctx as any })
      const fs = ctx.get('fs') as FsLike
      const credentials = ctx.get('credentials') as CredLike | undefined
      const bash = (ctx.get('bash') as BashLike | undefined) || (ctx.get('shell') as BashLike | undefined)
      const web = ctx.get('web') as WebLike | undefined
      const webServer = ctx.get('webServer') as { register(r: { kind: 'exact' | 'prefix'; path: string; handler: (req: any, res: any) => void | Promise<void> }): () => void } | undefined
      const tools = ctx.get('tools') as { register(def: unknown): () => void } | undefined
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

      /* ── GitHub API：node 原生 fetch（正式形态 node 环境，可直接带 Authorization header） ── */
      async function ghFetch(owner: string, repo: string, apiPath: string): Promise<{ ok: boolean; data?: any; httpStatus?: number; error?: string }> {
        const url = 'https://api.github.com/repos/' + encodeURIComponent(owner) + '/' + encodeURIComponent(repo) + '/' + apiPath
        let token: string | undefined
        if (credentials) {
          try {
            const resolved = await credentials.resolve(TOKEN_REF)
            if (resolved && resolved.value) token = resolved.value
          } catch { token = undefined }
        }
        try {
          const headers: Record<string, string> = { Accept: 'application/vnd.github+json' }
          if (token) headers.Authorization = 'Bearer ' + token
          const res = await fetch(url, { headers })
          const bodyText = await res.text()
          let data: any = null
          try { data = bodyText ? JSON.parse(bodyText) : null } catch { data = null }
          if (res.status >= 200 && res.status < 300) return { ok: true, data, httpStatus: res.status }
          return { ok: false, httpStatus: res.status, error: (data && (data.message || JSON.stringify(data))) || 'HTTP ' + res.status }
        } catch (e) {
          const err = e as any
          const detail = err && err.cause && err.cause.message ? ' (' + err.cause.message + ')' : ''
          return { ok: false, error: 'api error: ' + String(err && err.message ? err.message : err) + detail }
        }
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
        const cfg = await readConfig()
        const repoName = repo ? repo.name : (cfg.repo && cfg.repo.name) ? cfg.repo.name : null
        if (!repoName) {
          return { ok: false, error: '无法认领 taskId：卡片未关联 github-repo 且未配置远端仓库（先 git_configure 配 repo 或用 git_link 关联 github-repo），[ID] 约定要求 <repo-name>-<int>' }
        }
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
        const ext = spec && (spec.external_id !== undefined ? String(spec.external_id) : spec.externalId !== undefined ? String(spec.externalId) : '').trim() || ''
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
        const gh = await ghFetch(o, n, 'pulls?state=all&per_page=100')
        if (!gh.ok) return { ok: false, error: gh.error || 'github api failed' }
        const items: any[] = Array.isArray(gh.data) ? gh.data : []
        const mrsAll = items.map((p: any) => {
          const title = p.title || ''
          const rawState = p.state || 'open'
          return {
            number: p.number,
            title,
            state: p.merged_at ? 'merged' : rawState,
            url: p.html_url || '',
            updatedAt: p.updated_at || '',
            mergedAt: p.merged_at || null,
            mergeable: p.mergeable === undefined ? null : p.mergeable,
            taskIds: parseTaskIds(title),
          }
        })
        const mrs = mrsAll
        const taskId = taskIdOf(card)
        return { ok: true, repo: { owner: o, name: n }, open: mrsAll.filter((m) => m.state === 'open').length, total: mrsAll.length, mrs, matched: taskId ? mrs.filter((m) => m.taskIds.some((t: string) => normalizeTaskId(t) === normalizeTaskId(taskId))) : [] }
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
        // 拉全部状态（open+merged+closed），保证合并/关闭后状态正确反映
        const gh = await ghFetch(o, n, 'pulls?state=all&per_page=100')
        const taskId = taskIdOf(card)
        const branch = branchFromCard(card)
        if (!gh.ok) {
          const env: any = { version: 1, lastSyncAt: null, error: gh.error || 'github api failed', snapshot: null }
          await kanban.updateCard(cardId, { meta: { sync: { github: env } }, activity: '同步失败：' + (gh.error || 'github api failed') })
          return { ok: false, error: gh.error || 'github api failed', syncedAt: null }
        }
        const items: any[] = Array.isArray(gh.data) ? gh.data : []
        const mrsAll = items.map((p: any) => {
          // 归一化：GitHub 合并的 PR state=closed 但 merged_at 非空 → merged（区分关闭）
          const rawState = p.state || 'open'
          const state = p.merged_at ? 'merged' : rawState
          return {
            number: p.number,
            title: p.title || '',
            state,
            url: p.html_url || '',
            updatedAt: p.updated_at || '',
            mergedAt: p.merged_at || null,
            mergeable: p.mergeable === undefined ? null : p.mergeable,
            taskIds: parseTaskIds(p.title || ''),
          }
        })
        // 快照：open 全部 + 最近 5 个非 open（避免快照膨胀，merged/closed 只留最近的）
        const openMrs = mrsAll.filter((m) => m.state === 'open')
        const recentClosed = mrsAll.filter((m) => m.state !== 'open').slice(0, 5)
        const mrs = [...openMrs, ...recentClosed]
        // [ID] 自动关联：匹配本卡 taskId 的 MR → 补 github-mr refs；已有 ref 更新 state（合并/关闭后状态同步）
        let linked = 0
        let updated = 0
        const refs: any[] = Array.isArray(card.refs) ? card.refs.map((r: any) => ({ ...r })) : []
        if (taskId) {
          for (const m of mrs) {
            if (!m.taskIds.some((t: string) => normalizeTaskId(t) === normalizeTaskId(taskId))) continue
            const existing = refs.find((r) => r.kind === 'github-mr' && r.externalId === String(m.number))
            if (existing) {
              // 已有 ref：更新 state / title / url
              const prevState = existing.meta && existing.meta.state
              existing.meta = { state: m.state }
              existing.display = m.title
              existing.url = m.url
              if (prevState && prevState !== m.state) {
                updated++
                existing.updatedAt = now()
              }
              continue
            }
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
        const patch: any = { meta: { sync: { github: envelope } }, activity: '同步 GitHub MR（open ' + openMrs.length + (updated > 0 ? '，状态变更 ' + updated + '）' : '）') }
        if (linked > 0 || updated > 0) patch.refs = refs
        const res = await kanban.updateCard(cardId, patch)
        if (!res.ok) return { ok: false, error: res.error || 'updateCard failed' }
        // 通信协议：同步完成发布事件（动态=服务总线；部署=ctx.emit；监听方刷新 UI/联动）
        try {
          comm.bus.publish('git/card-synced', { cardId, syncedAt: envelope.lastSyncAt, taskId: taskId || undefined, openMrs: openMrs.length, linkedMrs: linked, updatedMrs: updated })
        } catch { /* 事件失败不影响结果 */ }
        return { ok: true, card_id: cardId, syncedAt: envelope.lastSyncAt, taskId, open_mrs: openMrs.length, linked_mrs: linked, updated_mrs: updated, matched_mrs: taskId ? mrs.filter((m) => m.taskIds.some((t: string) => normalizeTaskId(t) === normalizeTaskId(taskId))).map((m) => m.number) : [] }
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

      /* ── client sync 按钮通道（正式形态）：webServer 路由 POST /api/git/sync ── */
      if (webServer && typeof webServer.register === 'function') {
        ctx.effect(() => webServer.register({
          kind: 'exact',
          path: '/git-api/sync',
          handler: async (req: any, res: any) => {
            try {
              let body = ''
              for await (const chunk of req) body += chunk
              const args = body ? JSON.parse(body) : {}
              const cardId = args && args.cardId ? String(args.cardId) : ''
              const result = cardId ? await syncCard(cardId) : { ok: false, error: 'cardId required' }
              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify(result))
            } catch (e) {
              res.writeHead(500, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ ok: false, error: String(e && (e as Error).message ? (e as Error).message : e) }))
            }
          },
        }))
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
        {
          name: 'git_merge_pr',
          description: '合并仓库的 GitHub MR（PR）：合并前检查关联卡片必须处于 Stage 列（workflow 门禁）；合并后自动触发该卡 git_sync 刷新状态，并自动把卡片移入 Done 列。仓库来源：卡片 github-repo 关联 > git_configure 配置。',
          parameters: P({
            card_id: STR('卡片 id（可选；用于解析仓库、Stage 状态检查与合并后自动流转）'),
            owner: STR('仓库 owner（可选，覆盖卡片/配置）'),
            repo: STR('仓库名（可选，覆盖卡片/配置）'),
            mr_number: STR('MR 号（必填）'),
            squash: { type: 'boolean', description: '是否 squash 合并（默认 false）' },
          }, ['mr_number']),
          execute: async (args: any) => {
            const number = String(args.mr_number).trim()
            if (!number) return { ok: false, error: 'mr_number is required' }
            let o = args.owner ? String(args.owner).trim() : undefined
            let n = args.repo ? String(args.repo).trim() : undefined
            let cardId = args.card_id ? String(args.card_id) : undefined
            if (!o || !n) {
              const kanban = kanbanSvc()
              if (kanban && cardId) {
                const card = await kanban.getCard(cardId)
                const repo = repoFromCard(card)
                if (repo) { o = o || repo.owner; n = n || repo.name }
              }
            }
            if (!o || !n) {
              const cfg = await readConfig()
              if (cfg.repo && cfg.repo.owner && cfg.repo.name) { o = o || cfg.repo.owner; n = n || cfg.repo.name }
            }
            if (!o || !n) return { ok: false, error: 'no repo configured（git_configure 或卡片 github-repo 关联）' }
            // workflow 门禁：卡片必须处于 Stage 列才允许合并
            let stageCheck: any = null
            if (cardId) {
              const kanban = kanbanSvc()
              if (kanban && typeof kanban.getCardStatus === 'function') {
                stageCheck = await kanban.getCardStatus(cardId)
                if (!stageCheck || stageCheck.status !== 'Stage') {
                  return { ok: false, error: '门禁未通过：卡片必须处于 Stage 列才能合并 MR（当前：' + (stageCheck ? stageCheck.status : '未找到卡片') + '）' }
                }
              }
            }
            // PUT /pulls/{number}/merge —— 走 curl+token（同 ghFetch 机制）
            const url = 'https://api.github.com/repos/' + encodeURIComponent(o) + '/' + encodeURIComponent(n) + '/pulls/' + encodeURIComponent(number) + '/merge'
            let token: string | undefined
            if (credentials) {
              try {
                const resolved = await credentials.resolve(TOKEN_REF)
                if (resolved && resolved.value) token = resolved.value
              } catch { token = undefined }
            }
            if (!token) return { ok: false, error: '合并需要 GitHub token（git_configure 配置）' }
            const body = JSON.stringify({ merge_method: args.squash ? 'squash' : 'merge' })
            let data: any = null
            let status = 0
            try {
              const res = await fetch(url, {
                method: 'PUT',
                headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
                body,
              })
              status = res.status
              const bodyText = await res.text()
              try { data = bodyText ? JSON.parse(bodyText) : null } catch { data = null }
            } catch (e) {
              return { ok: false, error: 'merge request failed: ' + String(e && (e as Error).message ? (e as Error).message : e) }
            }
            if (status >= 200 && status < 300) {
              // 合并成功 → 自动同步该卡刷新状态 → 自动把卡片移入 Done 列（workflow 收尾）
              let syncRes: any = null
              let moveRes: any = null
              if (cardId) {
                syncRes = await syncCard(cardId)
                const kanban = kanbanSvc()
                if (kanban && typeof kanban.moveCard === 'function') {
                  moveRes = await kanban.moveCard(cardId, 'Done', 'MR #' + number + ' 已合并 → 自动移入 Done')
                }
              }
              return { ok: true, merged: true, mergedAt: (data && data.merged_at) || null, message: (data && data.message) || 'merged', autoSynced: !!syncRes, sync: syncRes || null, autoMovedToDone: !!moveRes, move: moveRes || null }
            }
            return { ok: false, httpStatus: status, error: (data && (data.message || JSON.stringify(data))) || 'merge failed (HTTP ' + status + ')' }
          },
          output: outputOf('合并结果'),
        },
        {
          name: 'git_create_branch',
          description: '为卡片创建 workflow 分支（进 RD 前置，workflow 流程）：本地仓库须干净且在默认分支(main/master)上 → 切出 workflow/<taskId> 并推送到远端(GitHub token 或本机凭据)；成功后自动给卡片关联 github-branch。',
          parameters: P({ card_id: STR('卡片 id（认领 taskId 并命名分支 workflow/<taskId>）') }, ['card_id']),
          execute: async (args: any) => {
            const cardId = String(args.card_id)
            const kanban = kanbanSvc()
            if (!kanban) return { ok: false, error: 'kanban service unavailable' }
            const card = await kanban.getCard(cardId)
            if (!card) return { ok: false, error: 'card not found: ' + cardId }
            let taskId = taskIdOf(card)
            if (!taskId) {
              const claimed = await claimTaskId(cardId)
              if (!claimed || !claimed.taskId) return { ok: false, error: '无法认领 taskId：' + ((claimed && claimed.error) || '未知（先 git_configure 配 repo 或 git_link 关联 github-repo）') }
              taskId = claimed.taskId
            }
            const cfg = await readConfig()
            if (!cfg.localPath) return { ok: false, error: '未配置本地仓库路径（git_configure 设置 local_path）' }
            if (!bash) return { ok: false, error: 'bash/shell 服务不可用' }
            const branch = 'workflow/' + taskId
            const repo = (() => { const r = repoFromCard(card); return r || (cfg.repo && cfg.repo.owner && cfg.repo.name ? { owner: cfg.repo.owner, name: cfg.repo.name } : null) })()
            let token: string | undefined
            if (credentials) {
              try { const r = await credentials.resolve(TOKEN_REF); if (r && r.value) token = r.value } catch { token = undefined }
            }
            const runGit = async (cmd: string, env?: Record<string, string>) => {
              const res = await bash!.run({ command: cmd, workdir: cfg.localPath, timeoutMs: 90000, stdoutMaxBytes: 1 << 18, env, sandboxPolicy: { mode: 'danger-full-access' } })
              return { exitCode: res.exitCode, out: (res.stdout && res.stdout.text) || '' }
            }
            const status = await runGit('git status --porcelain')
            if (status.exitCode !== 0) return { ok: false, error: 'git status 失败: ' + status.out }
            if (status.out.trim()) return { ok: false, error: '本地仓库有未提交改动，请先提交或暂存后再建分支：' + status.out.trim().split('\n').slice(0, 5).join(' | ') }
            const cur = await runGit('git branch --show-current')
            const curBranch = cur.out.trim()
            if (!curBranch || (curBranch !== 'main' && curBranch !== 'master')) return { ok: false, error: '当前不在主分支(main/master)，当前: ' + (curBranch || '(detached)') + '——workflow 分支必须从主分支切出' }
            const has = await runGit('git branch --list ' + branch)
            if (has.out.trim()) return { ok: false, error: '分支已存在: ' + branch + '（已创建过，直接复用；如需重新建请先删除远端分支）' }
            const co = await runGit('git checkout -b ' + branch)
            if (co.exitCode !== 0) return { ok: false, error: 'git checkout 失败: ' + co.out }
            let push: { exitCode: number | null; out: string }
            if (token && repo) {
              const pushUrl = 'https://x-access-token:$' + '{GIT_TOKEN}@github.com/' + repo.owner + '/' + repo.name + '.git'
              push = await runGit('git push -u ' + pushUrl + ' ' + branch, { GIT_TOKEN: token })
            } else {
              push = await runGit('git push -u origin ' + branch)
            }
            if (push.exitCode !== 0) {
              // 失败输出可能回显带 token 的 push URL——脱敏后再返回
              let out = push.out
              if (token) { try { out = out.split(token).join('***') } catch { /* ignore */ } }
              return { ok: false, error: 'git push 失败: ' + out.slice(0, 400) + '（确认 GitHub token 已配置 git_configure，或本机 git 凭据可推送）' }
            }
            let linkRes: any = null
            try {
              linkRes = await linkRef(cardId, { kind: 'github-branch', externalId: branch, display: branch, meta: repo ? { repo: repo.owner + '/' + repo.name } : undefined })
            } catch { linkRes = null }
            return { ok: true, branch, taskId, pushed: true, linked: !!linkRes, link: linkRes || null }
          },
          output: outputOf('建分支结果'),
        },
        {
          name: 'git_create_mr',
          description: '为卡片创建 GitHub MR（RD 确认后，workflow 流程）：head=workflow/<taskId>（须已 git_create_branch 推送）、base 默认 main；标题自动带 [taskId]（git_sync 按此自动关联）；创建成功后自动给卡片关联 github-mr。',
          parameters: P({ card_id: STR('卡片 id（取 taskId 与标题）'), base: STR('目标分支（默认 main）'), draft: STR('是否草稿（"true" 时创建 draft PR）') }, ['card_id']),
          execute: async (args: any) => {
            const cardId = String(args.card_id)
            const kanban = kanbanSvc()
            if (!kanban) return { ok: false, error: 'kanban service unavailable' }
            const card = await kanban.getCard(cardId)
            if (!card) return { ok: false, error: 'card not found: ' + cardId }
            const taskId = taskIdOf(card)
            if (!taskId) return { ok: false, error: '卡片没有 taskId，先 git_claim_task_id 认领' }
            const cfg = await readConfig()
            const repo = (() => { const r = repoFromCard(card); return r || (cfg.repo && cfg.repo.owner && cfg.repo.name ? { owner: cfg.repo.owner, name: cfg.repo.name } : null) })()
            if (!repo) return { ok: false, error: '未解析到仓库（卡片 github-repo 关联或 git_configure repo）' }
            const branch = 'workflow/' + taskId
            const base = (args.base && String(args.base).trim()) || 'main'
            let token: string | undefined
            if (credentials) {
              try { const r = await credentials.resolve(TOKEN_REF); if (r && r.value) token = r.value } catch { token = undefined }
            }
            if (!token) return { ok: false, error: '创建 MR 需要 GitHub token（git_configure 配置）' }
            const title = '[' + taskId + '] ' + (card.title || '')
            const body = {
              title,
              head: branch,
              base,
              body: (card.description ? card.description + '\n\n' : '') + 'Workflow 卡片: ' + cardId,
              ...(String(args.draft) === 'true' ? { draft: true } : {}),
            }
            let data: any = null
            let status = 0
            try {
              const res = await fetch('https://api.github.com/repos/' + encodeURIComponent(repo.owner) + '/' + encodeURIComponent(repo.name) + '/pulls', {
                method: 'POST',
                headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
              })
              status = res.status
              const bodyText = await res.text()
              try { data = bodyText ? JSON.parse(bodyText) : null } catch { data = null }
            } catch (e) {
              return { ok: false, error: 'create mr request failed: ' + String(e && (e as Error).message ? (e as Error).message : e) }
            }
            if (status >= 200 && status < 300) {
              const number = data && data.number
              let linkRes: any = null
              if (number) {
                try {
                  linkRes = await linkRef(cardId, { kind: 'github-mr', externalId: String(number), display: '#' + number, url: data.html_url || undefined, meta: { repo: repo.owner + '/' + repo.name } })
                } catch { linkRes = null }
              }
              return { ok: true, mr_number: number, url: (data && data.html_url) || null, taskId, title, linked: !!linkRes, link: linkRes || null }
            }
            return { ok: false, httpStatus: status, error: (data && (data.message || JSON.stringify(data))) || 'create mr failed (HTTP ' + status + ')' }
          },
          output: outputOf('创建 MR 结果'),
        },
      ]
      if (tools && typeof tools.register === 'function') {
        // DSL 适配：动态形态的 parameters 是 { type, properties, required } 包装，
        // dsh-tools 的 ParameterSchemaSpec 是直接属性映射（required 为属性级注解）
        const toToolParameters = (parameters: any): any => {
          const props = (parameters && parameters.properties) || {}
          const required: string[] = (parameters && parameters.required) || []
          const out: any = {}
          for (const key of Object.keys(props)) {
            out[key] = { ...props[key], ...(required.includes(key) ? { required: true } : {}) }
          }
          return out
        }
        for (const d of defs) {
          ctx.effect(() => tools.register(defineTool({ ...d, parameters: toToolParameters(d.parameters) })))
        }
      } else {
        throw new Error('tools service unavailable（正式形态需 @deepseek-ai/dsh-tools）')
      }
    }