// 共享类型（看板数据模型）
export interface KanbanCard {
  id: string
  title: string
  description?: string
  links?: unknown[]
  meta?: Record<string, unknown>
  comments?: KanbanComment[]
  activity?: KanbanActivity[]
  createdAt?: string
  updatedAt?: string
}

export interface KanbanComment {
  id: string
  text: string
  createdAt?: string
}

export interface KanbanActivity {
  id: string
  text: string
  at?: string
  /** 操作者：UI 手动修改 = "手动调整"；agent 修改 = "agent" */
  actor?: string
}

export interface KanbanColumn {
  id: string
  title: string
  cards: KanbanCard[]
  meta?: Record<string, unknown>
}

export interface KanbanBoard {
  version: number
  columns: KanbanColumn[]
  meta?: Record<string, unknown>
}

export interface HostApi {
  call(method: string, args?: unknown): Promise<any>
}

// 受限 Cordis ctx 的宽松形状（动态插件环境）
export interface CtxLike {
  get(name: string): unknown
}