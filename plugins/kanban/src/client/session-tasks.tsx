// 会话 Task 工作台：注册在 conversation.view 槽位（session scope）
// 左侧：当前会话关联的 task 列表（基础信息 + 状态 + 更新时间）
// 右侧：直接内嵌展示详情（默认最近更新的一个，点击左侧切换）——复用 CardDetail，无抽屉外壳
import React, { useEffect, useState } from 'react'
import { CardDetail } from './drawer'
import { useKanbanBoard, HostLike } from './board-hook'
import { fmtTime } from '@dsh-plugins/ui'

export interface SessionsLike {
  open(id: string): void
}

export interface SessionTaskPanelProps {
  sessionId?: string
  host: HostLike
  sessions?: SessionsLike
}

/** 同步按钮：走 kanban host 的 git-sync 桥接 RPC（内部 ctx.get('git').sync） */
function SyncButton(props: { cardId: string; host: HostLike; onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  function run() {
    setBusy(true)
    setError('')
    setDone(false)
    props.host
      .call('kanban/git-sync', { cardId: props.cardId })
      .then((res) => {
        setBusy(false)
        if (res && res.ok) {
          setDone(true)
          props.onDone()
        } else {
          setError((res && res.error) || '同步失败')
        }
      })
      .catch((e) => {
        setBusy(false)
        setError('同步失败: ' + String(e))
      })
  }
  return (
    <div className="kbnb-card-actions">
      <button className="kbnb-btn kbnb-primary" type="button" disabled={busy} onClick={run} title="拉取该Ticket关联仓库的 open MR 并刷新状态">
        {busy ? '同步中…' : '同步'}
      </button>
      {done ? <span className="git-sync-done">已同步</span> : null}
      {error ? <span className="git-sync-error">{error}</span> : null}
    </div>
  )
}

/** 单卡详情包装：绑定 board 操作 + 同步按钮 */
function CardDetailPane(props: { card: any; columns: any[]; cardId: string; kb: ReturnType<typeof useKanbanBoard>; host: HostLike; sessions?: SessionsLike }) {
  const { card, columns, cardId, kb, host, sessions } = props
  return (
    <CardDetail
      card={card}
      columns={columns}
      onSave={(title, description, content) => kb.saveCard(cardId, title, description, content)}
      onDelete={() => kb.deleteCard(cardId)}
      onArchive={() => kb.archiveCard(cardId)}
      onAddComment={(text) => kb.addComment(cardId, text)}
      onUpdateTags={(add, remove) => kb.updateTags(cardId, add, remove)}
      onMoveStatus={(targetColId) => kb.moveCardToStatus(cardId, targetColId)}
      onAddRef={(ref) => kb.addRef(cardId, ref)}
      onRemoveRef={(refId) => kb.removeRef(cardId, refId)}
      onOpenSession={(sid) => {
        if (sessions && typeof sessions.open === 'function') {
          try { sessions.open(sid) } catch { /* 会话可能已不存在 */ }
        }
      }}
      gateLibrary={kb.board ? kb.board.gateLibrary || [] : []}
      onAddGate={(gateId) => kb.attachGate(cardId, gateId)}
      onRemoveGate={(gateId) => kb.removeGate(cardId, gateId)}
      actionHost={() => <SyncButton cardId={cardId} host={host} onDone={() => kb.reload()} />}
    />
  )
}

export function SessionTaskPanel(props: SessionTaskPanelProps) {
  const kb = useKanbanBoard(props.host)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const sessionId = props.sessionId
  const related = sessionId ? kb.cardsBySession(sessionId) : []

  // 默认选最近更新的一个（updatedAt 倒序）
  useEffect(() => {
    if (selectedId && related.some((t) => t.id === selectedId)) return
    if (related.length > 0) setSelectedId(related[0].id)
    else setSelectedId(null)
  }, [sessionId, related.map((t) => t.id).join(',')])

  const selectedHit = selectedId ? kb.findCard(selectedId) : null
  const selectedCard = selectedHit ? selectedHit.card : null

  return (
    <div className="kbnb-session-tasks">
      {/* ── 左侧：Ticket 列表 ── */}
      <div className="kbnb-session-side">
        <header className="kbnb-session-side-head">
          <span className="kbnb-session-tasks-title">关联Ticket {related.length}</span>
        </header>
        {related.length === 0 ? (
          <div className="kbnb-session-tasks-empty">
            当前会话暂无关联Ticket。打开Kanban Ticket → 右侧「关联」→「+ 新增」→ 类型「会话」填入本会话 id 即可关联。
          </div>
        ) : (
          <div className="kbnb-session-tasks-list">
            {related.map((t) => {
              const full = kb.findCard(t.id)
              const updatedAt = full && full.card && full.card.updatedAt ? full.card.updatedAt : ''
              return (
                <button
                  key={t.id}
                  type="button"
                  className={'kbnb-session-task' + (selectedId === t.id ? ' kbnb-session-task-on' : '')}
                  onClick={() => setSelectedId(t.id)}
                >
                  <span className="kbnb-session-task-title">{t.title}</span>
                  <span className="kbnb-session-task-status">{t.status}</span>
                  {updatedAt ? <span className="kbnb-session-task-time">{fmtTime(updatedAt)}</span> : null}
                </button>
              )
            })}
          </div>
        )}
      </div>
      {/* ── 右侧：详情（内嵌，默认最近一个） ── */}
      <div className="kbnb-session-main">
        {selectedCard && selectedId ? (
          <CardDetailPane card={selectedCard} columns={kb.board ? kb.board.columns : []} cardId={selectedId} kb={kb} host={props.host} sessions={props.sessions} />
        ) : (
          <div className="kbnb-session-main-empty">选择左侧Ticket查看详情</div>
        )}
      </div>
    </div>
  )
}