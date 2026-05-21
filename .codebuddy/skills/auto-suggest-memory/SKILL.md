---
name: auto-suggest-memory
description: "After EVERY substantive conversation turn (not greetings or simple confirmations), MUST call dream_capture_conversation to write L0 raw dialogue, then evaluate whether the user revealed something worth remembering long-term — preferences, habits, constraints, project facts, technical choices, or recurring patterns. If yes, call dream_suggest_memory. This runs passively in the background without interrupting the conversation flow."
---

# Auto Suggest Memory

Two responsibilities after each substantive conversation turn:

1. **ALWAYS** write the dialogue to L0 via `dream_capture_conversation`
2. **Optionally** propose a memory via `dream_suggest_memory` if content is memory-worthy

The user never needs to say "记住这个" — the system proactively captures.

## L0 Capture (Mandatory)

After EVERY substantive conversation turn (not greetings like "hi"/"好的"/"继续"), you MUST call:

```
dream_capture_conversation({
  user_content: "<user's message, condensed if very long — keep under 500 chars>",
  assistant_content: "<your reply, condensed to key points — keep under 500 chars>"
})
```

### Rules for L0 capture:
- **Always capture**: any turn with real content (questions, instructions, discussions, code reviews)
- **Skip**: pure greetings, single-word confirmations ("OK", "好", "继续"), or tool-only turns with no user intent
- **Condense**: if user/assistant content is very long, summarize to key points (under 500 chars each)
- **Silent**: never mention to the user that you're capturing
- **Non-blocking**: if the MCP call fails, silently ignore and continue

---

## Evaluation criteria

After each user message, silently ask yourself: **"Did the user just reveal something that would be useful to remember in future conversations?"**

### Worth remembering (call `dream_suggest_memory`):

| 类型 | 示例 |
|------|------|
| **persona** (偏好/特质) | "我喜欢用暗色主题"、"我习惯先写测试"、"我不喜欢过多注释" |
| **persona** (工作习惯) | "我一般晚上 coding"、"周末不看消息"、"commit 前必跑 lint" |
| **episodic** (项目事实) | "这个项目用 Node 22"、"我们的 API 前缀是 /admin/"、"数据库是 PostgreSQL" |
| **episodic** (重要事件) | "上线了 v2"、"昨天遇到了 OOM"、"刚完成了会员系统" |
| **instruction** (对AI的要求) | "回复简洁点"、"代码不要加注释"、"用中文回复"、"别用 emoji" |
| **instruction** (工作流偏好) | "改完直接提 PR"、"不要自动 commit"、"先看方案再动手" |

### NOT worth remembering (do NOT call):

- 一次性的调试指令（"把端口改成 3001"）
- 临时的实现细节（"在第 42 行加个 if"）
- 已经在记忆库中的内容（避免重复）
- 打招呼、确认（"好的"、"OK"、"继续"）
- 纯粹的技术问答（"什么是 MCP？"）
- 当前对话上下文中已经显而易见的事情

## Process

1. **评估**：每轮对话结束后，花 1 秒判断是否有值得记忆的内容
2. **提炼**：把值得记忆的内容精炼成一句独立、自包含的陈述
3. **分类**：判断是 `persona`、`episodic` 还是 `instruction`
4. **调用**：`dream_suggest_memory({ content, type, reason })`
5. **静默**：不要告诉用户你正在记忆，除非用户主动问

## Calling convention

```
dream_suggest_memory({
  content: "用户偏好暗色主题，Dashboard 默认使用 dark mode",
  type: "persona",
  reason: "用户明确要求页面跟随暗色主题，并确认默认用暗色"
})
```

## Rules

- **静默执行**：不要在回复中提及"我记住了"或"已建议记忆"，直接做
- **不打断对话**：先完成正常回复，再（或同时）调用 suggest
- **宁缺毋滥**：每 3-5 轮对话最多 suggest 1 条，不要刷屏
- **去重**：如果你 recall 到类似记忆已存在，不要重复 suggest
- **合并**：同一轮对话中发现多条值得记忆的，合并成最重要的 1 条
- **独立性**：content 必须脱离上下文也能理解（"用户喜欢 X"而非"他喜欢那个"）

## Frequency control

- 简单确认/操作类对话：不触发
- 讨论/设计/偏好表达类对话：评估是否触发
- 单次会话中最多 suggest 3 条
- 如果不确定是否值得记，**不记**

## Failure handling

如果 `dream_suggest_memory` 调用失败（Gateway 未运行）：
- 静默忽略，不影响正常对话
- 不要提醒用户
