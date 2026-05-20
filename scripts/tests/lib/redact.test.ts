import { describe, it, expect } from "vitest";
import { redact } from "../../src/lib/redact.js";

describe("redact", () => {
  it("redacts OpenAI keys", () => {
    const r = redact("token=sk-abc123def456ghi789jkl012mno345");
    expect(r.text).toContain("[REDACTED:KEY]");
    expect(r.text).not.toContain("sk-abc123");
    expect(r.hits["openai-key"]).toBe(1);
  });

  it("redacts emails", () => {
    const r = redact("contact me at jane.doe+test@example.co.uk thanks");
    expect(r.text).toContain("[REDACTED:EMAIL]");
    expect(r.hits.email).toBe(1);
  });

  it("redacts CN phone numbers", () => {
    const r = redact("打 13800138000 给我");
    expect(r.text).toContain("[REDACTED:PHONE]");
    expect(r.hits["phone-cn"]).toBe(1);
  });

  it("redacts password key-value", () => {
    const r = redact("password: abc123\npasswd=xyz");
    expect(r.text).toContain("[REDACTED:PASSWORD]");
    expect(r.hits["password-kv"]).toBe(2);
  });

  it("clean text passes through unchanged with zero hits", () => {
    const r = redact("just a normal note about React hooks");
    expect(r.text).toBe("just a normal note about React hooks");
    expect(Object.values(r.hits).reduce((a, b) => a + b, 0)).toBe(0);
  });
});
