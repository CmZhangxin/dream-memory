import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Connect server over stdio. The MCP client (CodeBuddy/Claude Desktop) spawns us
 * and communicates via stdin/stdout.
 *
 * IMPORTANT: stdout is reserved for JSON-RPC. All logs MUST go to stderr.
 */
export async function startStdio(server: McpServer): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
