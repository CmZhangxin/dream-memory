# 阶段 2 手工集成测试 checklist

> 完成 Task 1-9 后执行。所有项必须通过才能关闭阶段 2。

## 前置

- [ ] `cd dream-dashboard && ./start.sh` 成功，`curl localhost:8420/health` 返回 200
- [ ] `cd dream-memory-mcp && npm run build` 成功（`dist/index.js` 存在）

## I1：MCP Inspector 列工具

- [ ] `npx @modelcontextprotocol/inspector node $PWD/dream-memory-mcp/dist/index.js`
- [ ] 浏览器 Inspector UI 打开
- [ ] Tools 标签下显示 **12 个** `dream_*` 工具
- [ ] 4 个 stub 工具描述含 "Stub · 未实现"

## I2：写入 → 检索（端到端验收设计文档第 10.1 节）

- [ ] 在 Inspector 调用 `dream_capture_note`：
      - input: `{ "content": "阶段2集成测试 unique-token-${TIMESTAMP}" }`
      - 期望：返回 `✅ 笔记已记录（1 条 L0）`
- [ ] 等 3 秒（让 L0 写入落库）
- [ ] 调用 `dream_search_conversations`：
      - input: `{ "query": "unique-token-${TIMESTAMP}" }`
      - 期望：`total >= 1`，结果中包含 `[NOTE] 阶段2集成测试 unique-token-...`

## I3：错误降级

- [ ] 在另一个 terminal 跑 `cd dream-dashboard && ./stop.sh`
- [ ] 在 Inspector 再调 `dream_capture_note`
- [ ] 期望返回 `isError: true` + "Memory Gateway unreachable at http://localhost:8420"
- [ ] `cd dream-dashboard && ./start.sh` 恢复

## I4：HTTP 模式

- [ ] `node dist/index.js --transport http --http-port 8421 &`
- [ ] `lsof -i :8421 | grep LISTEN`：有 `node` 进程
- [ ] curl initialize：

```bash
curl -s -X POST http://localhost:8421/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"manual","version":"1"}}}'
```

- [ ] 期望：返回含 `"serverInfo":{"name":"dream-memory-mcp"}` 的 SSE event
- [ ] `pkill -f "node.*dist/index.js"`

## I5：WebSocket 模式

- [ ] `node dist/index.js --transport ws --ws-port 8422 &`
- [ ] `npm i -g wscat`（一次）
- [ ] `wscat -c ws://localhost:8422/`
- [ ] 输入：

```json
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"wscat","version":"1"}}}
```

- [ ] 期望：收到带 `result.serverInfo.name = "dream-memory-mcp"` 的响应
- [ ] `pkill -f "node.*dist/index.js"`

## I6：CodeBuddy 注册（最终验收）

- [ ] 把 `examples/codebuddy-mcp.json` 内容合并到 `~/.codebuddy/mcp.json`
- [ ] 重启 CodeBuddy
- [ ] 在新对话里说："请用 dream_capture_note 工具记下：'今天 CodeBuddy 完成了阶段2 MCP 工具集集成'"
- [ ] 期望：CodeBuddy 调用了 `dream_capture_note` 并返回成功消息
- [ ] 在同一对话再问："用 dream_search_conversations 搜 '阶段2 MCP'"
- [ ] 期望：能搜到上一步写入的内容
