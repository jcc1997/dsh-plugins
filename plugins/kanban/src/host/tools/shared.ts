// host/tools/shared.ts — 工具定义公共辅助：JSON-Schema 简写 + 输出定义
// 受限环境工具定义要求：parameters 顶层平级、object 显式 additionalProperties、render 返回内容块数组。
import { FsLike } from '../board'

export const P = (properties: any, required: string[] = []) => ({ type: 'object', properties, required })
export const STR = (description: string) => ({ type: 'string', description })
export const STRS = (description: string) => ({ type: 'array', items: { type: 'string' }, description })
export const NUM = (description: string) => ({ type: 'number', description })

/** 工具输出定义：纯文本 JSON 渲染 */
export const outputOf = (description: string) => ({
  schema: { type: 'object', additionalProperties: true },
  render: (args: unknown, value: unknown) => [{ type: 'text', text: description + '\n' + JSON.stringify(value, null, 2) }],
})

export type { FsLike }
