import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { acquireLock, isProcessAlive, releaseLock, validateSchedule } from "../src/cron-runner.js";

const tmpDirs: string[] = [];
function makeTmp(): string {
  const d = mkdtempSync(join(tmpdir(), "cron-runner-test-"));
  tmpDirs.push(d);
  return d;
}

afterEach(() => {
  while (tmpDirs.length > 0) {
    const d = tmpDirs.pop()!;
    try {
      rmSync(d, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
});

describe("validateSchedule", () => {
  it("accepts valid cron expression", () => {
    expect(validateSchedule("0 23 * * *")).toBe(true);
    expect(validateSchedule("* * * * *")).toBe(true);
  });

  it("throws on invalid expression", () => {
    expect(() => validateSchedule("not-a-cron")).toThrow(/invalid/i);
    expect(() => validateSchedule("")).toThrow(/invalid/i);
  });
});

describe("acquireLock", () => {
  it("creates pid file when none exists", () => {
    const dir = makeTmp();
    const pidFile = join(dir, "cron.pid");
    acquireLock(pidFile, 12345);
    expect(existsSync(pidFile)).toBe(true);
    expect(readFileSync(pidFile, "utf-8")).toBe("12345");
  });

  it("overwrites stale pid file (process dead)", () => {
    const dir = makeTmp();
    const pidFile = join(dir, "cron.pid");
    // PID 999999 almost certainly doesn't exist
    writeFileSync(pidFile, "999999");
    expect(() => acquireLock(pidFile, process.pid)).not.toThrow();
    expect(readFileSync(pidFile, "utf-8")).toBe(String(process.pid));
  });

  it("throws when another live process holds the lock", () => {
    const dir = makeTmp();
    const pidFile = join(dir, "cron.pid");
    // Use current process pid as the "other holder"; pretend we're a different runner
    writeFileSync(pidFile, String(process.pid));
    expect(() => acquireLock(pidFile, process.pid + 1)).toThrow(/already running/i);
  });
});

describe("isProcessAlive", () => {
  it("returns true for current process", () => {
    expect(isProcessAlive(process.pid)).toBe(true);
  });

  it("returns false for very large unlikely pid", () => {
    expect(isProcessAlive(999_999_999)).toBe(false);
  });
});

describe("releaseLock", () => {
  it("removes pid file silently if missing", () => {
    const dir = makeTmp();
    const pidFile = join(dir, "missing.pid");
    expect(() => releaseLock(pidFile)).not.toThrow();
  });

  it("removes existing pid file", () => {
    const dir = makeTmp();
    const pidFile = join(dir, "cron.pid");
    writeFileSync(pidFile, "111");
    releaseLock(pidFile);
    expect(existsSync(pidFile)).toBe(false);
  });
});
