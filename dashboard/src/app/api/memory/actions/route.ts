import { NextResponse } from "next/server";
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATA_DIR = join(process.env.HOME ?? "~", ".memory-tencentdb", "memory-tdai");

/**
 * POST /api/memory/actions
 * Body: { action, record_id, ... }
 * Actions: delete | boost | demote | get_scene_content
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    const Database = (await import("better-sqlite3")).default;
    const dbPath = join(DATA_DIR, "vectors.db");
    if (!existsSync(dbPath)) {
      return NextResponse.json({ error: "Database not found" }, { status: 404 });
    }

    switch (action) {
      case "delete": {
        const { record_id } = body;
        if (!record_id) return NextResponse.json({ error: "record_id required" }, { status: 400 });
        const db = new Database(dbPath);
        db.prepare("DELETE FROM l1_records WHERE record_id = ?").run(record_id);
        db.close();
        return NextResponse.json({ success: true, action: "deleted", record_id });
      }

      case "boost": {
        const { record_id } = body;
        if (!record_id) return NextResponse.json({ error: "record_id required" }, { status: 400 });
        const db = new Database(dbPath);
        // priority 上限 100
        db.prepare("UPDATE l1_records SET priority = MIN(priority + 15, 100) WHERE record_id = ?").run(record_id);
        const row = db.prepare("SELECT priority FROM l1_records WHERE record_id = ?").get(record_id) as { priority: number } | undefined;
        db.close();
        return NextResponse.json({ success: true, action: "boosted", record_id, newPriority: row?.priority });
      }

      case "demote": {
        const { record_id } = body;
        if (!record_id) return NextResponse.json({ error: "record_id required" }, { status: 400 });
        const db = new Database(dbPath);
        // priority 下限 10，低于 10 自动删除（归档）
        db.prepare("UPDATE l1_records SET priority = MAX(priority - 15, 0) WHERE record_id = ?").run(record_id);
        const row = db.prepare("SELECT priority FROM l1_records WHERE record_id = ?").get(record_id) as { priority: number } | undefined;
        if (row && row.priority <= 0) {
          db.prepare("DELETE FROM l1_records WHERE record_id = ?").run(record_id);
          db.close();
          return NextResponse.json({ success: true, action: "archived", record_id });
        }
        db.close();
        return NextResponse.json({ success: true, action: "demoted", record_id, newPriority: row?.priority });
      }

      case "get_scene_content": {
        const { filename } = body;
        if (!filename) return NextResponse.json({ error: "filename required" }, { status: 400 });
        const scenePath = join(DATA_DIR, "scene_blocks", filename);
        if (!existsSync(scenePath)) {
          return NextResponse.json({ error: "Scene not found" }, { status: 404 });
        }
        const content = readFileSync(scenePath, "utf-8");
        return NextResponse.json({ success: true, content });
      }

      case "edit": {
        const { record_id, content } = body;
        if (!record_id || !content) return NextResponse.json({ error: "record_id and content required" }, { status: 400 });
        const db = new Database(dbPath);
        db.prepare("UPDATE l1_records SET content = ? WHERE record_id = ?").run(content, record_id);
        db.close();
        return NextResponse.json({ success: true, action: "edited", record_id });
      }

      case "regenerate_persona": {
        // 触发 session_end 让 pipeline 重新生成
        const GATEWAY_URL = process.env.DREAM_GATEWAY_URL ?? "http://localhost:8420";
        const r = await fetch(`${GATEWAY_URL}/session/end`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_key: "manual-regenerate" }),
        });
        const data = await r.json();
        return NextResponse.json({ success: true, action: "regenerate_triggered", data });
      }

      case "approve_suggest": {
        // 将 suggest L0 记录直接写入 L1（手动审核通过）
        const { record_id, content, type } = body;
        if (!record_id || !content) return NextResponse.json({ error: "record_id and content required" }, { status: 400 });
        const db = new Database(dbPath);
        const newRecordId = `m_${Date.now()}_approved`;
        db.prepare(
          "INSERT INTO l1_records (record_id, content, type, priority, scene_name, session_key, timestamp_str) VALUES (?, ?, ?, ?, ?, ?, ?)"
        ).run(newRecordId, content, type || "episodic", 80, "", "approved-from-suggest", new Date().toISOString());
        // 删除原始 L0 suggest 记录
        db.prepare("DELETE FROM l0_conversations WHERE record_id = ?").run(record_id);
        db.close();
        return NextResponse.json({ success: true, action: "approved", record_id: newRecordId });
      }

      case "reject_suggest": {
        // 删除 suggest L0 记录（拒绝）
        const { session_key } = body;
        if (!session_key) return NextResponse.json({ error: "session_key required" }, { status: 400 });
        const db = new Database(dbPath);
        db.prepare("DELETE FROM l0_conversations WHERE session_key = ?").run(session_key);
        db.close();
        return NextResponse.json({ success: true, action: "rejected", session_key });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
