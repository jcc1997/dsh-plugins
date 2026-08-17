// 通信协议：类型定义（业务代码只依赖本接口，不感知开发/部署形态差异）
// 协议目标：动态插件（受限：emit 禁用/timer 无/RPC 私有）与部署 bundle（完整 cordis）
//           使用同一套通信 API，工厂按环境切换实现。

/** 事件载荷：必须 JSON 兼容（动态环境经服务/桥接传输） */
export type EventPayload = Record<string, unknown>

/** 事件总线：发布/订阅（跨插件通知的正规通道） */
export interface EventBus {
  /**
   * 发布事件。动态环境实现为"服务总线"（全局 comm.bus 服务 notify），
   * 部署环境实现为 ctx.emit（cordis 原生事件）。
   * topic 建议命名空间：<plugin>/<event>，如 'git/ticket-synced'
   */
  publish(topic: string, payload?: EventPayload): void
  /** 订阅事件；返回取消订阅函数 */
  subscribe(topic: string, handler: (payload: EventPayload) => void): () => void
}

/** RPC：client → 本插件 host 半（每插件私有通道的封装） */
export interface RpcChannel {
  /** 调用本插件 host 半注册的 handler；返回 JSON 兼容结果 */
  call<T = unknown>(method: string, args?: unknown): Promise<T>
  /** host 半注册 handler（仅 host 环境使用） */
  handle(method: string, handler: (args: unknown) => unknown | Promise<unknown>): void
}

/** 跨插件服务调用（host 半；动态/部署均为 ctx.get(name) 直读） */
export interface ServiceLocator {
  get<T = any>(name: string): T | undefined
}

/** 环境标识：工厂据此选择实现 */
export type CommEnvironment = 'dynamic-host' | 'dynamic-client' | 'deployed-host' | 'deployed-client'

/** 协议整体门面 */
export interface Communication {
  env: CommEnvironment
  bus: EventBus
  rpc: RpcChannel
  services: ServiceLocator
}

/** 事件总线服务键（动态环境全局单例服务名） */
export const BUS_SERVICE = 'comm.bus'
