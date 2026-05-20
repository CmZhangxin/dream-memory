---
name: capture-decision
description: "When the user explicitly states a decision, choice, or commitment (e.g. \"决定 X\", \"敲定 Y\", \"先 A 不做 B\", \"choose A over B\", \"go with X\"), capture it into the dream-memory system via dream_capture_decision. Do NOT trigger on speculative discussion or questions — only on confirmed choices."
---

# Capture Decision

Capture explicit user decisions into long-term memory so they show up in future `dream_recall` and weekly L1 summaries.

## When to trigger

Trigger this skill **only** when the user makes a clear, confirmed choice. Examples that match:

- "决定先接 MCP 不写 Skill"
- "敲定用 DeepSeek 不用腾讯云"
- "选 B 方案"
- "排除掉 launchd，就用 node-cron"
- "Let's go with stdio transport"
- "We'll skip the WebSocket part"

Examples that do **NOT** match (do not trigger):

- "我在考虑 A 还是 B" (still deliberating)
- "你觉得哪个方案好？" (asking opinion)
- "我们之前决定的那个 X" (referring to a past decision, not making a new one)
- "如果选 A 会怎样" (hypothetical)

If unsure, **err on the side of NOT triggering**. False positives create noise.

## Process

When triggered:

1. **Distill the decision into one sentence.** What was chosen? Be specific.
2. **List alternatives that were rejected** (if mentioned in the recent conversation).
3. **Capture context**: what task/feature/conversation led here.
4. **Call `dream_capture_decision`** with:
   - `text`: a self-contained one-paragraph summary, e.g.:
     > "决定阶段 3c 走 B 方案：mcp.json 接入 + 2 个核心 Skill (capture-decision + daily-review)。备选 A (仅 mcp 接入) 和 D (等一周观察) 被排除，理由是用户希望立即体验主动捕获能力。"
   - `metadata` (optional, only when these fields are obviously available):
     - `tags`: e.g. `["stage3c", "skill-design"]`
     - `alternatives`: short list of rejected options
     - `context`: relevant file path or task name
5. **Acknowledge briefly**: just `✅ 决策已记入梦境记忆库。` — do not summarize again.

## Failure handling

If the tool call fails (e.g. Hermes Memory Gateway not running, fetch failed):

- Tell the user clearly: `⚠️ 梦境记忆库未启动，本次决策未持久化。请运行 cd dream-dashboard && ./start.sh 后再说一次。`
- Do NOT retry automatically. Do NOT pretend it succeeded.

## What NOT to do

- ❌ Don't paraphrase the user's words back as "I'll capture this..." — just do it.
- ❌ Don't ask the user to confirm before capturing. Trust the trigger.
- ❌ Don't capture the entire conversation — only the distilled decision.
- ❌ Don't trigger on every "OK" or "好的" — those are agreement, not decision.
- ❌ Don't trigger when reading old decisions back — that's recall, not capture.

## Example flow

**User**: "OK 那就 B 方案。mcp 接入 + 2 个 Skill。"

**You** (silently):
- Distill: "决定阶段 3c 选 B 方案"
- Alternatives: A (仅 mcp), C (3 Skill 完整), D (等一周)
- Call `dream_capture_decision({ text: "...", metadata: { alternatives: [...], tags: ["stage3c"] } })`

**You** (visible reply): `✅ 决策已记入梦境记忆库。` 然后继续推进 B 方案的实施步骤。
