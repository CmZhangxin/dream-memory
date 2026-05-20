import { captureConversationTool } from "./capture-conversation.js";
import { captureNoteTool } from "./capture-note.js";
import { captureDecisionTool } from "./capture-decision.js";
import { captureSkillTool } from "./capture-skill.js";
import { recallTool } from "./recall.js";
import { searchMemoriesTool } from "./search-memories.js";
import { searchConversationsTool } from "./search-conversations.js";
import { sessionEndTool } from "./session-end.js";
import { getPersonaTool, getTodayTool, getScenariosTool, captureTaskTool, suggestMemoryTool } from "./stubs.js";

export const ALL_TOOLS = [
  // Real (11)
  captureConversationTool,
  captureNoteTool,
  captureDecisionTool,
  captureSkillTool,
  recallTool,
  searchMemoriesTool,
  searchConversationsTool,
  sessionEndTool,
  getPersonaTool,
  getScenariosTool,
  suggestMemoryTool,
  // Stubs (2)
  getTodayTool,
  captureTaskTool,
] as const;
