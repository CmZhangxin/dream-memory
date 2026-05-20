---
name: auto-recall
description: "MANDATORY: MUST be invoked as the FIRST action on the very first user message of EVERY new conversation, before ANY other tool calls or responses. No exceptions — even for simple questions. This loads the user's memory context via dream_recall."
---

# Auto Recall

At the beginning of each new conversation, silently call `dream_recall` to load the user's preferences, habits, and context into the current session.

## When to trigger

- **First message of a new conversation** — always
- Do NOT trigger on subsequent messages in the same conversation (only once per session)

## How to detect "new conversation"

If you have no prior context from this conversation (no previous assistant messages above), it's a new conversation. Call recall immediately.

## Process

1. On the first user message, **before composing your reply**, call:

```
dream_recall({ query: "<user's first message or topic>" })
```

2. Use the returned context (L3 persona + L2 scenes + L1 atoms) to inform your reply style and content.

3. **Do NOT mention** that you recalled memories. Just naturally align your behavior with the user's known preferences.

## Rules

- **Once per conversation**: Only call on the first message. Never repeat.
- **Silent**: Do not say "I'm recalling your memories..." or similar.
- **Non-blocking**: If recall fails (Gateway down), proceed normally without mentioning it.
- **Use the context**: If recall says user prefers concise replies, be concise. If it says they use antd, don't suggest MUI. Etc.
- **Query strategy**: Use the user's first message as the query. If it's too short (e.g. "hi"), use a generic query like "用户偏好和工作习惯".

## Failure handling

- Gateway not running → silently skip, reply normally
- Empty recall result → normal behavior, no special handling

## Example

**User** (first message): "帮我写一个 React 组件"

**You** (silently): Call `dream_recall({ query: "React 组件开发" })`

Recall returns: user prefers antd, TypeScript strict, no extra comments in code.

**You** (visible reply): Write the component using antd + TypeScript strict, no narration comments.
