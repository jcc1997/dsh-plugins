// 构建脚本：TS/TSX 源码 → 单文件纯 JS 函数体（供 cordis_define 加载）
// 产物格式：`return (() => { ...bundle... })()` 或 `var __KB__ = ...; return __KB__.default`
// 用法：node build.mjs [--watch]
import { build } from 'esbuild'
import { readFile, writeFile, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(fileURLToPath(import.meta.url))
const tmp = join(root, 'dist', '.tmp-bundle.js')

const base = {
  bundle: true,
  format: 'iife',
  globalName: '__KB__',
  jsx: 'automatic',
  jsxImportSource: 'react',
  alias: { 'react': join(root, 'shims', 'react.js'), 'react/jsx-runtime': join(root, 'shims', 'jsx-runtime.js') },

  define: { 'process.env.NODE_ENV': '"production"' },
  target: 'es2020',
  minify: true,
  outfile: tmp,
  loader: { '.woff': 'empty', '.woff2': 'empty', '.ttf': 'empty', '.eot': 'empty', '.svg': 'empty' },
  logLevel: 'warning',
}

/** 把 esbuild iife 产物（含 external react 的 import 行）转成受限环境函数体 */
async function toPluginBody(outfile, globalName) {
  let code = await readFile(tmp, 'utf8')
  // 去掉 external react 的 import 行（new Function 里 import 是语法错误；
  // 删除后 React 引用落到受限环境注入的全局 React）
  code = code.replace(/^import[^\n]*from "react"[^\n]*;\n?/gm, '')
  // 产物形如 `var __KB__ = (() => {...})();` → 追加 return
  const body = code + '\nreturn ' + globalName + '.default;\n'
  await writeFile(outfile, body, 'utf8')
  await rm(tmp, { force: true })
}

async function run() {
  const watch = process.argv.includes('--watch')
  const opts = watch
    ? { ...base, watch: { onRebuild: async (err) => {
        if (err) { console.error('rebuild failed', err); return }
        try { await toPluginBody(join(root, 'dist', 'client.js'), '__KB__'); console.log('[kanban] client rebuilt -> dist/client.js') } catch (e) { console.error('post failed', e) }
      } } }
    : base

  // client
  await build({ ...opts, entryPoints: [join(root, 'src', 'client', 'entry.tsx')], minify: true })
  if (!watch) await toPluginBody(join(root, 'dist', 'client.js'), '__KB__')
  console.log('[kanban] client.js written')

  // host（无 react，纯 bundle）
  await build({
    bundle: true,
    entryPoints: [join(root, 'src', 'host', 'entry.ts')],
    format: 'iife',
    globalName: '__KBH__',
    target: 'es2020',
    minify: true,
    outfile: tmp,
    logLevel: 'warning',
    ...(watch ? { watch: { onRebuild: async (err) => {
      if (err) { console.error('host rebuild failed', err); return }
      try { await toPluginBody(join(root, 'dist', 'host.js'), '__KBH__'); console.log('[kanban] host rebuilt -> dist/host.js') } catch (e) { console.error('post failed', e) }
    } } } : {}),
  })
  if (!watch) await toPluginBody(join(root, 'dist', 'host.js'), '__KBH__')
  console.log('[kanban] host.js written')
  if (watch) console.log('[kanban] watching src/ ...')
}

async function makeSubmit() {
  const c = await readFile(join(root, 'dist', 'client.js'), 'utf8')
  const h = await readFile(join(root, 'dist', 'host.js'), 'utf8')
  const j = JSON.stringify({ client: c, host: h })
  fs.writeFileSync(join(root, 'dist', 'submit.json'), j)
  const SEG = 1900
  let start = 0, idx = 0
  while (start < j.length) {
    fs.writeFileSync('/tmp/kanban-segs/seg-' + String(idx).padStart(2, '0') + '.txt', j.slice(start, start + SEG) + '\n')
    start += SEG; idx++
  }
  console.log('[kanban] submit.json +', idx, 'segments ready (total', j.length, 'bytes)')
}

run().then(makeSubmit).catch((e) => { console.error(e); process.exit(1) })
