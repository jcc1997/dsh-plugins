// client/graph.tsx — Dify 式流水线图（基于 @xyflow/react，与 Dify 同源的开源流程可视化库）
// 交互：节点卡片（类型徽章/标题/删除/端口点）；边中点 + 新增节点；点节点选中（右侧编辑面板）。
// 不支持拖拽节点（nodesDraggable=false）；画布可平移/缩放；连线规则与 host 引擎一致（显式 inputs 优先，否则串联上一个）。
import React, { useMemo, useState } from 'react'
import { IconCloseOutline16, IconPlusOutline16, useEscClose } from '@dsh-plugins/ui'
import { ReactFlow, Background, Controls, Panel, BaseEdge, EdgeLabelRenderer, getBezierPath, MarkerType, Handle, Position, type EdgeProps, type NodeProps } from '@xyflow/react'

export interface GraphNode {
  id: string
  title: string
  type: string
  order: number
  inputs?: string[]
  config: Record<string, unknown>
}

export const NODE_TYPES = ['input', 'output', 'exec', 'fetch', 'transform', 'llm', 'pipeline'] as const
export const NODE_LABEL: Record<string, string> = {
  input: '输入', output: '输出', exec: 'Shell 命令', fetch: 'HTTP 请求',
  transform: '转换', llm: 'LLM 分析', pipeline: '子流水线',
}
export const NODE_DEFAULT_CONFIG: Record<string, Record<string, unknown>> = {
  input: { keys: [] },
  output: {},
  exec: { command: 'echo hello', timeoutMs: 60000 },
  fetch: { url: 'https://', method: 'GET' },
  transform: { mappings: {}, template: '' },
  llm: { prompt: '请基于上游内容分析：{{up}}' },
  pipeline: { ref: '', inputs: {} },
}

const TYPE_DESC: Record<string, string> = {
  input: '抽取入参字段', output: '汇总输出', exec: '执行 shell 命令', fetch: 'HTTP 请求',
  transform: 'JSON 字段映射', llm: '大模型分析', pipeline: '引用已发布流水线',
}

const NODE_W = 320
const NODE_H = 88
const GAP = 64
export const GRAPH_STEP = NODE_H + GAP

/** 配置摘要（节点卡片脚注） */
function configSummary(n: GraphNode): string {
  const c = n.config || {}
  if (n.type === 'exec') return typeof c.command === 'string' ? c.command : ''
  if (n.type === 'fetch') return (typeof c.method === 'string' ? c.method + ' ' : '') + (typeof c.url === 'string' ? c.url : '')
  if (n.type === 'llm') return typeof c.prompt === 'string' ? c.prompt : ''
  if (n.type === 'pipeline') return typeof c.ref === 'string' && c.ref ? '引用 ' + c.ref : '未配置引用'
  if (n.type === 'transform') {
    const keys = Object.keys(c.mappings || {}).join(', ')
    return keys + (typeof c.template === 'string' && c.template ? (keys ? ' + 模板' : '模板') : '')
  }
  if (n.type === 'input') return Array.isArray(c.keys) && c.keys.length ? '取字段 ' + (c.keys as string[]).join(', ') : '透传全部入参'
  return ''
}

interface PlpNodeData {
  node: GraphNode
  selected: boolean
  readonly?: boolean
  onDelete: (id: string) => void
  onMove: (id: string, dir: -1 | 1) => void
  canUp: boolean
  canDown: boolean
}

/** 自定义节点卡片 */
function PlpNode(props: NodeProps) {
  const d = props.data as unknown as PlpNodeData
  const n = d.node
  return (
    <div className={'plp-rf-node' + (d.selected ? ' plp-rf-node-sel' : '')}>
      <Handle type="target" position={Position.Top} className="plp-rf-handle" />
      <span className="plp-rf-port plp-rf-port-in" />
      <div className="plp-rf-node-head">
        <span className={'plp-graph-type plp-graph-type-' + n.type}>{NODE_LABEL[n.type] || n.type}</span>
        <span className="plp-rf-node-title" title={n.title}>{n.title}</span>
        <span className="plp-rf-node-spacer" />
        {!d.readonly ? (
          <button type="button" className="plp-graph-del" title="删除节点"
            onClick={(e) => { e.stopPropagation(); d.onDelete(n.id) }}><IconCloseOutline16 size={12} /></button>
        ) : null}
      </div>
      <div className="plp-rf-node-summary" title={configSummary(n)}>{configSummary(n) || '未配置'}</div>
      <div className="plp-rf-node-foot">
        <span className="plp-graph-deps">{n.inputs && n.inputs.length ? '依赖 ' + n.inputs.join(', ') : '串联上游'}</span>
        <span className="plp-rf-node-spacer" />
        {!d.readonly ? (
          <button type="button" className="plp-graph-move" title="上移" disabled={!d.canUp}
            onClick={(e) => { e.stopPropagation(); d.onMove(n.id, -1) }}>↑</button>
        ) : null}
        {!d.readonly ? (
          <button type="button" className="plp-graph-move" title="下移" disabled={!d.canDown}
            onClick={(e) => { e.stopPropagation(); d.onMove(n.id, 1) }}>↓</button>
        ) : null}
      </div>
      <span className="plp-rf-port plp-rf-port-out" />
      <Handle type="source" position={Position.Bottom} className="plp-rf-handle" />
    </div>
  )
}

/** 自定义边：bezier + 中点 + 按钮 */
function PlpEdge(props: EdgeProps) {
  const [path, labelX, labelY] = getBezierPath({ ...props, curvature: 0.25 })
  return (
    <>
      <BaseEdge id={props.id} path={path} markerEnd={props.markerEnd} />
      <EdgeLabelRenderer>
        {!(props.data as unknown as { readonly?: boolean }).readonly ? (
          <button type="button" className="plp-rf-edge-add nodrag nopan" title="在此新增节点"
            style={{ position: 'absolute', transform: 'translate(-50%,-50%) translate(' + labelX + 'px,' + labelY + 'px)', pointerEvents: 'all' }}
            onClick={(e) => { e.stopPropagation(); const d = props.data as unknown as { onAddBetween?: (f: string, t: string) => void } | undefined; if (d && d.onAddBetween) d.onAddBetween(props.source, props.target) }}>
            <IconPlusOutline16 size={10} />
          </button>
        ) : null}
      </EdgeLabelRenderer>
    </>
  )
}

const nodeTypes = { plp: PlpNode }
const edgeTypes = { plp: PlpEdge }

export function NodeGraph(props: {
  nodes: GraphNode[]
  selectedId: string | null
  /** 只读模式（查看历史版本）：隐藏新增/删除/移动/边中点按钮 */
  readonly?: boolean
  onSelect: (id: string) => void
  /** 在 sorted[afterIndex] 之后插入 type 类型节点 */
  onAdd: (afterIndex: number, type: string) => void
  /** 在 from → to 这条边之间插入（弹类型选择） */
  onAddEdge: (from: string, to: string) => void
  onDelete: (id: string) => void
  onMove: (id: string, dir: -1 | 1) => void
  onAddTail: (type: string) => void
}) {
  const readonly = props.readonly === true
  const sorted = useMemo(() => [...props.nodes].sort((a, b) => a.order - b.order), [props.nodes])
  // 顶部「新增节点」类型选择浮层
  const [picker, setPicker] = useState(false)
  useEscClose(picker, () => setPicker(false))

  const rfNodes = useMemo(() => sorted.map((n, i) => ({
    id: n.id,
    type: 'plp',
    position: { x: 0, y: i * GRAPH_STEP },
    data: { node: n, selected: props.selectedId === n.id, readonly, onDelete: props.onDelete, onMove: props.onMove, canUp: i > 0, canDown: i < sorted.length - 1 },
  })), [sorted, props.selectedId, props.onDelete, props.onMove])

  const rfEdges = useMemo(() => {
    const byId = new Set(sorted.map((n) => n.id))
    const edges: any[] = []
    let prev: GraphNode | null = null
    for (const n of sorted) {
      const deps = n.inputs && n.inputs.length ? n.inputs : prev ? [prev.id] : []
      for (const d of deps) {
        if (!byId.has(d) || d === n.id) continue
        edges.push({
          id: 'e-' + d + '-' + n.id,
          source: d,
          target: n.id,
          type: 'plp',
          markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
          data: { readonly, onAddBetween: props.onAddEdge },
        })
      }
      prev = n
    }
    return edges
  }, [sorted, props.onAddEdge])

  return (
    <div className="plp-rf-wrap">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        deleteKeyCode={null}
        minZoom={0.25}
        maxZoom={1.5}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: false }}
        onNodeClick={(_e, node) => props.onSelect(node.id)}
        onPaneClick={() => props.onSelect('')}
      >
        <Background gap={24} size={1} />
        <Controls showInteractive={false} position="bottom-left" />
        <Panel position="top-left">
          {!readonly ? (
            <button type="button" className="plp-btn plp-primary" onClick={() => setPicker(true)}>
              <IconPlusOutline16 />
              新增节点
            </button>
          ) : null}
          <span className="plp-rf-hint">{readonly ? '只读版本 · 查看历史节点' : '点击节点编辑 · 边中点 + 插入 · 卡片 × 删除'}</span>
        </Panel>
      </ReactFlow>
      {picker ? (
        <div className="plp-mask plp-mask-clear" onClick={() => setPicker(false)}>
          <div className="plp-modal" style={{ width: 380 }} onClick={(e) => e.stopPropagation()}>
            <div className="plp-modal-head">
              <span className="plp-modal-title">新增节点（追加到末尾）</span>
              <button className="plp-icon-btn" type="button" onClick={() => setPicker(false)}><IconCloseOutline16 /></button>
            </div>
            <div className="plp-modal-body">
              <div className="plp-type-grid">
                {NODE_TYPES.map((t) => (
                  <button key={t} type="button" className="plp-type-cell"
                    onClick={() => { props.onAddTail(t); setPicker(false) }}>
                    <span className={'plp-graph-type plp-graph-type-' + t}>{NODE_LABEL[t]}</span>
                    <span className="plp-type-desc">{TYPE_DESC[t]}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export { TYPE_DESC }
