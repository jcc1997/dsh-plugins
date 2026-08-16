# dsh-markdown-review

DSH markdown 文档审阅插件:在**对话流**中打开本地 markdown 文档的**大浮窗**——划词批注 + 总评,点「提交」即把内容作为工具结果回传,**agent 自动继续**后续流程。

## 能力

- **对话流工具卡**:agent 调用 `md_doc_open` 后,消息流出现「文档审阅」卡片 + 「打开文档」按钮(`tool.call.toolview` 接管);
- **大浮窗审阅**:渲染本地 markdown——标题/粗斜体/行内代码/代码块/引用/列表(两层嵌套)/表格/链接/分隔线/**mermaid 图**(官方库渲染,失败降级为源码+错误提示);
- **划词批注**:选中正文 → 批注框**内嵌对应块下方**(引用风格:左品牌蓝竖条 + 淡灰底;列表项、代码块、表格均可划词);引用带**行号范围**(`划中文字#L11-13`,随提交给 agent 定位);右侧引用清单支持**点击定位原文(高亮闪烁)/编辑(预填重开)/删除**;底部总评;
- **提交即续跑**:`md_doc_open` 工具执行阻塞等待提交(机制照抄宿主内置 `tool-ask-user`,但 pending→路由→resolve 自实现,不依赖内置服务);提交内容(逐条引用+批注+总评)成为工具结果,agent 立即继续;卡片就地展示提交摘要。

## 划词交互与限制

- **锚定在块下方**:批注输入框渲染在所选段落/列表项/代码块的正下方,不再悬浮;表格内划词锚定到整个表格下方;
- **必须同一块内**:跨段落、跨块、跨表格的选区会被拒绝并提示「划词请保持在同一段落内」;
- **不可引用区域**:mermaid 图区域不参与划词;选区落在图内会被忽略;
- 单条引用最多取前 400 字;引用可在右侧清单删除;「总评」独立于引用,两者至少其一即可提交。

## 工具契约

### md_doc_open

参数:

| 参数 | 必填 | 说明 |
|---|---|---|
| `path` | 是 | 本地 markdown 绝对路径(支持 `~` 展开),如 `~/repo/docs/dsh-plugins-1/td.md` |
| `title` | 否 | 展示标题,默认文件名 |
| `context` | 否 | 一句话说明为什么需要审阅(展示在卡片上) |

结果(用户提交后):

```json
{ "ok": true, "docId": "…", "quotes": [{ "id": "…", "key": "块key", "text": "选中原文", "note": "批注", "line": 11, "lineEnd": 13 }], "comment": "总评", "cancelled": false }
```

> 用户点「取消」或超时(30 分钟)会返回 `{ ok: false, error: … }`。同文档同时只允许一个待处理审阅。

## 数据

- 提交历史(尽力而为)落 `~/.dsh/markdown-review/submissions.json`(保留最近 200 条);
- 文档本身只读,插件不修改被审阅文件。

## 与开发工作流配合

把要审的文档放 git 仓库 `docs/<taskId>/`(workflow 约定),审批点时让 agent:

```
md_doc_open(path: "~/repo/docs/<taskId>/td.md", context: "TD 完成,请审阅确认")
```

你划词批注并提交后,agent 拿到批注/总评,按 workflow 约定打确认标签、推进列。kanban 门禁机制不变。

## 开发

```bash
pnpm --filter dsh-markdown-review check   # typecheck + build + verify(1 工具 / 2 路由断言)
node build.mjs --watch                     # HMR 开发
```
