import http from "node:http";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export interface HttpTransportOptions {
  port: number;
  host?: string;
}

/**
 * Start an HTTP server with MCP Streamable HTTP transport.
 * Endpoint: POST/GET/DELETE /mcp (JSON-RPC over Streamable HTTP, SDK-managed).
 */
export async function startHttp(
  server: McpServer,
  opts: HttpTransportOptions,
): Promise<http.Server> {
  const transports = new Map<string, StreamableHTTPServerTransport>();

  const httpServer = http.createServer(async (req, res) => {
    if (req.url !== "/mcp") {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found. Use POST /mcp" }));
      return;
    }

    const sessionIdHeader = req.headers["mcp-session-id"];
    const sessionId = Array.isArray(sessionIdHeader) ? sessionIdHeader[0] : sessionIdHeader;

    let transport = sessionId ? transports.get(sessionId) : undefined;

    if (!transport && req.method === "POST") {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id: string) => {
          if (transport) transports.set(id, transport);
        },
      });
      transport.onclose = () => {
        if (transport && transport.sessionId) transports.delete(transport.sessionId);
      };
      await server.connect(transport);
    }

    if (!transport) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid or missing session" }));
      return;
    }

    await transport.handleRequest(req, res);
  });

  await new Promise<void>((resolve) => {
    httpServer.listen(opts.port, opts.host ?? "127.0.0.1", () => resolve());
  });
  return httpServer;
}
