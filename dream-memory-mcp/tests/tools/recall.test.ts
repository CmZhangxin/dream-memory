import { describe, it, expect } from "vitest";
import { recallSchema, recall } from "../../src/tools/recall.js";
import { makeMockContext } from "../_helpers.js";

describe("dream_recall", () => {
  it("schema requires non-empty query", () => {
    expect(() => recallSchema.parse({ query: "" })).toThrow();
  });

  it("returns context text from gateway", async () => {
    const ctx = makeMockContext({
      client: {
        recall: async (req) => {
          expect(req.query).toBe("q1");
          expect(req.session_key).toBe("auto-session-1");
          return { context: "memory snippet", strategy: "bm25", memory_count: 3 };
        },
      },
    });
    const r = await recall({ query: "q1" }, ctx);
    expect(r.content[0].text).toContain("memory snippet");
    expect(r.content[0].text).toContain("3");
  });

  it("handles empty context gracefully", async () => {
    const ctx = makeMockContext({
      client: { recall: async () => ({ context: "", memory_count: 0 }) },
    });
    const r = await recall({ query: "q" }, ctx);
    expect(r.content[0].text).toMatch(/无相关记忆/);
  });
});
