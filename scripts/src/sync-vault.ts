import { readFile, stat, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join, relative } from "node:path";
import { Gateway } from "./lib/gateway.js";
import { SyncState } from "./lib/sync-state.js";
import { redact } from "./lib/redact.js";
import { chunkMarkdown } from "./lib/chunk.js";

const VAULT_PATH = process.env.DREAM_VAULT_PATH ?? join(homedir(), "Documents", "Obsidian Vault");
const STATE_PATH = join(homedir(), ".dream-memory", "sync-state.json");
const MAX_CHUNKS_PER_FILE = 50;

interface SyncResult {
  files_scanned: number;
  files_synced: number;
  files_skipped: number;
  chunks_synced: number;
  redact_hits_total: number;
  errors: string[];
}

async function* walkMarkdown(root: string): AsyncGenerator<string> {
  async function* visit(dir: string): AsyncGenerator<string> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (ent.name.startsWith(".")) continue; // skip .obsidian, .trash 等
      const full = join(dir, ent.name);
      if (ent.isDirectory()) yield* visit(full);
      else if (ent.isFile() && ent.name.endsWith(".md")) yield full;
    }
  }
  yield* visit(root);
}

export async function syncVault(opts: { dryRun?: boolean } = {}): Promise<SyncResult> {
  const session_key = `sync-vault-${dateStamp()}`;
  const gw = new Gateway();
  const state = await SyncState.load(STATE_PATH);
  const result: SyncResult = {
    files_scanned: 0,
    files_synced: 0,
    files_skipped: 0,
    chunks_synced: 0,
    redact_hits_total: 0,
    errors: [],
  };

  for await (const file of walkMarkdown(VAULT_PATH)) {
    result.files_scanned++;
    const rel = relative(VAULT_PATH, file);
    let st;
    try {
      st = await stat(file);
    } catch (err) {
      result.errors.push(`stat ${rel}: ${(err as Error).message}`);
      continue;
    }
    if (!state.shouldSync("vault", rel, st.mtimeMs)) {
      result.files_skipped++;
      continue;
    }
    let content: string;
    try {
      content = await readFile(file, "utf-8");
    } catch (err) {
      result.errors.push(`read ${rel}: ${(err as Error).message}`);
      continue;
    }

    const chunks = chunkMarkdown(content).slice(0, MAX_CHUNKS_PER_FILE);
    let i = 0;
    for (const chunk of chunks) {
      i++;
      const { text, hits } = redact(chunk);
      result.redact_hits_total += Object.values(hits).reduce((a, b) => a + b, 0);

      if (opts.dryRun) {
        result.chunks_synced++;
        continue;
      }
      try {
        await gw.capture({
          user_content: `[VAULT:${rel}] §${i}\n\n${text}`,
          assistant_content: "已收录",
          session_key,
        });
        result.chunks_synced++;
      } catch (err) {
        result.errors.push(`capture ${rel}#${i}: ${(err as Error).message}`);
      }
    }
    state.mark("vault", rel, { mtime_ms: st.mtimeMs, size_bytes: st.size });
    result.files_synced++;
  }

  if (!opts.dryRun) await state.save();
  return result;
}

function dateStamp(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const dryRun = process.argv.includes("--dry-run");
  syncVault({ dryRun })
    .then((r) => {
      console.log(
        `[sync-vault] scanned=${r.files_scanned} synced=${r.files_synced} skipped=${r.files_skipped} chunks=${r.chunks_synced} redact=${r.redact_hits_total} errors=${r.errors.length}`,
      );
      if (r.errors.length > 0) for (const e of r.errors.slice(0, 10)) console.error("  -", e);
      process.exit(0);
    })
    .catch((err: unknown) => {
      const e = err as Error;
      console.error("[sync-vault] fatal:", e.message);
      process.exit(e.name === "GatewayUnavailableError" ? 1 : 3);
    });
}
