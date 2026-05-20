import { describe, it, expect } from "vitest";
import { captureNoteSchema, captureNote } from "../../src/tools/capture-note.js";
import { captureDecision } from "../../src/tools/capture-decision.js";
import { captureSkill } from "../../src/tools/capture-skill.js";
import { makeMockContext } from "../_helpers.js";

describe("dream_capture_note", () => {
  it("requires non-empty content", () => {
    expect(() => captureNoteSchema.parse({ content: "" })).toThrow();
  });

  it("prefixes content with [NOTE] and appends tags", async () => {
    const ctx = makeMockContext({
      client: {
        capture: async (req) => {
          expect(req.user_content).toBe("[NOTE] hello\n#skill #work");
          expect(req.assistant_content).toBe("已记录");
          return { l0_recorded: 1, scheduler_notified: true };
        },
      },
    });
    await captureNote({ content: "hello", tags: ["skill", "#work"] }, ctx);
  });

  it("normalizes tags (adds # if missing)", async () => {
    const ctx = makeMockContext({
      client: {
        capture: async (req) => {
          expect(req.user_content).toContain("#a #b");
          return { l0_recorded: 1, scheduler_notified: true };
        },
      },
    });
    await captureNote({ content: "x", tags: ["a", "b"] }, ctx);
  });
});

describe("dream_capture_decision", () => {
  it("composes structured text with what/why/alternatives", async () => {
    const ctx = makeMockContext({
      client: {
        capture: async (req) => {
          expect(req.user_content).toContain("[DECISION]");
          expect(req.user_content).toContain("决定: 用 React");
          expect(req.user_content).toContain("理由: 团队熟悉");
          expect(req.user_content).toContain("备选: Vue");
          expect(req.user_content).toContain("备选: Svelte");
          return { l0_recorded: 1, scheduler_notified: true };
        },
      },
    });
    await captureDecision(
      { what: "用 React", why: "团队熟悉", alternatives: ["Vue", "Svelte"] },
      ctx,
    );
  });

  it("works without alternatives", async () => {
    const ctx = makeMockContext({
      client: {
        capture: async (req) => {
          expect(req.user_content).not.toContain("备选");
          return { l0_recorded: 1, scheduler_notified: true };
        },
      },
    });
    await captureDecision({ what: "x", why: "y" }, ctx);
  });
});

describe("dream_capture_skill", () => {
  it("composes name/when/how/examples and adds #skill tag", async () => {
    const ctx = makeMockContext({
      client: {
        capture: async (req) => {
          expect(req.user_content).toContain("[SKILL]");
          expect(req.user_content).toContain("名称: Pipeline 模式");
          expect(req.user_content).toContain("场景: 多步编排");
          expect(req.user_content).toContain("做法: 链式调用");
          expect(req.user_content).toContain("例子: redis 中间件");
          expect(req.user_content).toContain("#skill");
          return { l0_recorded: 1, scheduler_notified: true };
        },
      },
    });
    await captureSkill(
      { name: "Pipeline 模式", when: "多步编排", how: "链式调用", examples: ["redis 中间件"] },
      ctx,
    );
  });
});
