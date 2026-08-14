// 会话 Task 面板：注册在 conversation.view 槽位（session scope）
// 展示当前会话关联的看板 task（refs 含 session 且 externalId === 当前 sessionId），点击打开可编辑详情（复用 CardDrawer）
import React, { useState } from 'react'
import { CardDrawer } from './drawer'
import { useKanbanBoard, HostLike } from './board-hook'

export interface SessionsLike {
  open(id: string): void
}

export interface SessionTaskPanelProps {
  sessionId?: string
  host: HostLike
  sessions?: SessionsLike
}

export function SessionTaskPanel(props: SessionTaskPanelProps) {
  const kb = useKanbanBoard(props.host)
  const [openCardId, setOpenCardId] = useState<string | null>(null)

  const sessionId = props.sessionId
  const related = sessionId ? kb.cardsBySession(sessionId) : []

  const openHit = openCardId ? kb.findCard(openCardId) : null
  const openCard = openHit ? openHit.card : null

  return (
    <div className="kbnb-session-tasks">
      <header className="kbnb-session-tasks-head">
        <span className="kbnb-session-tasks-title">关联任务 {related.length}</span>
        <span className="kbnb-session-tasks-hint">与当前会话关联的看板卡片（卡片侧「关联 → 新增 → 会话」建立）</span>
      </header>
      {related.length === 0 ? (
        <div className="kbnb-session-tasks-empty">
          当前会话暂无关联任务。打开看板卡片 → 右侧「关联」→「+ 新增」→ 类型「会话」填入本会话 id 即可关联。
        </div>
      ) : (
        <div className="kbnb-session-tasks-list">
          {related.map((t) => (
            <button key={t.id} type="button" className="kbnb-session-task" onClick={() => setOpenCardId(t.id)}>
              <span className="kbnb-session-task-title">{t.title}</span>
              <span className="kbnb-session-task-status">{t.status}</span>
            </button>
          ))}
        </div>
      )}
      {openCard && openCardId ? (
        <CardDrawer
          key={openCardId}
          card={openCard}
          columns={kb.board ? kb.board.columns : []}
          onSave={(title, description) => kb.saveCard(openCardId, title, description)}
          onDelete={() => {
            kb.deleteCard(openCardId)
            setOpenCardId(null)
          }}
          onClose={() => setOpenCardId(null)}
          onAddComment={(text) => kb.addComment(openCardId, text)}
          onUpdateTags={(add, remove) => kb.updateTags(openCardId, add, remove)}
          onMoveStatus={(targetColId) => kb.moveCardToStatus(openCardId, targetColId)}
          onAddRef={(ref) => kb.addRef(openCardId, ref)}
          onRemoveRef={(refId) => kb.removeRef(openCardId, refId)}
          onOpenSession={(sid) => {
            if (props.sessions && typeof props.sessions.open === 'function') {
              try { props.sessions.open(sid) } catch { /* 会话可能已不存在 */ }
            }
            setOpenCardId(null)
          }}
          actionHost={null}
        />
      ) : null}
    </div>
  )
}
