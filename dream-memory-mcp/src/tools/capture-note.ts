import { z } from "zod";
import type { ToolContext } from "../types.js";

export const captureNoteSchema = z.object({
  content: z.string().min(1).describe("笔记正文"),
  tags: z.array(z.string()).optional().describe("标签，自动补 # 前缀"),
  session_key: z.string().optional(),
});

export type CaptureNoteInput = z.infer<typeof captureNoteSchema>;

export async function captureNote(input: CaptureNoteInput, ctx: ToolContext) {
  const session_key = ctx.session.resolve(input.session_key);
  const tags = input.tags && input.tags.length > 0
    ? "\n" + input.tags.map((t) => (t.startsWith("#") ? t : `#${t}`)).join(" ")
    : "";
  const userText = `[NOTE] ${input.content}${tags}`;
  const r = await ctx.client.capture({
    user_content: userText,
    assistant_content: "已记录",
    session_key,
  });
  return {
    content: [{
      type: "text" as const,
      text: `✅ 笔记已记录（${r.l0_recorded} 条 L0，session=${session_key}）`,
    }],
  };
}

export const captureNoteTool = {
  name: "dream_capture_note",
  description: "记录任意笔记/想法到 L0（自动加 [NOTE] 前缀，便于后续检索）。",
  inputSchema: captureNoteSchema,
  handler: captureNote,
} as const;
