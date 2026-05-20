import { z } from "zod";
import type { ToolContext } from "../types.js";

export const searchMemoriesSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().positive().optional(),
  type: z.string().optional().describe("L1 atom 类型过滤"),
  scene: z.string().optional().describe("L2 场景过滤"),
});

export type SearchMemoriesInput = z.infer<typeof searchMemoriesSchema>;

export async function searchMemories(input: SearchMemoriesInput, ctx: ToolContext) {
  const r = await ctx.client.searchMemories(input);
  return {
    content: [{
      type: "text" as const,
      text: `🔍 命中 ${r.total} 条 L1 记忆（strategy=${r.strategy}）：\n\n${r.results}`,
    }],
  };
}

export const searchMemoriesTool = {
  name: "dream_search_memories",
  description: "在 L1 atom 层（结构化记忆）中检索。",
  inputSchema: searchMemoriesSchema,
  handler: searchMemories,
} as const;
