---
name: grill-me
description: Interview the user relentlessly about a plan or design until reaching shared understanding, resolving each branch of the decision tree. Use when user wants to stress-test a plan, get grilled on their design, or mentions "grill me". 中文场景同样适用：用户说「拷问我」「盘问方案」「拷打设计」时使用。
---

# grill-me

> 来源：Matt Pocock 的 skills 集（https://github.com/mattpocock/skills 的 grill-me；经 TimothyVang/Grill-me fork 核对）。
> 安装到 dsh-plugins 时的本环境适配：提问工具为 `ask_user_question`（run_code 内 `tools.ask_user_question`），见下文「本环境适配」。

Interview me relentlessly about every aspect of this plan until we reach a shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one-by-one. For each question, provide your recommended answer.

Ask the questions one at a time.

If a question can be answered by exploring the codebase, explore the codebase instead.

## 本环境适配（dsh-plugins）

1. **提问必须用 `ask_user_question` 工具**：每次一个问题，通过工具的多选弹窗让用户快速作答或自定义。
   - `questions` 数组一项一条问题，`id` 稳定唯一；
   - 每条问题给 2–4 个**具体**选项（最可能的方向，不要「是/否」糊弄），推荐项放第一并标注「（推荐）」；
   - 用户在弹窗里作答，答案从工具结果 `answers` 取回。
2. **一次只问一个**：等用户答完再问下一个（每个决策点一个工具调用）。
3. **能查代码就不问**：答案在仓库文件里能查到的（read/grep/glob），自己查，不要问用户。
4. **逐个给出推荐答案**：每个问题都带上你认为最合理的选项，并一句话说明理由（写在选项 description 里）。
5. **收尾**：所有决策分支都定完后，给一份简明的决策总结。

## Flow

1. 收到答案后，1–2 句确认该决策，随即用 `ask_user_question` 问下一个问题。
2. 问题若能从代码库/文件回答，先查再问。
3. 继续直至设计树所有分支都有了定论。
4. 结束前输出所有已定决策的简明总结。
