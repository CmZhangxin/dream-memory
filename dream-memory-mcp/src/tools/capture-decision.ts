import { z } from "zod";
import type { ToolContext } from "../types.js";

export const captureDecisionSchema = z.object({
  what: z.string().min(1).describe("决定做什么"),
  why: z.string().min(1).describe("为什么这么决定"),
  alternatives: z.array(z.string()).optional().describe("考虑过的备选方案"),
  session_key: z.string().optional(),
});

export type CaptureDecisionInput = z.infer<typeof captureDecisionSchema>;

export async function captureDecision(input: CaptureDecisionInput, ctx: ToolContext) {
  const session_key = ctx.session.resolve(input.session_key);
  const lines = [`[DECISION]`, `决定: ${input.what}`, `理由: ${input.why}`];
  if (input.alternatives && input.alternatives.length > 0) {
    for (const alt of input.alternatives) lines.push(`备选: ${alt}`);
  }
  lines.push("#decision");
  const r = await ctx.client.capture({
    user_content: lines.join("\n"),
    assistant_content: "已记录",
    session_key,
  });
  return {
    content: [{
      type: "text" as const,
      text: `✅ 决策已记录（${r.l0_recorded} 条 L0，session=${session_key}）`,
    }],
  };
}

export const captureDecisionTool = {
  name: "dream_capture_decision",
  description: "沉淀重要决策（含决定/理由/备选），自动加 [DECISION] 前缀。",
  inputSchema: captureDecisionSchema,
  handler: captureDecision,
} as const;
