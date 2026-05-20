import { z } from "zod";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { ToolContext } from "../types.js";

// ─── Data paths ──────────────────────────────────────────
const MEMORY_DATA_DIR = process.env.MEMORY_TENCENTDB_DATA_DIR
  ?? join(process.env.HOME ?? "~", ".memory-tencentdb", "memory-tdai");

const PERSONA_PATH = join(MEMORY_DATA_DIR, "persona.md");
const SCENE_INDEX_PATH = join(MEMORY_DATA_DIR, ".metadata", "scene_index.json");

// ─── dream_get_persona ───────────────────────────────────

const emptySchema = z.object({}).describe("无输入参数");

async function getPersona(_input: unknown, _ctx: ToolContext) {
  if (!existsSync(PERSONA_PATH)) {
    return {
      content: [{
        type: "text" as const,
        text: "（L3 Persona 尚未生成。需要更多对话让系统积累记忆后自动生成。）",
      }],
    };
  }
  const persona = readFileSync(PERSONA_PATH, "utf-8");
  return {
    content: [{
      type: "text" as const,
      text: `📋 当前 L3 Persona：\n\n${persona}`,
    }],
  };
}

export const getPersonaTool = {
  name: "dream_get_persona",
  description: "读取 L3 用户画像（Persona）。这是系统从历史对话中自动生成的稳定用户画像，包含偏好、决策风格、工作习惯等。",
  inputSchema: emptySchema,
  handler: getPersona,
} as const;

// ─── dream_get_scenarios ─────────────────────────────────

interface SceneIndexEntry {
  filename: string;
  summary: string;
  heat: number;
  created: string;
  updated: string;
}

async function getScenarios(_input: unknown, _ctx: ToolContext) {
  if (!existsSync(SCENE_INDEX_PATH)) {
    return {
      content: [{
        type: "text" as const,
        text: "（L2 场景尚未生成。需要更多对话让系统自动聚类。）",
      }],
    };
  }
  const raw = readFileSync(SCENE_INDEX_PATH, "utf-8");
  let entries: SceneIndexEntry[];
  try {
    entries = JSON.parse(raw);
  } catch {
    return { content: [{ type: "text" as const, text: "（scene_index.json 解析失败）" }] };
  }

  if (entries.length === 0) {
    return { content: [{ type: "text" as const, text: "（暂无活跃场景）" }] };
  }

  const lines = entries
    .sort((a, b) => b.heat - a.heat)
    .map((e) => `- **${e.filename.replace(/\.md$/, "")}** (热度 ${e.heat}) — ${e.summary}`);

  return {
    content: [{
      type: "text" as const,
      text: `🎭 活跃 L2 场景（${entries.length} 个）：\n\n${lines.join("\n")}`,
    }],
  };
}

export const getScenariosTool = {
  name: "dream_get_scenarios",
  description: "列出活跃的 L2 场景块（Scene Block）。每个场景代表一个项目/主题/工作流，包含该场景下所有相关记忆的聚合。",
  inputSchema: emptySchema,
  handler: getScenarios,
} as const;

// ─── dream_suggest_memory ────────────────────────────────

const suggestSchema = z.object({
  content: z.string().min(1).describe("建议记忆的内容（完整独立的一句话）"),
  type: z.enum(["persona", "episodic", "instruction"]).describe("记忆类型：persona=偏好/特质, episodic=事件/决策, instruction=对AI的要求"),
  reason: z.string().optional().describe("为什么建议记住这条（给用户审核时看）"),
});

async function suggestMemory(input: z.infer<typeof suggestSchema>, ctx: ToolContext) {
  // 写入 L0 作为 "suggest" 类型对话，让 L1 pipeline 自动提取
  // 用特殊 session_key 前缀标记"建议"来源
  const session_key = `suggest-${Date.now()}`;
  await ctx.client.capture({
    user_content: `[MEMORY_SUGGEST type=${input.type}] ${input.content}`,
    assistant_content: input.reason ?? "AI 自动提议的记忆",
    session_key,
  });

  return {
    content: [{
      type: "text" as const,
      text: `💡 已提议记忆（待确认）：\n类型: ${input.type}\n内容: ${input.content}${input.reason ? `\n理由: ${input.reason}` : ""}`,
    }],
  };
}

export const suggestMemoryTool = {
  name: "dream_suggest_memory",
  description: "AI 主动提议一条值得记住的记忆（偏好、决策、对AI的要求等）。提议后会进入待审核状态，用户可在 Dashboard 确认或拒绝。",
  inputSchema: suggestSchema,
  handler: suggestMemory,
} as const;

// ─── Remaining stubs ─────────────────────────────────────

function makeStub(name: string, futureStage: string) {
  return async (_input: unknown, _ctx: ToolContext) => ({
    isError: true,
    content: [{
      type: "text" as const,
      text: `🚧 ${name} 暂未实现，将在 ${futureStage} 提供。`,
    }],
  });
}

export const getTodayTool = {
  name: "dream_get_today",
  description: "(Stub · 未实现) 列出今日新增的 L0/L1 记忆。",
  inputSchema: emptySchema,
  handler: makeStub("dream_get_today", "后续迭代"),
} as const;

export const captureTaskTool = {
  name: "dream_capture_task",
  description: "(Stub · 未实现) 记录任务/Todo。",
  inputSchema: z.object({
    title: z.string(),
    status: z.enum(["todo", "doing", "done"]).optional(),
  }).describe("（待 todo 域语义明确再实现）"),
  handler: makeStub("dream_capture_task", "后续迭代"),
} as const;
