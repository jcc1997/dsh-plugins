# dsh-workflow-dev

一套基于 [dsh-kanban](../plugins/kanban/README.md) 门禁的**软件开发工作流模板**。它把一条完整的研发流程沉淀为数据:

- 10 个阶段列:**Backlog → RD → TD → UC → In Dev → review → Testing → 2nd review → Stage → Done**
- 9 条行为门禁:进入下一列必须满足条件(关联 MR / 确认标签 / 测试通过 / MR 合并),不满足则动作被拒绝
- 1 个创建模板 `workflow`:建卡时自动带入描述、标签与全部门禁

> 这是一个 **template**:复制本目录出去、改 `workflow.json`、重跑安装,即可得到你自己的流程工具。

## 依赖

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)(DSH)
- 插件 **dsh-kanban**(必选,门禁与看板本体)
- 插件 **dsh-git**(推荐:门禁 `mr-linked` / `mr-merged` 依赖它读 GitHub 仓库/MR)
- 插件 **dsh-pipeline**(可选:把「测试通过」门禁换成真实 pipeline 检查)

## 安装

### 方式一:脚本一键安装(推荐)

```bash
# 先安装 dsh-kanban 并打开一次看板(生成 ~/.dsh/kanban/board.json)
cd workflow-dev
node install.mjs
```

脚本**幂等**:已存在的列/门禁不会重复创建;执行前自动备份 `board.json.bak-<时间戳>`。也支持指定数据目录:`node install.mjs [workflow.json] [数据目录]`。

### 方式二:让 agent 安装

把 `workflow.json` 拖给 DSH 会话里的 agent,说「按这个文件安装我的看板工作流」即可——agent 会用 `kanban_add_column` / `kanban_gate_create` / `kanban_template_update` 逐项落盘。

## 工作流总览

```
Backlog ──> RD ──> TD ──> UC ──> In Dev ──> review ──> Testing ──> 2nd review ──> Stage ──> Done
 需求池     设计     技术设计  验收用例   开发       代码评审     测试       上线前复审      预发布    完成
```

| 阶段 | 谁 / 做什么 | 进入条件(门禁) | 怎么通过 |
|---|---|---|---|
| Backlog | 任何人:把想法/需求建成卡片 | 无 | 直接建卡 |
| RD | RD 确认需求可做 | 已关联 GitHub 仓库与 MR | agent 建 MR 或用 `kanban_link` 关联 |
| TD | 写技术设计文档 | 打标签 `rd-confirmed` | agent/人确认后 `kanban_tags(add: ["rd-confirmed"])` |
| UC | 写验收用例 | 打标签 `td-confirmed` | 同上 |
| In Dev | 开发实现 | 打标签 `uc-confirmed` | 同上 |
| review | 代码评审(首轮) | 已关联 MR | 关联 MR |
| Testing | 测试(可用 pipeline 自动跑) | 打标签 `review-1-done` | 评审通过后打标签 |
| 2nd review | 上线前复审(第二轮) | 打标签 `tests-passed` | 测试通过后打标签 |
| Stage | 预发布/待合并 | 打标签 `review-2-done` | 复审通过后打标签 |
| Done | 完成 | **MR 已合并** | git 插件合并 MR 后自动放行 |

## 门禁清单(9 条)

| # | 门禁名 | 触发 | 检查器 | config |
|---|---|---|---|---|
| 1 | 进入 RD 需关联 MR | move → RD | mr-linked | 无 |
| 2 | RD 确认才能进 TD | move → TD | tag-required | `{"tags":["rd-confirmed"]}` |
| 3 | TD 确认才能进 UC | move → UC | tag-required | `{"tags":["td-confirmed"]}` |
| 4 | 验收用例确认才能开发 | move → In Dev | tag-required | `{"tags":["uc-confirmed"]}` |
| 5 | 进入 review 需关联 MR | move → review | mr-linked | 无 |
| 6 | review 通过才能测试 | move → Testing | tag-required | `{"tags":["review-1-done"]}` |
| 7 | 测试通过才能进 2nd review | move → 2nd review | tag-required | `{"tags":["tests-passed"]}` |
| 8 | 2nd review 通过才能 Stage | move → Stage | tag-required | `{"tags":["review-2-done"]}` |
| 9 | MR 已合并才能进 Done | move → Done | mr-merged | 无 |

门禁是看板库里的独立实体:同一条门禁可被多张卡/多个模板复用;改一处全局生效。检查器统一走沙箱 code 执行(内置类型是预设代码模板),可用 `code` 类型写任意检查、`pipeline` 类型现场跑流水线,详见 [kanban 的 Agent 门禁指南](../plugins/kanban/README.md#面向-agent-的门禁指南)。

## 日常使用

1. **建卡**:看板列头「+」新建卡片,模板选 `workflow`(自动带入 9 条门禁);或让 agent 用 `kanban_create(title, template: "workflow")`。
2. **关联 git**:卡片抽屉「+ 新增 git 关联」填 repo;开分支提 MR(标题带 `[taskId]` 会自动关联)。
3. **推进列**:满足门禁后把卡拖到下一列;不满足会被拒绝并提示原因。
4. **确认 = 打标签**:`rd-confirmed` / `td-confirmed` / `uc-confirmed` / `review-1-done` / `tests-passed` / `review-2-done`,由相应角色确认后打上(agent 可代劳)。
5. **收尾**:Stage 列里由 git 插件合并 MR,卡片自动进 Done(合并前有 Stage 门禁,合并后自动流转)。

## 自定义:复制成你自己的流程

1. 把 `workflow-dev/` 整个目录复制出去(如 `cp -r workflow-dev my-flow`)。
2. 编辑 `my-flow/workflow.json`:
   - `kanban.columns`:增删阶段(按顺序);
   - `kanban.gates`:改每条门禁的 `on`(move/tags/archive)、`to`(目标列)、`checker`(mr-linked / mr-merged / tag-required / field-nonempty / code / pipeline);
   - `kanban.template`:改模板名、预置描述与标签。
3. 重跑 `node install.mjs`(幂等,自动备份)。

## 文件说明

| 文件 | 作用 |
|---|---|
| `workflow.json` | 工作流定义(列 + 门禁 + 模板),**单一事实源** |
| `install.mjs` | 一键合并进看板(幂等 + 自动备份) |
| `package.json` | 包元信息 |
| `README.md` | 本文件:安装指引 + 使用指南 |

## License

[MIT](../LICENSE)
