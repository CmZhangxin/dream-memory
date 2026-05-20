# Dream Memory · CodeBuddy 项目级 system prompt

## 项目定位

**dream-memory** 是跨 AI 工具的共享记忆中间件，基于 TencentDB-Agent-Memory 4 层 pipeline（L0→L1→L2→L3）。

## 模块

- `dream-memory-mcp/` — MCP Server，stdio 模式注册到 CodeBuddy/Claude
- `dashboard/` — Next.js 独立 Dashboard（端口 3002）
- `scripts/` — cron-runner 定时触发升华
- `.codebuddy/skills/` — capture-decision + daily-review

## 启动

```bash
# Gateway（后台常驻）
cd ~/.dream-memory/tdai-memory-openclaw-plugin && node dist/standalone/index.js &

# Dashboard
cd dashboard && npm run dev
```

## Skills

### capture-decision
触发：用户明确做出决策时自动调用 `dream_capture_decision`。

### daily-review
触发：用户请求日终复盘时拉取记忆、整理、确认后持久化。

## 安全约定

- 不要把 API Key / token / 密码捕获到记忆库
- 发现 Key 形字符串立即提醒用户轮换
