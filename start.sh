#!/bin/bash
# ============================================================
#  Dream Memory 一键启动脚本
#  功能：启动 Memory Gateway + Cron-runner + Dashboard
#  用法：./start.sh
# ============================================================

set -e

# ─── 配置 ──────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DASHBOARD_DIR="${SCRIPT_DIR}/dashboard"
DASHBOARD_PORT=3002
DASHBOARD_URL="http://localhost:${DASHBOARD_PORT}"

MEMORY_REPO_DIR="${HOME}/.dream-memory/tdai-memory-openclaw-plugin"
MEMORY_PORT=8420

CRON_ENABLED="${CRON_ENABLED:-true}"
CRON_SCHEDULE="${CRON_SCHEDULE:-0 23 * * *}"
CRON_TIMEZONE="${CRON_TIMEZONE:-Asia/Shanghai}"
SCRIPTS_DIR="${SCRIPT_DIR}/scripts"
CRON_LOG_FILE="${HOME}/.dream-memory/cron.log"
CRON_PID_FILE="${HOME}/.dream-memory/cron-runner.pid"

# ─── 颜色 ──────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}"
echo "  ╔══════════════════════════════════════╗"
echo "  ║     🧠 Dream Memory 启动器           ║"
echo "  ╚══════════════════════════════════════╝"
echo -e "${NC}"

# ─── Node.js 版本检查（需要 22+） ──────────────
NODE_MAJOR=$(node -e "console.log(process.versions.node.split('.')[0])" 2>/dev/null || echo "0")
if [ "$NODE_MAJOR" -lt 22 ]; then
  if [ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]; then
    echo -e "${YELLOW}⚙️  当前 Node $(node -v)，切换到 Node 22...${NC}"
    export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
    . "$NVM_DIR/nvm.sh"
    nvm use 22 2>/dev/null || nvm use --lts 2>/dev/null || true
  fi
  NODE_MAJOR=$(node -e "console.log(process.versions.node.split('.')[0])" 2>/dev/null || echo "0")
  if [ "$NODE_MAJOR" -lt 22 ]; then
    echo -e "${RED}❌ 需要 Node.js >= 22（当前: $(node -v 2>/dev/null || echo '未安装')）${NC}"
    exit 1
  fi
fi
echo -e "${GREEN}✓ Node.js $(node -v)${NC}"

# ─── 通用：按端口杀进程 ─────────────────────────
kill_port() {
  local port=$1
  local label=$2
  local pid=$(lsof -ti :$port 2>/dev/null | head -1)
  if [ -n "$pid" ]; then
    echo -e "${YELLOW}🔄 清理 ${label} 旧进程 (PID: $pid)...${NC}"
    kill "$pid" 2>/dev/null || true
    sleep 1
  fi
}

# ─── 启动 Memory Gateway ──────────────────────
launch_memory() {
  if curl -s "http://localhost:${MEMORY_PORT}/health" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Memory Gateway 已在运行 (端口 ${MEMORY_PORT})${NC}"
    return
  fi

  if [ ! -d "$MEMORY_REPO_DIR" ]; then
    echo -e "${RED}❌ Memory Gateway 未安装: ${MEMORY_REPO_DIR}${NC}"
    echo -e "${YELLOW}请先克隆 TencentDB-Agent-Memory 到该路径${NC}"
    exit 1
  fi

  echo -e "${GREEN}🚀 启动 Memory Gateway (端口 ${MEMORY_PORT})...${NC}"
  kill_port "$MEMORY_PORT" "Memory Gateway"
  cd "$MEMORY_REPO_DIR"
  nohup node --import tsx src/gateway/server.ts > "${HOME}/.dream-memory/gateway.log" 2>&1 &
  cd - > /dev/null

  # 等待就绪
  for i in $(seq 1 20); do
    if curl -s "http://localhost:${MEMORY_PORT}/health" >/dev/null 2>&1; then
      echo -e "${GREEN}✅ Memory Gateway 就绪${NC}"
      return
    fi
    sleep 0.5
  done
  echo -e "${YELLOW}⚠️  Memory Gateway 启动超时，请检查日志${NC}"
}

# ─── 启动 Cron-runner ─────────────────────────
launch_cron() {
  if [ "$CRON_ENABLED" != "true" ]; then
    echo -e "${YELLOW}ℹ️  Cron-runner 已禁用${NC}"
    return
  fi

  # 停止旧的
  if [ -f "$CRON_PID_FILE" ]; then
    local old_pid=$(cat "$CRON_PID_FILE" 2>/dev/null)
    if [ -n "$old_pid" ] && kill -0 "$old_pid" 2>/dev/null; then
      echo -e "${YELLOW}🔄 清理 Cron-runner 旧进程 (PID: $old_pid)...${NC}"
      kill "$old_pid" 2>/dev/null
      # 等待旧进程完全退出，避免 PID 锁竞态
      for i in $(seq 1 10); do
        kill -0 "$old_pid" 2>/dev/null || break
        sleep 0.5
      done
    fi
    rm -f "$CRON_PID_FILE"
  fi

  mkdir -p "$(dirname "$CRON_LOG_FILE")"
  cd "$SCRIPTS_DIR"
  if [ ! -d "node_modules" ]; then
    npm install --silent
  fi
  # 注意: 不在外部写 PID 文件，由 cron-runner 内部 acquireLock 管理
  CRON_SCHEDULE="$CRON_SCHEDULE" CRON_TIMEZONE="$CRON_TIMEZONE" \
    nohup npx tsx src/cron-runner.ts >> "$CRON_LOG_FILE" 2>&1 &
  local runner_pid=$!
  cd - > /dev/null
  sleep 2
  if kill -0 "$runner_pid" 2>/dev/null; then
    echo -e "${GREEN}✅ Cron-runner 已启动 (PID $runner_pid)${NC}"
  else
    echo -e "${YELLOW}⚠️  Cron-runner 启动失败，详见: ${CRON_LOG_FILE}${NC}"
  fi
}

# ─── 启动 Dashboard ───────────────────────────
launch_dashboard() {
  if curl -s "http://localhost:${DASHBOARD_PORT}" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Dashboard 已在运行: ${CYAN}${DASHBOARD_URL}${NC}"
    return
  fi

  cd "$DASHBOARD_DIR"
  if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 安装 Dashboard 依赖...${NC}"
    npm install --silent
  fi

  echo -e "${GREEN}🚀 启动 Dashboard (端口 ${DASHBOARD_PORT})...${NC}"
  npm run dev &
  DASH_PID=$!

  for i in $(seq 1 30); do
    if curl -s "http://localhost:${DASHBOARD_PORT}" >/dev/null 2>&1; then
      echo -e "${GREEN}✅ Dashboard 就绪: ${CYAN}${DASHBOARD_URL}${NC}"
      return
    fi
    sleep 0.5
  done
  echo -e "${RED}❌ Dashboard 启动超时${NC}"
}

# ─── 主流程 ────────────────────────────────────
main() {
  launch_memory
  launch_cron
  launch_dashboard

  echo ""
  echo -e "${GREEN}═══════════════════════════════════════${NC}"
  echo -e "  ${GREEN}🎉 Dream Memory 全部启动完成！${NC}"
  echo ""
  echo -e "  Dashboard:      ${CYAN}${DASHBOARD_URL}${NC}"
  echo -e "  Memory Gateway: ${CYAN}http://localhost:${MEMORY_PORT}${NC}"
  echo -e "  Cron:           ${CYAN}${CRON_SCHEDULE} (${CRON_TIMEZONE})${NC}"
  echo ""
  echo -e "  ${YELLOW}提示: 按 Ctrl+C 停止所有服务${NC}"
  echo -e "${GREEN}═══════════════════════════════════════${NC}"
  echo ""
  wait
}

trap 'echo -e "\n${YELLOW}👋 正在关闭...${NC}"; kill_port $DASHBOARD_PORT Dashboard; kill_port $MEMORY_PORT "Memory Gateway"; exit 0' INT TERM

main "$@"
