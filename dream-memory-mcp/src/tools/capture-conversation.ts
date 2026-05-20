import { z } from "zod";
import type { ToolContext } from "../types.js";

export const captureConversationSchema = z.object({
  user_content: z.string().min(1).describe("用户的发言内容"),
  assistant_content: z.string().min(1).describe("助手的回复内容"),
  session_key: z.string().optional().describe("会话标识，未传则按日自动生成"),
  session_id: z.string().optional(),
});

export type CaptureConversationInput = z.infer<typeof captureConversationSchema>;

export async function captureConversation(input: CaptureConversationInput, ctx: ToolContext) {
  const session_key = ctx.session.resolve(input.session_key);
  const r = await ctx.client.capture({
    user_content: input.user_content,
    assistant_content: input.assistant_content,
    session_key,
    session_id: input.session_id,
  });
  return {
    content: [{
      type: "text" as const,
      text: `✅ 对话已写入 L0：${r.l0_recorded} 条记录（session=${session_key}）`,
    }],
  };
}

export const captureConversationTool = {
  name: "dream_capture_conversation",
  description: "把一轮 user/assistant 对话写入 L0 原始素材层。",
  inputSchema: captureConversationSchema,
  handler: captureConversation,
} as const;
