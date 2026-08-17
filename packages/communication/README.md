# @dsh-plugins/communication

DSH 插件**通信协议**：事件发布/订阅 + RPC + 服务调用的统一接口。

## 为什么需要

| 形态 | 事件 | timer | RPC | import |
|---|---|---|---|---|
| 开发：动态插件（受限） | `ctx.emit` **禁用** → 服务总线 | 无 | `harness.handle`/`host.call` 私有 | 无 |
| 部署：bundle 插件 | `ctx.emit` ✅ | ✅ | 官方通道 | ✅ |

业务代码**只依赖本协议**，开发/部署两形态由 `createComm({ env })` 工厂切换实现——**两形态抹平**，部署时不改业务代码。

## 用法

```ts
import { createComm } from '@dsh-plugins/communication'

// host 半（动态）
const comm = createComm({ env: 'dynamic-host', ctx, harness })
// client 半（动态）
const comm = createComm({ env: 'dynamic-client', ctx, host })
// 部署后（bundle 插件）
const comm = createComm({ env: 'deployed-host', ctx })

// 发布 / 订阅（跨插件通知）
comm.bus.publish('git/ticket-synced', { ticketId, syncedAt })
const off = comm.bus.subscribe('git/ticket-synced', (payload) => { /* 刷新 UI / 联动 */ })

// RPC（client → 本插件 host 半）
await comm.rpc.call('git/sync', { ticketId })

// 跨插件服务（host 半）
const kanban = comm.services.get('kanban')
await kanban.updateTicket(ticketId, { meta })
```

## 事件 topic 约定

`<plugin>/<event>`：如 `git/ticket-synced`（git 同步完成）、未来 `kanban/ticket-updated`。

## 实现说明

- **动态事件** = 全局单例服务 `comm.bus`（`ctx.provide/get`，服务是全局 store）：跨插件 host 半共享；client 半各自实例，跨半事件经 RPC 桥接（见 plugins/git/PLAN.md §8）。
- **部署事件** = `ctx.emit/ctx.on`（cordis 原生，topic 加 `comm/` 前缀命名空间）。
- **RPC**：动态 = harness/host.call 封装；部署 = 官方通道（PLAN §8.3 接入点，未实现前 throw 提示）。

## 迁移原则

业务代码禁止直接 import 受限机制（harness/host.call/ctx.emit）；一律经本协议。部署时仅改 `createComm` 的 env 参数（或环境探测），业务逻辑零改动。
