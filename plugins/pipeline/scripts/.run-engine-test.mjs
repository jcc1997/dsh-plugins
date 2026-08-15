// 引擎级回归测试（UC A 组）：esbuild 打包 .engine-test-entry.ts → /tmp 执行
// 用法：node scripts/run-engine-test.mjs
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { rmSync } from 'node:fs'
import { execSync } from 'node:child_process'
const root = dirname(fileURLToPath(import.meta.url))
const out = '/tmp/dsh-pipeline-engine-test.mjs'
try { rmSync(out, { force: true }) } catch { /* ignore */ }
await build({
  entryPoints: [join(root, '.engine-test-entry.ts')],
  bundle: true, platform: 'node', format: 'esm', target: 'es2022',
  outfile: out, logLevel: 'warning',
})
execSync('node ' + out, { stdio: 'inherit' })
