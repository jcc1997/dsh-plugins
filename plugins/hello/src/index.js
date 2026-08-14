import { defineTool } from '@deepseek-ai/dsh-tools'
import Schema from '@deepseek-ai/schemastery'

export const name = 'dsh-plugins-hello'

// 插件配置 schema（Standard Schema）：cordis.yml 行内 config 会经此校验并填充默认值。
export const Config = Schema.object({
  greeting: Schema.string().default('你好'),
  verbose: Schema.boolean().default(false),
})

// tools 是硬依赖：等待宿主 tools 注册表就绪后才 apply。
export const inject = ['tools']

export function apply(ctx, config) {
  if (config.verbose) {
    console.log(`[dsh-plugins-hello] loaded (greeting: ${config.greeting})`)
  }

  // 注册一个模型可调用的工具（官方 tool 规范，defineTool）。
  // 工具注册属于 ctx 生命周期：插件卸载时自动清理。
  ctx.tools.register(defineTool({
    name: 'hello',
    description: '向指定名字问好，用于验证 dsh-plugins-hello 插件已生效。',
    parameters: {
      name: { type: 'string', required: true, description: '要问候的名字' },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    async execute(args) {
      return `${config.greeting}，${args.name}!`
    },
  }))
}
