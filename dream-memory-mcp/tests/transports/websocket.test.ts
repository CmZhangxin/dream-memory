import { describe, it, expect } from "vitest";
import { WebSocket as WSClient } from "ws";
import { createServer } from "../../src/server.js";
import { startWebSocket } from "../../src/transports/websocket.js";

describe("WebSocket transport", () => {
  it("starts listening on the configured port", async () => {
    const server = createServer();
    const httpServer = await startWebSocket(server, { port: 18422 });
    expect(httpServer.listening).toBe(true);
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  it("accepts a JSON-RPC initialize handshake from a WS client", async () => {
    const server = createServer();
    const httpServer = await startWebSocket(server, { port: 18423 });

    try {
      const ws = new WSClient("ws://127.0.0.1:18423/");
      await new Promise<void>((resolve, reject) => {
        ws.once("open", () => resolve());
        ws.once("error", reject);
      });

      const initMsg = {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "test-client", version: "0.0.1" },
        },
      };
      ws.send(JSON.stringify(initMsg));

      const reply = await new Promise<string>((resolve, reject) => {
        ws.once("message", (data) => resolve(data.toString("utf-8")));
        ws.once("error", reject);
        setTimeout(() => reject(new Error("timeout")), 3000);
      });

      const parsed = JSON.parse(reply) as {
        id: number;
        result?: { serverInfo?: { name?: string } };
        error?: unknown;
      };
      expect(parsed.id).toBe(1);
      expect(parsed.result).toBeDefined();
      expect(parsed.result?.serverInfo?.name).toBe("dream-memory-mcp");
      expect(parsed.error).toBeUndefined();

      ws.close();
    } finally {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
  });
});
