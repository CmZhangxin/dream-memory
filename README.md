# Dream Memory

跨 AI 工具的共享记忆中间件。让 CodeBuddy、Claude Desktop 等 AI 工具记住你的偏好、决策和工作习惯。

基于 [TencentDB-Agent-Memory](https://github.com/user/tdai-memory) 4 层记忆 Pipeline（L0→L1→L2→L3）。

**GitHub**: [https://github.com/CmZhangxin/dream-memory](https://github.com/CmZhangxin/dream-memory)

## 特性

- **4 层记忆架构**：L0 原始对话 → L1 原子记忆 → L2 场景聚类 → L3 人格画像
- **MCP 协议**：支持 stdio / HTTP / WebSocket，兼容所有 MCP 客户端
- **自动记忆**：AI 对话中自动识别值得记住的内容，无需手动触发
- **人工审核**：Dashboard 可审核/编辑 AI 建议的记忆，也可跳过等待自动通过
- **定时升华**：每晚自动触发 L0→L1→L2→L3 流水线
- **多客户端共享**：CodeBuddy + Claude Desktop 共享同一份记忆

## 快速开始

### 前置条件

- Node.js >= 22
- [TencentDB-Agent-Memory](https://github.com/user/tdai-memory) 安装在 `~/.dream-memory/tdai-memory-openclaw-plugin/`
- **LLM API Key**（必须，否则 L0→L1 升华会失败）

### 配置 LLM（必读）

在 `~/.dream-memory/tdai-memory-openclaw-plugin/tdai-gateway.yaml` 里配置 `llm` 段：

```yaml
memory:
  embedding:
    provider: openai
    baseUrl: https://api.siliconflow.cn/v1
    apiKey: sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
    model: BAAI/bge-large-zh-v1.5
    dimensions: 1024

llm:
  baseUrl: https://api.siliconflow.cn/v1
  apiKey: sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
  model: deepseek-ai/DeepSeek-V3
  maxTokens: 4096
  timeoutMs: 120000
```

> 也可通过环境变量 `TDAI_LLM_BASE_URL` / `TDAI_LLM_API_KEY` / `TDAI_LLM_MODEL` 覆盖。
>
> 推荐组合：[硅基流动 SiliconFlow](https://siliconflow.cn) + DeepSeek-V3（Embedding 和 LLM 共用一个 key）。

### 一键启动

```bash
./start.sh
```

这会启动：
- Memory Gateway（端口 8420）
- Cron-runner（每晚 23:00 升华）
- Dashboard（端口 3002）

### 手动启动

```bash
# 1. Memory Gateway
cd ~/.dream-memory/tdai-memory-openclaw-plugin
node --import tsx src/gateway/server.ts

# 2. Dashboard
cd dashboard && npm install && npm run dev

# 3. Cron-runner（可选）
cd scripts && npm install && npx tsx src/cron-runner.ts
```

### 停止

```bash
./stop.sh
```

## 注册 MCP 到 AI 工具

### CodeBuddy

在 `~/.codebuddy/mcp.json` 中添加：

```json
{
  "mcpServers": {
    "dream-memory": {
      "command": "node",
      "args": ["--import", "tsx", "src/index.ts", "--transport", "stdio", "--client-hint", "codebuddy"],
      "cwd": "/path/to/dream-memory/dream-memory-mcp",
      "env": {
        "GATEWAY_URL": "http://localhost:8420"
      }
    }
  }
}
```

### Claude Desktop

在 `~/Library/Application Support/Claude/claude_desktop_config.json` 中添加相同配置。

## MCP 工具

| 工具 | 用途 |
|------|------|
| `dream_recall` | 召回相关记忆注入上下文 |
| `dream_capture_conversation` | 写入 L0 对话 |
| `dream_capture_decision` | 记录重要决策 |
| `dream_capture_note` | 记录笔记 |
| `dream_capture_skill` | 记录技能/模式 |
| `dream_suggest_memory` | AI 建议一条记忆（待审核） |
| `dream_search_memories` | 语义搜索 L1 记忆 |
| `dream_search_conversations` | 搜索 L0 对话 |
| `dream_session_end` | 结束会话并触发升华 |
| `dream_get_persona` | 获取 L3 人格画像 |
| `dream_get_scenarios` | 获取 L2 场景列表 |
| `dream_get_today` | 获取今日记忆 |

## 项目结构

```
dream-memory/
├── dream-memory-mcp/       # MCP Server（核心）
│   ├── src/tools/          # 12 个 dream_* 工具实现
│   ├── src/transports/     # stdio / HTTP / WebSocket
│   └── src/gateway-client.ts
├── dashboard/              # Next.js Dashboard（端口 3002）
│   └── src/app/memory/     # 记忆管理页面
├── scripts/                # Cron-runner + 同步脚本
│   └── src/cron-runner.ts
├── .codebuddy/skills/      # CodeBuddy Skills
│   ├── auto-suggest-memory/  # 自动建议记忆
│   ├── capture-decision/     # 捕获决策
│   └── daily-review/         # 日终复盘
├── start.sh                # 一键启动
├── stop.sh                 # 一键停止
└── docs/                   # 设计文档
```

## 4 层记忆

| 层 | 名称 | 内容 | 触发 |
|----|------|------|------|
| L0 | 原始对话 | 完整对话片段 | 实时写入 |
| L1 | 原子记忆 | 偏好/事件/指令 | LLM 提取（升华） |
| L2 | 场景聚类 | 按项目/主题分组 | L1 累积后自动 |
| L3 | 人格画像 | AI 眼中的你 | 50 条 L1 后自动 |

## Dashboard

访问 `http://localhost:3002/memory`：

- 记忆概览（飞轮进度、待审核、建议）
- L0 原子对话（含审核按钮）
- L1 原子记忆（搜索、过滤、编辑、删除）
- L2 记忆场景
- L3 记忆画像

## CodeBuddy Skills

安装到全局即可自动生效：

```bash
cp -r .codebuddy/skills/* ~/.codebuddy/skills/
```

| Skill | 功能 |
|-------|------|
| `auto-suggest-memory` | 每轮对话自动评估是否有值得记忆的内容 |
| `capture-decision` | 用户做决策时自动捕获 |
| `daily-review` | 日终复盘，整理当天记忆 |

## 配置

参考 `.env.example`。主要配置项通过环境变量或 CLI 参数传入。

## 贡献

欢迎 PR 和 Issue！请参阅 [CONTRIBUTING.md](CONTRIBUTING.md)。

## License

[MIT](LICENSE)
