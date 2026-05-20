import { readFile, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { Gateway } from "./lib/gateway.js";
import { SyncState } from "./lib/sync-state.js";
import { redact } from "./lib/redact.js";
import { loadProjectsConfig } from "./lib/projects-config.js";

const PROJECTS_YML = join(homedir(), ".dream-memory", "projects.yml");
const STATE_PATH = join(homedir(), ".dream-memory", "sync-state.json");

interface SyncResult {
  projects_scanned: number;
  files_scanned: number;
  files_synced: number;
  files_skipped: number;
  redact_hits_total: number;
  errors: string[];
}

export async function syncCodeBuddy(opts: { dryRun?: boolean } = {}): Promise<SyncResult> {
  const session_key = `sync-codebuddy-${dateStamp()}`;
  const config = await loadProjectsConfig(PROJECTS_YML);
  const gw = new Gateway();
  const state = await SyncState.load(STATE_PATH);
  const result: SyncResult = {
    projects_scanned: 0,
    files_scanned: 0,
    files_synced: 0,
    files_skipped: 0,
    redact_hits_total: 0,
    errors: [],
  };

  for (const proj of config.projects) {
    result.projects_scanned++;
    const memDir = join(proj.path, ".codebuddy", "memory");
    let entries;
    try {
      entries = await readdir(memDir, { withFileTypes: true });
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code === "ENOENT") continue; // 项目没建过 memory；跳过
      result.errors.push(`readdir ${memDir}: ${(err as Error).message}`);
      continue;
    }

    for (const ent of entries) {
      if (!ent.isFile() || !ent.name.endsWith(".md")) continue;
      const full = join(memDir, ent.name);
      const key = full;
      result.files_scanned++;

      let st;
      try {
        st = await stat(full);
      } catch (err) {
        result.errors.push(`stat ${full}: ${(err as Error).message}`);
        continue;
      }
      if (!state.shouldSync("codebuddy_memory", key, st.mtimeMs)) {
        result.files_skipped++;
        continue;
      }

      let content: string;
      try {
        content = await readFile(full, "utf-8");
      } catch (err) {
        result.errors.push(`read ${full}: ${(err as Error).message}`);
        continue;
      }

      const { text, hits } = redact(content);
      result.redact_hits_total += Object.values(hits).reduce((a, b) => a + b, 0);

      if (!opts.dryRun) {
        try {
          await gw.capture({
            user_content: `[CB-MEMORY:${proj.name}/${ent.name}]\n\n${text}`,
            assistant_content: "已收录",
            session_key,
          });
        } catch (err) {
          result.errors.push(`capture ${full}: ${(err as Error).message}`);
          continue;
        }
      }
      state.mark("codebuddy_memory", key, { mtime_ms: st.mtimeMs, size_bytes: st.size });
      result.files_synced++;
    }
  }

  if (!opts.dryRun) await state.save();
  return result;
}

function dateStamp(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dryRun = process.argv.includes("--dry-run");
  syncCodeBuddy({ dryRun })
    .then((r) => {
      console.log(
        `[sync-codebuddy] projects=${r.projects_scanned} scanned=${r.files_scanned} synced=${r.files_synced} skipped=${r.files_skipped} redact=${r.redact_hits_total} errors=${r.errors.length}`,
      );
      if (r.errors.length > 0) for (const e of r.errors.slice(0, 10)) console.error("  -", e);
      process.exit(0);
    })
    .catch((err: unknown) => {
      const e = err as Error;
      console.error("[sync-codebuddy] fatal:", e.message);
      process.exit(e.name === "GatewayUnavailableError" ? 1 : 3);
    });
}
