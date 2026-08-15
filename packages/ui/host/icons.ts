/**
 * 宿主图标桥: 直接 re-export vendor submodule 的 ic_ds_* 图标集(70 个)。
 * 来源: vendor/deepseek-harness/packages/client/ui-primitives/src/icons/index.tsx(MIT)
 * 说明: 与宿主渲染同一份源码, 结构性一致, 无漂移; 宿主新增/修改图标无需任何同步动作。
 * 注意: 本文件不复制任何图标代码; 删除/改名需同步更新引用方。
 */
export * from '../../../vendor/deepseek-harness/packages/client/ui-primitives/src/icons/index.tsx'
