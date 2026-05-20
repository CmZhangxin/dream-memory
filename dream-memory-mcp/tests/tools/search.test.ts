import { describe, it, expect } from "vitest";
import { searchMemoriesSchema, searchMemories } from "../../src/tools/search-memories.js";
import { searchConversationsSchema, searchConversations } from "../../src/tools/search-conversations.js";
import { makeMockContext } from "../_helpers.js";

describe("dream_search_memories", () => {
  it("requires non-empty query", () => {
    expect(() => searchMemoriesSchema.parse({ query: "" })).toThrow();
  });

  it("passes optional limit/type/scene to gateway", async () => {
    const ctx = makeMockContext({
      client: {
        searchMemories: async (req) => {
          expect(req).toEqual({ query: "x", limit: 5, type: "atom", scene: "work" });
          return { results: "...", total: 2, strategy: "bm25" };
        },
      },
    });
    const r = await searchMemories({ query: "x", limit: 5, type: "atom", scene: "work" }, ctx);
    expect(r.content[0].text).toContain("2");
  });
});

describe("dream_search_conversations", () => {
  it("filters by session_key when provided", async () => {
    const ctx = makeMockContext({
      client: {
        searchConversations: async (req) => {
          expect(req.session_key).toBe("sk-1");
          return { results: "...", total: 1 };
        },
      },
    });
    await searchConversations({ query: "q", session_key: "sk-1" }, ctx);
  });

  it("schema requires non-empty query", () => {
    expect(() => searchConversationsSchema.parse({ query: "" })).toThrow();
  });
});
