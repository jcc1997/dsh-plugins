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

export interface KanbanTicket {
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
  /** 归档时记录来源列 id（恢复时回原列）；恢复后保留 */
  archivedFrom?: string
  archivedAt?: string
  /** 卡片勾选的门禁（v6）：门禁库 id 引用列表；旧内联 gates 读取时自动入库迁移 */
  gateIds?: string[]
  /** 兼容旧数据：内联门禁（v5 及以前），normalize 时迁入门禁库 */
  gates?: TicketGate[]
}

/** 门禁检查器（v5 抽象）：门禁 = 统一检查单元，可以是内置条件、一段代码或一条/多条 pipeline。 */
export interface GateChecker {
  /** 检查器类型：tag-required / field-nonempty / mr-linked / branch-linked / mr-merged / code / pipeline */
  type: 'tag-required' | 'field-nonempty' | 'mr-linked' | 'branch-linked' | 'mr-merged' | 'code' | 'pipeline'
  /** 类型相关配置：tag-required {tags:[]}；field-nonempty {field}；code {code?, script?, timeoutMs?}；pipeline {pipelines:[], timeoutMs?} */
  config?: Record<string, unknown>
}

/** 门禁（v5）：某类行为触发时必须通过的检查单元。挂在卡片或创建模板上。 */
export interface TicketGate {
  id: string
  /** 门禁名（展示用） */
  name: string
  /** 触发行为：move（移动状态）/ tags（增减标签）/ archive（归档） */
  on: 'move' | 'tags' | 'archive'
  /** 统一检查器（v5）；旧平铺 kind/config 数据由 normalize 自动迁移 */
  checker: GateChecker
  /** move 可带目标列限定（等价 checker 外的触发过滤） */
  to?: string
}

/** 创建模板（v4）：预设 description / tags / content / gates，创建卡片时引用免重复输入 */
export interface TicketTemplate {
  id: string
  name: string
  description?: string
  tags?: string[]
  content?: KanbanBlock[]
  /** 模板勾选的门禁（v6）：门禁库 id 引用列表 */
  gateIds?: string[]
  /** 兼容旧数据：内联门禁（normalize 时迁入门禁库） */
  gates?: TicketGate[]
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

/** 归档卡片：额外记录来源列与归档时间（恢复时回原列） */
export interface ArchivedTicket extends KanbanTicket {
  archivedFrom?: string
  archivedAt?: string
}

export interface KanbanColumn {
  id: string
  title: string
  tickets: KanbanTicket[]
  meta?: Record<string, unknown>
}

export interface KanbanBoard {
  version: number
  columns: KanbanColumn[]
  /** 归档卡片（v3）：从列移出、看板隐藏，可恢复 */
  archive?: KanbanTicket[]
  /** 创建模板（v4）：新建卡片时引用，预填描述/标签/内容/门禁 */
  templates?: TicketTemplate[]
  /** 门禁库（v6）：门禁是独立可复用实体，单独配置；模板/卡片用 gateIds 引用勾选 */
  gateLibrary?: TicketGate[]
  meta?: Record<string, unknown>
}

export interface HostApi {
  call(method: string, args?: unknown): Promise<any>
}

// 受限 Cordis ctx 的宽松形状（动态插件环境）
export interface CtxLike {
  get(name: string): unknown
}
