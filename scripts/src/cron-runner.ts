/**
 * cron-runner: 常驻进程，按 schedule 触发 daily-dream 同步。
 *
 * 用法：
 *   npx tsx src/cron-runner.ts                      # 默认 0 23 * * * Asia/Shanghai
 *   CRON_SCHEDULE="* * * * *" npx tsx src/cron-runner.ts   # 测试用
 *
 * 行为：
 * - 启动时校验 cron 表达式 + 申请 PID 锁
 * - 时间到 → spawn `npx tsx src/daily-dream.ts`，捕获 stdout/stderr 写日志
 * - 子进程失败不影响 runner 存活
 * - SIGTERM/SIGINT 优雅关闭
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync, appendFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import cron from "node-cron";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SCHEDULE = process.env.CRON_SCHEDULE ?? "0 23 * * *";
const TIMEZONE = process.env.CRON_TIMEZONE ?? "Asia/Shanghai";
const DREAM_HOME = process.env.DREAM_MEMORY_HOME ?? join(process.env.HOME ?? "", ".dream-memory");
const PID_FILE = join(DREAM_HOME, "cron-runner.pid");
const LOG_FILE = join(DREAM_HOME, "cron.log");
const DAILY_DREAM_SCRIPT = resolve(__dirname, "daily-dream.ts");

// ─── Pure helpers (TDD targets) ──────────────────────────────────────────

export function validateSchedule(expr: string): true {
  if (!cron.validate(expr)) {
    throw new Error(`Invalid cron expression: ${expr}`);
  }
  return true;
}

/** Returns true if a process with given pid is alive. */
export function isProcessAlive(pid: number): boolean {
  try {
    // Signal 0 just probes; throws ESRCH if dead.
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Acquire single-instance lock via PID file.
 * Throws if another live runner (or the same process re-entering) holds the lock.
 */
export function acquireLock(pidFile: string, currentPid: number = process.pid): void {
  if (existsSync(pidFile)) {
    const raw = readFileSync(pidFile, "utf-8").trim();
    const existing = Number.parseInt(raw, 10);
    if (Number.isFinite(existing) && isProcessAlive(existing)) {
      // Note: even when existing === currentPid we throw, because the only
      // legitimate way to land here is double-init within the same process
      // (e.g. tsx loader chain re-evaluating the entry module).
      throw new Error(`cron-runner already running (pid ${existing})`);
    }
    // Stale lock: remove and continue
  }
  mkdirSync(dirname(pidFile), { recursive: true });
  writeFileSync(pidFile, String(currentPid));
}

export function releaseLock(pidFile: string): void {
  try {
    if (existsSync(pidFile)) unlinkSync(pidFile);
  } catch {
    /* ignore */
  }
}

// ─── Logging ─────────────────────────────────────────────────────────────

type LogLevel = "info" | "warn" | "error";

function log(level: LogLevel, event: string, extra: Record<string, unknown> = {}): void {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...extra });
  // Write to file only. Avoid stderr because start.sh redirects stderr → cron.log
  // (nohup ... >> cron.log 2>&1), which would cause every line to be written twice.
  // For foreground debugging, run: tail -f ~/.dream-memory/cron.log
  try {
    mkdirSync(dirname(LOG_FILE), { recursive: true });
    appendFileSync(LOG_FILE, line + "\n");
  } catch {
    /* don't crash on log failure */
  }
}

// ─── Sync invocation ─────────────────────────────────────────────────────

function runDaily(): Promise<number> {
  return new Promise((resolveP) => {
    const startedAt = Date.now();
    log("info", "sync.start");
    const child = spawn("npx", ["tsx", DAILY_DREAM_SCRIPT], {
      cwd: resolve(__dirname, ".."),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderrBuf = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      // Forward to log as info, but truncate to keep lines small
      const text = chunk.toString("utf-8").trim();
      if (text) log("info", "sync.stdout", { text: text.slice(0, 500) });
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderrBuf += chunk.toString("utf-8");
    });
    child.on("close", (code) => {
      const exitCode = code ?? -1;
      const durationMs = Date.now() - startedAt;
      if (exitCode === 0) {
        log("info", "sync.done", { exitCode, durationMs });
      } else {
        log("error", "sync.failed", {
          exitCode,
          durationMs,
          stderr: stderrBuf.slice(-1000),
        });
      }
      resolveP(exitCode);
    });
  });
}

// ─── main ────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  validateSchedule(SCHEDULE);
  try {
    acquireLock(PID_FILE);
  } catch (err) {
    // Same-process double-init (tsx loader chain re-evaluation) or a real
    // separate runner. Either way, just bail silently — the first invocation
    // already owns the cron task.
    log("warn", "cron-runner.skipped", {
      reason: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  log("info", "cron-runner.started", { schedule: SCHEDULE, timezone: TIMEZONE, pid: process.pid });

  const task = cron.schedule(
    SCHEDULE,
    () => {
      // Fire-and-forget; runDaily handles its own logging
      void runDaily();
    },
    { scheduled: true, timezone: TIMEZONE },
  );

  const shutdown = (signal: string): void => {
    log("info", "cron-runner.shutdown", { signal });
    task.stop();
    releaseLock(PID_FILE);
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // Keep process alive
  process.stdin.resume();
}

// Run only when invoked as CLI (not when imported by tests)
// Use a module-level guard to avoid double-init under tsx loader chains.
declare global {
  // eslint-disable-next-line no-var
  var __DREAM_CRON_BOOTED__: boolean | undefined;
}
const isCli =
  process.argv[1] !== undefined && /cron-runner\.(ts|js|cjs|mjs)$/.test(process.argv[1]);
if (isCli && !globalThis.__DREAM_CRON_BOOTED__) {
  globalThis.__DREAM_CRON_BOOTED__ = true;
  main().catch((err: unknown) => {
    log("error", "cron-runner.fatal", { message: err instanceof Error ? err.message : String(err) });
    releaseLock(PID_FILE);
    process.exit(1);
  });
}
