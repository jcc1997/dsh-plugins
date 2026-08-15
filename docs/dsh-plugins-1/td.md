# TD:仓库级 CI 验证脚本(dsh-plugins-1)

## 技术方案

- 新增 scripts/workflow-ci-check.mjs(Node ESM,零依赖)
- 遍历 plugins/kanban | git | pipeline,子进程 execSync 执行各自 scripts/verify-dist.mjs(超时 120s)
- 汇总 { plugin, ok, ms, error? },任一失败 exit 1,全过 exit 0 并打印 [CI] ALL PASS

## 关键实现

- 根路径由 import.meta.url 推导(root = script 的上一级目录),与 cwd 无关,任意目录可执行
- 子进程输出 pipe 捕获;失败时打印尾部 500~800 字符便于定位

## 边界与取舍

- 串行执行(三个 verify 本身都在秒级;并行无收益且日志交织)
- 不引入依赖;verify-dist 是各插件既有脚本,CI 脚本只做编排
