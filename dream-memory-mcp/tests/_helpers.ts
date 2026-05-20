import { vi } from "vitest";
import type { GatewayClient } from "../src/gateway-client.js";
import type { SessionManager } from "../src/session.js";
import type { ToolContext } from "../src/types.js";

export function makeMockContext(overrides: Partial<{
  client: Partial<GatewayClient>;
  session: Partial<SessionManager>;
}> = {}): ToolContext {
  const client = {
    health: vi.fn(),
    recall: vi.fn(),
    capture: vi.fn(),
    searchMemories: vi.fn(),
    searchConversations: vi.fn(),
    sessionEnd: vi.fn(),
    seed: vi.fn(),
    ...overrides.client,
  };
  const session = {
    resolve: vi.fn((explicit?: string | null) => explicit ?? "auto-session-1"),
    current: vi.fn(() => "auto-session-1"),
    ...overrides.session,
  };
  return { client, session } as unknown as ToolContext;
}
