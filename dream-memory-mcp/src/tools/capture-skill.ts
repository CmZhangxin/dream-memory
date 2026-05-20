import { z } from "zod";
import type { ToolContext } from "../types.js";

export const captureSkillSchema = z.object({
  name: z.string().min(1).describe("技能名"),
  when: z.string().min(1).describe("什么场景下用"),
  how: z.string().min(1).describe("具体怎么用"),
  examples: z.array(z.string()).optional().describe("具体例子"),
  session_key: z.string().optional(),
});

export type CaptureSkillInput = z.infer<typeof captureSkillSchema>;

export async function captureSkill(input: CaptureSkillInput, ctx: ToolContext) {
  const session_key = ctx.session.resolve(input.session_key);
  const lines = [
    `[SKILL]`,
    `名称: ${input.name}`,
    `场景: ${input.when}`,
    `做法: ${input.how}`,
  ];
  if (input.examples && input.examples.length > 0) {
    for (const ex of input.examples) lines.push(`例子: ${ex}`);
  }
  lines.push("#skill");
  const r = await ctx.client.capture({
    user_content: lines.join("\n"),
    assistant_content: "已记录",
    session_key,
  });
  return {
    content: [{
      type: "text" as const,
      text: `✅ 技能已记录（${r.l0_recorded} 条 L0，session=${session_key}）`,
    }],
  };
}

export const captureSkillTool = {
  name: "dream_capture_skill",
  description: "沉淀可复用技能（名称/场景/做法/例子），自动加 [SKILL] 前缀和 #skill 标签。",
  inputSchema: captureSkillSchema,
  handler: captureSkill,
} as const;
