# 5a: 修好 L1 提取 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 TencentDB-Agent-Memory 的 L1 extraction 在 DeepSeek API 下正常工作，产出 L1 atoms。

**Architecture:** 修改 llm-runner.ts 使 enableTools=false 时不传任何 tools（而非传 read_file），验证 DeepSeek 在无 tools 干扰下输出符合 l1-extractor 期望的 JSON 格式。如果 DeepSeek 输出仍不合规，在 l1-extractor 解析层增加容错。

**Tech Stack:** TypeScript, TencentDB-Agent-Memory 源码, DeepSeek API (deepseek-chat model)

---

## File Structure

| 文件 | 操作 | 职责 |
|---|---|---|
| `~/.dream-memory/tdai-memory-openclaw-plugin/src/adapters/standalone/llm-runner.ts` | **Modify** L201-203 | 去掉 enableTools=false 时的 tools 传递 |
| `~/.dream-memory/tdai-memory-openclaw-plugin/src/core/record/l1-extractor.ts` | **Modify** L360-400 | 增加 DeepSeek 输出容错（reasoning model fallback） |
| `~/worker/job/workshop/dream-dashboard/start.sh` | **Verify** | 确认 TDAI_LLM_MODEL=deepseek-chat 传递正确 |

---

### Task 1: 修 llm-runner.ts — enableTools=false 时不传 tools

**Files:**
- Modify: `~/.dream-memory/tdai-memory-openclaw-plugin/src/adapters/standalone/llm-runner.ts:200-211`

- [ ] **Step 1: 备份原文件**

```bash
cp ~/.dream-memory/tdai-memory-openclaw-plugin/src/adapters/standalone/llm-runner.ts \
   ~/.dream-memory/tdai-memory-openclaw-plugin/src/adapters/standalone/llm-runner.ts.bak
```

- [ ] **Step 2: 修改 tools 逻辑**

将第 200-211 行从：
```typescript
    // Select tools based on mode
    const tools = this.enableTools
      ? createSandboxedTools(workspaceDir, this.logger)
      : createReadOnlyTools(workspaceDir, this.logger);

    try {
      const result = await generateText({
        model: provider.chat(this.model),
        system: params.systemPrompt,
        prompt: params.prompt,
        tools,
        stopWhen: stepCountIs(this.enableTools ? MAX_TOOL_ITERATIONS : 1),
        maxOutputTokens: maxTokens,
        abortSignal: AbortSignal.timeout(timeoutMs),
      });
```

改为：
```typescript
    // Select tools based on mode — when enableTools=false, pass NO tools at all.
    // Passing even read-only tools causes DeepSeek to attempt tool-use instead of
    // outputting the expected JSON text, resulting in empty content (0 L1 atoms).
    const tools = this.enableTools
      ? createSandboxedTools(workspaceDir, this.logger)
      : undefined;

    try {
      const generateParams: Parameters<typeof generateText>[0] = {
        model: provider.chat(this.model),
        system: params.systemPrompt,
        prompt: params.prompt,
        maxOutputTokens: maxTokens,
        abortSignal: AbortSignal.timeout(timeoutMs),
      };
      // Only pass tools and stopWhen when tools are enabled
      if (tools) {
        generateParams.tools = tools;
        generateParams.stopWhen = stepCountIs(MAX_TOOL_ITERATIONS);
      }
      const result = await generateText(generateParams);
```

- [ ] **Step 3: 验证 TypeScript 编译通过**

```bash
cd ~/.dream-memory/tdai-memory-openclaw-plugin && npx tsc --noEmit 2>&1 | head -10
```

Expected: 0 errors（或只有不相关的 warning）

- [ ] **Step 4: Commit**

```bash
cd ~/.dream-memory/tdai-memory-openclaw-plugin && git add src/adapters/standalone/llm-runner.ts && git commit -m "fix: do not pass tools when enableTools=false (DeepSeek compat)"
```

---

### Task 2: 重启 Hermes + 验证 LLM 调用格式

**Files:**
- Verify: `~/worker/job/workshop/dream-dashboard/start.sh`
- Verify: `~/.dream-memory/gateway.log`

- [ ] **Step 1: 停止 Hermes**

```bash
pkill -f "gateway/server.ts" && sleep 2 && pgrep -lf "gateway/server.ts" || echo "✅ stopped"
```

- [ ] **Step 2: 清库（删除错误的 Vault 数据）**

```bash
rm -rf ~/.memory-tencentdb/memory-tdai/vectors.db*
rm -rf ~/.memory-tencentdb/memory-tdai/.metadata/recall_checkpoint.json
rm -rf ~/.memory-tencentdb/memory-tdai/scene_blocks/*
rm -f ~/.memory-tencentdb/memory-tdai/persona.md
rm -f ~/.dream-memory/gateway.log
echo '{}' > ~/.dream-memory/sync-state.json
```

- [ ] **Step 3: 重启 Hermes（用正确的 env）**

```bash
cd ~/worker/job/workshop/dream-dashboard && ./stop.sh && ./start.sh
```

等待 20s，然后验证：
```bash
curl -s http://localhost:8420/health
grep "StandaloneLLMRunner" ~/.dream-memory/gateway.log
```

Expected: `model=deepseek-chat`, gateway 在线

- [ ] **Step 4: 手动 capture 5 条测试对话触发 L1**

```bash
for i in 1 2 3 4 5; do
  curl -s -X POST http://localhost:8420/capture \
    -H "Content-Type: application/json" \
    -d "{\"user_content\":\"测试对话 $i：我喜欢用 antd 写前端，TypeScript strict 模式\",\"assistant_content\":\"好的，已了解你的偏好。\",\"session_key\":\"test-l1-fix\"}"
  sleep 1
done
```

- [ ] **Step 5: 等待 L1 触发（warmup threshold=1，第 1 条就会触发）**

```bash
sleep 15 && grep -E "run\(\) (start|completed)|L1 complete|detected|NO_JSON" ~/.dream-memory/gateway.log | tail -20
```

Expected: `run() completed` 有内容（output > 0 chars） + `detected N scene(s)` 其中 N > 0

- [ ] **Step 6: 查看 L1 是否真的写入**

```bash
sqlite3 ~/.memory-tencentdb/memory-tdai/vectors.db "SELECT COUNT(*) FROM l1_records;"
```

Expected: > 0

---

### Task 3: 如果 Task 2 仍失败 — l1-extractor 容错增强

> 只在 Task 2 Step 5/6 失败时执行本 Task

**Files:**
- Modify: `~/.dream-memory/tdai-memory-openclaw-plugin/src/core/record/l1-extractor.ts:360-400`

- [ ] **Step 1: 分析 gateway.log 看 LLM 实际输出**

```bash
grep "NO_JSON\|rawFull\|run() completed" ~/.dream-memory/gateway.log | tail -10
```

根据日志判断失败原因是：
- (a) output=0 chars → DeepSeek 仍返回空（可能需要换模型）
- (b) output 有内容但不是 JSON → 需要在解析层适配
- (c) output 是 JSON 但格式不匹配 → 需要调整解析

- [ ] **Step 2: 如果是 (b)/(c)，增加 l1-extractor 容错**

在 `parseExtractionResult` 函数（L360）的 JSON 提取前加入：

```typescript
// DeepSeek sometimes wraps response in thinking/reasoning tags — strip them
cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
cleaned = cleaned.replace(/<reasoning>[\s\S]*?<\/reasoning>/g, "").trim();

// If the model outputs a single object instead of array, wrap it
if (cleaned.startsWith("{") && !cleaned.startsWith("[")) {
  cleaned = `[${cleaned}]`;
}
```

- [ ] **Step 3: 如果是 (a)，尝试在 l1-extractor 的 prompt 末尾加强制指令**

找到 l1 extraction 的 prompt 文件：
```bash
grep -rn "systemPrompt\|l1.*prompt\|extraction.*prompt" ~/.dream-memory/tdai-memory-openclaw-plugin/src/core/record/l1-extractor.ts | head -5
```

在 prompt 末尾追加：
```
IMPORTANT: Output ONLY a valid JSON array. Do not use any tools. Do not explain. Just output the JSON.
```

- [ ] **Step 4: 重启 + 重新验证**

重复 Task 2 的 Step 1-6。

- [ ] **Step 5: Commit**

```bash
cd ~/.dream-memory/tdai-memory-openclaw-plugin && git add -A && git commit -m "fix: l1-extractor DeepSeek output compat (strip reasoning tags, single-object wrap)"
```

---

### Task 4: 验证 L1→L2→L3 全链路

> 前提：Task 2 或 Task 3 成功产出 L1

**Files:**
- Verify: `~/.memory-tencentdb/memory-tdai/scene_blocks/`
- Verify: `~/.memory-tencentdb/memory-tdai/persona.md`
- Verify: `~/.dream-memory/gateway.log`

- [ ] **Step 1: 继续灌入更多对话（凑够触发 L2 的阈值）**

```bash
for i in $(seq 6 20); do
  curl -s -X POST http://localhost:8420/capture \
    -H "Content-Type: application/json" \
    -d "{\"user_content\":\"对话 $i：workshop 项目用 cron 定时同步，我决定 TDD 先写测试再实现\",\"assistant_content\":\"好的，按你的习惯来。\",\"session_key\":\"test-l1-fix\"}"
  sleep 0.5
done
```

- [ ] **Step 2: 触发 session_end 加速升华**

```bash
curl -s -X POST http://localhost:8420/session/end \
  -H "Content-Type: application/json" \
  -d '{"session_key":"test-l1-fix"}'
```

- [ ] **Step 3: 等待 L2 触发（L1 完成后 90s）**

```bash
sleep 120 && echo "=== L1 ===" && sqlite3 ~/.memory-tencentdb/memory-tdai/vectors.db "SELECT COUNT(*) FROM l1_records;" && echo "=== L2 scene_blocks ===" && ls ~/.memory-tencentdb/memory-tdai/scene_blocks/ 2>&1 && echo "=== L3 persona.md ===" && head -10 ~/.memory-tencentdb/memory-tdai/persona.md 2>&1
```

Expected:
- L1 > 0 ✅
- scene_blocks/ 下有 .md 文件 ✅
- persona.md 有内容（可能还需要 50 条 L1 才触发 L3，这步可选）

- [ ] **Step 4: 如果 L3 没触发（正常，需要 50 条 L1），手动触发**

看 PersonaGenerator 是否有手动触发路径：
```bash
grep -n "generateLocalPersona\|triggerPersona\|forcePersona" ~/.dream-memory/tdai-memory-openclaw-plugin/src/core/persona/persona-generator.ts | head -5
```

如果有，通过 API 或代码触发。否则继续灌数据直到 50 条 L1。

- [ ] **Step 5: 验证 recall 返回三层**

```bash
curl -s -X POST http://localhost:8420/recall \
  -H "Content-Type: application/json" \
  -d '{"query":"我要写个新页面","session_key":"test-recall"}' | head -100
```

Expected: 返回含 `appendSystemContext`（L3 + L2 导航）+ `prependContext`（L1 atoms）

- [ ] **Step 6: 记录成功状态 + Commit workshop 变更**

```bash
cd ~/worker/job/workshop && git add -A && git commit -m "feat(stage5a): L1 extraction fixed, L0→L1→L2 pipeline verified"
```

---

### Task 5: 更新设计文档标记 5a 完成

**Files:**
- Modify: `~/worker/job/workshop/docs/2026-05-19-记忆系统-阶段5-设计文档.md`

- [ ] **Step 1: 更新文档状态**

将"状态：方向确认 + 技术验证完成，待实施"改为"5a 已完成"

- [ ] **Step 2: 在"当前问题"章节标记已修复**

- [ ] **Step 3: Commit**

```bash
cd ~/worker/job/workshop && git add docs/ && git commit -m "docs: mark 5a L1 fix as complete"
```

---

## Success Criteria

| 条件 | 验证方式 |
|---|---|
| L1 提取产出 > 0 atoms | `sqlite3 vectors.db "SELECT COUNT(*) FROM l1_records;"` |
| LLM 不再尝试调工具 | gateway.log 无 `Tool calls:` 行 |
| L2 Scene Block 有产出（可选） | `ls scene_blocks/` 有 .md 文件 |
| recall 返回含 L1 | `curl /recall` 有 prependContext |

---

*Plan created: 2026-05-20*
