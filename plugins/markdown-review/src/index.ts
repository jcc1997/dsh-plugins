// src/index.ts — dsh-markdown-review 宿主半(正式 bundle 形态)
// 核心机制:md_doc_open 工具「调用即阻塞」——读取本地 markdown → 挂起等待用户在对话流组件里
// 划词批注并提交 → 提交内容成为工具结果,agent 自动继续。
// 模式照抄宿主内置 tool-ask-user 的 execute(args, exec) 阻塞式交互,但 pending→路由→resolve 全部自实现,
// 不依赖宿主的 userQuestions/approval 内置服务。
import { defineTool } from '@deepseek-ai/dsh-tools'
import { readFileSync, statSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve as resolvePath, basename } from 'node:path'
import { createHash } from 'node:crypto'

const name = 'dsh-markdown-review'
const inject = ['tools', 'webServer']
const DATA_DIR = join(homedir(), '.dsh', 'markdown-review')
const MAX_SIZE = 2 * 1024 * 1024
const SUBMIT_TIMEOUT_MS = 30 * 60 * 1000

function expandTilde(p: string): string {
  if (p === '~') return homedir()
  if (p.startsWith('~/') || p.startsWith('~\\')) return join(homedir(), p.slice(2))
  return p
}

/** 读取本地 markdown:返回 {ok, docId, path, title, markdown, size} 或 {ok:false, error} */
function readDoc(rawPath: string, titleIn?: string): any {
  const abs = resolvePath(expandTilde(rawPath.trim()))
  try {
    const st = statSync(abs)
    if (!st.isFile()) return { ok: false, error: '不是文件: ' + abs }
    if (st.size > MAX_SIZE) return { ok: false, error: '文件过大(>2MB): ' + abs }
    const markdown = readFileSync(abs, 'utf8')
    const docId = createHash('sha1').update(abs).digest('hex').slice(0, 16)
    const title = (titleIn && String(titleIn).trim()) || basename(abs)
    return { ok: true, docId, path: abs, title, markdown, size: st.size }
  } catch (e) {
    return { ok: false, error: '读取失败: ' + String((e as Error).message || e) }
  }
}

/** 持久化一次提交(尽力而为,失败不影响工具结果) */
function persistSubmission(sub: any): void {
  try {
    mkdirSync(DATA_DIR, { recursive: true })
    const file = join(DATA_DIR, 'submissions.json')
    const list = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : []
    list.push(sub)
    writeFileSync(file, JSON.stringify(list.slice(-200), null, 2))
  } catch { /* 持久化失败不阻断 */ }
}

export function apply(ctx: any) {
  const tools = ctx.get('tools')
  const webServer = ctx.get('webServer')
  if (!tools || !webServer) return

  /** docId → {resolve, reject, timer, path, title, context} */
  const pending = new Map<string, { resolve: (v: any) => void; reject: (e: Error) => void; timer: any; path: string; title: string; context: string }>()

  /** 注册精确路由(与 kanban 同款:req 为 body 异步迭代器,res.writeHead/end 回 JSON) */
  const route = (path: string, handler: (payload: any) => Promise<any> | any) => {
    webServer.register({
      kind: 'exact',
      path,
      handler: async (req: any, res: any) => {
        try {
          let body = ''
          for await (const chunk of req) body += chunk
          const payload = body ? JSON.parse(body) : {}
          const out = await handler(payload)
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(out))
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: false, error: String((e as Error).message || e) }))
        }
      },
    })
  }

  // 卡片读取文档内容(打开按钮点击时调用)
  route('/md-api/read', (payload: any) => readDoc(String(payload && payload.path || ''), payload && payload.title))

  // 提交:resolve 挂起的工具执行
  route('/md-api/submit', (payload: any) => {
    const docId = String(payload && payload.docId || '')
    const entry = pending.get(docId)
    if (!entry) return { ok: false, error: '没有待提交的审阅(可能已提交或超时)' }
    clearTimeout(entry.timer)
    pending.delete(docId)
    const quotes = Array.isArray(payload && payload.quotes) ? payload.quotes : []
    const comment = payload && payload.comment !== undefined ? String(payload.comment) : ''
    const cancelled = payload && payload.cancelled === true
    persistSubmission({ docId, path: entry.path, title: entry.title, quotes, comment, cancelled, at: new Date().toISOString() })
    entry.resolve({ ok: true, docId, quotes, comment, cancelled })
    return { ok: true }
  })

  tools.register(defineTool({
    name: 'md_doc_open',
    description: '在对话流中打开一份本地 markdown 文档供用户审阅(划词批注 + 总评)。调用后工具保持运行直到用户提交或取消;提交内容(逐条引用+批注+总评)作为本工具结果返回,据此继续后续流程(如打确认标签、推进列)。适合人工审批点:把要审的文档(如 docs/<taskId>/td.md)展示给人。',
    parameters: {
      path: { type: 'string', required: true, description: '本地 markdown 文件绝对路径(支持 ~ 展开),如 ~/repo/docs/dsh-plugins-1/td.md' },
      title: { type: 'string', description: '展示标题(可选,默认取文件名)' },
      context: { type: 'string', description: '一句话说明为什么需要审阅(可选,展示在卡片上)' },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args: unknown, value: unknown) => [{ type: 'text', text: '文档审阅提交:\n' + JSON.stringify(value, null, 2) }],
    },
    async execute(args: any, exec: any) {
      const rawPath = String(args && args.path || '').trim()
      if (!rawPath) return { ok: false, error: 'path is required' }
      const doc = readDoc(rawPath, args && args.title)
      if (!doc.ok) return doc
      const context = args && args.context !== undefined ? String(args.context) : ''
      const docId = doc.docId
      if (pending.has(docId)) return { ok: false, error: '该文档已有待处理的审阅,请先完成上一次提交' }
      return await new Promise<any>((resolve) => {
        const settle = (value: any) => {
          const e = pending.get(docId)
          if (e) { clearTimeout(e.timer); pending.delete(docId) }
          resolve(value)
        }
        const timer = setTimeout(() => settle({ ok: false, docId, error: '等待提交超时(30 分钟)' }), SUBMIT_TIMEOUT_MS)
        pending.set(docId, { resolve, reject: () => {}, timer, path: doc.path, title: doc.title, context })
        const signal = exec && exec.signal
        if (signal) {
          if (signal.aborted) { settle({ ok: false, docId, error: 'aborted' }); return }
          signal.addEventListener('abort', () => settle({ ok: false, docId, error: 'aborted' }), { once: true })
        }
      })
    },
  }))
}

export { name, inject }
