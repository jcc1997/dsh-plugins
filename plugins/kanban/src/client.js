return {
  name: 'kanban',
  apply(ctx) {
    const slots = ctx.get('slots')
    if (slots === undefined) return
    console.log('[kanban] client apply running')



    // ── 工具函数 ──────────────────────────────────────────────
    function safeId(prefix) {
      try {
        return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
      } catch (e) {
        return prefix + Math.floor(Math.random() * 1e9).toString(36)
      }
    }
    function safeNow() {
      try { return new Date().toISOString() } catch (e) { return undefined }
    }
    function inlineMd(text) {
      const nodes = []
      const push = (k, v) => nodes.push(React.createElement(k, { key: nodes.length }, v))
      let rest = text
      const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\))/
      while (rest.length > 0) {
        const m = rest.match(re)
        if (!m) { nodes.push(rest); break }
        if (m.index > 0) nodes.push(rest.slice(0, m.index))
        if (m[2] !== undefined) push('strong', m[2])
        else if (m[3] !== undefined) push('em', m[3])
        else if (m[4] !== undefined) push('code', m[4])
        else nodes.push(React.createElement('a', { key: nodes.length, href: m[6], target: '_blank', rel: 'noreferrer' }, m[5]))
        rest = rest.slice(m.index + m[0].length)
      }
      return nodes
    }
    function mdToElements(text) {
      const out = []
      const blocks = String(text || '').split(/\n{2,}/)
      for (const block of blocks) {
        const trimmed = block.trim()
        if (!trimmed) continue
        if (trimmed.startsWith('### ')) out.push(React.createElement('h3', { key: out.length }, inlineMd(trimmed.slice(4))))
        else if (trimmed.startsWith('## ')) out.push(React.createElement('h2', { key: out.length }, inlineMd(trimmed.slice(3))))
        else if (trimmed.startsWith('# ')) out.push(React.createElement('h1', { key: out.length }, inlineMd(trimmed.slice(2))))
        else if (/^[-*] /.test(trimmed)) {
          const items = trimmed.split(/\n(?=[-*] )/).map((line) => line.replace(/^[-*] /, ''))
          out.push(React.createElement('ul', { key: out.length }, items.map((it, i) => React.createElement('li', { key: i }, inlineMd(it)))))
        } else {
          out.push(React.createElement('p', { key: out.length }, inlineMd(trimmed)))
        }
      }
      return out
    }

    // ── 侧边栏按钮 ────────────────────────────────────────────
    function TrashIcon() {
      return React.createElement('svg', { width: 13, height: 13, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.2, 'aria-hidden': true },
        React.createElement('path', { d: 'M2.5 4.5h11M6 4.5V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M4 4.5l.7 8a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9l.7-8' }),
      )
    }
    function GearIcon() {
      return React.createElement('svg', { width: 13, height: 13, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.2, 'aria-hidden': true },
        React.createElement('circle', { cx: 8, cy: 8, r: 2.2 }),
        React.createElement('path', { d: 'M8 1.8v2M8 12.2v2M1.8 8h2M12.2 8h2M3.6 3.6l1.4 1.4M11 11l1.4 1.4M12.4 3.6L11 5M5 11l-1.4 1.4' }),
      )
    }
    function BoardIcon() {
      return React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.2, 'aria-hidden': true },
        React.createElement('rect', { x: 1.5, y: 2, width: 4, height: 12, rx: 1 }),
        React.createElement('rect', { x: 6, y: 2, width: 4, height: 8, rx: 1 }),
        React.createElement('rect', { x: 10.5, y: 2, width: 4, height: 5, rx: 1 }),
      )
    }
    function KanbanEntry(props) {
      const [open, setOpen] = React.useState(false)
      return React.createElement('div', null,
        React.createElement('button', {
          className: 'kbnb-side-btn' + (open ? ' kbnb-side-btn-on' : ''),
          type: 'button',
          title: '看板',
          'aria-label': '看板',
          onClick: () => { console.log('[kanban] sidebar button clicked, open=', !open); setOpen(!open) },
        }, props.wide ? [React.createElement(BoardIcon, { key: 'i' }), React.createElement('span', { key: 't' }, '看板')] : React.createElement(BoardIcon, null)),
        open ? React.createElement(KanbanPage, { onClose: () => setOpen(false) }) : null,
      )
    }

    // ── 看板页面 ──────────────────────────────────────────────
    function KanbanPage() {
      const [board, setBoard] = React.useState(null)
      const [dataDir, setDataDir] = React.useState('')
      const [error, setError] = React.useState('')
      const [modal, setModal] = React.useState(null)
      const [drag, setDrag] = React.useState(null)
      const [hint, setHint] = React.useState(null)
      const [saving, setSaving] = React.useState(false)

      React.useEffect(() => {
        host.call('kanban/load', {}).then((r) => {
          setBoard(r.board)
          setDataDir(r.dataDir)
        }).catch((e) => setError('加载失败: ' + String(e)))
      }, [])

      function save(next) {
        setBoard(next)
        setSaving(true)
        host.call('kanban/save', { board: next }).then(() => setSaving(false)).catch((e) => {
          setSaving(false)
          setError('保存失败: ' + String(e))
        })
      }
      function mutate(fn) {
        if (!board) return
        const next = JSON.parse(JSON.stringify(board))
        fn(next)
        save(next)
      }

      // ── 列操作（全部走 modal，无 window API）────────────────
      function submitColumn() {
        if (!modal) return
        const title = (modal.title || '').trim()
        if (!title) return
        if (modal.kind === 'newColumn') {
          mutate((b) => b.columns.push({ id: safeId('c'), title, cards: [], meta: {} }))
        } else if (modal.kind === 'renameColumn') {
          mutate((b) => { b.columns.find((c) => c.id === modal.columnId).title = title })
        }
        setModal(null)
      }
      function requestDeleteColumn(col) {
        if (col.cards.length > 0) {
          setModal({ kind: 'confirmDeleteColumn', columnId: col.id, title: col.title, count: col.cards.length })
        } else {
          mutate((b) => { b.columns = b.columns.filter((c) => c.id !== col.id) })
        }
      }
      function confirmDeleteColumn() {
        if (!modal) return
        mutate((b) => { b.columns = b.columns.filter((c) => c.id !== modal.columnId) })
        setModal(null)
      }
      function requestDeleteCard(columnId, cardId) {
        setModal({ kind: 'confirmDeleteCard', columnId, cardId })
      }
      function confirmDeleteCard() {
        if (!modal) return
        mutate((b) => {
          const col = b.columns.find((c) => c.id === modal.columnId)
          if (col) col.cards = col.cards.filter((k) => k.id !== modal.cardId)
        })
        setModal(null)
      }

      // ── 卡片操作 ────────────────────────────────────────────
      function openCard(columnId, card) {
        setModal({
          kind: 'card',
          columnId,
          cardId: card ? card.id : null,
          title: card ? card.title : '',
          description: card ? card.description || '' : '',
        })
      }
      function saveCard() {
        if (!modal || modal.kind !== 'card') return
        const title = (modal.title || '').trim()
        if (!title) return
        mutate((b) => {
          const col = b.columns.find((c) => c.id === modal.columnId)
          if (!col) return
          if (modal.cardId) {
            const card = col.cards.find((k) => k.id === modal.cardId)
            if (card) {
              card.title = title
              card.description = modal.description || ''
              card.updatedAt = safeNow()
            }
          } else {
            col.cards.push({ id: safeId('k'), title, description: modal.description || '', links: [], meta: {}, createdAt: safeNow(), updatedAt: safeNow() })
          }
        })
        setModal(null)
      }

      // ── 拖拽 ────────────────────────────────────────────────
      function computeCardIndex(evt) {
        const el = evt.currentTarget
        try {
          const cards = Array.from(el.children).filter((child) => child && child.getAttribute && child.getAttribute('data-card') !== null)
          for (let i = 0; i < cards.length; i++) {
            const r = cards[i].getBoundingClientRect()
            if (evt.clientY < r.top + r.height / 2) return i
          }
          return cards.length
        } catch (e) { return 0 }
      }
      function onColumnOver(columnId, evt) {
        evt.preventDefault()
        if (!drag) return
        if (drag.kind === 'card') setHint({ columnId, index: computeCardIndex(evt) })
      }
      function onColumnDrop(columnId, evt) {
        evt.preventDefault()
        if (!drag) return
        if (drag.kind === 'card') {
          const index = computeCardIndex(evt)
          mutate((b) => {
            const fromCol = b.columns.find((c) => c.id === drag.from)
            const toCol = b.columns.find((c) => c.id === columnId)
            if (!fromCol || !toCol) return
            const idx = fromCol.cards.findIndex((k) => k.id === drag.cardId)
            if (idx < 0) return
            const [card] = fromCol.cards.splice(idx, 1)
            if (fromCol.id === toCol.id) {
              let target = index
              if (idx < target) target -= 1
              toCol.cards.splice(target, 0, card)
            } else {
              toCol.cards.splice(index, 0, card)
            }
            card.updatedAt = safeNow()
          })
        } else if (drag.kind === 'column') {
          mutate((b) => {
            const from = drag.from
            const to = b.columns.findIndex((c) => c.id === columnId)
            if (from < 0 || to < 0 || from === to) return
            const [col] = b.columns.splice(from, 1)
            b.columns.splice(to, 0, col)
          })
        }
        setDrag(null)
        setHint(null)
      }
      function onDragEnd() {
        setDrag(null)
        setHint(null)
      }

      // ── 数据目录设置 ────────────────────────────────────────
      function saveDataDir() {
        if (!modal || modal.kind !== 'settings') return
        const dir = (modal.dir || '').trim()
        if (!dir) return
        host.call('kanban/set-data-dir', { dir }).then((r) => {
          if (r && r.ok) {
            setDataDir(r.dataDir)
            setModal(null)
          } else {
            setError('设置失败: ' + (r && r.error ? r.error : 'unknown'))
          }
        }).catch((e) => setError('设置失败: ' + String(e)))
      }

      if (!board) {
        return React.createElement('div', { className: 'kbnb-page' }, React.createElement('div', { className: 'kbnb-loading' }, error || '加载中…'))
      }

      const mCard = modal && modal.kind === 'card' ? modal : null
      const mSettings = modal && modal.kind === 'settings' ? modal : null
      const mCol = modal && (modal.kind === 'newColumn' || modal.kind === 'renameColumn') ? modal : null
      const mDelCol = modal && modal.kind === 'confirmDeleteColumn' ? modal : null
      const mDelCard = modal && modal.kind === 'confirmDeleteCard' ? modal : null

      return React.createElement('div', { className: 'kbnb-page' },
        React.createElement('header', { className: 'kbnb-header' },
          React.createElement('button', { className: 'kbnb-back', type: 'button', onClick: () => props.onClose() }, '返回'),
          React.createElement('span', { className: 'kbnb-title' }, '看板'),
          React.createElement('span', { className: 'kbnb-saving' }, saving ? '保存中…' : ''),
          React.createElement('div', { className: 'kbnb-header-actions' },
            React.createElement('button', { className: 'kbnb-btn', type: 'button', onClick: () => setModal({ kind: 'settings', dir: dataDir }) }, [React.createElement(GearIcon, { key: 'g' }), ' 数据目录']),
            React.createElement('button', { className: 'kbnb-btn kbnb-primary', type: 'button', onClick: () => setModal({ kind: 'newColumn', title: '' }) }, '+ 新建列'),
          ),
        ),
        error ? React.createElement('div', { className: 'kbnb-error' }, error) : null,
        React.createElement('main', { className: 'kbnb-board' },
          board.columns.length === 0
            ? React.createElement('div', { className: 'kbnb-empty' }, '空看板，点右上角「+ 新建列」开始')
            : board.columns.map((col, colIndex) => React.createElement('section', {
                key: col.id,
                className: 'kbnb-column' + (hint && hint.columnId === col.id ? ' kbnb-column-drop' : ''),
                onDragOver: (evt) => onColumnOver(col.id, evt),
                onDrop: (evt) => onColumnDrop(col.id, evt),
              },
                React.createElement('header', {
                  className: 'kbnb-column-head',
                  draggable: true,
                  onDragStart: (evt) => { evt.dataTransfer.effectAllowed = 'move'; setDrag({ kind: 'column', from: colIndex }) },
                  onDragEnd: onDragEnd,
                },
                  React.createElement('span', { className: 'kbnb-column-title', onClick: () => setModal({ kind: 'renameColumn', columnId: col.id, title: col.title }), title: '点击重命名' }, col.title),
                  React.createElement('span', { className: 'kbnb-column-count' }, col.cards.length),
                  React.createElement('button', { className: 'kbnb-icon-btn', type: 'button', title: '删除列', onClick: () => requestDeleteColumn(col) }, React.createElement(TrashIcon, null)),
                ),
                React.createElement('div', { className: 'kbnb-cards' },
                  col.cards.map((card) => React.createElement('article', {
                    key: card.id,
                    'data-card': '',
                    className: 'kbnb-card' + (drag && drag.kind === 'card' && drag.cardId === card.id ? ' kbnb-card-drag' : ''),
                    draggable: true,
                    onDragStart: (evt) => { evt.dataTransfer.effectAllowed = 'move'; setDrag({ kind: 'card', cardId: card.id, from: col.id }) },
                    onDragEnd: onDragEnd,
                    onClick: () => openCard(col.id, card),
                  },
                    React.createElement('div', { className: 'kbnb-card-title' }, card.title),
                    card.description ? React.createElement('div', { className: 'kbnb-card-desc' }, card.description.replace(/[#*`\[\]()\-]/g, '').split(/\n{2,}/)[0]) : null,
                  )),
                  hint && hint.columnId === col.id ? React.createElement('div', { className: 'kbnb-drop-line' }) : null,
                ),
                React.createElement('button', { className: 'kbnb-add-card', type: 'button', onClick: () => openCard(col.id, null) }, '+ 添加卡片'),
              )),
        ),
        // 卡片详情/新建弹窗
        mCard ? React.createElement('div', { className: 'kbnb-modal-mask', onClick: () => setModal(null) },
          React.createElement('div', { className: 'kbnb-modal', onClick: (evt) => evt.stopPropagation() },
            React.createElement('h3', null, mCard.cardId ? '编辑卡片' : '新建卡片'),
            React.createElement('label', { className: 'kbnb-field' }, '标题',
              React.createElement('input', { className: 'kbnb-input', value: mCard.title, onChange: (evt) => setModal({ ...mCard, title: evt.target.value }), placeholder: '卡片标题（必填）' })),
            React.createElement('label', { className: 'kbnb-field' }, '描述（Markdown）',
              React.createElement('textarea', { className: 'kbnb-textarea', value: mCard.description, onChange: (evt) => setModal({ ...mCard, description: evt.target.value }), placeholder: '支持 **粗体**、*斜体*、`代码`、- 列表、[链接](url)、# 标题、空行分段' })),
            React.createElement('div', { className: 'kbnb-preview' }, mdToElements(mCard.description)),
            React.createElement('div', { className: 'kbnb-modal-actions' },
              mCard.cardId ? React.createElement('button', { className: 'kbnb-btn kbnb-danger', type: 'button', onClick: () => requestDeleteCard(mCard.columnId, mCard.cardId) }, '删除') : null,
              React.createElement('span', { className: 'kbnb-spacer' }),
              React.createElement('button', { className: 'kbnb-btn', type: 'button', onClick: () => setModal(null) }, '取消'),
              React.createElement('button', { className: 'kbnb-btn kbnb-primary', type: 'button', onClick: saveCard, disabled: !(mCard.title || '').trim() }, '保存'),
            ),
          ),
        ) : null,
        // 数据目录设置弹窗
        mSettings ? React.createElement('div', { className: 'kbnb-modal-mask', onClick: () => setModal(null) },
          React.createElement('div', { className: 'kbnb-modal kbnb-modal-sm', onClick: (evt) => evt.stopPropagation() },
            React.createElement('h3', null, '数据目录'),
            React.createElement('p', { className: 'kbnb-hint' }, '看板文件将存到该目录（board.json）。设为 git 仓库目录即可随 git 同步。'),
            React.createElement('input', { className: 'kbnb-input', value: mSettings.dir, onChange: (evt) => setModal({ ...mSettings, dir: evt.target.value }), placeholder: '/绝对/路径' }),
            React.createElement('div', { className: 'kbnb-modal-actions' },
              React.createElement('span', { className: 'kbnb-spacer' }),
              React.createElement('button', { className: 'kbnb-btn', type: 'button', onClick: () => setModal(null) }, '取消'),
              React.createElement('button', { className: 'kbnb-btn kbnb-primary', type: 'button', onClick: saveDataDir, disabled: !(mSettings.dir || '').trim() }, '保存并迁移'),
            ),
          ),
        ) : null,
        // 新建列/重命名列弹窗
        mCol ? React.createElement('div', { className: 'kbnb-modal-mask', onClick: () => setModal(null) },
          React.createElement('div', { className: 'kbnb-modal kbnb-modal-sm', onClick: (evt) => evt.stopPropagation() },
            React.createElement('h3', null, mCol.kind === 'newColumn' ? '新建列' : '重命名列'),
            React.createElement('input', { className: 'kbnb-input', value: mCol.title, onChange: (evt) => setModal({ ...mCol, title: evt.target.value }), placeholder: '列名称（必填）' }),
            React.createElement('div', { className: 'kbnb-modal-actions' },
              React.createElement('span', { className: 'kbnb-spacer' }),
              React.createElement('button', { className: 'kbnb-btn', type: 'button', onClick: () => setModal(null) }, '取消'),
              React.createElement('button', { className: 'kbnb-btn kbnb-primary', type: 'button', onClick: submitColumn, disabled: !(mCol.title || '').trim() }, '保存'),
            ),
          ),
        ) : null,
        // 删除列确认弹窗
        mDelCol ? React.createElement('div', { className: 'kbnb-modal-mask', onClick: () => setModal(null) },
          React.createElement('div', { className: 'kbnb-modal kbnb-modal-sm', onClick: (evt) => evt.stopPropagation() },
            React.createElement('h3', null, '删除列'),
            React.createElement('p', { className: 'kbnb-hint' }, '「' + mDelCol.title + '」有 ' + mDelCol.count + ' 张卡片，删除后卡片一并丢失。确定？'),
            React.createElement('div', { className: 'kbnb-modal-actions' },
              React.createElement('span', { className: 'kbnb-spacer' }),
              React.createElement('button', { className: 'kbnb-btn', type: 'button', onClick: () => setModal(null) }, '取消'),
              React.createElement('button', { className: 'kbnb-btn kbnb-danger', type: 'button', onClick: confirmDeleteColumn }, '删除'),
            ),
          ),
        ) : null,
        // 删除卡片确认弹窗
        mDelCard ? React.createElement('div', { className: 'kbnb-modal-mask', onClick: () => setModal(null) },
          React.createElement('div', { className: 'kbnb-modal kbnb-modal-sm', onClick: (evt) => evt.stopPropagation() },
            React.createElement('h3', null, '删除卡片'),
            React.createElement('p', { className: 'kbnb-hint' }, '确定删除这张卡片？'),
            React.createElement('div', { className: 'kbnb-modal-actions' },
              React.createElement('span', { className: 'kbnb-spacer' }),
              React.createElement('button', { className: 'kbnb-btn', type: 'button', onClick: () => setModal(null) }, '取消'),
              React.createElement('button', { className: 'kbnb-btn kbnb-danger', type: 'button', onClick: confirmDeleteCard }, '删除'),
            ),
          ),
        ) : null,
      )
    }

    // ── 样式 ──────────────────────────────────────────────────
    styles.insert('.kbnb-page{position:fixed;inset:0;background:var(--dsw-alias-bg-base,#f7f7f8);display:flex;flex-direction:column;z-index:60;color:var(--dsw-alias-label-primary,#1f2329);pointer-events:auto}.kbnb-header{display:flex;align-items:center;gap:12px;padding:10px 16px;border-bottom:1px solid var(--dsw-alias-border-l2,#e5e6eb);background:var(--dsw-alias-bg-base,#fff)}.kbnb-back{background:none;border:none;cursor:pointer;font-size:14px;color:var(--dsw-alias-label-primary,#1f2329);padding:6px 10px;border-radius:8px}.kbnb-back:hover{background:var(--dsw-alias-interactive-bg-hover,#f2f3f5)}.kbnb-title{font-size:15px;font-weight:600}.kbnb-saving{font-size:12px;color:var(--dsw-alias-label-tertiary,#86909c)}.kbnb-header-actions{margin-left:auto;display:flex;gap:8px}.kbnb-btn{background:var(--dsw-alias-button-floating-fill,#fff);border:1px solid var(--dsw-alias-border-l2,#e5e6eb);border-radius:8px;padding:6px 12px;font-size:13px;cursor:pointer;color:var(--dsw-alias-label-primary,#1f2329)}.kbnb-btn:hover{background:var(--dsw-alias-interactive-bg-hover,#f2f3f5)}.kbnb-primary{background:#2563eb;border-color:#2563eb;color:#fff}.kbnb-primary:hover{background:#1d4ed8}.kbnb-danger{color:#dc2626;border-color:#fecaca}.kbnb-error{background:#fef2f2;color:#b91c1c;padding:8px 16px;font-size:13px}.kbnb-board{flex:1;display:flex;gap:14px;padding:16px;overflow-x:auto;align-items:flex-start}.kbnb-empty{margin:60px auto;color:var(--dsw-alias-label-tertiary,#86909c);font-size:14px}.kbnb-column{flex:0 0 240px;background:var(--dsw-alias-bg-elevated,#f2f3f5);border-radius:12px;padding:10px;display:flex;flex-direction:column;max-height:100%;border:2px solid transparent}.kbnb-column-drop{border-color:#2563eb}.kbnb-column-head{display:flex;align-items:center;gap:6px;padding:4px 4px 8px;cursor:grab}.kbnb-column-title{font-weight:600;font-size:13px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:text}.kbnb-column-count{font-size:12px;color:var(--dsw-alias-label-tertiary,#86909c)}.kbnb-icon-btn{background:none;border:none;cursor:pointer;font-size:12px;padding:2px 4px;border-radius:6px;opacity:.6}.kbnb-icon-btn:hover{opacity:1;background:var(--dsw-alias-interactive-bg-hover,#e5e6eb)}.kbnb-cards{display:flex;flex-direction:column;gap:8px;overflow-y:auto;flex:1;min-height:40px}.kbnb-card{background:var(--dsw-alias-bg-base,#fff);border:1px solid var(--dsw-alias-border-l2,#e5e6eb);border-radius:10px;padding:10px 12px;cursor:pointer;user-select:none}.kbnb-card:hover{border-color:#2563eb}.kbnb-card-drag{opacity:.5}.kbnb-card-title{font-size:13px;font-weight:500;line-height:1.4;word-break:break-word}.kbnb-card-desc{font-size:12px;color:var(--dsw-alias-label-secondary,#4e5969);margin-top:4px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}.kbnb-add-card{background:none;border:none;cursor:pointer;color:var(--dsw-alias-label-secondary,#4e5969);font-size:13px;padding:8px;border-radius:8px;text-align:left}.kbnb-add-card:hover{background:var(--dsw-alias-interactive-bg-hover,#e5e6eb);color:#2563eb}.kbnb-drop-line{height:3px;background:#2563eb;border-radius:2px;margin:-2px 0}.kbnb-modal-mask{position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:70;pointer-events:auto}.kbnb-modal{background:var(--dsw-alias-bg-base,#fff);border-radius:14px;padding:20px;width:520px;max-width:90vw;max-height:85vh;overflow-y:auto;box-shadow:0 8px 30px rgba(0,0,0,.15)}.kbnb-modal-sm{width:400px}.kbnb-modal h3{margin:0 0 14px;font-size:15px}.kbnb-field{display:block;font-size:12px;color:var(--dsw-alias-label-secondary,#4e5969);margin-bottom:12px}.kbnb-input{display:block;width:100%;box-sizing:border-box;margin-top:4px;border:1px solid var(--dsw-alias-border-l2,#e5e6eb);border-radius:8px;padding:8px 10px;font-size:13px;background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#1f2329)}.kbnb-textarea{display:block;width:100%;box-sizing:border-box;margin-top:4px;border:1px solid var(--dsw-alias-border-l2,#e5e6eb);border-radius:8px;padding:8px 10px;font-size:13px;min-height:120px;font-family:inherit;background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#1f2329)}.kbnb-preview{border:1px dashed var(--dsw-alias-border-l2,#e5e6eb);border-radius:8px;padding:10px 12px;margin-bottom:12px;font-size:13px;line-height:1.6;color:var(--dsw-alias-label-primary,#1f2329)}.kbnb-preview h1{font-size:18px;margin:4px 0}.kbnb-preview h2{font-size:16px;margin:4px 0}.kbnb-preview h3{font-size:14px;margin:4px 0}.kbnb-preview ul{margin:4px 0;padding-left:20px}.kbnb-preview a{color:#2563eb}.kbnb-modal-actions{display:flex;gap:8px;align-items:center;margin-top:8px}.kbnb-spacer{flex:1}.kbnb-hint{font-size:12px;color:var(--dsw-alias-label-secondary,#4e5969);margin:0 0 10px;line-height:1.5}.kbnb-loading{padding:40px;text-align:center;color:var(--dsw-alias-label-tertiary,#86909c)}.kbnb-side-btn{box-sizing:border-box;width:100%;height:49px;color:var(--dsw-alias-label-primary,#1f2329);cursor:pointer;background:none;border:none;border-radius:12px;align-items:center;gap:8px;padding:0 8px 0 6px;font-family:inherit;font-size:14px;display:inline-flex;overflow:hidden;line-height:20px}.kbnb-side-btn:hover{background:var(--dsw-alias-interactive-bg-hover,#f2f3f5);color:var(--dsw-alias-label-primary,#1f2329)}.kbnb-side-btn-on{color:var(--dsw-alias-state-success-primary,#16a34a)}.Nqubda_layer{width:auto;flex:1 1 auto;min-width:0}.hHd-Xa_footerActions{flex-direction:column;gap:4px}.hHd-Xa_collapsed .hHd-Xa_footerActions{flex-direction:column;width:auto;align-items:center}')

    // ── 注册槽位 ──────────────────────────────────────────────
    slots.inject('sidebar.footer.action', () => slots.register(
      { name: 'sidebar.footer.action', id: 'kanban', order: 10, label: () => '看板' },
      (props) => React.createElement(KanbanEntry, { wide: props.wide }),
    ))
  },
}
