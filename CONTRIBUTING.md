# Contributing to Dream Memory

感谢你对 Dream Memory 的关注！

## 开发环境

1. Node.js >= 22
2. clone 仓库
3. 各子模块独立安装依赖：

```bash
cd dream-memory-mcp && npm install
cd ../dashboard && npm install
cd ../scripts && npm install
```

## 开发流程

1. Fork 本仓库
2. 创建 feature branch: `git checkout -b feat/my-feature`
3. 提交变更: `git commit -m 'feat: add some feature'`
4. Push: `git push origin feat/my-feature`
5. 提 PR

## Commit 规范

使用 [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` 新功能
- `fix:` 修复
- `docs:` 文档
- `refactor:` 重构
- `test:` 测试
- `chore:` 杂项

## 项目结构

- `dream-memory-mcp/` — MCP Server 核心，修改工具逻辑在这里
- `dashboard/` — Next.js Dashboard，修改 UI 在这里
- `scripts/` — Cron/同步脚本
- `.codebuddy/skills/` — CodeBuddy Skill 定义

## 测试

```bash
cd dream-memory-mcp && npm test
cd ../scripts && npm test
```

## 注意事项

- 不要提交个人记忆数据（`*.db` 已在 `.gitignore`）
- 不要提交 API Key 或 Token
- Dashboard 的 `better-sqlite3` 需要与运行时 Node 版本匹配（`npm rebuild`）
