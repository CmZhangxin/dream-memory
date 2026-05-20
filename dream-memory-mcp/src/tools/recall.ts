import { z } from "zod";
import type { ToolContext } from "../types.js";

export const recallSchema = z.object({
  query: z.string().min(1).describe("要召回的查询内容"),
  session_key: z.string().optional().describe("会话标识"),
});

export type RecallInput = z.infer<typeof recallSchema>;

export async function recall(input: RecallInput, ctx: ToolContext) {
  const session_key = ctx.session.resolve(input.session_key);
  const r = await ctx.client.recall({ query: input.query, session_key });
  const text = r.context && r.context.length > 0
    ? `📚 召回 ${r.memory_count ?? 0} 条相关记忆（strategy=${r.strategy ?? "default"}）：\n\n${r.context}`
    : "（无相关记忆）";
  return { content: [{ type: "text" as const, text }] };
}

export const recallTool = {
  name: "dream_recall",
  description: "基于查询召回相关 L1 记忆，作为 system context 注入。",
  inputSchema: recallSchema,
  handler: recall,
} as const;
