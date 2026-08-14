// 构建：TS/TSX 源码 → 正式 bundle 双产物
// lib/index.js   — host 半（ESM/node；@deepseek-ai/* external；@dsh-plugins/ui 打进包）
// lib/client.js  — client 半（CJS/browser；banner/footer 包成 window.__ModuleLoader__.load 格式；
//                   react external 由 web 端 ModuleLoader 供应；@dsh-plugins/ui 打进包）
import { build } from 'esbuild'
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const id = pkg.name
const tmp = join(root, 'lib', '.tmp.js')
mkdirSync(join(root, 'lib'), { recursive: true })

const base = { bundle: true, minify: true, target: 'es2022', logLevel: 'warning', sourcemap: false }

// host：ESM node（@deepseek-ai/* external；@dsh-plugins/ui 打进包）
await build({
  ...base,
  entryPoints: [join(root, 'src', 'index.ts')],
  format: 'esm',
  platform: 'node',
  external: ['@deepseek-ai/*'],
  outfile: join(root, 'lib', 'index.js'),
})

// client：CJS browser + ModuleLoader 包装（同社区样板 dsh-kanban 的 tsdown banner/footer）
await build({
  ...base,
  entryPoints: [join(root, 'src', 'client', 'index.ts')],
  format: 'cjs',
  platform: 'browser',
  jsx: 'automatic', // JSX 编译为 jsx-runtime 调用（不依赖 React 全局标识符；icons.tsx 等无 React import 的文件也安全）
  external: ['react', 'react/jsx-runtime', 'react-dom', '@deepseek-ai/*'],
  outfile: tmp,
  banner: { js: 'var module = { exports: {} }; var exports = module.exports; window.__ModuleLoader__.load({ id: ' + JSON.stringify(id) + ', factory: (require) => {' },
  footer: { js: 'return module.exports; } });' },
})
const cjs = readFileSync(tmp, 'utf8')
writeFileSync(join(root, 'lib', 'client.js'), cjs)
rmSync(tmp, { force: true })
console.log('[' + id + '] lib/index.js + lib/client.js built')

// 类型声明（简化：tsc 产出，失败不阻断）
try {
  const { execSync } = await import('node:child_process')
  execSync('npx tsc -p tsconfig.json --declaration --emitDeclarationOnly --outDir lib/types 2>/dev/null || true', { cwd: root })
} catch { /* ignore */ }