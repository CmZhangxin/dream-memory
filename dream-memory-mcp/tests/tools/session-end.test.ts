import { describe, it, expect } from "vitest";
import { sessionEndSchema, sessionEnd } from "../../src/tools/session-end.js";
import { makeMockContext } from "../_helpers.js";

describe("dream_session_end", () => {
  it("uses auto session_key when not provided", async () => {
    const ctx = makeMockContext({
      client: {
        sessionEnd: async (req) => {
          expect(req.session_key).toBe("auto-session-1");
          return { flushed: true };
        },
      },
    });
    const r = await sessionEnd({}, ctx);
    expect(r.content[0].text).toMatch(/已结束|已升华/);
  });

  it("schema accepts empty input", () => {
    expect(() => sessionEndSchema.parse({})).not.toThrow();
  });
});
