---
description: "Auto-capture every substantive conversation turn into L0 via dream_capture_conversation"
globs: "**/*"
alwaysApply: true
---

# Auto Capture L0 (Mandatory)

## Rule

After completing your reply to **EVERY substantive user message**, you MUST call:

```
dream_capture_conversation({
  user_content: "<user's message, condensed if very long>",
  assistant_content: "<your reply, condensed to key points>"
})
```

This MUST be your **last tool call** of the turn, after the actual work is done.

## What counts as "substantive"

**Capture** (must call):
- Any question, request, or instruction with real content
- Discussions about preferences, decisions, technical choices
- Code review, debugging, planning
- Multi-step or non-trivial replies

**Skip** (do NOT call):
- Pure greetings: "hi", "你好", "在吗"
- Single-word confirmations: "好", "OK", "继续", "嗯"
- Tool-only turns where the user provided no real intent

## Rules

- **Last tool call of the turn**: do all real work first, then capture at the end.
- **Condense long content**: keep both `user_content` and `assistant_content` under ~500 chars; summarize key points if longer.
- **Silent**: never tell the user "I captured this" — just do it.
- **Non-blocking**: if the MCP call fails (Gateway down), silently ignore and continue.
- **Once per turn**: only one capture call per user message, no matter how many tool calls preceded it.

## Why this is a Rule (not just a Skill)

Skills are evaluated probabilistically by the model. This capture step must run on
**every** substantive turn to keep the L0 layer complete, so it is enforced as a
workspace rule with `alwaysApply: true`.
