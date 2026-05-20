export interface CaptureRequest {
  user_content: string;
  assistant_content: string;
  session_key: string;
}
export interface CaptureResponse {
  l0_recorded: number;
  scheduler_notified: boolean;
}
export interface SessionEndRequest {
  session_key: string;
}
export interface SessionEndResponse {
  flushed: boolean;
}

export class GatewayUnavailableError extends Error {
  constructor(public readonly cause: unknown) {
    super("Hermes Gateway unreachable. Run `cd dream-dashboard && ./start.sh` first.");
    this.name = "GatewayUnavailableError";
  }
}

export class Gateway {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    const url = baseUrl ?? process.env.DREAM_GATEWAY_URL ?? "http://localhost:8420";
    this.baseUrl = url.replace(/\/$/, "");
  }

  capture(body: CaptureRequest): Promise<CaptureResponse> {
    return this.post<CaptureResponse>("/capture", body);
  }

  sessionEnd(body: SessionEndRequest): Promise<SessionEndResponse> {
    return this.post<SessionEndResponse>("/session/end", body);
  }

  private async post<T>(endpoint: string, body: unknown): Promise<T> {
    let resp: Response;
    try {
      resp = await fetch(`${this.baseUrl}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (err) {
      const cause = (err as { cause?: { code?: string } })?.cause;
      if (cause?.code === "ECONNREFUSED" || cause?.code === "ENOTFOUND") {
        throw new GatewayUnavailableError(err);
      }
      throw err;
    }
    if (!resp.ok) {
      let detail = `HTTP ${resp.status}`;
      try {
        const j = (await resp.json()) as { error?: string };
        if (j?.error) detail = `${resp.status} ${j.error}`;
      } catch {
        /* not json */
      }
      throw new Error(`Gateway ${endpoint}: ${detail}`);
    }
    return (await resp.json()) as T;
  }
}
