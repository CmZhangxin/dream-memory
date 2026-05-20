#!/bin/bash
# ============================================================
#  Dream Memory 一键停止脚本
#  用法：./stop.sh
# ============================================================

DASHBOARD_PORT=3002
MEMORY_PORT=8420
CRON_PID_FILE="${HOME}/.dream-memory/cron-runner.pid"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}"
echo "  ╔══════════════════════════════════════╗"
echo "  ║     🛑 Dream Memory 停止器           ║"
echo "  ╚══════════════════════════════════════╝"
echo -e "${NC}"

stop_by_port() {
  local port=$1
  local label=$2
  local pids=$(lsof -ti :"$port" 2>/dev/null)
  if [ -z "$pids" ]; then
    echo -e "${YELLOW}ℹ️  ${label} (端口 ${port}) 未运行${NC}"
    return
  fi
  echo -e "${GREEN}🔍 停止 ${label} (PID: ${pids})${NC}"
  for pid in $pids; do kill "$pid" 2>/dev/null; done
  sleep 2
  # 强杀残留
  local still=$(lsof -ti :"$port" 2>/dev/null)
  if [ -n "$still" ]; then
    for pid in $still; do kill -9 "$pid" 2>/dev/null; done
  fi
  echo -e "${GREEN}✅ ${label} 已停止${NC}"
}

stop_cron() {
  if [ ! -f "$CRON_PID_FILE" ]; then
    echo -e "${YELLOW}ℹ️  Cron-runner 未运行${NC}"
    return
  fi
  local pid=$(cat "$CRON_PID_FILE" 2>/dev/null)
  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
    echo -e "${GREEN}🔍 停止 Cron-runner (PID ${pid})${NC}"
    kill "$pid" 2>/dev/null
    sleep 1
    kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null
    echo -e "${GREEN}✅ Cron-runner 已停止${NC}"
  fi
  rm -f "$CRON_PID_FILE"
}

main() {
  stop_cron
  stop_by_port "$DASHBOARD_PORT" "Dashboard"
  stop_by_port "$MEMORY_PORT" "Memory Gateway"

  # 清理残留
  pgrep -f "cron-runner.ts" 2>/dev/null | xargs kill 2>/dev/null || true

  echo ""
  echo -e "${GREEN}🎉 全部服务已停止${NC}"
}

main "$@"
