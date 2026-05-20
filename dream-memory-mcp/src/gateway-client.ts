import {
  type HealthResponse,
  type RecallRequest,
  type RecallResponse,
  type CaptureRequest,
  type CaptureResponse,
  type MemorySearchRequest,
  type MemorySearchResponse,
  type ConversationSearchRequest,
  type ConversationSearchResponse,
  type SessionEndRequest,
  type SessionEndResponse,
  type SeedRequest,
  type SeedResponse,
  GatewayError,
  GatewayUnavailableError,
} from "./types.js";

export interface GatewayClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
  seedTimeoutMs?: number;
}

export class GatewayClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly seedTimeoutMs: number;

  constructor(opts: GatewayClientOptions | string = {}) {
    const o: GatewayClientOptions = typeof opts === "string" ? { baseUrl: opts } : opts;
    this.baseUrl = (o.baseUrl ?? process.env.DREAM_GATEWAY_URL ?? "http://localhost:8420").replace(/\/$/, "");
    this.timeoutMs = o.timeoutMs ?? 10_000;
    this.seedTimeoutMs = o.seedTimeoutMs ?? 5 * 60_000;
  }

  health(): Promise<HealthResponse> { return this.request<HealthResponse>("GET", "/health"); }
  recall(body: RecallRequest): Promise<RecallResponse> { return this.request("POST", "/recall", body); }
  capture(body: CaptureRequest): Promise<CaptureResponse> { return this.request("POST", "/capture", body); }
  searchMemories(body: MemorySearchRequest): Promise<MemorySearchResponse> { return this.request("POST", "/search/memories", body); }
  searchConversations(body: ConversationSearchRequest): Promise<ConversationSearchResponse> { return this.request("POST", "/search/conversations", body); }
  sessionEnd(body: SessionEndRequest): Promise<SessionEndResponse> { return this.request("POST", "/session/end", body); }
  seed(body: SeedRequest): Promise<SeedResponse> { return this.request("POST", "/seed", body, this.seedTimeoutMs); }

  private async request<T>(
    method: "GET" | "POST",
    endpoint: string,
    body?: unknown,
    timeoutMs: number = this.timeoutMs,
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error("Gateway request timeout")), timeoutMs);

    let resp: Response;
    try {
      resp = await fetch(url, {
        method,
        headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (err) {
      const cause = (err as { cause?: { code?: string } })?.cause;
      if (cause?.code === "ECONNREFUSED" || cause?.code === "ENOTFOUND") {
        throw new GatewayUnavailableError(err);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }

    if (!resp.ok) {
      let upstreamMessage = `HTTP ${resp.status}`;
      try {
        const json = (await resp.json()) as { error?: string };
        if (json?.error) upstreamMessage = json.error;
      } catch { /* not JSON */ }
      throw new GatewayError(resp.status, upstreamMessage, endpoint);
    }
    return (await resp.json()) as T;
  }
}
