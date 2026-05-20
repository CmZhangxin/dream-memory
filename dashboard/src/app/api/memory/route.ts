import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GATEWAY_URL = process.env.DREAM_GATEWAY_URL ?? "http://localhost:8420";
const DATA_DIR = join(
  process.env.HOME ?? "~",
  ".memory-tencentdb",
  "memory-tdai"
);
const PERSONA_PATH = join(DATA_DIR, "persona.md");
const SCENE_INDEX_PATH = join(DATA_DIR, ".metadata", "scene_index.json");

interface SceneEntry {
  filename: string;
  summary: string;
  heat: number;
  created: string;
  updated: string;
}

export async function GET() {
  try {
    // 1. Health
    let health = { status: "unknown", uptime: 0, stores: { vectorStore: false, embeddingService: false } };
    try {
      const r = await fetch(`${GATEWAY_URL}/health`, { signal: AbortSignal.timeout(3000) });
      if (r.ok) health = await r.json();
    } catch { /* offline */ }

    // 2. L1 memories (search with empty query = recent)
    let l1Memories: Array<{ content: string; type: string; priority: number; scene_name: string }> = [];
    let l1Total = 0;
    try {
      const r = await fetch(`${GATEWAY_URL}/search/memories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "*", limit: 100 }),
        signal: AbortSignal.timeout(5000),
      });
      if (r.ok) {
        const data = await r.json();
        // search/memories returns { results: string, total: number }
        l1Total = data.total ?? 0;
        // Parse results text into structured data if possible
        // For now just pass raw
        l1Memories = data.results_raw ?? [];
      }
    } catch { /* */ }

    // 2b. Direct SQLite query for L1 (more reliable than search API for listing)
    let l1Records: Array<Record<string, unknown>> = [];
    try {
      const Database = (await import("better-sqlite3")).default;
      const dbPath = join(DATA_DIR, "vectors.db");
      if (existsSync(dbPath)) {
        const db = new Database(dbPath, { readonly: true });
        l1Records = db.prepare(
          "SELECT record_id, content, type, priority, scene_name, session_key, timestamp_str FROM l1_records ORDER BY timestamp_str DESC LIMIT 200"
        ).all() as Array<Record<string, unknown>>;
        l1Total = (db.prepare("SELECT COUNT(*) as cnt FROM l1_records").get() as { cnt: number }).cnt;
        db.close();
      }
    } catch { /* */ }

    // 3. L2 Scenes
    let scenes: SceneEntry[] = [];
    try {
      if (existsSync(SCENE_INDEX_PATH)) {
        scenes = JSON.parse(readFileSync(SCENE_INDEX_PATH, "utf-8"));
      }
    } catch { /* */ }

    // 4. L3 Persona
    let persona = "";
    try {
      if (existsSync(PERSONA_PATH)) {
        persona = readFileSync(PERSONA_PATH, "utf-8");
      }
    } catch { /* */ }

    // 5. L0 count + recent records
    let l0Count = 0;
    let l0Records: Array<Record<string, unknown>> = [];
    try {
      const Database = (await import("better-sqlite3")).default;
      const dbPath = join(DATA_DIR, "vectors.db");
      if (existsSync(dbPath)) {
        const db = new Database(dbPath, { readonly: true });
        l0Count = (db.prepare("SELECT COUNT(*) as cnt FROM l0_conversations").get() as { cnt: number }).cnt;
        l0Records = db.prepare(
          "SELECT record_id, session_key, role, message_text, recorded_at FROM l0_conversations ORDER BY timestamp DESC LIMIT 50"
        ).all() as Array<Record<string, unknown>>;
        db.close();
      }
    } catch { /* */ }

    return NextResponse.json({
      health,
      l0Count,
      l0Records,
      l1: { total: l1Total, records: l1Records },
      l2: { scenes },
      l3: { persona, lastUpdated: existsSync(PERSONA_PATH) ? readFileSync(PERSONA_PATH, "utf-8").length > 0 ? new Date().toISOString() : null : null },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
