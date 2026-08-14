// 事件总线两种实现：
// 1) serviceBus —— 动态环境（ctx.emit 禁用）：全局单例服务 comm.bus（provide/get），订阅/通知走服务方法
// 2) cordisBus  —— 部署环境：ctx.emit / ctx.on（cordis 原生事件）
import { BUS_SERVICE, EventBus, EventPayload } from './types'

/** 动态环境：服务总线（跨插件 host 半共享；client 半可各自实例，跨半事件经 RPC 桥接） */
export function serviceBus(ctx: {
  get(name: string): unknown
  provide(name: string, value: unknown): unknown
}): EventBus {
  // 单例：已有则复用（服务是全局 store，重复 provide 抛错）
  let bus = ctx.get(BUS_SERVICE) as EventBus | undefined
  if (!bus) {
    const handlers = new Map<string, Set<(payload: EventPayload) => void>>()
    bus = {
      publish(topic: string, payload: EventPayload = {}) {
        const set = handlers.get(topic)
        if (!set) return
        for (const fn of [...set]) {
          try { fn(payload) } catch { /* 监听器失败不影响发布 */ }
        }
      },
      subscribe(topic: string, handler: (payload: EventPayload) => void) {
        let set = handlers.get(topic)
        if (!set) { set = new Set(); handlers.set(topic, set) }
        set.add(handler)
        return () => { set!.delete(handler) }
      },
    }
    try {
      ctx.provide(BUS_SERVICE, bus)
    } catch {
      // 并发 provide 竞争：取已注册的
      const existing = ctx.get(BUS_SERVICE) as EventBus | undefined
      if (existing) bus = existing
    }
  }
  return bus
}

/** 部署环境：cordis 原生事件（ctx.emit / ctx.on） */
export function cordisBus(ctx: {
  emit(name: string, payload?: unknown): void
  on(name: string, listener: (payload: any) => void): () => void
}): EventBus {
  const keyOf = (topic: string) => 'comm/' + topic
  return {
    publish(topic: string, payload: EventPayload = {}) {
      ctx.emit(keyOf(topic), payload)
    },
    subscribe(topic: string, handler: (payload: EventPayload) => void) {
      return ctx.on(keyOf(topic), (payload: any) => handler((payload || {}) as EventPayload))
    },
  }
}
