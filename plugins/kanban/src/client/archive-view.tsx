// client/archive-view.tsx — 归档视图：侧边栏「归档」列表（原列/归档时间）+ 恢复/永久删除/清空
// 恢复默认回原列（kb.unarchiveCard 内部处理原列已删回第一列）；清空需 confirm 二次确认
import React from 'react'
import { fmtTime } from '@dsh-plugins/ui'
import { KanbanBoard } from '@dsh-plugins/ui'
import { useKanbanBoard } from './board-hook'

export function ArchiveView(props: {
  board: KanbanBoard
  kb: ReturnType<typeof useKanbanBoard>
  onBackToBoard: () => void
}) {
  const archived = props.board.archive || []
  return (
    <div className="kbnb-archive">
      <div className="kbnb-archive-head">
        <span className="kbnb-archive-title">归档 {archived.length}</span>
        {archived.length > 0 ? (
          <button
            className="kbnb-btn kbnb-danger"
            type="button"
            onClick={() => {
              if (window.confirm('清空归档？所有归档卡片将被永久删除，不可恢复。')) {
                props.kb.mutate((b) => {
                  b.archive = []
                })
              }
            }}
          >
            清空归档
          </button>
        ) : null}
      </div>
      {archived.length === 0 ? (
        <div className="kbnb-empty">归档为空。看板卡片右上角「归档」后可在侧边栏这里找回。</div>
      ) : (
        <div className="kbnb-archive-list">
          {archived.map((card: any) => {
            const fromCol = props.board.columns.find((c) => c.id === (card.archivedFrom || ''))
            return (
              <div key={card.id} className="kbnb-arch-row">
                <div className="kbnb-arch-info">
                  <div className="kbnb-arch-title">{card.title}</div>
                  {card.description ? <div className="kbnb-arch-desc">{card.description}</div> : null}
                  <div className="kbnb-arch-meta">
                    {fromCol ? <span className="kbnb-arch-col">原列 {fromCol.title}</span> : null}
                    {card.archivedAt ? <span className="kbnb-arch-time">归档于 {fmtTime(card.archivedAt)}</span> : null}
                  </div>
                </div>
                <div className="kbnb-arch-actions">
                  <button
                    className="kbnb-btn"
                    type="button"
                    onClick={() => {
                      props.kb.unarchiveCard(card.id)
                      props.onBackToBoard()
                    }}
                  >
                    恢复
                  </button>
                  <button
                    className="kbnb-btn kbnb-danger"
                    type="button"
                    onClick={() => {
                      if (window.confirm('永久删除卡片「' + card.title + '」？不可恢复。')) {
                        props.kb.deleteArchivedCard(card.id)
                      }
                    }}
                  >
                    删除
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
