# dsh-workflow-template

一套基于 [dsh-kanban](../plugins/kanban/README.md) 门禁的**软件开发工作流配置样例**。它把一条完整研发流程沉淀为一个可移植的配置文件:

- 10 个阶段列:**Backlog → RD → TD → UC → In Dev → 1st Review → Testing → 2nd review → Stage → Done**
- 9 条行为门禁:进入下一列必须满足条件(关联 MR / 确认标签 / MR 合并),不满足则动作被拒绝
- 1 个创建模板 `workflow`:建卡时自动带入描述、标签与全部门禁

> 这是一个 **template**:复制本目录出去、改 `workflow.json`、重新导入,即可得到你自己的流程。看板配置**可导入可导出**,流转方式见下文。

## 依赖

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)(DSH)
- 插件 **dsh-kanban**(必选,看板 + 门禁 + 配置导入导出)
- 插件 **dsh-git**(推荐:门禁 `mr-linked` / `mr-merged` 依赖它读 GitHub 仓库/MR)
- 插件 **dsh-pipeline**(可选:把「测试通过」门禁换成真实 pipeline 检查)

## 安装(导入)

1. 安装好 dsh-kanban 并打开过一次看板(生成看板数据);
2. 把本目录的 `workflow.json` 交给 DSH 会话里的 agent,说:「用 `kanban_import_config` 导入这个配置」;
3. 或者直接在会话里说「导入 workflow-template 的 workflow.json 作为我的看板配置」。

导入是**整体替换配置层**(列 / 门禁库 / 模板重建,id 重新生成、门禁按名字重新关联);**你的卡片不受影响**——旧卡片会全部挪到新板第一列,门禁挂载清除,不丢任何数据。导入前自动备份 `board.json.bak-<时间戳>`。

## 工作流总览

```
Backlog ──> RD ──> TD ──> UC ──> In Dev ──> 1st Review ──> Testing ──> 2nd review ──> Stage ──> Done
 需求池     设计     技术设计  验收用例   开发       代码评审     测试       上线前复审      预发布    完成
```

| 阶段 | 谁 / 做什么 | 进入条件(门禁) | 怎么通过 |
|---|---|---|---|
| Backlog | 任何人:把想法/需求建成卡片 | 无 | 直接建卡 |
| RD | RD 确认需求可做 | 已关联 GitHub 仓库与 MR | agent 建 MR 或用 `kanban_link` 关联 |
| TD | 写技术设计文档 | 打标签 `rd-confirmed` | 确认后 `kanban_tags(add: ["rd-confirmed"])` |
| UC | 写验收用例 | 打标签 `td-confirmed` | 同上 |
| In Dev | 开发实现 | 打标签 `uc-confirmed` | 同上 |
| 1st Review | 代码评审(首轮) | 已关联 MR | 关联 MR |
| Testing | 测试(可用 pipeline 自动跑) | 打标签 `review-1-done` | 1st Review 通过后打标签 |
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
| 5 | 进入评审需关联 MR | move → 1st Review | mr-linked | 无 |
| 6 | 1st review 通过才能测试 | move → Testing | tag-required | `{"tags":["review-1-done"]}` |
| 7 | 测试通过才能进 2nd review | move → 2nd review | tag-required | `{"tags":["tests-passed"]}` |
| 8 | 2nd review 通过才能 Stage | move → Stage | tag-required | `{"tags":["review-2-done"]}` |
| 9 | MR 已合并才能进 Done | move → Done | mr-merged | 无 |

门禁是看板库里的独立实体:同一条门禁可被多张卡/多个模板复用。检查器统一走沙箱 code 执行(内置类型是预设代码模板),可用 `code` 类型写任意检查、`pipeline` 类型现场跑流水线,详见 [kanban 的 Agent 门禁指南](../plugins/kanban/README.md#面向-agent-的门禁指南)。

## 日常使用

1. **建卡**:看板列头「+」新建卡片,模板选 `workflow`(自动带入 9 条门禁);或让 agent 用 `kanban_create(title, template: "workflow")`。
2. **关联 git**:卡片抽屉「+ 新增 git 关联」填 repo;开分支提 MR(标题带 `[taskId]` 会自动关联)。
3. **推进列**:满足门禁后把卡拖到下一列;不满足会被拒绝并提示原因。
4. **确认 = 打标签**:`rd-confirmed` / `td-confirmed` / `uc-confirmed` / `review-1-done` / `tests-passed` / `review-2-done`,由相应角色确认后打上(agent 可代劳)。
5. **收尾**:Stage 列里由 git 插件合并 MR,卡片自动进 Done。

## 配置导入导出(通用能力)

看板配置的流转由 dsh-kanban 的 2 个 agent 工具承担,格式与本文件一致:

- `kanban_export_config`:导出我当前的看板配置(列 + 门禁库 + 模板,按名字引用,**不含任何卡片/个人数据**),拿结果存成 JSON 分享给他人;
- `kanban_import_config`:导入一份配置(整体替换配置层,旧卡片挪第一列,自动备份)。

所以:别人把自己的形态 `kanban_export_config` 出来发给你,你 `kanban_import_config` 进去,就拿到了他那套流程——本包只是这套机制的一个官方样例。

## 自定义:复制成你自己的流程

1. 把 `workflow-template/` 整个目录复制出去(如 `cp -r workflow-template my-flow`);
2. 编辑 `my-flow/workflow.json`:
   - `kanban.columns`:增删阶段(按顺序);
   - `kanban.gates`:改每条门禁的 `on`(move/tags/archive)、`to`(目标列)、`checker`(mr-linked / mr-merged / tag-required / field-nonempty / code / pipeline);
   - `kanban.templates`:改模板名、预置描述、标签与勾选门禁(按门禁名引用)。
3. 让 agent 用 `kanban_import_config` 重新导入即可(整体替换,自动备份)。

## 文件说明

| 文件 | 作用 |
|---|---|
| `workflow.json` | 工作流配置(列 + 门禁 + 模板),**单一事实源**,与 kanban_export_config 导出格式一致 |
| `README.md` | 本文件:安装指引 + 使用指南 |

## License

[MIT](../LICENSE)
