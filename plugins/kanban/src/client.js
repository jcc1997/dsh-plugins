return {
  name: 'kanban',
  apply(ctx) {
    const slots = ctx.get('slots')
    if (slots === undefined) return
    console.log('[kanban] client apply running')

    // ══════════════════════════════════════════════════════════
    // 分区 1：图标（自绘 SVG，风格对齐官方 outline 16px/stroke 1.2）
    // 说明：动态插件无法 import 官方图标库（dsh-client-ui-primitives），
    // 发布版 bundle 将替换为官方图标。
    // ══════════════════════════════════════════════════════════
    function Icon({ d, w, h, sw }) {
      return React.createElement('svg', { width: w || 16, height: h || 16, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: sw || 1.2, 'aria-hidden': true, style: { flex: 'none' } },
        React.createElement('path', { d }),
      )
    }
    function IconBoard() {
      return React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.2, 'aria-hidden': true, style: { flex: 'none' } },
        React.createElement('rect', { x: 1.5, y: 2, width: 4, height: 12, rx: 1 }),
        React.createElement('rect', { x: 6, y: 2, width: 4, height: 8, rx: 1 }),
        React.createElement('rect', { x: 10.5, y: 2, width: 4, height: 5, rx: 1 }),
      )
    }
    function IconBack() {
      return React.createElement(Icon, { d: 'M9.5 3.5L5 8l4.5 4.5' })
    }
    function IconTrash() {
      return React.createElement(Icon, { d: 'M2.5 4.5h11M6 4.5V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M4 4.5l.7 8a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9l.7-8' })
    }
    function IconUp() {
      return React.createElement(Icon, { d: 'M8 12.5v-9M4.5 6.5L8 3l3.5 3.5' })
    }
    function IconDown() {
      return React.createElement(Icon, { d: 'M8 3.5v9M4.5 9.5L8 13l3.5-3.5' })
    }
    function IconClose() {
      return React.createElement(Icon, { d: 'M4 4l8 8M12 4l-8 8' })
    }

    // ══════════════════════════════════════════════════════════
    // 分区 2：工具函数
    // ══════════════════════════════════════════════════════════
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
    function fmtTime(iso) {
      try {
        const d = new Date(iso)
        const p = (n) => (n < 10 ? '0' + n : String(n))
        return p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes())
      } catch (e) { return '' }
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

    // ══════════════════════════════════════════════════════════
    // 分区 3：通用小组件（遮罩不点击关闭，只走显式按钮）
    // ══════════════════════════════════════════════════════════
    function Modal({ title, width, children, onClose }) {
      return React.createElement('div', { className: 'kbnb-mask' },
        React.createElement('div', { className: 'kbnb-modal', style: width ? { width } : null },
          React.createElement('div', { className: 'kbnb-modal-head' },
            React.createElement('span', { className: 'kbnb-modal-title' }, title),
            React.createElement('button', { className: 'kbnb-icon-btn', type: 'button', title: '关闭', onClick: onClose }, React.createElement(IconClose, null)),
          ),
          React.createElement('div', { className: 'kbnb-modal-body' }, children),
        ),
      )
    }

    // ══════════════════════════════════════════════════════════
    // 分区 4：侧边栏入口组件（按钮 + 全屏看板，单一组件无跨组件状态）
    // ══════════════════════════════════════════════════════════
    function KanbanEntry(props) {
      const [open, setOpen] = React.useState(false)
      return React.createElement('div', null,
        React.createElement('button', {
          className: 'kbnb-side-btn' + (open ? ' kbnb-side-btn-on' : ''),
          type: 'button',
          title: '看板',
          'aria-label': '看板',
          onClick: () => setOpen(!open),
        }, props.wide ? [React.createElement(IconBoard, { key: 'i' }), React.createElement('span', { key: 't' }, '看板')] : React.createElement(IconBoard, null)),
        open ? React.createElement(KanbanPage, { onClose: () => setOpen(false) }) : null,
      )
    }

    // ══════════════════════════════════════════════════════════
    // 分区 5：看板页面
    // ══════════════════════════════════════════════════════════
    function KanbanPage(props) {
      const [board, setBoard] = React.useState(null)
      const [error, setError] = React.useState('')
      const [drawer, setDrawer] = React.useState(null) // { columnId, cardId }，cardId null = 新建
      const [showColumns, setShowColumns] = React.useState(false)
      const [drag, setDrag] = React.useState(null)
      const [hint, setHint] = React.useState(null)
      const [saving, setSaving] = React.useState(false)

      React.useEffect(() => {
        host.call('kanban/load', {}).then((r) => {
          setBoard(r.board)
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
        if (!board) return null
        const next = JSON.parse(JSON.stringify(board))
        const result = fn(next)
        save(next)
        return result
      }
      function findCard(colId, cardId) {
        if (!board) return null
        const col = board.columns.find((c) => c.id === colId)
        if (!col) return null
        return col.cards.find((k) => k.id === cardId) || null
      }
      function colTitle(colId) {
        if (!board) return ''
        const col = board.columns.find((c) => c.id === colId)
        return col ? col.title : ''
      }
      function appendActivity(card, text) {
        if (!card.activity) card.activity = []
        card.activity.push({ id: safeId('a'), text, at: safeNow() })
      }

      // ── 卡片操作 ──
      function openNewCard(columnId) {
        setDrawer({ columnId, cardId: null })
      }
      function openCard(columnId, cardId) {
        setDrawer({ columnId, cardId })
      }
      function saveCard(title, description) {
        if (!drawer) return
        const colId = drawer.columnId
        if (drawer.cardId) {
          mutate((b) => {
            const col = b.columns.find((c) => c.id === colId)
            const card = col && col.cards.find((k) => k.id === drawer.cardId)
            if (card) {
              card.title = title
              card.description = description
              card.updatedAt = safeNow()
              appendActivity(card, '更新卡片')
            }
          })
        } else {
          const newId = mutate((b) => {
            const col = b.columns.find((c) => c.id === colId)
            if (!col) return null
            const card = { id: safeId('k'), title, description, links: [], meta: {}, comments: [], activity: [], createdAt: safeNow(), updatedAt: safeNow() }
            appendActivity(card, '创建卡片')
            col.cards.push(card)
            return card.id
          })
          // 创建成功后自动打开该卡片详情
          if (newId) setDrawer({ columnId: colId, cardId: newId })
        }
      }
      function deleteCard() {
        if (!drawer || !drawer.cardId) return
        const colId = drawer.columnId
        const cardId = drawer.cardId
        mutate((b) => {
          const col = b.columns.find((c) => c.id === colId)
          if (col) col.cards = col.cards.filter((k) => k.id !== cardId)
        })
        setDrawer(null)
      }
      function addComment(text) {
        if (!drawer || !drawer.cardId) return
        const colId = drawer.columnId
        const cardId = drawer.cardId
        mutate((b) => {
          const col = b.columns.find((c) => c.id === colId)
          const card = col && col.cards.find((k) => k.id === cardId)
          if (!card) return
          if (!card.comments) card.comments = []
          card.comments.push({ id: safeId('m'), text, createdAt: safeNow() })
          appendActivity(card, '添加评论')
        })
      }

      // ── 列操作 ──
      function addColumn(title) {
        mutate((b) => b.columns.push({ id: safeId('c'), title, cards: [], meta: {} }))
      }
      function renameColumn(colId, title) {
        mutate((b) => { b.columns.find((c) => c.id === colId).title = title })
      }
      function deleteColumn(colId) {
        mutate((b) => { b.columns = b.columns.filter((c) => c.id !== colId) })
      }
      function moveColumn(colId, dir) {
        mutate((b) => {
          const idx = b.columns.findIndex((c) => c.id === colId)
          const to = idx + dir
          if (idx < 0 || to < 0 || to >= b.columns.length) return
          const [col] = b.columns.splice(idx, 1)
          b.columns.splice(to, 0, col)
        })
      }

      // ── 拖拽 ──
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
            appendActivity(card, '移至「' + toCol.title + '」')
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

      if (!board) {
        return React.createElement('div', { className: 'kbnb-page' }, React.createElement('div', { className: 'kbnb-loading' }, error || '加载中…'))
      }

      const drawerCard = drawer && drawer.cardId ? findCard(drawer.columnId, drawer.cardId) : null

      return React.createElement('div', { className: 'kbnb-page' },
        // 顶部栏：返回(SVG) + 标题 + 列配置
        React.createElement('header', { className: 'kbnb-header' },
          React.createElement('button', { className: 'kbnb-icon-btn kbnb-back', type: 'button', title: '返回', onClick: () => props.onClose() }, React.createElement(IconBack, null)),
          React.createElement('span', { className: 'kbnb-title' }, '看板'),
          React.createElement('span', { className: 'kbnb-saving' }, saving ? '保存中…' : ''),
          React.createElement('div', { className: 'kbnb-header-actions' },
            React.createElement('button', { className: 'kbnb-btn', type: 'button', onClick: () => setShowColumns(true) }, '列配置'),
          ),
        ),
        error ? React.createElement('div', { className: 'kbnb-error' }, error) : null,
        // 看板主体：列通过竖线分割，白底
        React.createElement('main', { className: 'kbnb-board' },
          board.columns.length === 0
            ? React.createElement('div', { className: 'kbnb-empty' }, '空看板，点右上角「列配置」添加列')
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
                  React.createElement('span', { className: 'kbnb-column-title', title: '拖拽排序' }, col.title),
                  React.createElement('span', { className: 'kbnb-column-count' }, col.cards.length),
                ),
                React.createElement('div', { className: 'kbnb-cards' },
                  col.cards.map((card) => React.createElement('article', {
                    key: card.id,
                    'data-card': '',
                    className: 'kbnb-card' + (drag && drag.kind === 'card' && drag.cardId === card.id ? ' kbnb-card-drag' : ''),
                    draggable: true,
                    onDragStart: (evt) => { evt.dataTransfer.effectAllowed = 'move'; setDrag({ kind: 'card', cardId: card.id, from: col.id }) },
                    onDragEnd: onDragEnd,
                    onClick: () => openCard(col.id, card.id),
                  },
                    React.createElement('div', { className: 'kbnb-card-title' }, card.title),
                    card.description ? React.createElement('div', { className: 'kbnb-card-desc' }, card.description.replace(/[#*`\[\]()\-]/g, '').split(/\n{2,}/)[0]) : null,
                  )),
                  hint && hint.columnId === col.id ? React.createElement('div', { className: 'kbnb-drop-line' }) : null,
                ),
                React.createElement('button', { className: 'kbnb-add-card', type: 'button', onClick: () => openNewCard(col.id) }, '+ 添加卡片'),
              )),
        ),
        // 右侧卡片抽屉（新建时 cardId=null；创建成功后自动切到该卡片）
        drawer ? React.createElement(CardDrawer, {
          key: drawer.cardId || 'new',
          card: drawerCard,
          columnTitle: colTitle(drawer.columnId),
          isNew: !drawer.cardId,
          onSave: saveCard,
          onDelete: deleteCard,
          onClose: () => setDrawer(null),
          onAddComment: addComment,
        }) : null,
        // 列配置弹窗
        showColumns ? React.createElement(Modal, { title: '列配置', width: 420, onClose: () => setShowColumns(false) },
          React.createElement(ColumnsPanel, {
            columns: board.columns,
            onAdd: addColumn,
            onRename: renameColumn,
            onDelete: deleteColumn,
            onMove: moveColumn,
          }),
        ) : null,
      )
    }

    // ══════════════════════════════════════════════════════════
    // 分区 6：卡片抽屉（右侧，宽 520px）
    // ══════════════════════════════════════════════════════════
    function CardDrawer(props) {
      const [mode, setMode] = React.useState('edit') // edit | preview
      const [title, setTitle] = React.useState(props.card ? props.card.title : '')
      const [description, setDescription] = React.useState(props.card ? props.card.description || '' : '')
      const [comment, setComment] = React.useState('')

      function submit() {
        const t = title.trim()
        if (!t) return
        props.onSave(t, description)
        if (props.isNew) {
          // 新建模式：父组件创建成功后自动切到该卡片详情（key 变化重建本组件）
          setTitle('')
          setDescription('')
          setMode('edit')
        }
      }
      const comments = (props.card && props.card.comments) || []
      const activity = (props.card && props.card.activity) || []

      return React.createElement('div', { className: 'kbnb-drawer-mask' },
        React.createElement('aside', { className: 'kbnb-drawer' },
          React.createElement('div', { className: 'kbnb-drawer-head' },
            React.createElement('span', { className: 'kbnb-drawer-title' }, props.isNew ? '新建卡片' : (props.card ? props.card.title : '卡片')),
            React.createElement('button', { className: 'kbnb-icon-btn', type: 'button', title: '关闭', onClick: props.onClose }, React.createElement(IconClose, null)),
          ),
          React.createElement('div', { className: 'kbnb-drawer-body' },
            React.createElement('label', { className: 'kbnb-field' }, '标题',
              React.createElement('input', { className: 'kbnb-input', value: title, onChange: (evt) => setTitle(evt.target.value), placeholder: '卡片标题（必填）' })),
            React.createElement('div', { className: 'kbnb-field' },
              React.createElement('div', { className: 'kbnb-field-row' },
                React.createElement('span', { className: 'kbnb-field-label' }, '描述'),
                React.createElement('div', { className: 'kbnb-switch', role: 'tablist' },
                  React.createElement('button', { type: 'button', className: mode === 'edit' ? 'kbnb-switch-on' : '', onClick: () => setMode('edit') }, '编辑'),
                  React.createElement('button', { type: 'button', className: mode === 'preview' ? 'kbnb-switch-on' : '', onClick: () => setMode('preview') }, '预览'),
                ),
              ),
              mode === 'edit'
                ? React.createElement('textarea', { className: 'kbnb-textarea', value: description, onChange: (evt) => setDescription(evt.target.value), placeholder: '支持 **粗体**、*斜体*、`代码`、- 列表、[链接](url)、# 标题、空行分段' })
                : React.createElement('div', { className: 'kbnb-preview kbnb-preview-scroll' }, mdToElements(description)),
            ),
            React.createElement('div', { className: 'kbnb-drawer-actions' },
              props.card && !props.isNew ? React.createElement('button', { className: 'kbnb-btn kbnb-danger', type: 'button', onClick: props.onDelete }, '删除') : null,
              React.createElement('span', { className: 'kbnb-spacer' }),
              React.createElement('button', { className: 'kbnb-btn kbnb-primary', type: 'button', onClick: submit, disabled: !title.trim() }, props.isNew ? '创建' : '保存'),
            ),
            // 评论
            React.createElement('div', { className: 'kbnb-section' },
              React.createElement('div', { className: 'kbnb-section-title' }, '评论 ' + comments.length),
              comments.length === 0 ? React.createElement('div', { className: 'kbnb-section-empty' }, '暂无评论') : null,
              comments.map((m) => React.createElement('div', { key: m.id, className: 'kbnb-comment' },
                React.createElement('div', { className: 'kbnb-comment-text' }, m.text),
                React.createElement('div', { className: 'kbnb-comment-time' }, fmtTime(m.createdAt)),
              )),
              React.createElement('div', { className: 'kbnb-comment-input' },
                React.createElement('input', { className: 'kbnb-input', value: comment, onChange: (evt) => setComment(evt.target.value), placeholder: '写评论…', onKeyDown: (evt) => {
                  if (evt.key === 'Enter' && comment.trim()) {
                    props.onAddComment(comment.trim())
                    setComment('')
                  }
                } }),
                React.createElement('button', { className: 'kbnb-btn kbnb-primary', type: 'button', onClick: () => {
                  if (comment.trim()) {
                    props.onAddComment(comment.trim())
                    setComment('')
                  }
                }, disabled: !comment.trim() }, '发送'),
              ),
            ),
            // 更新日志
            React.createElement('div', { className: 'kbnb-section' },
              React.createElement('div', { className: 'kbnb-section-title' }, '更新日志 ' + activity.length),
              activity.length === 0 ? React.createElement('div', { className: 'kbnb-section-empty' }, '暂无记录') : null,
              activity.map((a) => React.createElement('div', { key: a.id, className: 'kbnb-activity' },
                React.createElement('span', { className: 'kbnb-activity-time' }, fmtTime(a.at)),
                React.createElement('span', { className: 'kbnb-activity-text' }, a.text),
              )),
            ),
          ),
        ),
      )
    }

    // ══════════════════════════════════════════════════════════
    // 分区 7：列配置面板（名称编辑 / 排序 / 删除 / 添加）
    // ══════════════════════════════════════════════════════════
    function ColumnsPanel(props) {
      const [newTitle, setNewTitle] = React.useState('')
      return React.createElement('div', { className: 'kbnb-columns-panel' },
        props.columns.map((col, idx) => React.createElement(ColumnRow, {
          key: col.id,
          col: col,
          first: idx === 0,
          last: idx === props.columns.length - 1,
          onRename: (title) => props.onRename(col.id, title),
          onMoveUp: () => props.onMove(col.id, -1),
          onMoveDown: () => props.onMove(col.id, 1),
          onDelete: () => props.onDelete(col.id),
        })),
        React.createElement('div', { className: 'kbnb-columns-add' },
          React.createElement('input', { className: 'kbnb-input', value: newTitle, onChange: (evt) => setNewTitle(evt.target.value), placeholder: '新列名称', onKeyDown: (evt) => {
            if (evt.key === 'Enter' && newTitle.trim()) {
              props.onAdd(newTitle.trim())
              setNewTitle('')
            }
          } }),
          React.createElement('button', { className: 'kbnb-btn kbnb-primary', type: 'button', onClick: () => {
            if (newTitle.trim()) {
              props.onAdd(newTitle.trim())
              setNewTitle('')
            }
          }, disabled: !newTitle.trim() }, '添加'),
        ),
      )
    }
    function ColumnRow(props) {
      const [title, setTitle] = React.useState(props.col.title)
      function commit() {
        const t = title.trim()
        if (t && t !== props.col.title) props.onRename(t)
        else setTitle(props.col.title)
      }
      return React.createElement('div', { className: 'kbnb-column-row' },
        React.createElement('div', { className: 'kbnb-column-row-btns' },
          React.createElement('button', { className: 'kbnb-icon-btn', type: 'button', title: '上移', disabled: props.first, onClick: props.onMoveUp }, React.createElement(IconUp, null)),
          React.createElement('button', { className: 'kbnb-icon-btn', type: 'button', title: '下移', disabled: props.last, onClick: props.onMoveDown }, React.createElement(IconDown, null)),
        ),
        React.createElement('input', { className: 'kbnb-input', value: title, onChange: (evt) => setTitle(evt.target.value), onBlur: commit, onKeyDown: (evt) => {
          if (evt.key === 'Enter') { evt.target.blur() }
        } }),
        React.createElement('button', { className: 'kbnb-icon-btn', type: 'button', title: '删除列', onClick: props.onDelete }, React.createElement(IconTrash, null)),
      )
    }

    // ══════════════════════════════════════════════════════════
    // 分区 8：设置页（settings.section）—— 数据目录配置
    // ══════════════════════════════════════════════════════════
    function KanbanSettings() {
      const [dir, setDir] = React.useState('')
      const [msg, setMsg] = React.useState('')
      const [loading, setLoading] = React.useState(true)
      React.useEffect(() => {
        host.call('kanban/load', {}).then((r) => {
          setDir(r.dataDir)
          setLoading(false)
        }).catch((e) => {
          setMsg('读取失败: ' + String(e))
          setLoading(false)
        })
      }, [])
      function save() {
        const d = dir.trim()
        if (!d) return
        host.call('kanban/set-data-dir', { dir: d }).then((r) => {
          if (r && r.ok) {
            setDir(r.dataDir)
            setMsg('已保存，数据迁移完成')
          } else {
            setMsg('保存失败: ' + (r && r.error ? r.error : 'unknown'))
          }
        }).catch((e) => setMsg('保存失败: ' + String(e)))
      }
      return React.createElement('div', { className: 'kbnb-settings' },
        React.createElement('p', { className: 'kbnb-hint' }, '看板数据文件（board.json）存储目录。设为 git 仓库目录即可随 git 同步。'),
        React.createElement('input', { className: 'kbnb-input', value: dir, onChange: (evt) => setDir(evt.target.value), placeholder: '/绝对/路径', disabled: loading }),
        React.createElement('div', { className: 'kbnb-settings-row' },
          React.createElement('button', { className: 'kbnb-btn kbnb-primary', type: 'button', onClick: save, disabled: loading || !dir.trim() }, '保存并迁移'),
          msg ? React.createElement('span', { className: 'kbnb-settings-msg' }, msg) : null,
        ),
      )
    }

    // ══════════════════════════════════════════════════════════
    // 分区 9：样式
    // ══════════════════════════════════════════════════════════
    styles.insert('.kbnb-page{position:fixed;inset:0;background:var(--dsw-alias-bg-base,#fff);display:flex;flex-direction:column;z-index:60;color:var(--dsw-alias-label-primary,#1f2329);pointer-events:auto}.kbnb-header{display:flex;align-items:center;gap:12px;padding:10px 16px;border-bottom:1px solid var(--dsw-alias-border-l2,#e5e6eb);flex:none}.kbnb-back{width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center}.kbnb-title{font-size:16px;font-weight:600}.kbnb-saving{font-size:12px;color:var(--dsw-alias-label-tertiary,#86909c)}.kbnb-header-actions{margin-left:auto;display:flex;gap:8px}.kbnb-btn{background:var(--dsw-alias-button-floating-fill,#fff);border:1px solid var(--dsw-alias-border-l2,#e5e6eb);border-radius:8px;padding:6px 12px;font-size:13px;cursor:pointer;color:var(--dsw-alias-label-primary,#1f2329)}.kbnb-btn:hover{background:var(--dsw-alias-interactive-bg-hover,#f2f3f5)}.kbnb-btn:disabled{opacity:.5;cursor:default}.kbnb-primary{background:#2563eb;border-color:#2563eb;color:#fff}.kbnb-primary:hover{background:#1d4ed8}.kbnb-danger{color:#dc2626;border-color:#fecaca}.kbnb-error{background:#fef2f2;color:#b91c1c;padding:8px 16px;font-size:13px}.kbnb-board{flex:1;display:flex;gap:0;padding:16px 0 16px 16px;overflow-x:auto;align-items:flex-start}.kbnb-empty{margin:60px auto;color:var(--dsw-alias-label-tertiary,#86909c);font-size:14px}.kbnb-column{flex:0 0 260px;padding:0 16px;display:flex;flex-direction:column;max-height:100%;border-left:1px solid var(--dsw-alias-border-l2,#e5e6eb)}.kbnb-column:first-child{border-left:none}.kbnb-column-drop{outline:2px solid #2563eb;outline-offset:-2px;border-radius:4px}.kbnb-column-head{display:flex;align-items:center;gap:8px;padding:2px 4px 10px;cursor:grab}.kbnb-column-title{font-weight:600;font-size:16px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.kbnb-column-count{font-size:12px;color:var(--dsw-alias-label-tertiary,#86909c)}.kbnb-cards{display:flex;flex-direction:column;gap:10px;overflow-y:auto;flex:1;min-height:40px;padding-bottom:4px}.kbnb-card{background:var(--dsw-alias-bg-base,#fff);border:1px solid var(--dsw-alias-border-l2,#e5e6eb);border-radius:12px;padding:14px 16px;cursor:pointer;user-select:none}.kbnb-card:hover{border-color:#2563eb}.kbnb-card-drag{opacity:.5}.kbnb-card-title{font-size:14px;font-weight:500;line-height:1.5;word-break:break-word}.kbnb-card-desc{font-size:13px;color:var(--dsw-alias-label-secondary,#4e5969);margin-top:6px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}.kbnb-add-card{background:none;border:none;cursor:pointer;color:var(--dsw-alias-label-secondary,#4e5969);font-size:13px;padding:10px 4px;border-radius:8px;text-align:left;flex:none}.kbnb-add-card:hover{color:#2563eb}.kbnb-drop-line{height:3px;background:#2563eb;border-radius:2px;margin:-2px 0}.kbnb-icon-btn{background:none;border:none;cursor:pointer;padding:4px;border-radius:6px;color:var(--dsw-alias-label-secondary,#4e5969);display:inline-flex;align-items:center;justify-content:center}.kbnb-icon-btn:hover{background:var(--dsw-alias-interactive-bg-hover,#e5e6eb);color:var(--dsw-alias-label-primary,#1f2329)}.kbnb-icon-btn:disabled{opacity:.3;cursor:default}.kbnb-mask{position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:70;pointer-events:auto}.kbnb-modal{background:var(--dsw-alias-bg-base,#fff);border-radius:14px;box-shadow:0 8px 30px rgba(0,0,0,.15);width:480px;max-width:90vw;max-height:85vh;display:flex;flex-direction:column;overflow:hidden}.kbnb-modal-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px 10px;border-bottom:1px solid var(--dsw-alias-border-l2,#e5e6eb)}.kbnb-modal-title{font-size:15px;font-weight:600}.kbnb-modal-body{padding:14px 16px 16px;overflow-y:auto}.kbnb-drawer-mask{position:fixed;inset:0;background:rgba(0,0,0,.2);z-index:70;pointer-events:auto;display:flex;justify-content:flex-end}.kbnb-drawer{background:var(--dsw-alias-bg-base,#fff);border-left:1px solid var(--dsw-alias-border-l2,#e5e6eb);width:520px;max-width:92vw;height:100%;display:flex;flex-direction:column;box-shadow:-8px 0 30px rgba(0,0,0,.08)}.kbnb-drawer-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--dsw-alias-border-l2,#e5e6eb);flex:none}.kbnb-drawer-title{font-size:15px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.kbnb-drawer-body{flex:1;overflow-y:auto;padding:16px}.kbnb-field{display:block;margin-bottom:14px}.kbnb-field-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}.kbnb-field-label{font-size:12px;color:var(--dsw-alias-label-secondary,#4e5969)}.kbnb-switch{display:inline-flex;border:1px solid var(--dsw-alias-border-l2,#e5e6eb);border-radius:8px;overflow:hidden}.kbnb-switch button{background:none;border:none;cursor:pointer;font-size:12px;padding:4px 12px;color:var(--dsw-alias-label-secondary,#4e5969)}.kbnb-switch .kbnb-switch-on{background:#2563eb;color:#fff}.kbnb-input{display:block;width:100%;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2,#e5e6eb);border-radius:8px;padding:8px 10px;font-size:13px;background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#1f2329)}.kbnb-textarea{display:block;width:100%;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2,#e5e6eb);border-radius:8px;padding:8px 10px;font-size:13px;min-height:140px;font-family:inherit;background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#1f2329)}.kbnb-preview{border:1px solid var(--dsw-alias-border-l2,#e5e6eb);border-radius:8px;padding:12px;font-size:13px;line-height:1.6;color:var(--dsw-alias-label-primary,#1f2329);background:var(--dsw-alias-bg-base,#fafafa)}.kbnb-preview-scroll{max-height:280px;overflow-y:auto}.kbnb-preview h1{font-size:18px;margin:4px 0}.kbnb-preview h2{font-size:16px;margin:4px 0}.kbnb-preview h3{font-size:14px;margin:4px 0}.kbnb-preview ul{margin:4px 0;padding-left:20px}.kbnb-preview a{color:#2563eb}.kbnb-drawer-actions{display:flex;gap:8px;align-items:center;margin:4px 0 8px}.kbnb-spacer{flex:1}.kbnb-section{margin-top:18px;border-top:1px solid var(--dsw-alias-border-l2,#e5e6eb);padding-top:12px}.kbnb-section-title{font-size:13px;font-weight:600;margin-bottom:8px;color:var(--dsw-alias-label-secondary,#4e5969)}.kbnb-section-empty{font-size:12px;color:var(--dsw-alias-label-tertiary,#86909c);padding:4px 0 8px}.kbnb-comment{background:var(--dsw-alias-bg-base,#f5f6f7);border-radius:10px;padding:8px 12px;margin-bottom:8px}.kbnb-comment-text{font-size:13px;line-height:1.5;white-space:pre-wrap;word-break:break-word}.kbnb-comment-time{font-size:11px;color:var(--dsw-alias-label-tertiary,#86909c);margin-top:4px}.kbnb-comment-input{display:flex;gap:8px;margin-top:10px}.kbnb-comment-input .kbnb-input{flex:1}.kbnb-activity{display:flex;gap:8px;font-size:12px;padding:3px 0;color:var(--dsw-alias-label-secondary,#4e5969)}.kbnb-activity-time{flex:none;color:var(--dsw-alias-label-tertiary,#86909c);font-variant-numeric:tabular-nums}.kbnb-activity-text{min-width:0;word-break:break-word}.kbnb-columns-panel{display:flex;flex-direction:column;gap:8px}.kbnb-column-row{display:flex;gap:8px;align-items:center}.kbnb-column-row-btns{display:flex;gap:2px;flex:none}.kbnb-column-row .kbnb-input{flex:1}.kbnb-columns-add{display:flex;gap:8px;margin-top:12px}.kbnb-columns-add .kbnb-input{flex:1}.kbnb-hint{font-size:12px;color:var(--dsw-alias-label-secondary,#4e5969);margin:0 0 10px;line-height:1.5}.kbnb-settings-row{display:flex;gap:10px;align-items:center;margin-top:10px}.kbnb-settings-msg{font-size:12px;color:var(--dsw-alias-state-success-primary,#16a34a)}.kbnb-loading{padding:40px;text-align:center;color:var(--dsw-alias-label-tertiary,#86909c)}.kbnb-side-btn{box-sizing:border-box;width:100%;height:49px;color:var(--dsw-alias-label-primary,#1f2329);cursor:pointer;background:none;border:none;border-radius:12px;align-items:center;gap:8px;padding:0 8px 0 6px;font-family:inherit;font-size:14px;display:inline-flex;overflow:hidden;line-height:20px}.kbnb-side-btn:hover{background:var(--dsw-alias-interactive-bg-hover,#f2f3f5);color:var(--dsw-alias-label-primary,#1f2329)}.kbnb-side-btn-on{color:var(--dsw-alias-state-success-primary,#16a34a)}.Nqubda_layer{width:auto;flex:1 1 auto;min-width:0}.hHd-Xa_footerActions{flex-direction:column;gap:4px}.hHd-Xa_collapsed .hHd-Xa_footerActions{flex-direction:column;width:auto;align-items:center}')

    // ══════════════════════════════════════════════════════════
    // 分区 10：注册
    // ══════════════════════════════════════════════════════════
    slots.inject('sidebar.footer.action', () => slots.register(
      { name: 'sidebar.footer.action', id: 'kanban', order: 10, label: () => '看板' },
      (props) => React.createElement(KanbanEntry, { wide: props.wide }),
    ))
    slots.inject('settings.section', () => slots.register(
      { name: 'settings.section', id: 'kanban', order: 30, label: () => '看板' },
      () => React.createElement(KanbanSettings),
    ))
  },
}
