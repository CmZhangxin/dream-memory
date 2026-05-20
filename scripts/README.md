# workshop/scripts

数据同步脚本：Obsidian Vault + CodeBuddy memory → Hermes Gateway。
含手工命令（阶段 3a）和定时调度（阶段 3b）。

## 用法

```bash
# 1. 配置白名单（一次）
mkdir -p ~/.dream-memory
cp examples/projects.yml ~/.dream-memory/projects.yml
# 编辑 ~/.dream-memory/projects.yml 列出要同步的项目

# 2. 确保 Gateway 跑着
cd ../dream-dashboard && ./start.sh

# 3a. 手动同步（按需）
cd ../scripts
npm run sync                   # 全流程：vault + codebuddy + flush
npm run sync -- --dry-run      # 只看会同步多少，不写
npm run sync:vault             # 只同步 Vault
npm run sync:codebuddy         # 只同步 CodeBuddy memory

# 3b. 自动定时（已集成进 ./start.sh，无需手动启停）
#    每晚 23:00 (Asia/Shanghai) 自动跑 daily-dream
#    日志: ~/.dream-memory/cron.log（JSON Lines）
tail -f ~/.dream-memory/cron.log
```

## 工作机制（数据流）

- 增量：`~/.dream-memory/sync-state.json` 按 mtime 跳过已同步文件
- 段落切分：Vault 文件按 `\n\n` 切；每段 30-2000 字符；frontmatter 剥离
- 整篇同步：CodeBuddy `.codebuddy/memory/*.md` 整篇一条（结构化日报不切）
- 脱敏：密码/token/邮箱/手机号 → `[REDACTED:*]`
- 来源标记：`[VAULT:rel/path] §N` / `[CB-MEMORY:project/file]`

## Cron 自动调度（阶段 3b）

`src/cron-runner.ts` 是一个常驻进程：

- 启动：随 `dream-dashboard/start.sh` 自动拉起（缺 LLM Key 时自动跳过）
- 调度：默认 `0 23 * * *` (Asia/Shanghai)，可通过 env 覆盖
- 单实例：`~/.dream-memory/cron-runner.pid` 防止重复启动
- 失败处理：写 `cron.log` ERROR 行，不重试，下次定时继续

环境变量：

| 变量 | 默认 | 用途 |
|---|---|---|
| `CRON_ENABLED` | `true` | 设 `false` 跳过启动 |
| `CRON_SCHEDULE` | `0 23 * * *` | 5 字段或 6 字段 cron 表达式 |
| `CRON_TIMEZONE` | `Asia/Shanghai` | IANA 时区 |

调试：

```bash
# 前台跑（日志只写文件，用 tail 看）
CRON_SCHEDULE="*/3 * * * * *" npx tsx src/cron-runner.ts &
tail -f ~/.dream-memory/cron.log
# Ctrl+C 时优雅 SIGINT
```

## 输出示例

```
[daily-dream] start (dryRun=false noFlush=false)
[daily-dream] vault: scanned=64 synced=64 skipped=0 chunks=753 redact=0 errors=0
[daily-dream] codebuddy: projects=1 scanned=5 synced=5 skipped=0 redact=0 errors=0
[daily-dream] flush triggered for session=sync-vault-20260519
[daily-dream] done
```

## 配置项

| 环境变量 | 默认 | 用途 |
|---|---|---|
| `DREAM_GATEWAY_URL` | `http://localhost:8420` | Hermes Gateway URL |
| `DREAM_VAULT_PATH` | `~/Documents/Obsidian Vault` | Vault 根目录 |
| `DREAM_MEMORY_HOME` | `~/.dream-memory` | 状态/日志目录 |

## 测试

```bash
npm test           # 28 单测（19 同步 + 9 cron-runner）
npm run typecheck  # tsc --noEmit
```

详细设计：

- 阶段 3a：[`../docs/2026-05-19-梦境系统-阶段3a-设计.md`](../docs/2026-05-19-梦境系统-阶段3a-设计.md)
- 阶段 3b：[`../docs/2026-05-19-梦境系统-阶段3b-设计与实施计划.md`](../docs/2026-05-19-梦境系统-阶段3b-设计与实施计划.md)
