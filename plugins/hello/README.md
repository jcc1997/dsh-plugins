# dsh-plugins-hello

DSH hello world 插件 bundle：注册 `hello` 模型工具，演示官方 bundle 包规范。

## 组成

| 文件 | 作用 |
|---|---|
| `package.json` | `dsh.bundle.patch` 声明本包是一个配置层 |
| `cordis.patch.yml` | 插入 `hello` 插件行（含示例 config） |
| `src/index.js` | 插件本体：`Config` schema + `hello` 工具 |

## 安装

```bash
dsh plugin --profile web add dsh-plugins-hello   # 或本地路径 ./plugins/hello
```

重启 dsh 后，对模型说"用 hello 工具问候"即可看到工具生效。

## 配置

| 字段 | 默认值 | 说明 |
|---|---|---|
| `greeting` | `你好` | 问候语 |
| `verbose` | `false` | 启动时打印加载日志 |

可在 profile 的 `cordis.patch.yml` 覆盖（`hello` 行的 `config`），或直接改本包的 patch 层。
