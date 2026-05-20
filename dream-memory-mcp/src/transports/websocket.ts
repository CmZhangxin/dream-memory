import http from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

export interface WebSocketTransportOptions {
  port: number;
  host?: string;
}

/**
 * Custom MCP transport over WebSocket.
 *
 * One transport instance per WS connection. McpServer is connected per-connection
 * so each client gets isolated state (consistent with HTTP Streamable's per-session model).
 */
class WebSocketServerTransport implements Transport {
  // Transport interface contract: start/close/send + onclose/onerror/onmessage callbacks
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  constructor(private readonly ws: WebSocket) {}

  async start(): Promise<void> {
    this.ws.on("message", (data) => {
      try {
        const text = data.toString("utf-8");
        const msg = JSON.parse(text) as JSONRPCMessage;
        this.onmessage?.(msg);
      } catch (err) {
        this.onerror?.(err instanceof Error ? err : new Error(String(err)));
      }
    });
    this.ws.on("close", () => this.onclose?.());
    this.ws.on("error", (err) => this.onerror?.(err));
  }

  async send(message: JSONRPCMessage): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws.send(JSON.stringify(message), (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async close(): Promise<void> {
    return new Promise((resolve) => {
      if (this.ws.readyState === this.ws.CLOSED) {
        resolve();
      } else {
        this.ws.once("close", () => resolve());
        this.ws.close();
      }
    });
  }
}

/**
 * Start an HTTP server upgrading to WebSocket, with one McpServer connection per WS.
 */
export async function startWebSocket(
  server: McpServer,
  opts: WebSocketTransportOptions,
): Promise<http.Server> {
  const httpServer = http.createServer((_req, res) => {
    res.writeHead(426, { "Content-Type": "text/plain", Upgrade: "websocket" });
    res.end("Upgrade Required: this endpoint expects a WebSocket connection");
  });

  const wss = new WebSocketServer({ server: httpServer });

  wss.on("connection", async (ws) => {
    const transport = new WebSocketServerTransport(ws);
    try {
      await server.connect(transport);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ws.close(1011, `MCP connect failed: ${msg}`);
    }
  });

  await new Promise<void>((resolve) => {
    httpServer.listen(opts.port, opts.host ?? "127.0.0.1", () => resolve());
  });
  return httpServer;
}
