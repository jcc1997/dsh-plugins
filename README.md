# dsh-plugins — DSH 插件大仓

DeepSeek Harness（DSH）的插件集合仓库。每个插件是一个遵循官方规范的 **bundle 包**（npm 包 + 配置层），可独立安装、发布、共享。

> 官方开发文档：[deepseek-harness docs/user/develop](https://github.com/deepseek-ai/deepseek-harness/tree/master/docs/user/develop)

## 仓库结构

```
dsh-plugins/
├── package.json            # workspace 根（pnpm）
├── pnpm-workspace.yaml     # 聚合 plugins/*
└── plugins/
    └── hello/              # hello world 示例插件（第一个插件，可直接发布）
        ├── package.json      # 声明 dsh.bundle（本包是一个配置层）
        ├── cordis.patch.yml  # 配置层：插入 hello 插件行
        └── src/index.js      # 插件本体：Config schema + hello 工具
```

## 什么是 DSH 插件（官方概念）

| 概念 | 说明 |
|---|---|
| **bundle** | 一个 npm 包，`package.json` 里声明 `dsh.bundle.patch` 指向一个 `cordis.patch.yml`，即"这个包贡献一层配置" |
| **profile** | `$DSH_HOME/profiles/<name>` 下的一个可运行组合，`dsh.profile.bundles` 按顺序叠加各 bundle 的层 |
| **插件行** | `cordis.patch.yml` 里 `- insert:` 的 `{ id, name, config }`，`name` 是包名，`config` 经插件导出的 `Config` schema 校验 |

组合顺序：bundle 列表顺序 → profile 自己的 `cordis.patch.yml` → `$DSH_HOME/cordis.patch.yml` → `--patch` 覆盖。

## 开发一个插件

以 `plugins/hello` 为模板复制新目录：

```bash
mkdir -p plugins/my-plugin/src
cp plugins/hello/{cordis.patch.yml,package.json} plugins/my-plugin/
# 修改 package.json 的 name/version，写 src/index.js
```

插件入口是一个 ESM 模块，导出：

```js
export const name = 'my-plugin'                 // 插件名
export const Config = Schema.object({ ... })    // 配置 schema（Standard Schema，可省略）
export const inject = ['tools']                 // 硬依赖（可选）
export function apply(ctx, config) { ... }      // 注册能力，ctx 生命周期内自动清理
```

- 纯 JS 即可，无需编译（官方规范）。
- 注册模型工具用 `defineTool`（见 `plugins/hello/src/index.js`）。
- 更多形态（Service 定义/提供者/消费者三层拆分）见官方 [practice 教程](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/practice/index.md)。

## 安装到本机

用官方 CLI（`dsh plugin` 本质是把包装进 profile 目录并登记 bundle 层）：

```bash
# 方式一：本地目录（开发时）
dsh plugin --profile web add ./plugins/hello

# 方式二：本地打包的 tarball（分发）
pnpm --filter dsh-plugins-hello pack
dsh plugin --profile web add ./dsh-plugins-hello-0.1.0.tgz

# 方式三：从 npm registry（发布后）
dsh plugin --profile web add dsh-plugins-hello

# 卸载
dsh plugin --profile web remove dsh-plugins-hello
```

> 注意：`--profile web` 就是当前 Web GUI 用的 profile（`~/.dsh/profiles/web`，设备级）。安装后**重启 dsh web 进程**生效。每个机器/用户各自安装——插件不随仓库自动分发。

验证组合是否包含新层（无需重启）：

```bash
dsh --profile web --dump-config    # 末尾应出现 "# == dsh-plugins-hello" 层
```

## 发布

发布渠道自选，包结构本身（`files` 只含 `src/index.js` + `cordis.patch.yml`）与渠道无关：

```bash
# npm 公开发布（先把包名改成全局唯一）
cd plugins/hello
npm publish --access public

# 私有 registry（公司 npm / GitHub Packages / GitLab Packages）
# 在 plugins/hello/package.json 加：
#   "publishConfig": { "registry": "https://your-registry" }
npm publish

# 只打 tarball 走内部分发
pnpm --filter dsh-plugins-hello pack
```

安装方只需 `dsh plugin --profile <name> add <包名>`（公开）或配置 `.npmrc` 指向私有 registry 后同样安装。

## 验证脚本（可选）

仓库根安装验证依赖后，`node scripts/verify-hello.mjs` 可不启动 dsh 直接验证插件模块可被 Cordis 加载。

## 参考

- [Your first plugin（官方）](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/index.md)
- [Build a tool（官方）](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/tool.md)
- [Plugin configuration（官方）](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/config.md)
- [Package and install a plugin（官方）](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.md)
