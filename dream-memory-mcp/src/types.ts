/**
 * Local snapshot of upstream Hermes Gateway HTTP contract.
 * Source: ~/.dream-memory/tdai-memory-openclaw-plugin/src/gateway/types.ts (as of 2026-05-19)
 *
 * Do NOT import from upstream directly — when upstream changes, we want a
 * compile error here that forces a conscious diff/update.
 */

// ─── /health ──────────────────────────────────────────────
export interface HealthResponse {
  status: "ok" | "degraded";
  version: string;
  uptime: number;
  stores: { vectorStore: boolean; embeddingService: boolean };
}

// ─── /recall ──────────────────────────────────────────────
export interface RecallRequest {
  query: string;
  session_key: string;
  user_id?: string;
}
export interface RecallResponse {
  context: string;
  strategy?: string;
  memory_count?: number;
}

// ─── /capture ─────────────────────────────────────────────
export interface CaptureRequest {
  user_content: string;
  assistant_content: string;
  session_key: string;
  session_id?: string;
  user_id?: string;
  messages?: unknown[];
}
export interface CaptureResponse {
  l0_recorded: number;
  scheduler_notified: boolean;
}

// ─── /search/memories ─────────────────────────────────────
export interface MemorySearchRequest {
  query: string;
  limit?: number;
  type?: string;
  scene?: string;
}
export interface MemorySearchResponse {
  results: string;
  total: number;
  strategy: string;
}

// ─── /search/conversations ────────────────────────────────
export interface ConversationSearchRequest {
  query: string;
  limit?: number;
  session_key?: string;
}
export interface ConversationSearchResponse {
  results: string;
  total: number;
}

// ─── /session/end ─────────────────────────────────────────
export interface SessionEndRequest {
  session_key: string;
  user_id?: string;
}
export interface SessionEndResponse {
  flushed: boolean;
}

// ─── /seed (kept for completeness, not exposed by MCP tools) ─
export interface SeedRequest {
  data: unknown;
  session_key?: string;
  strict_round_role?: boolean;
  auto_fill_timestamps?: boolean;
  config_override?: Record<string, unknown>;
}
export interface SeedResponse {
  sessions_processed: number;
  rounds_processed: number;
  messages_processed: number;
  l0_recorded: number;
  duration_ms: number;
  output_dir: string;
}

// ─── Gateway error envelope ───────────────────────────────
export interface GatewayErrorResponse {
  error: string;
  code?: string;
}

// ─── MCP layer ────────────────────────────────────────────

export class GatewayError extends Error {
  constructor(
    public status: number,
    public upstreamMessage: string,
    public endpoint: string,
  ) {
    super(`Gateway ${endpoint} returned ${status}: ${upstreamMessage}`);
    this.name = "GatewayError";
  }
}

export class GatewayUnavailableError extends Error {
  constructor(public readonly cause: unknown) {
    super(
      "Memory Gateway unreachable at http://localhost:8420. " +
        "Is `cd dream-dashboard && ./start.sh` running?",
    );
    this.name = "GatewayUnavailableError";
  }
}

export interface ToolContext {
  client: import("./gateway-client.js").GatewayClient;
  session: import("./session.js").SessionManager;
}
