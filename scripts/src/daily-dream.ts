import { Gateway, GatewayUnavailableError } from "./lib/gateway.js";
import { syncVault } from "./sync-vault.js";
import { syncCodeBuddy } from "./sync-codebuddy.js";

interface CliOptions {
  dryRun: boolean;
  noFlush: boolean;
}

function parseArgs(): CliOptions {
  return {
    dryRun: process.argv.includes("--dry-run"),
    noFlush: process.argv.includes("--no-flush"),
  };
}

async function main() {
  const opts = parseArgs();
  console.log(`[daily-dream] start (dryRun=${opts.dryRun} noFlush=${opts.noFlush})`);

  // 提前探活
  if (!opts.dryRun) {
    try {
      const r = await fetch(`${process.env.DREAM_GATEWAY_URL ?? "http://localhost:8420"}/health`);
      if (!r.ok) throw new Error(`/health returned ${r.status}`);
    } catch (err) {
      const cause = (err as { cause?: { code?: string } })?.cause;
      if (cause?.code === "ECONNREFUSED" || cause?.code === "ENOTFOUND") {
        console.error(
          "[daily-dream] Gateway not reachable. Run `cd dream-dashboard && ./start.sh` first.",
        );
        process.exit(1);
      }
      console.error("[daily-dream] health check failed:", (err as Error).message);
      process.exit(1);
    }
  }

  const v = await syncVault({ dryRun: opts.dryRun });
  console.log(
    `[daily-dream] vault: scanned=${v.files_scanned} synced=${v.files_synced} skipped=${v.files_skipped} chunks=${v.chunks_synced} redact=${v.redact_hits_total} errors=${v.errors.length}`,
  );

  try {
    const c = await syncCodeBuddy({ dryRun: opts.dryRun });
    console.log(
      `[daily-dream] codebuddy: projects=${c.projects_scanned} scanned=${c.files_scanned} synced=${c.files_synced} skipped=${c.files_skipped} redact=${c.redact_hits_total} errors=${c.errors.length}`,
    );
  } catch (err) {
    console.warn(`[daily-dream] codebuddy skipped: ${(err as Error).message}`);
  }

  if (!opts.dryRun && !opts.noFlush) {
    const gw = new Gateway();
    const session = `sync-vault-${dateStamp()}`;
    try {
      await gw.sessionEnd({ session_key: session });
      console.log(`[daily-dream] flush triggered for session=${session}`);
    } catch (err) {
      if (err instanceof GatewayUnavailableError) throw err;
      console.warn(`[daily-dream] flush failed (non-fatal): ${(err as Error).message}`);
    }
  }

  console.log(`[daily-dream] done`);
}

function dateStamp(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
}

main().catch((err: unknown) => {
  const e = err as Error;
  console.error("[daily-dream] fatal:", e.message);
  process.exit(e.name === "GatewayUnavailableError" ? 1 : 3);
});
