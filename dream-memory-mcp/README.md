# dream-memory-mcp

> MCP server exposing 12 `dream_*` tools (8 real + 4 stub) backed by Hermes Memory Gateway at `http://localhost:8420`.

阶段 2 实现，详见根目录 `docs/2026-05-19-梦境系统-阶段2-设计.md` 与上下篇实施计划。

## 快速使用

```bash
# 1. 确保阶段 1 已就绪
cd ../dream-dashboard && ./start.sh
curl http://localhost:8420/health   # 应返回 200

# 2. 构建并测试
cd ../dream-memory-mcp
npm install --registry=https://registry.npmjs.org/
npm test
npm run build
```

## 启动方式

```bash
# stdio（被 MCP 客户端 spawn）
node dist/index.js

# HTTP/SSE（监听 :8421）
node dist/index.js --transport http --http-port 8421

# WebSocket（监听 :8422）
node dist/index.js --transport ws --ws-port 8422

# 三种全开
node dist/index.js --transport all
```

## 在 CodeBuddy / Claude Desktop 中注册

把 `examples/codebuddy-mcp.json` 或 `examples/claude-desktop-config.json` 的内容合并到对应客户端的 MCP 配置文件，重启客户端。

## 工具列表

| Tool | 状态 | 用途 |
|---|---|---|
| `dream_capture_conversation` | ✅ | 写入 user/assistant 一来一回 |
| `dream_capture_note` | ✅ | 任意笔记（[NOTE] 前缀） |
| `dream_capture_decision` | ✅ | 重要决策（[DECISION] 前缀） |
| `dream_capture_skill` | ✅ | 可复用技能（#skill 标签） |
| `dream_recall` | ✅ | 基于查询召回相关 L1 记忆 |
| `dream_search_memories` | ✅ | 搜 L1 atoms |
| `dream_search_conversations` | ✅ | 搜 L0 原始对话 |
| `dream_session_end` | ✅ | 结束会话 + 触发升华 |
| `dream_get_persona` | 🚧 Stub | 待阶段 4 |
| `dream_get_today` | 🚧 Stub | 待阶段 3+ |
| `dream_get_scenarios` | 🚧 Stub | 待阶段 4 |
| `dream_capture_task` | 🚧 Stub | 待 todo 域语义明确 |

## 配置项

| 来源（优先级 高→低） | 配置项 | 默认 |
|---|---|---|
| `--gateway-url` / `DREAM_GATEWAY_URL` | Hermes Gateway URL | `http://localhost:8420` |
| `--transport` | stdio \| http \| ws \| all | `stdio` |
| `--http-port` / `DREAM_HTTP_PORT` | HTTP 端口 | `8421` |
| `--ws-port` / `DREAM_WS_PORT` | WebSocket 端口 | `8422` |
| `--client-hint` / `MCP_CLIENT_NAME` | 用于 session_key 自动生成 | `unknown` |

## 故障排除

**"Memory Gateway unreachable at http://localhost:8420"**
→ 阶段 1 服务未启动。`cd ../dream-dashboard && ./start.sh`

**stdio 模式返回乱码 / JSON-RPC 错误**
→ 检查没有把日志写到 stdout。所有日志必须走 stderr。

**WebSocket 连接被拒**
→ 默认绑定 `127.0.0.1`，远程访问需在代码里改 host 为 `0.0.0.0`（注意安全：当前无 auth）。

## 测试

```bash
npm test           # 跑全部 40 单元测试
npm run typecheck  # tsc --noEmit
```

集成测试见 [`tests/integration.manual.md`](tests/integration.manual.md)（人工执行）。
