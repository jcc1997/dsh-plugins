// git 插件受限环境验证 + 端到端逻辑测试（mock 宿主服务）
// 用法：node scripts/verify-dist.mjs
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(fileURLToPath(import.meta.url)) + '/..'

async function loadClient() {
  const src = await readFile(join(root, 'dist', 'client.js'), 'utf8')
  const React = await import('react')
  const registered = []
  const slotsMock = {
    inject: (name, fn) => { if (name === 'kanban.card.actions') fn() },
    register: (options, component) => { registered.push({ options, component }); return () => {} },
  }
  const sandbox = {
    React,
    console,
    styles: { insert: () => () => {} },
    host: { call: async (m) => ({ ok: true, method: m }) },
    ctx: { get: (name) => (name === 'slots' ? slotsMock : undefined) },
  }
  const ctx = vm.createContext(sandbox)
  const result = await vm.runInContext('(async () => {' + src + '\n})()', ctx)
  const plugin = await result
  if (!plugin || plugin.name !== 'git') throw new Error('client plugin shape wrong: ' + JSON.stringify(plugin && plugin.name))
  if (typeof plugin.apply !== 'function') throw new Error('client apply missing')
  const ret = plugin.apply(sandbox.ctx)
  if (ret !== undefined) throw new Error('apply should return undefined')
  // M3：应注册 git-sync 条目到 kanban.card.actions
  const syncEntry = registered.find((e) => e.options && e.options.name === 'kanban.card.actions' && e.options.id === 'git-sync')
  if (!syncEntry) throw new Error('git-sync slot entry not registered: ' + JSON.stringify(registered.map((e) => e.options && e.options.name)))
  if (typeof syncEntry.component !== 'function') throw new Error('git-sync component missing')
  console.log('client.js: OK (plugin=git, slot entry=kanban.card.actions/git-sync)')
}

async function loadHost() {
  const src = await readFile(join(root, 'dist', 'host.js'), 'utf8')
  const handlers = {}
  const registered = []
  const provided = {}

  // ── mock：内存看板（kanban 服务） ──
  const board = {
    version: 1,
    columns: [{ id: 'c1', title: '待办', cards: [
      { id: 'k1', title: '测试卡', refs: [{ id: 'r1', kind: 'github-repo', platform: 'github', externalId: 'jcc1997/dsh-plugins', createdAt: '' }], meta: { taskId: 'dsh-plugins-1' }, comments: [], activity: [], tags: [], createdAt: '', updatedAt: '' },
      { id: 'k2', title: '无 ID 卡', refs: [], meta: {}, comments: [], activity: [], tags: [], createdAt: '', updatedAt: '' },
    ], meta: {} }],
    meta: {},
  }
  const kanbanSvc = {
    getCard: async (id) => {
      for (const col of board.columns) for (const c of col.cards) if (c.id === id) return c
      return null
    },
    updateCard: async (id, patch) => {
      for (const col of board.columns) for (const c of col.cards) {
        if (c.id !== id) continue
        if (Array.isArray(patch.refs)) c.refs = patch.refs
        if (patch.meta && typeof patch.meta === 'object') {
          if (!c.meta || typeof c.meta !== 'object') c.meta = {}
          for (const k of Object.keys(patch.meta)) c.meta[k] = patch.meta[k]
        }
        if (patch.activity) { if (!c.activity) c.activity = []; c.activity.push({ id: 'a', text: patch.activity, at: '', actor: 'agent' }) }
        c.updatedAt = ''
        return { ok: true }
      }
      return { ok: false, error: 'not found' }
    },
    listCards: async () => board.columns.flatMap((col) => col.cards.map((c) => ({ id: c.id, title: c.title, taskId: (c.meta && c.meta.taskId) || null }))),
  }

  // ── mock：fs / credentials / bash（curl 返回 canned PR JSON） ──
  const files = {}
  const fsMock = {
    resolve: async (p) => ({ targetKey: p }),
    readText: async (t) => { if (files[t.targetKey] === undefined) throw new Error('ENOENT'); return files[t.targetKey] },
    writeText: async (t, content) => { files[t.targetKey] = content },
  }
  const secrets = {}
  const credMock = {
    resolve: async (ref) => (secrets[ref] ? { value: secrets[ref], source: 'mock' } : undefined),
    describe: async (ref) => ({ configured: !!secrets[ref], writable: true }),
    set: async (ref, value) => { secrets[ref] = value },
    unset: async (ref) => { delete secrets[ref] },
  }
  const cannedPulls = JSON.stringify([
    { number: 1, title: '[dsh-plugins-1] docs(git): MR 自动关联规范', state: 'closed', merged_at: '2025-08-14T01:00:00Z', html_url: 'https://github.com/jcc1997/dsh-plugins/pull/1', updated_at: '2025-08-14T00:00:00Z', mergeable: true },
    { number: 2, title: 'feat: 无 ID 的 MR', state: 'open', html_url: 'https://github.com/jcc1997/dsh-plugins/pull/2', updated_at: '2025-08-14T00:00:00Z', mergeable: true },
  ])
  let bashCalls = 0
  const bashMock = {
    run: async (spec) => {
      bashCalls++
      if (spec.command.includes('GITHUB_TOKEN')) throw new Error('token should go through env, not command')
      return { exitCode: 0, stdout: { text: cannedPulls + '\n200', truncated: false } }
    },
  }
  const webMock = { fetch: async () => ({ statusCode: 200, body: { kind: 'text', content: cannedPulls }, truncated: false }) }

  const sandbox = {
    console,
    harness: {
      handle: (m, fn) => { handlers[m] = fn },
      defineTool: (def) => def,
      registerTool: (_ctx, def) => { registered.push(def); return () => {} },
    },
    ctx: {
      get: (name) => {
        if (name === 'fs') return fsMock
        if (name === 'credentials') return credMock
        if (name === 'bash' || name === 'shell') return bashMock
        if (name === 'web') return webMock
        if (name === 'kanban') return kanbanSvc
        return provided[name]
      },
      provide: (name, value) => { provided[name] = value; return () => { delete provided[name] } },
      effect: (cb) => cb() || (() => {}),
    },
  }
  const ctx = vm.createContext(sandbox)
  const result = await vm.runInContext('(async () => {' + src + '\n})()', ctx)
  const plugin = await result
  if (!plugin || plugin.name !== 'git') throw new Error('host plugin shape wrong')
  plugin.apply(sandbox.ctx)

  const expectTools = ['git_configure', 'git_claim_task_id', 'git_link', 'git_list_mrs', 'git_sync', 'git_status', 'git_merge_pr']
  const missing = expectTools.filter((t) => !registered.map((d) => d && d.name).includes(t))
  if (missing.length > 0) throw new Error('tools missing: ' + missing.join(','))
  if (!provided['git'] || typeof provided['git'].sync !== 'function' || typeof provided['git'].isConfigured !== 'function') {
    throw new Error('git service not provided correctly')
  }
  console.log('tools=' + registered.length + ', service=git, handlers=' + (Object.keys(handlers).join(',') || 'none'))
  if (typeof handlers['git/sync'] !== 'function') throw new Error('git/sync RPC handler missing (M3 sync 按钮链路)')

  // ── 端到端逻辑测试 ──
  // 1) git_claim_task_id：k2 无 ID 且无 repo 关联/配置 → 拒绝（[ID] 约定要求 <repo-name>-<int>，不得编造 ID）
  const claim1 = findTool('git_claim_task_id', registered)
  const rClaim = await claim1.execute({ card_id: 'k2' })
  if (rClaim.ok) throw new Error('claim should reject without repo: ' + JSON.stringify(rClaim))
  // 1b) 先 git_link github-repo → 再 claim → dsh-plugins-2（k1 已占 dsh-plugins-1，同 repo 递增）
  const rLinkRepo = await findTool('git_link', registered).execute({ card_id: 'k2', kind: 'github-repo', external_id: 'jcc1997/dsh-plugins' })
  if (!rLinkRepo.ok) throw new Error('link repo failed: ' + JSON.stringify(rLinkRepo))
  const rClaim2 = await claim1.execute({ card_id: 'k2' })
  if (!rClaim2.ok || rClaim2.taskId !== 'dsh-plugins-2') throw new Error('claim after link failed: ' + JSON.stringify(rClaim2))
  // 2) git_sync：k1（taskId dsh-plugins-1）→ 匹配 PR #1，自动补 github-mr ref，写 meta.sync.github
  const rSync = await findTool('git_sync', registered).execute({ card_id: 'k1' })
  if (!rSync.ok) throw new Error('sync failed: ' + JSON.stringify(rSync))
  if (rSync.open_mrs !== 1 || rSync.matched_mrs.length !== 1 || rSync.matched_mrs[0] !== 1) throw new Error('sync match wrong: ' + JSON.stringify(rSync))
  const k1 = await kanbanSvc.getCard('k1')
  const syncEnv = k1.meta && k1.meta.sync && k1.meta.sync.github
  if (!syncEnv || syncEnv.version !== 1 || !syncEnv.lastSyncAt || syncEnv.error !== null) throw new Error('envelope wrong: ' + JSON.stringify(syncEnv))
  if (syncEnv.snapshot.mrs.length !== 2) throw new Error('snapshot mrs wrong: ' + JSON.stringify(syncEnv.snapshot.mrs))
  const mrRef = (k1.refs || []).find((r) => r.kind === 'github-mr' && r.externalId === '1')
  if (!mrRef || mrRef.url !== 'https://github.com/jcc1997/dsh-plugins/pull/1') throw new Error('auto-link ref missing: ' + JSON.stringify(k1.refs))
  // 3) git_status 读回信封
  const rStatus = await findTool('git_status', registered).execute({ card_id: 'k1' })
  if (!rStatus.ok || !rStatus.sync || rStatus.taskId !== 'dsh-plugins-1') throw new Error('status wrong: ' + JSON.stringify(rStatus))
  // 4) git_link local-repo 校验
  const rLink = await findTool('git_link', registered).execute({ card_id: 'k1', kind: 'github-branch', external_id: 'feat/sync', display: 'feat/sync' })
  if (!rLink.ok) throw new Error('link failed: ' + JSON.stringify(rLink))
  // 5) token 经 env 传递（bash 调用断言在 mock 内）
  if (bashCalls < 1) throw new Error('bash not used')
  // 6) M3：git/sync RPC（client sync 按钮 → host.call）
  const rRpc = await handlers['git/sync']({ cardId: 'k1' })
  if (!rRpc.ok || rRpc.open_mrs !== 1) throw new Error('git/sync RPC failed: ' + JSON.stringify(rRpc))
  // 7) 通信协议：sync 成功发布 git/card-synced 事件（comm.bus 服务总线）
  const bus = provided['comm.bus']
  if (!bus || typeof bus.subscribe !== 'function') throw new Error('comm.bus service missing (通信协议)')
  let received = null
  const off = bus.subscribe('git/card-synced', (payload) => { received = payload })
  const rSync2 = await findTool('git_sync', registered).execute({ card_id: 'k1' })
  if (!rSync2.ok) throw new Error('sync2 failed: ' + JSON.stringify(rSync2))
  if (!received || received.cardId !== 'k1' || received.openMrs !== 1) throw new Error('sync event not published: ' + JSON.stringify(received))
  off()
  // 8) 状态变更：PR #1 已 merged（canned 数据）→ 已有 ref 的 state 应更新为 merged
  const k1b = await kanbanSvc.getCard('k1')
  const mrRefB = (k1b.refs || []).find((r) => r.kind === 'github-mr' && r.externalId === '1')
  if (!mrRefB || !mrRefB.meta || mrRefB.meta.state !== 'merged') throw new Error('ref state not updated to merged: ' + JSON.stringify(mrRefB))
  console.log('logic: OK (claim-reject=' + (rClaim.error ? 'yes' : 'no') + ', claim=' + rClaim2.taskId + ', sync matched=' + rSync.matched_mrs.join(',') + ', auto-linked=' + mrRef.externalId + ', envelope.version=' + syncEnv.version + ', state-updated=' + mrRefB.meta.state + ')')
}

function findTool(name, registered) {
  return registered.find((d) => d && d.name === name)
}

await loadClient()
await loadHost()
console.log('ALL OK: git 插件产物可在受限环境加载，端到端逻辑通过')
