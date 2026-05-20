import { describe, it, expect } from "vitest";
import { captureConversationSchema, captureConversation } from "../../src/tools/capture-conversation.js";
import { makeMockContext } from "../_helpers.js";

describe("dream_capture_conversation", () => {
  it("schema rejects when user_content empty", () => {
    expect(() => captureConversationSchema.parse({ user_content: "", assistant_content: "a" })).toThrow();
  });

  it("calls client.capture with resolved session_key", async () => {
    const ctx = makeMockContext({
      client: {
        capture: async (req) => {
          expect(req.user_content).toBe("u1");
          expect(req.assistant_content).toBe("a1");
          expect(req.session_key).toBe("auto-session-1");
          return { l0_recorded: 1, scheduler_notified: true };
        },
      },
    });
    const result = await captureConversation({ user_content: "u1", assistant_content: "a1" }, ctx);
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toMatch(/已写入.*1/);
    expect(result.isError).toBeFalsy();
  });

  it("respects explicit session_key", async () => {
    const ctx = makeMockContext({
      client: {
        capture: async (req) => {
          expect(req.session_key).toBe("explicit-key");
          return { l0_recorded: 2, scheduler_notified: true };
        },
      },
    });
    await captureConversation(
      { user_content: "u", assistant_content: "a", session_key: "explicit-key" },
      ctx,
    );
  });
});
