# 验收用例(dsh-plugins-1)

面向人的文字验收用例。

## 用例 1:三插件全量通过

- 前置:仓库处于任一提交,三个插件 lib/ 产物已构建
- 步骤:在仓库根执行 node scripts/workflow-ci-check.mjs
- 预期:依次打印 [CI] kanban OK / git OK / pipeline OK,[CI] ALL PASS,退出码 0

## 用例 2:任一失败即失败

- 步骤:临时把某个插件的 lib/client.js 删掉,再执行脚本
- 预期:对应插件打印 [CI] xxx FAILED 及失败日志尾部,汇总含 ok:false,退出码非 0

## 用例 3:任意目录可执行

- 步骤:cd /tmp 后执行 node /Users/jinchao.chen/Desktop/agent/dsh-plugins/scripts/workflow-ci-check.mjs
- 预期:结果与用例 1 一致(根路径由脚本自身推导,不依赖 cwd)
