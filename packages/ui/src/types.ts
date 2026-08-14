// 共享类型（看板数据模型）
/** 富文本块（Notion 式块模型）：text 存 HTML 片段（内联加粗/斜体等），image 存 dataURL */
export interface KanbanBlock {
  id: string
  /** text | h1 | h2 | h3 | bullet | ordered | check | quote | code | divider | image */
  type: string
  /** 文本块的内联 HTML；code 块为纯文本 */
  text?: string
  /** image 块：dataURL 或 http(s) 链接 */
  url?: string
  /** check 块：是否勾选 */
  checked?: boolean
}

export interface KanbanCard {
  id: string
  title: string
  /** 一句话纯文本描述（无预览、无 Markdown 渲染） */
  description?: string
  /** 富文本内容（Notion 式块数组）；旧数据为字符串时按单文本块兼容 */
  content?: KanbanBlock[]
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

/** 归档时记录来源列，恢复时默认回原列 */
export interface ArchivedCard extends KanbanCard {
  archivedFrom?: string
  archivedAt?: string
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
  /** 归档卡片（v3）：从列移出、看板隐藏，可恢复 */
  archive?: KanbanCard[]
  meta?: Record<string, unknown>
}

export interface HostApi {
  call(method: string, args?: unknown): Promise<any>
}

// 受限 Cordis ctx 的宽松形状（动态插件环境）
export interface CtxLike {
  get(name: string): unknown
}