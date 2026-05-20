#!/usr/bin/env node
import { parseArgs } from "node:util";
import { createServer } from "./server.js";
import { startStdio } from "./transports/stdio.js";
import { startHttp } from "./transports/http.js";
import { startWebSocket } from "./transports/websocket.js";

interface CliOptions {
  transport: "stdio" | "http" | "ws" | "all";
  httpPort: number;
  wsPort: number;
  gatewayUrl?: string;
  clientHint?: string;
}

const USAGE = `\
dream-memory-mcp — MCP server backed by Hermes Memory Gateway

Usage:
  dream-memory-mcp [options]

Options:
  --transport <stdio|http|ws|all>  Transport type (default: stdio)
  --http-port <port>               HTTP port (default: 8421)
  --ws-port <port>                 WebSocket port (default: 8422)
  --gateway-url <url>              Hermes Gateway URL (default: http://localhost:8420)
  --client-hint <name>             Client hint for session_key (e.g. "codebuddy")
  --help, -h                       Show this help
`;

function parseCliArgs(): CliOptions {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      transport: { type: "string", default: "stdio" },
      "http-port": { type: "string", default: "8421" },
      "ws-port": { type: "string", default: "8422" },
      "gateway-url": { type: "string" },
      "client-hint": { type: "string" },
      help: { type: "boolean", short: "h" },
    },
    strict: true,
  });

  if (values.help) {
    process.stderr.write(USAGE);
    process.exit(0);
  }

  const transport = values.transport as CliOptions["transport"];
  if (!["stdio", "http", "ws", "all"].includes(transport)) {
    process.stderr.write(`Invalid --transport: ${transport}\n${USAGE}`);
    process.exit(1);
  }

  return {
    transport,
    httpPort: Number(values["http-port"] ?? 8421),
    wsPort: Number(values["ws-port"] ?? 8422),
    gatewayUrl: values["gateway-url"] as string | undefined,
    clientHint: values["client-hint"] as string | undefined,
  };
}

function logToStderr(...args: unknown[]) {
  process.stderr.write(args.map(String).join(" ") + "\n");
}

async function main(): Promise<void> {
  const opts = parseCliArgs();
  const server = createServer({ gatewayUrl: opts.gatewayUrl, clientHint: opts.clientHint });

  const tasks: Promise<unknown>[] = [];
  const wantStdio = opts.transport === "stdio" || opts.transport === "all";
  const wantHttp = opts.transport === "http" || opts.transport === "all";
  const wantWs = opts.transport === "ws" || opts.transport === "all";

  if (wantHttp) {
    tasks.push(
      startHttp(server, { port: opts.httpPort }).then(() =>
        logToStderr(`[dream-memory-mcp] HTTP transport on http://127.0.0.1:${opts.httpPort}/mcp`),
      ),
    );
  }
  if (wantWs) {
    tasks.push(
      startWebSocket(server, { port: opts.wsPort }).then(() =>
        logToStderr(`[dream-memory-mcp] WebSocket transport on ws://127.0.0.1:${opts.wsPort}/`),
      ),
    );
  }

  await Promise.all(tasks);

  // stdio must be last and only if requested — it takes over stdout
  if (wantStdio) {
    if (wantHttp || wantWs) {
      logToStderr(`[dream-memory-mcp] stdio transport starting (logs go to stderr)`);
    }
    await startStdio(server);
  } else {
    // Keep process alive for HTTP/WS-only modes
    await new Promise(() => {});
  }
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`[dream-memory-mcp] fatal: ${msg}\n`);
  process.exit(1);
});
