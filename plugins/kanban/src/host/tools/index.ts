// host/tools/index.ts — 31 个 agent 工具定义汇总（按类别拆分：card/archive/column/ref/gate/template/config）
import { FsLike } from '../board'
import { cardToolDefs } from './card'
import { archiveToolDefs } from './archive'
import { columnToolDefs } from './column'
import { refToolDefs } from './ref'
import { gateToolDefs } from './gate'
import { templateToolDefs } from './template'
import { configToolDefs } from './config'
import { GateCheckDeps } from '../gate'

/** 全部工具定义；fs/gateDeps 由 entry.ts 注入（apply 时已确认存在） */
export function buildToolDefs(fs: FsLike, gateDeps: GateCheckDeps): any[] {
  return [
    ...cardToolDefs(fs, gateDeps),
    ...archiveToolDefs(fs, gateDeps),
    ...columnToolDefs(fs),
    ...refToolDefs(fs),
    ...gateToolDefs(fs, gateDeps),
    ...templateToolDefs(fs),
    ...configToolDefs(fs),
  ]
}
