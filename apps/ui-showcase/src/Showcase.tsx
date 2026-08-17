// src/Showcase.tsx — dsh-plugins UI 组件库画廊(独立开发服务,不依赖宿主)
// 组件来源:packages/ui(Composer/icons)+ plugins/markdown-review(工具卡/浮窗/批注/markdown)+ plugins/pipeline(工具卡/节点图/控件)
// 后续组件沉淀进 packages/ui 后,这里随包同步展示。
import React, { useEffect, useState } from 'react'
import { Composer, IconCheckOutline16, IconCloseOutline16, IconDarkOutline16, IconLightOutline16, IconTrashOutline16, Modal } from '@dsh-plugins/ui'
import { MdViewer } from '../../../plugins/markdown-review/src/client/card'
import { parseMarkdownBlocks, renderBlocks } from '../../../plugins/markdown-review/src/client/md'
import { PipelineDock } from '../../../plugins/pipeline/src/client/dock'
import { NodeGraph } from '../../../plugins/pipeline/src/client/graph'

// ── pipeline demo:mock /pipeline-api 接口(dock 条数据,不依赖真实后端) ──
const DEMO_DOCK_RUNS: any = [
  { id: 'run-abc123', pipelineId: 'p1', pipelineName: '视频转 mp3', status: 'running', version: 'v0.3.0', createdAt: '2026-08-15T10:00:00Z', done: 2, total: 5, error: '', output: null },
  { id: 'run-def456', pipelineId: 'p2', pipelineName: '文档总结', status: 'queued', version: 'v1.0.0', createdAt: '2026-08-15T09:58:00Z', done: 0, total: 3, error: '', output: null },
  { id: 'run-ghi789', pipelineId: 'p3', pipelineName: '数据抓取', status: 'success', version: 'v0.1.0', createdAt: '2026-08-15T09:30:00Z', done: 4, total: 4, error: '', output: { rows: 128 } },
  { id: 'run-jkl012', pipelineId: 'p4', pipelineName: '网页转 pdf', status: 'failed', version: 'v0.2.0', createdAt: '2026-08-15T08:00:00Z', done: 2, total: 4, error: 'fetch timeout', output: null },
]
const originalFetch = window.fetch.bind(window)
window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input)
  if (url.startsWith('/pipeline-api/dock-runs')) {
    // 模拟运行推进:第 3 轮后 run-abc123 完成
    const d = window as any
    d.__dockPolls = (d.__dockPolls || 0) + 1
    if (d.__dockPolls >= 3) {
      DEMO_DOCK_RUNS[0].status = 'success'
      DEMO_DOCK_RUNS[0].done = 5
      DEMO_DOCK_RUNS[0].output = { mp3: '/tmp/demo.mp3' }
      DEMO_DOCK_RUNS[1].status = 'running'
      DEMO_DOCK_RUNS[1].done = 1
    }
    return Promise.resolve(new Response(JSON.stringify({ ok: true, runs: DEMO_DOCK_RUNS }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
  }
  return originalFetch(input, init)
}) as typeof fetch

// 节点图 demo 数据(覆盖全部类型徽章)
const DEMO_GRAPH_NODES = [
  { id: 'g1', title: '读取文档', type: 'input', order: 0, inputs: [], config: { path: '/tmp/a.md' } },
  { id: 'g2', title: 'LLM 总结', type: 'llm', order: 1, inputs: ['g1'], config: { model: 'deepseek' } },
  { id: 'g3', title: '调用子流水线', type: 'pipeline', order: 2, inputs: ['g2'], config: { ref: 'other@1.0.0' } },
  { id: 'g4', title: '执行命令', type: 'exec', order: 3, inputs: ['g3'], config: { cmd: 'ffmpeg -i a.mp3 b.mp3' } },
  { id: 'g5', title: '抓取网页', type: 'fetch', order: 4, inputs: ['g4'], config: { url: 'https://example.com' } },
  { id: 'g6', title: '输出结果', type: 'output', order: 5, inputs: ['g5'], config: {} },
] as any

const DEMO_MD = [
  '# 组件展示文档',
  '',
  '这是一段正文,含 **加粗**、*斜体*、`行内代码` 与 [链接](https://github.com)。',
  '',
  '## 列表',
  '- 列表项一',
  '- 列表项二',
  '  - 嵌套项 A',
  '',
  '## 表格',
  '| 阶段 | 产出 |',
  '|---|---|',
  '| RD | 设计文档 |',
  '| TD | 技术设计 |',
  '',
  '## 代码块',
  '```js',
  'const a = 1',
  '```',
  '',
  '## mermaid',
  '```mermaid',
  'flowchart LR',
  '  A[需求] --> B[设计]',
  '  B --> C[开发]',
  '  C --> D[上线]',
  '```',
  '',
  '## 图片',
  '![演示图](https://picsum.photos/seed/dsh-md/640/320)',
].join('\n')

function Section(props: { title: string; children: React.ReactNode }) {
  return (
    <section className="sc-sec">
      <h3 className="sc-title">{props.title}</h3>
      {props.children}
    </section>
  )
}

type TabId = 'base' | 'md' | 'pipeline' | 'kanban'

const TABS: { id: TabId; label: string }[] = [
  { id: 'base', label: '基础组件' },
  { id: 'md', label: 'Markdown 审阅' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'kanban', label: '看板' },
]

function Tabs(props: { value: TabId; onChange: (id: TabId) => void }) {
  return (
    <nav className="sc-tabs" role="tablist" aria-label="组件模块">
      {TABS.map((t) => (
        <button key={t.id} className={'sc-tab' + (props.value === t.id ? ' sc-tab-on' : '')} type="button" role="tab" aria-selected={props.value === t.id} onClick={() => props.onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </nav>
  )
}

export function Showcase() {
  const [note, setNote] = useState('多行模式:输入增多后按钮落到最下面一行,输入横向撑满。再来一行看看自动增高。')
  const [single, setSingle] = useState('')
  const [tab, setTab] = useState<TabId>('base')
  // 暗黑模式:宿主 token 深色定义在 body[data-ds-dark-theme],toggle 即切换该属性
  const [dark, setDark] = useState(false)
  useEffect(() => {
    if (dark) document.body.setAttribute('data-ds-dark-theme', '')
    else document.body.removeAttribute('data-ds-dark-theme')
  }, [dark])
  return (
    <div className="sc-page">
      <div className="sc-head">
        <h2>dsh-plugins UI 组件库 Showcase(独立开发服务)</h2>
        <button className="mdr-btn" type="button" title="切换明暗主题" onClick={() => setDark((d) => !d)}>
          {dark ? <IconLightOutline16 /> : <IconDarkOutline16 />}
          {dark ? '浅色' : '暗色'}
        </button>
      </div>
      <div className="sc-layout">
      <Tabs value={tab} onChange={setTab} />
      <div className="sc-content">
      {tab === 'base' ? (
        <>
          <Section title="按钮(宿主胶囊契约)">
            <div className="sc-row">
              <button className="mdr-btn mdr-btn-primary">主按钮</button>
              <button className="mdr-btn">次按钮</button>
              <button className="mdr-btn" disabled>禁用</button>
            </div>
          </Section>
          <Section title="icon 按钮(28×28 圆 + hover 背景)">
            <div className="sc-row">
              <button className="mdr-icon-btn mdr-icon-confirm"><IconCheckOutline16 /></button>
              <button className="mdr-icon-btn"><IconCloseOutline16 /></button>
              <button className="mdr-icon-btn"><IconTrashOutline16 /></button>
              <button className="mdr-icon-btn" disabled><IconCheckOutline16 /></button>
            </div>
          </Section>
          <Section title="Composer(单行:按钮右侧同行)">
            <Composer value={single} onChange={setSingle} placeholder="单行输入…" actions={<>
              <button className="mdr-icon-btn"><IconCloseOutline16 /></button>
              <button className="mdr-icon-btn mdr-icon-confirm"><IconCheckOutline16 /></button>
            </>} />
          </Section>
          <Section title="Composer(多行:输入撑满,按钮落最下面一行)">
            <Composer value={note} onChange={setNote} placeholder="多行输入…" actions={<>
              <button className="mdr-icon-btn"><IconCloseOutline16 /></button>
              <button className="mdr-icon-btn mdr-icon-confirm"><IconCheckOutline16 /></button>
            </>} />
          </Section>
        </>
      ) : null}
      {tab === 'md' ? (
        <>
          <Section title="对话流工具卡(待审阅 / 已提交摘要)">
            <div className="sc-card-col">
              <div className="mdr-card">
                <div className="mdr-card-head">
                  <span className="mdr-card-title">文档审阅</span>
                  <span className="mdr-card-file">workflow-template/README.md</span>
                  <span className="mdr-card-status">待审阅</span>
                </div>
                <div className="mdr-card-context">一句话说明为什么需要审阅</div>
                <button className="mdr-btn mdr-btn-primary">打开文档</button>
              </div>
              <div className="mdr-card">
                <div className="mdr-card-head">
                  <span className="mdr-card-title">文档审阅</span>
                  <span className="mdr-card-file">workflow-template/README.md</span>
                  <span className="mdr-card-status">已提交</span>
                </div>
                <div className="mdr-card-summary">
                  <div className="mdr-card-count">3 条批注</div>
                  <div className="mdr-card-comment">总评:整体意见示例</div>
                </div>
              </div>
            </div>
          </Section>
          <Section title="划词批注框(内嵌文档流;淡灰底 + 引用文字#行号 + 紧凑输入)">
            <div className="mdr-editor">
              <div className="mdr-editor-quote">选中原文示例:这是一段被划词选中的文字,带行号定位。<span className="mdr-editor-line">#L12</span></div>
              <Composer value="" onChange={() => {}} placeholder="对这段的批注…" compact actions={<>
                <button className="mdr-icon-btn"><IconCloseOutline16 /></button>
                <button className="mdr-icon-btn mdr-icon-confirm"><IconCheckOutline16 /></button>
              </>} />
            </div>
          </Section>
          <Section title="markdown 渲染(标题/列表/表格/代码/mermaid/图片)">
            <div className="mdr-content sc-md">{renderBlocks(parseMarkdownBlocks(DEMO_MD))}</div>
          </Section>
          <Section title="大浮窗(真实组件,可划词)">
            <div className="sc-viewer-wrap">
              <MdViewer
                doc={{ ok: true, docId: 'showcase', path: '/tmp/demo.md', title: '组件展示文档', markdown: DEMO_MD }}
                onClose={() => {}}
                onSubmit={async (p) => { console.log('submit', p); return { ok: true } }}
              />
            </div>
          </Section>
        </>
      ) : null}
      {tab === 'pipeline' ? (
        <>
          <Section title="常驻 dock 条(conversation.input.dock,Composer 上方;todo 式运行列表,轮询推进)">
            <div style={{ maxWidth: 640 }}>
              <PipelineDock />
            </div>
          </Section>
          <Section title="节点图(React Flow,只读模式)">
            <div style={{ height: 480, border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 12 }}>
              <NodeGraph
                nodes={DEMO_GRAPH_NODES}
                selectedId=""
                readonly
                onSelect={() => {}}
                onAdd={() => {}}
                onAddEdge={() => {}}
                onDelete={() => {}}
                onMove={() => {}}
                onAddTail={() => {}}
              />
            </div>
          </Section>
          <Section title="控件(按钮/输入/徽章/版本行)">
            <div className="sc-row" style={{ flexWrap: 'wrap', gap: 8 }}>
              <button className="plp-btn plp-primary">主按钮</button>
              <button className="plp-btn">次按钮</button>
              <button className="plp-btn plp-danger">危险按钮</button>
              <button className="plp-btn" disabled>禁用</button>
              <button className="plp-icon-btn" title="图标按钮"><IconTrashOutline16 /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
              <div className="plp-field">
                <label className="plp-field-label">输入框(零高亮)</label>
                <input className="plp-input" placeholder="输入点什么…" />
              </div>
              <div className="plp-field">
                <label className="plp-field-label">选择框</label>
                <select className="plp-select"><option>atomic</option><option>combined</option></select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              <span className="plp-badge">atomic</span>
              <span className="plp-badge plp-badge-kind">combined</span>
              <span className="plp-version">v0.1.0</span>
              <span className="plp-ver-latest">最新</span>
              <span className="plp-graph-type plp-graph-type-input">input</span>
              <span className="plp-graph-type plp-graph-type-llm">llm</span>
              <span className="plp-graph-type plp-graph-type-pipeline">pipeline</span>
              <span className="plp-graph-type plp-graph-type-exec">exec</span>
              <span className="plp-graph-type plp-graph-type-fetch">fetch</span>
              <span className="plp-graph-type plp-graph-type-output">output</span>
            </div>
            <div style={{ maxWidth: 560, marginTop: 12 }}>
              <div className="plp-ver-row"><span className="plp-ver-chip plp-ver-published">v0.1.0</span><span className="plp-ver-meta">已发布</span><span className="plp-ver-latest">已发布</span></div>
              <div className="plp-ver-row plp-ver-row-sel"><span className="plp-ver-chip plp-ver-draft">v0.2.0</span><span className="plp-ver-meta">草稿</span><span className="plp-ver-latest">最新</span></div>
            </div>
            <div className="plp-run" style={{ maxWidth: 560, marginTop: 12 }}>
              <span className="plp-run-status plp-st-running" />
              <div className="plp-run-main">
                <div className="plp-run-title">视频转 mp3</div>
                <div className="plp-run-meta"><span className="plp-run-id">run-abc123</span><span>节点 2/5 · 40%</span></div>
              </div>
            </div>
          </Section>
        </>
      ) : null}
      {tab === 'kanban' ? (
        <>
          <Section title="看板列与卡片">
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              {[
                { name: '待办', cards: [{ t: 'UI 规范对齐', d: 'tokens 快照迁移', tag: 'ui' }, { t: '批注行号', d: '划中文字#L11-13', tag: 'md' }] },
                { name: '进行中', cards: [{ t: 'pipeline dock', d: 'todo 式常驻条', tag: 'pipeline' }] },
                { name: '已完成', cards: [{ t: '宿主桥', d: 'icons re-export', tag: 'ui' }] },
              ].map((col) => (
                <div key={col.name} className="kbnb-col" style={{ width: 240 }}>
                  <div className="kbnb-col-head">
                    <span className="kbnb-col-title">{col.name}</span>
                    <span className="kbnb-col-count">{col.cards.length}</span>
                  </div>
                  {col.cards.map((c) => (
                    <div key={c.t} className="kbnb-ticket">
                      <div className="kbnb-ticket-title">{c.t}</div>
                      {c.d ? <div className="kbnb-ticket-desc">{c.d}</div> : null}
                      <span className="kbnb-tag">{c.tag}</span>
                    </div>
                  ))}
                  <div className="kbnb-add-ticket">+ 添加Ticket</div>
                </div>
              ))}
            </div>
          </Section>
          <Section title="看板控件(按钮/输入/徽章)">
            <div className="sc-row" style={{ flexWrap: 'wrap', gap: 8 }}>
              <button className="kbnb-btn kbnb-primary">主按钮</button>
              <button className="kbnb-btn">次按钮</button>
              <button className="kbnb-btn kbnb-danger">危险按钮</button>
              <button className="kbnb-btn" disabled>禁用</button>
              <button className="kbnb-icon-btn" title="图标按钮"><IconTrashOutline16 /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
              <div className="kbnb-field">
                <label className="kbnb-field-label">输入框(零高亮)</label>
                <input className="kbnb-input" placeholder="卡片标题…" />
              </div>
              <div className="kbnb-field">
                <label className="kbnb-field-label">文本域</label>
                <textarea className="kbnb-textarea" style={{ minHeight: 60 }} placeholder="描述…" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              <span className="kbnb-tag">ui</span>
              <span className="kbnb-tag">workflow</span>
              <span className="kbnb-arch-col">归档</span>
              <span className="kbnb-activity-actor">agent</span>
            </div>
          </Section>
        </>
      ) : null}
      </div>
      </div>
    </div>
  )
}
