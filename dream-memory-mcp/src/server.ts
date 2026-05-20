import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GatewayClient } from "./gateway-client.js";
import { SessionManager } from "./session.js";
import { ALL_TOOLS } from "./tools/index.js";
import type { ToolContext } from "./types.js";
import { GatewayError, GatewayUnavailableError } from "./types.js";

export interface CreateServerOptions {
  gatewayUrl?: string;
  clientHint?: string;
}

export function createServer(opts: CreateServerOptions = {}): McpServer {
  const client = new GatewayClient({ baseUrl: opts.gatewayUrl });
  const session = new SessionManager({ clientHint: opts.clientHint });
  const ctx: ToolContext = { client, session };

  const server = new McpServer(
    { name: "dream-memory-mcp", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  for (const tool of ALL_TOOLS) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        // Pass the whole zod object schema (matches AnySchema overload).
        // SDK validates inputs against it; we still re-parse inside the handler
        // for full type narrowing / runtime safety.
        inputSchema: tool.inputSchema,
      },
      async (args: unknown) => {
        try {
          const parsed = tool.inputSchema.parse(args);
          return await tool.handler(parsed as never, ctx);
        } catch (err) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: formatError(err) }],
          };
        }
      },
    );
  }

  return server;
}

function formatError(err: unknown): string {
  if (err instanceof GatewayUnavailableError) return `❌ ${err.message}`;
  if (err instanceof GatewayError) {
    return `❌ Gateway ${err.endpoint} 返回 ${err.status}：${err.upstreamMessage}`;
  }
  if (err instanceof Error) return `❌ ${err.name}: ${err.message}`;
  return `❌ 未知错误: ${String(err)}`;
}
