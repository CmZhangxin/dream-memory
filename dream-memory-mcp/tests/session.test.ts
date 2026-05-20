import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SessionManager } from "../src/session.js";

describe("SessionManager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-19T10:00:00Z"));
    delete process.env.MCP_CLIENT_NAME;
  });
  afterEach(() => { vi.useRealTimers(); });

  it("returns explicit session_key as-is when provided", () => {
    const sm = new SessionManager({ clientHint: "codebuddy" });
    expect(sm.resolve("user-given-key")).toBe("user-given-key");
  });

  it("auto-generates dream-mcp-{client}-{date} when no key passed", () => {
    const sm = new SessionManager({ clientHint: "codebuddy" });
    expect(sm.resolve()).toBe("dream-mcp-codebuddy-20260519");
  });

  it("uses MCP_CLIENT_NAME env var when no clientHint provided", () => {
    process.env.MCP_CLIENT_NAME = "claude-desktop";
    const sm = new SessionManager();
    expect(sm.resolve()).toBe("dream-mcp-claude-desktop-20260519");
  });

  it("falls back to 'unknown' when no client info available", () => {
    const sm = new SessionManager();
    expect(sm.resolve()).toBe("dream-mcp-unknown-20260519");
  });

  it("current() returns same value as resolve()", () => {
    const sm = new SessionManager({ clientHint: "test" });
    expect(sm.current()).toBe(sm.resolve());
  });

  it("date rolls over correctly", () => {
    const sm = new SessionManager({ clientHint: "x" });
    vi.setSystemTime(new Date("2026-05-19T23:59:59Z"));
    const before = sm.resolve();
    vi.setSystemTime(new Date("2026-05-20T00:00:01Z"));
    const after = sm.resolve();
    expect(before).not.toBe(after);
    expect(after).toBe("dream-mcp-x-20260520");
  });
});
