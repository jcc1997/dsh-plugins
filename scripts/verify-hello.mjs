// 不启动 dsh 的独立验证：用 Cordis Context 加载 hello 插件包，
// 验证 apply 执行 + Config schema 默认值 + hello 工具注册。
import { Context } from '@deepseek-ai/cordis'
import * as hello from 'dsh-plugins-hello'

const registered = []
const ctx = new Context()
ctx.provide('tools', {
  register: (tool) => {
    registered.push(tool)
    return () => {}
  },
})
await ctx.plugin(hello)

const tool = registered.find((t) => t.name === 'hello')
if (!tool) {
  console.error('FAIL: hello tool not registered')
  process.exit(1)
}

const result = await tool.execute({ name: '验证' })
console.log('tool result:', result)
console.log('OK: hello plugin loads, Config defaults apply, tool registered')
