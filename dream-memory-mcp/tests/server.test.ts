import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createServer } from "../src/server.js";

describe("createServer", () => {
  it("registers all 12 dream_* tools", () => {
    const calls: string[] = [];
    const orig = McpServer.prototype.registerTool;
    McpServer.prototype.registerTool = function (name: string, ...rest: unknown[]) {
      calls.push(name);
      return orig.apply(this, [name, ...rest] as never);
    };
    try {
      createServer();
      expect(calls).toHaveLength(12);
      expect(calls).toContain("dream_capture_conversation");
      expect(calls).toContain("dream_capture_note");
      expect(calls).toContain("dream_capture_decision");
      expect(calls).toContain("dream_capture_skill");
      expect(calls).toContain("dream_recall");
      expect(calls).toContain("dream_search_memories");
      expect(calls).toContain("dream_search_conversations");
      expect(calls).toContain("dream_session_end");
      expect(calls).toContain("dream_get_persona");
      expect(calls).toContain("dream_get_today");
      expect(calls).toContain("dream_get_scenarios");
      expect(calls).toContain("dream_capture_task");
    } finally {
      McpServer.prototype.registerTool = orig;
    }
  });
});
