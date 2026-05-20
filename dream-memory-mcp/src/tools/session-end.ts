import { z } from "zod";
import type { ToolContext } from "../types.js";

export const sessionEndSchema = z.object({
  session_key: z.string().optional(),
});

export type SessionEndInput = z.infer<typeof sessionEndSchema>;

export async function sessionEnd(input: SessionEndInput, ctx: ToolContext) {
  const session_key = ctx.session.resolve(input.session_key);
  const r = await ctx.client.sessionEnd({ session_key });
  return {
    content: [{
      type: "text" as const,
      text: r.flushed
        ? `✨ 会话已结束并触发升华（session=${session_key}）`
        : `⚠️ 会话结束但未触发升华`,
    }],
  };
}

export const sessionEndTool = {
  name: "dream_session_end",
  description: "结束当前会话并触发 L0→L1→L2 升华。",
  inputSchema: sessionEndSchema,
  handler: sessionEnd,
} as const;
