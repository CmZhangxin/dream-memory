import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SyncState } from "../../src/lib/sync-state.js";

describe("SyncState", () => {
  let dir: string;
  let path: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "syncstate-"));
    path = join(dir, "sync-state.json");
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("returns empty state when file missing", async () => {
    const s = await SyncState.load(path);
    expect(s.shouldSync("vault", "any-file", 12345)).toBe(true);
  });

  it("round-trips: mark + save + reload", async () => {
    const s1 = await SyncState.load(path);
    s1.mark("vault", "/a/b.md", { mtime_ms: 1000, size_bytes: 10 });
    await s1.save();

    const s2 = await SyncState.load(path);
    expect(s2.shouldSync("vault", "/a/b.md", 1000)).toBe(false);
    expect(s2.shouldSync("vault", "/a/b.md", 1001)).toBe(true);
  });

  it("mtime mismatch triggers re-sync", async () => {
    const s = await SyncState.load(path);
    s.mark("codebuddy_memory", "x.md", { mtime_ms: 100, size_bytes: 1 });
    expect(s.shouldSync("codebuddy_memory", "x.md", 200)).toBe(true);
  });

  it("corrupt JSON degrades to empty state with warning", async () => {
    await writeFile(path, "{not json", "utf-8");
    const s = await SyncState.load(path);
    expect(s.shouldSync("vault", "any", 0)).toBe(true);
  });
});
