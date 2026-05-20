import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadProjectsConfig } from "../../src/lib/projects-config.js";

describe("loadProjectsConfig", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "pcfg-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("parses valid yaml", async () => {
    const p = join(dir, "projects.yml");
    await writeFile(
      p,
      `projects:\n  - path: /tmp/a\n    name: a\nignore:\n  - "*.bak"\n`,
      "utf-8",
    );
    const c = await loadProjectsConfig(p);
    expect(c.projects).toHaveLength(1);
    expect(c.projects[0]).toEqual({ path: "/tmp/a", name: "a" });
    expect(c.ignore).toEqual(["*.bak"]);
  });

  it("rejects when projects array missing", async () => {
    const p = join(dir, "projects.yml");
    await writeFile(p, "ignore: []\n", "utf-8");
    await expect(loadProjectsConfig(p)).rejects.toThrow(/projects/);
  });

  it("throws clear error when file not found", async () => {
    await expect(loadProjectsConfig(join(dir, "missing.yml"))).rejects.toThrow(
      /not found|ENOENT/i,
    );
  });
});
