// client/showcase.tsx — 组件展示页(开发用:http://127.0.0.1:3080/md-api/showcase)
// 把所有 mdr 组件铺开渲染,便于对照微调;自带宿主 tokens(design-platform.css)+ mdrCss + composerCss。
import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import tokensCss from '../../../../packages/ui/dsh/design-platform.css'
import { mdrCss } from './styles'
import { Composer, composerCss, IconCheckOutline16, IconCloseOutline16, IconTrashOutline16 } from '@dsh-plugins/ui'
import { MdViewer } from './card'
import { parseMarkdownBlocks, renderBlocks } from './md'

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

function Showcase() {
  const [note, setNote] = useState('多行模式:输入增多后按钮落到最下面一行,输入横向撑满。' + '再来一行看看自动增高。')
  const [single, setSingle] = useState('')
  return (
    <div className="sc-page">
      <h2 className="sc-head">dsh-markdown-review 组件展示页(微调用)</h2>
      <Section title="按钮(主/次/危险/禁用)">
        <div className="sc-row">
          <button className="mdr-btn mdr-btn-primary">主按钮</button>
          <button className="mdr-btn">次按钮</button>
          <button className="mdr-btn" disabled>禁用</button>
        </div>
      </Section>
      <Section title="icon 按钮(28×28 圆 + hover 背景;确认/删除/关闭)">
        <div className="sc-row">
          <button className="mdr-icon-btn mdr-icon-confirm"><IconCheckOutline16 /></button>
          <button className="mdr-icon-btn"><IconCloseOutline16 /></button>
          <button className="mdr-icon-btn"><IconTrashOutline16 /></button>
          <button className="mdr-icon-btn" disabled><IconCheckOutline16 /></button>
        </div>
      </Section>
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
              <div className="mdr-card-quote">
                <div className="mdr-card-quote-text">选中原文示例</div>
                <div className="mdr-card-quote-note">批注示例</div>
              </div>
              <div className="mdr-card-comment">总评:整体意见示例</div>
            </div>
          </div>
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
      <Section title="划词批注框(左:选中原文 / 右:批注输入)">
        <div className="mdr-editor">
          <div className="mdr-editor-quote">选中原文示例:这是一段被划词选中的文字,出现在批注框左侧。</div>
          <Composer value="" onChange={() => {}} placeholder="对这段的批注…" actions={<>
            <button className="mdr-icon-btn"><IconCloseOutline16 /></button>
            <button className="mdr-icon-btn mdr-icon-confirm"><IconCheckOutline16 /></button>
          </>} />
        </div>
      </Section>
      <Section title="markdown 渲染(标题/列表/表格/代码/mermaid/图片)">
        <div className="mdr-content sc-md">{renderBlocks(parseMarkdownBlocks(DEMO_MD))}</div>
      </Section>
      <Section title="大浮窗(真实组件,可交互)">
        <MdViewer
          doc={{ ok: true, docId: 'showcase', path: '/tmp/demo.md', title: '组件展示文档', markdown: DEMO_MD }}
          onClose={() => {}}
          onSubmit={async (p) => { console.log('submit', p); return { ok: true } }}
        />
      </Section>
    </div>
  )
}


export function render(root: HTMLElement) {
  const style = document.createElement('style')
  style.textContent = tokensCss + mdrCss + composerCss + `
.sc-page{padding:24px 32px;max-width:1240px;margin:0 auto;font-family:inherit}
.sc-head{font-size:16px;margin-bottom:16px}
.sc-sec{margin-bottom:28px}
.sc-title{font-size:14px;font-weight:600;margin-bottom:12px;color:var(--dsw-alias-label-secondary)}
.sc-row{display:flex;gap:12px;align-items:center}
.sc-card-col{display:flex;flex-direction:column;gap:12px;max-width:640px}
.sc-md{border:1px solid var(--dsw-alias-border-l2);border-radius:12px;max-height:480px}
.sc-page .mdr-mask{position:relative;inset:auto;background:none;justify-content:flex-start}
.sc-page .mdr-viewer{width:100%;height:640px}
`
  document.head.appendChild(style)
  createRoot(root).render(<Showcase />)
}
