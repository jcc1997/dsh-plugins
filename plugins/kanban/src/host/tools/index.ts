// host/tools/index.ts — 19 个 agent 工具定义汇总（按类别拆分：card/archive/column/ref）
import { FsLike } from '../board'
import { cardToolDefs } from './card'
import { archiveToolDefs } from './archive'
import { columnToolDefs } from './column'
import { refToolDefs } from './ref'

/** 全部工具定义；fs 由 entry.ts 注入（apply 时已确认存在） */
export function buildToolDefs(fs: FsLike): any[] {
  return [
    ...cardToolDefs(fs),
    ...archiveToolDefs(fs),
    ...columnToolDefs(fs),
    ...refToolDefs(fs),
  ]
}
