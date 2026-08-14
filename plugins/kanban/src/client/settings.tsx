// 设置页（settings.section）：数据目录配置
import React, { useEffect, useState } from 'react'

export function KanbanSettings(props: { host: { call(method: string, args?: unknown): Promise<any> } }) {
  const [dir, setDir] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    props.host
      .call('kanban/load', {})
      .then((r) => {
        setDir(r.dataDir)
        setLoading(false)
      })
      .catch((e) => {
        setMsg('读取失败: ' + String(e))
        setLoading(false)
      })
  }, [props.host])

  function save() {
    const d = dir.trim()
    if (!d) return
    props.host
      .call('kanban/set-data-dir', { dir: d })
      .then((r) => {
        if (r && r.ok) {
          setDir(r.dataDir)
          setMsg('已保存，数据迁移完成')
        } else {
          setMsg('保存失败: ' + (r && r.error ? r.error : 'unknown'))
        }
      })
      .catch((e) => setMsg('保存失败: ' + String(e)))
  }

  return (
    <div className="kbnb-settings">
      <p className="kbnb-hint">看板数据文件（board.json，含归档与富文本内容）存储目录。设为 git 仓库目录即可随 git 同步。归档卡片在侧边栏「归档」中管理。</p>
      <input
        className="kbnb-input"
        value={dir}
        onChange={(evt) => setDir(evt.target.value)}
        placeholder="/绝对/路径"
        disabled={loading}
      />
      <div className="kbnb-settings-row">
        <button className="kbnb-btn kbnb-primary" type="button" onClick={save} disabled={loading || !dir.trim()}>
          保存并迁移
        </button>
        {msg ? <span className="kbnb-settings-msg">{msg}</span> : null}
      </div>
    </div>
  )
}