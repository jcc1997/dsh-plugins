// 通用小组件：Modal（遮罩不点击关闭，只走显式按钮）
import React from 'react'
import { IconCloseOutline16 } from './icons'

export function Modal(props: { title: string; width?: number; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="kbnb-mask">
      <div className="kbnb-modal" style={props.width ? { width: props.width } : undefined}>
        <div className="kbnb-modal-head">
          <span className="kbnb-modal-title">{props.title}</span>
          <button className="kbnb-icon-btn" type="button" title="关闭" onClick={props.onClose}>
            <IconCloseOutline16 />
          </button>
        </div>
        <div className="kbnb-modal-body">{props.children}</div>
      </div>
    </div>
  )
}
