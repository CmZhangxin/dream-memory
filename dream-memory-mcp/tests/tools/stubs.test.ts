import { describe, it, expect } from "vitest";
import { getPersonaTool, getTodayTool, getScenariosTool, captureTaskTool } from "../../src/tools/stubs.js";
import { makeMockContext } from "../_helpers.js";

describe("stub tools", () => {
  const ctx = makeMockContext();

  for (const tool of [getPersonaTool, getTodayTool, getScenariosTool, captureTaskTool]) {
    it(`${tool.name} returns isError with NotImplemented message`, async () => {
      const r = await tool.handler({} as never, ctx);
      expect(r.isError).toBe(true);
      expect(r.content[0].text).toMatch(/未实现|阶段/);
    });

    it(`${tool.name} description marks itself as Stub`, () => {
      expect(tool.description).toMatch(/Stub|未实现/i);
    });
  }
});
