export interface SessionManagerOptions {
  clientHint?: string;
}

export class SessionManager {
  private readonly clientHint: string;

  constructor(opts: SessionManagerOptions = {}) {
    this.clientHint = opts.clientHint ?? process.env.MCP_CLIENT_NAME ?? "unknown";
  }

  resolve(explicit?: string | null): string {
    if (explicit && explicit.trim().length > 0) return explicit;
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(now.getUTCDate()).padStart(2, "0");
    return `dream-mcp-${this.clientHint}-${yyyy}${mm}${dd}`;
  }

  current(): string {
    return this.resolve();
  }
}
