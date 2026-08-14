// 通信协议入口：createComm 工厂按环境返回统一门面
// 用法：
//   host 半：const comm = createComm({ env: 'dynamic-host', ctx, harness })
//   client 半：const comm = createComm({ env: 'dynamic-client', ctx, host })
//   部署后：const comm = createComm({ env: 'deployed-host', ctx })
// 业务代码只 import 本包，不直接碰 harness/host.call/ctx.emit —— 开发与部署两形态由此抹平。
import { Communication, CommEnvironment } from './types'
import { serviceBus, cordisBus } from './bus'
import { dynamicHostRpc, dynamicClientRpc, deployedRpc } from './rpc'

export * from './types'
export { serviceBus, cordisBus } from './bus'

export interface CommOptions {
  env: CommEnvironment
  /** 动态 host 半的 ctx（get/provide） */
  ctx?: { get(name: string): unknown; provide?(name: string, value: unknown): unknown; emit?(name: string, payload?: unknown): void; on?(name: string, listener: (payload: any) => void): () => void }
  /** 动态 host 半的 harness（handle） */
  harness?: { handle(method: string, handler: (args: unknown) => unknown): void }
  /** 动态 client 半的 host（call） */
  host?: { call(method: string, args?: unknown): Promise<any> }
}

export function createComm(opts: CommOptions): Communication {
  const { env, ctx, harness, host } = opts
  const services = { get: (name: string) => (ctx ? ctx.get(name) : undefined) }

  let bus: Communication['bus']
  if (env === 'dynamic-host' || env === 'dynamic-client') {
    bus = serviceBus(ctx as any)
  } else {
    bus = cordisBus(ctx as any)
  }

  let rpc: Communication['rpc']
  if (env === 'dynamic-host') rpc = dynamicHostRpc(harness as any)
  else if (env === 'dynamic-client') rpc = dynamicClientRpc(host as any)
  else rpc = deployedRpc(env)

  return { env, bus, rpc, services }
}
