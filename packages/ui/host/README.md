# host/ — 宿主桥(direct host bridge)

本目录集中所有「直接来自 vendor/deepseek-harness submodule」的内容,**与自研代码物理隔离**:

| 文件 | 内容 | 方式 | 同步 |
| --- | --- | --- | --- |
| `icons.ts` | ic_ds_* 图标集 re-export(70 个) | 通配 re-export 源码 | 宿主升级 submodule 后自动生效,零动作 |
| `design-platform.css` | 官方 tokens 全量快照 | sync 脚本生成 | `node scripts/sync-host-tokens.mjs` |

规则:
1. **禁复制**: 任何本目录内容不得复制进 src/ 或插件内, 一律经本目录引用。
2. 宿主升级: `git submodule update --init --recursive` → 图标自动跟随; tokens 重跑 sync 脚本。
3. 宿主缺失的业务图标(看板/门禁等)允许自绘, 风格跟随 ic_ds_*(stroke 1.3/圆头), 放插件内或 src/ 自研区。
