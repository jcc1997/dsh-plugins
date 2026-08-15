# RD:仓库级 CI 验证脚本(dsh-plugins-1)

## 背景

dsh-plugins 有三个插件(kanban / git / pipeline),各自有 scripts/verify-dist.mjs 验证产物。目前没有仓库级的一键验证入口,CI/测试阶段要逐个目录手跑。

## 目标

新增 scripts/workflow-ci-check.mjs:一条命令跑三个插件的 verify-dist,输出汇总,任一失败非零退出。

## 范围

- 新增 scripts/workflow-ci-check.mjs(遍历 plugins/kanban|git|pipeline 跑 node scripts/verify-dist.mjs)
- 不改动任何插件业务代码

## 非目标

- 不引入新依赖、不改 CI 平台配置(本地/工作流 Testing 阶段使用)

## 验收口径(详见 TD / 验收用例)

- 本地 node scripts/workflow-ci-check.mjs 三个插件全 PASS 且退出码 0;任一失败退出码非 0 并打印失败摘要。
