// RPC 通道两种实现：
// 1) dynamicRpc —— 动态环境：client 半 host.call / host 半 harness.handle（每插件私有，天然配对）
// 2) deployedRpc —— 部署环境：预留标准通道（bundle 插件 client↔host 官方机制接入点）
import { RpcChannel } from './types'

/** 动态环境 RPC：host 半实现（harness.handle 注册） */
export function dynamicHostRpc(harness: { handle(method: string, handler: (args: unknown) => unknown): void }): RpcChannel {
  return {
    call: async () => { throw new Error('host 半不能发起 client RPC') },
    handle(method, handler) {
      harness.handle(method, (args) => {
        try {
          const out = handler(args)
          return out && typeof (out as any).then === 'function' ? (out as Promise<unknown>) : out
        } catch (e) {
          return { ok: false, error: String(e && (e as Error).message ? (e as Error).message : e) }
        }
      })
    },
  }
}

/** 动态环境 RPC：client 半实现（host.call 调用） */
export function dynamicClientRpc(host: { call(method: string, args?: unknown): Promise<any> }): RpcChannel {
  return {
    call: async (method, args) => host.call(method, args),
    handle: () => { throw new Error('client 半不能注册 handler（host 半注册）') },
  }
}

/** 部署环境 RPC：预留（bundle 插件 client↔host 官方通道，PLAN §8 部署时接入） */
export function deployedRpc(env: 'deployed-host' | 'deployed-client'): RpcChannel {
  if (env === 'deployed-host') {
    return {
      call: async () => { throw new Error('部署形态 host RPC 未接入（见 PLAN §8.3）') },
      handle: () => { throw new Error('部署形态 host RPC 未接入（见 PLAN §8.3）') },
    }
  }
  return {
    call: async () => { throw new Error('部署形态 client RPC 未接入（见 PLAN §8.3）') },
    handle: () => { throw new Error('部署形态 client RPC 未接入（见 PLAN §8.3）') },
  }
}
