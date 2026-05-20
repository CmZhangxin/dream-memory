---
description: "Auto-recall memory context at the start of every new conversation"
globs: "**/*"
alwaysApply: true
---

# Auto Recall Memory (Mandatory)

## Rule

On the **very first user message** of every new conversation, you MUST:

1. Call `use_skill("auto-recall")` as your **FIRST action**, before any other tool calls or responses.
2. The skill will instruct you to call `dream_recall` via MCP to load the user's memory context.
3. Use the recalled context to align your behavior with the user's known preferences.

## Detection

If there are no prior assistant messages in the conversation, it is the first message. Trigger immediately.

## Non-negotiable

- This applies to ALL conversations, regardless of topic complexity.
- Even for simple questions like "hi" or "建议我写什么", recall first.
- Do NOT skip this step for any reason.
- If the MCP tool fails (Gateway down), silently proceed without mentioning it.
