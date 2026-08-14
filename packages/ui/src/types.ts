// 共享类型（看板数据模型）
export interface KanbanCard {
  id: string
  title: string
  description?: string
  links?: unknown[]
  /** 外部关联引用（数据模型 v2）：github-repo / github-branch / github-mr / local-repo / jira-issue … */
  refs?: TaskRef[]
  /** meta.taskId = 自动关联 ID（<repo-name>-<int>）；meta.sync.<provider> = 各 provider 同步快照信封 */
  meta?: Record<string, unknown>
  tags?: string[]
  comments?: KanbanComment[]
  activity?: KanbanActivity[]
  createdAt?: string
  updatedAt?: string
}

/** 平台无关的外部引用。kind 命名空间：<platform>-<type>；payload 细节归 provider */
export interface TaskRef {
  id: string
  kind: string
  platform: string
  externalId: string
  url?: string
  display?: string
  meta?: Record<string, unknown>
  createdAt?: string
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