// client/nav.ts — 面板内跳转总线
// conversation.view 槽位的「流水线」tab 卡片点击 → 侧边栏主面板打开并定位到对应 run。
// (useEscClose 已提升至 @dsh-plugins/ui 共享,勿在此重复定义)
type OpenHandler = (runId: string) => void

let handler: OpenHandler | null = null

/** 侧边栏主面板注册打开处理（PipelineEntry mount 时）；返回注销函数 */
export function registerOpenHandler(fn: OpenHandler): () => void {
  handler = fn
  return () => { if (handler === fn) handler = null }
}

/** 请求打开主面板并定位某个 run（会话 tab 卡片点击） */
export function requestOpenRun(runId: string): void {
  if (handler) handler(runId)
}
