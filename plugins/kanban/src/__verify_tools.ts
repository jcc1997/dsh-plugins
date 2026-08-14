// 临时校验入口：真实 defineTool 校验 19 个工具
import { defineTool } from '@deepseek-ai/dsh-tools'
import { buildToolDefs } from './host/tools'
import { FsLike } from './host/board'

const fs = { resolve: async (p: any) => ({ targetKey: p }), readText: async () => { throw new Error('ENOENT') }, writeText: async () => ({}) } as unknown as FsLike
const toToolParameters = (parameters: any): any => {
  const props = (parameters && parameters.properties) || {}
  const required: string[] = (parameters && parameters.required) || []
  const out: any = {}
  for (const key of Object.keys(props)) out[key] = { ...props[key], ...(required.includes(key) ? { required: true } : {}) }
  return out
}
let fail = 0
for (const d of buildToolDefs(fs)) {
  try {
    defineTool({ ...d, parameters: toToolParameters(d.parameters) })
    console.log('OK  ' + d.name)
  } catch (e: any) {
    fail++
    console.log('FAIL ' + d.name + ' :: ' + (e && e.message ? e.message : e))
  }
}
console.log(fail === 0 ? 'ALL 19 OK' : fail + ' FAILED')
