import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Obsidian Vault 路径 — 通过环境变量配置 */
  env: {
    OBSIDIAN_VAULT_PATH: process.env.OBSIDIAN_VAULT_PATH || "/Users/cmzhang/Documents/Obsidian Vault",
  },
  /* Native modules that must be loaded by Node, not bundled by webpack/turbopack.
   * Without this, @node-rs/jieba's platform-specific .node binary can't be resolved
   * inside the server bundle. */
  serverExternalPackages: ["@node-rs/jieba", "better-sqlite3"],
};

export default nextConfig;
