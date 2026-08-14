// 列配置面板：名称编辑 / 排序 / 删除 / 添加
import React, { useState } from 'react'
import { IconChevronUpOutline14, IconChevronDownOutline14, IconTrashOutline16 } from '@dsh-plugins/ui'
import { KanbanColumn } from '@dsh-plugins/ui'

export function ColumnsPanel(props: {
  columns: KanbanColumn[]
  onAdd: (title: string) => void
  onRename: (colId: string, title: string) => void
  onDelete: (colId: string) => void
  onMove: (colId: string, dir: number) => void
}) {
  const [newTitle, setNewTitle] = useState('')
  return (
    <div className="kbnb-columns-panel">
      {props.columns.map((col, idx) => (
        <ColumnRow
          key={col.id}
          col={col}
          first={idx === 0}
          last={idx === props.columns.length - 1}
          onRename={(title) => props.onRename(col.id, title)}
          onMoveUp={() => props.onMove(col.id, -1)}
          onMoveDown={() => props.onMove(col.id, 1)}
          onDelete={() => props.onDelete(col.id)}
        />
      ))}
      <div className="kbnb-columns-add">
        <input
          className="kbnb-input"
          value={newTitle}
          onChange={(evt) => setNewTitle(evt.target.value)}
          placeholder="新列名称"
          onKeyDown={(evt) => {
            if (evt.key === 'Enter' && newTitle.trim()) {
              props.onAdd(newTitle.trim())
              setNewTitle('')
            }
          }}
        />
        <button
          className="kbnb-btn kbnb-primary"
          type="button"
          disabled={!newTitle.trim()}
          onClick={() => {
            if (newTitle.trim()) {
              props.onAdd(newTitle.trim())
              setNewTitle('')
            }
          }}
        >
          添加
        </button>
      </div>
    </div>
  )
}

function ColumnRow(props: {
  col: KanbanColumn
  first: boolean
  last: boolean
  onRename: (title: string) => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
}) {
  const [title, setTitle] = useState(props.col.title)
  function commit() {
    const t = title.trim()
    if (t && t !== props.col.title) props.onRename(t)
    else setTitle(props.col.title)
  }
  return (
    <div className="kbnb-column-row">
      <div className="kbnb-column-row-btns">
        <button className="kbnb-icon-btn" type="button" title="上移" disabled={props.first} onClick={props.onMoveUp}>
          <IconChevronUpOutline14 />
        </button>
        <button className="kbnb-icon-btn" type="button" title="下移" disabled={props.last} onClick={props.onMoveDown}>
          <IconChevronDownOutline14 />
        </button>
      </div>
      <input
        className="kbnb-input"
        value={title}
        onChange={(evt) => setTitle(evt.target.value)}
        onBlur={commit}
        onKeyDown={(evt) => {
          if (evt.key === 'Enter') evt.currentTarget.blur()
        }}
      />
      <button className="kbnb-icon-btn" type="button" title="删除列" onClick={props.onDelete}>
        <IconTrashOutline16 />
      </button>
    </div>
  )
}
