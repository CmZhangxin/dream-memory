import { z } from "zod";
import type { ToolContext } from "../types.js";

export const searchConversationsSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().positive().optional(),
  session_key: z.string().optional(),
});

export type SearchConversationsInput = z.infer<typeof searchConversationsSchema>;

export async function searchConversations(input: SearchConversationsInput, ctx: ToolContext) {
  const r = await ctx.client.searchConversations(input);
  return {
    content: [{
      type: "text" as const,
      text: `🔍 命中 ${r.total} 条 L0 原始对话：\n\n${r.results}`,
    }],
  };
}

export const searchConversationsTool = {
  name: "dream_search_conversations",
  description: "在 L0 原始对话层中检索。",
  inputSchema: searchConversationsSchema,
  handler: searchConversations,
} as const;
