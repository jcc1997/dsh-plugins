// LSP 查询脚本：tsserver（typescript language server）stdin/stdout 协议
// 用途：会话内读代码时快速定位——指定文件 + 行 + 列 → 输出定义位置与 quickinfo（含类型）
// 用法：node scripts/lsp-query.mjs <file> <line> <col>
// 示例：node scripts/lsp-query.mjs plugins/kanban/src/client/page.tsx 30 10
// 输出：{ file, line, col, definition?: {file,line,col}, quickinfo?: string, documentation?: string }
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// 解析 typescript 的 tsserver 入口（root 或上溯 node_modules）
function resolveTsserver() {
  for (const base of [root, join(root, 'plugins/kanban'), join(root, 'plugins/git')]) {
    try {
      const req = createRequire(join(base, 'package.json'))
      return req.resolve('typescript/lib/tsserver.js')
    } catch { /* 继续 */ }
  }
  throw new Error('typescript not found — run: pnpm -w add -D typescript')
}

const [fileArg, lineArg, colArg] = process.argv.slice(2)
if (!fileArg || !lineArg || !colArg) {
  console.error('usage: node scripts/lsp-query.mjs <file> <line> <col>')
  process.exit(1)
}
const file = resolve(root, fileArg)
const line = parseInt(lineArg, 10)
const col = parseInt(colArg, 10)

const tsserver = spawn(process.execPath, [resolveTsserver()], { cwd: root, stdio: ['pipe', 'pipe', 'pipe'] })
let buf = ''
const pending = new Map()
let seq = 0

function send(command, arguments_) {
  const msg = { seq: ++seq, type: 'request', command, arguments: arguments_ }
  const body = JSON.stringify(msg)
  tsserver.stdin.write(JSON.stringify(msg) + '\n') // tsserver 输入协议：逐行 JSON
  return seq
}

tsserver.stdout.on('data', (chunk) => {
  buf += chunk.toString('utf8')
  let idx
  while ((idx = buf.indexOf('\r\n\r\n')) >= 0) {
    const header = buf.slice(0, idx)
    const len = Number(/Content-Length: (\d+)/.exec(header)?.[1] ?? 0)
    if (buf.length < idx + 4 + len) break
    const body = buf.slice(idx + 4, idx + 4 + len)
    buf = buf.slice(idx + 4 + len)
    let msg
    try { msg = JSON.parse(body) } catch { continue }
    const waiter = pending.get(msg.request_seq)
    if (waiter) { pending.delete(msg.request_seq); waiter(msg) }
  }
})

function request(command, arguments_) {
  return new Promise((resolve2) => {
    const id = send(command, arguments_)
    pending.set(id, resolve2)
  })
}

const timeout = setTimeout(() => { console.error('tsserver timeout (pending=' + [...pending.keys()].join(',') + ')'); process.exit(1) }, 30000)

const sleep = (ms) => new Promise((res) => setTimeout(res, ms))
try {
  await request('configure', { hostInfo: 'dsh-lsp-query', preferences: {} })
  await request('open', { file })
  // 等项目加载（首次全量类型检查可能数秒）；definition 空则重试一次
  await sleep(3000)
  const [def, quick] = await Promise.all([
    request('definition', { file, line, offset: col }),
    request('quickinfo', { file, line, offset: col }),
  ])
  const out = { file: fileArg, line, col }
  if (!def?.body?.length || !quick?.body) {
    await sleep(2500)
    const [def2, quick2] = await Promise.all([
      request('definition', { file, line, offset: col }),
      request('quickinfo', { file, line, offset: col }),
    ])
    if (def?.body?.length) { /* keep first */ } else if (def2?.body?.length) { def.body = def2.body }
    if (!quick?.body && quick2?.body) quick.body = quick2.body
  }
  if (def?.body?.length) {
    const d = def.body[0]
    out.definition = { file: d.file.replace(root + '/', ''), line: d.start.line, col: d.start.offset }
  }
  if (quick?.body) {
    out.quickinfo = quick.body.displayString
    out.documentation = Array.isArray(quick.body.documentation) ? quick.body.documentation.slice(0, 2).map((d) => d.text).join(' ') : String(quick.body.documentation || '')
  }
  console.log(JSON.stringify(out, null, 2))
} catch (e) {
  console.error('lsp query failed:', e.message)
  process.exit(1)
} finally {
  clearTimeout(timeout)
  tsserver.kill()
}