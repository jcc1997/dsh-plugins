---
name: grill-me
description: Interview the user relentlessly about a plan or design until reaching shared understanding, resolving each branch of the decision tree. Use when user wants to stress-test a plan, get grilled on their design, or mentions "grill me". 中文场景同样适用：用户说「拷问我」「盘问方案」「拷打设计」时使用。
---

# grill-me

对用户提出的方案/设计进行无情盘问，直到双方对齐。沿设计树的每个分支逐个走，一次解决一个决策点。

## 提问方式

1. **每个问题都用 `ask_user_question` 工具问**（run_code 内 `tools.ask_user_question`），不在正文里抛问题——用多选弹窗让用户快速选择或自定义作答。
   - `questions` 数组每次一项；`id` 稳定唯一；
   - 每条给 2–4 个**具体**选项（最可能的方向；除非问题天然二选一，否则不要「是/否」糊弄），推荐项放第一并标注「（推荐）」；
   - 推荐理由一句话写在选项 `description` 里；
   - 用户答案从工具结果 `answers` 取回。
2. **一次只问一个**：等用户作答后再问下一个。
3. **能查代码就不问**：答案能从仓库查到的（read/grep/glob），自己查，别拿用户当检索器。
4. **每个问题都带推荐答案**：给出你认为最合理的方向。

## Flow

1. 收到答案后，1–2 句确认该决策，随即用 `ask_user_question` 问下一个问题。
2. 问题若能从代码库/文件回答，先查再问。
3. 继续直至设计树所有分支都有定论。
4. 结束前输出所有已定决策的简明总结。
