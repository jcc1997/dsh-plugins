// scripts/workflow-ci-check.mjs — 工作流 Testing 阶段的仓库级验证脚本
// 跑全部插件的正式形态验证(verify-dist:host 工具/路由/服务 + client ModuleLoader 真实执行)。
// 由 pipeline「三插件验证」的 exec 节点调用;也可本地直接 node 执行。
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(fileURLToPath(import.meta.url)) + '/..'
const plugins = ['kanban', 'git', 'pipeline', 'markdown-review']

const results = []
let failed = false
for (const name of plugins) {
  const dir = join(root, 'plugins', name)
  const t0 = Date.now()
  try {
    execSync('node scripts/verify-dist.mjs', { cwd: dir, stdio: 'pipe', timeout: 120000 })
    results.push({ plugin: name, ok: true, ms: Date.now() - t0 })
    console.log('[CI] ' + name + ' OK (' + (Date.now() - t0) + 'ms)')
  } catch (e) {
    failed = true
    const out = String(e && e.stdout ? e.stdout : e)
    results.push({ plugin: name, ok: false, ms: Date.now() - t0, error: out.slice(-500) })
    console.log('[CI] ' + name + ' FAILED')
    console.log(out.slice(-800))
  }
}
console.log('[CI] summary:', JSON.stringify(results))
if (failed) process.exit(1)
console.log('[CI] ALL PASS')
