import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export type SyncSource = "vault" | "codebuddy_memory";

interface FileEntry {
  mtime_ms: number;
  size_bytes: number;
}

interface StateFile {
  schema_version: 1;
  vault: { last_sync_at: string | null; files: Record<string, FileEntry> };
  codebuddy_memory: { last_sync_at: string | null; files: Record<string, FileEntry> };
}

const EMPTY: StateFile = {
  schema_version: 1,
  vault: { last_sync_at: null, files: {} },
  codebuddy_memory: { last_sync_at: null, files: {} },
};

export class SyncState {
  private constructor(private readonly path: string, private state: StateFile) {}

  static async load(path: string): Promise<SyncState> {
    try {
      const raw = await readFile(path, "utf-8");
      const parsed = JSON.parse(raw) as StateFile;
      return new SyncState(path, {
        schema_version: 1,
        vault: parsed.vault ?? EMPTY.vault,
        codebuddy_memory: parsed.codebuddy_memory ?? EMPTY.codebuddy_memory,
      });
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code !== "ENOENT") {
        console.warn(`[sync-state] failed to load ${path}, starting empty:`, err);
      }
      return new SyncState(path, structuredClone(EMPTY));
    }
  }

  shouldSync(source: SyncSource, key: string, mtime_ms: number): boolean {
    const stored = this.state[source].files[key];
    return !stored || stored.mtime_ms !== mtime_ms;
  }

  mark(source: SyncSource, key: string, entry: FileEntry): void {
    this.state[source].files[key] = entry;
    this.state[source].last_sync_at = new Date().toISOString();
  }

  async save(): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(this.path, JSON.stringify(this.state, null, 2), "utf-8");
  }
}
