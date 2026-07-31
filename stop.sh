#!/bin/bash
set -euo pipefail

# ── Flags ────────────────────────────────────────────────────────────────────
MODE="dev"
CLEAN=false

for arg in "$@"; do
  case $arg in
    --prod)  MODE="prod" ;;
    --dev)   MODE="dev" ;;
    --clean) CLEAN=true ;;
    --help|-h)
      echo "Uso: ./stop.sh [--dev|--prod] [--clean]"
      echo ""
      echo "  --dev    Para modo desenvolvimento (padrão)"
      echo "  --prod   Para modo produção"
      echo "  --clean  Remove volumes Docker (apaga dados do banco — irreversível)"
      exit 0 ;;
  esac
done

# ── Cores ────────────────────────────────────────────────────────────────────
B='\033[0;34m'; G='\033[0;32m'; Y='\033[1;33m'; R='\033[0;31m'; N='\033[0m'; BOLD='\033[1m'
log()  { echo -e "${B}▸${N} $1"; }
ok()   { echo -e "${G}✔${N} $1"; }
warn() { echo -e "${Y}⚠${N}  $1"; }
err()  { echo -e "${R}✖${N}  $1"; exit 1; }
sep()  { echo -e "${B}────────────────────────────────────────${N}"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

sep
echo -e "${BOLD}  Ateliê de Costura — Parando$( [ "$CLEAN" = true ] && echo " + limpando volumes" || echo "" )${N}"
sep

# ── Aviso de limpeza ──────────────────────────────────────────────────────────
if [ "$CLEAN" = true ]; then
  echo -e "${R}${BOLD}  ATENÇÃO: --clean remove todos os volumes Docker.${N}"
  echo -e "${R}  Os dados do banco de dados serão PERDIDOS permanentemente.${N}"
  echo ""
  read -p "  Confirmar? Digite 'sim' para continuar: " confirm
  [[ "$confirm" != "sim" ]] && { warn "Cancelado."; exit 0; }
  echo ""
fi

# ═════════════════════════════════════════════════════════════════════════════
# PRODUÇÃO
# ═════════════════════════════════════════════════════════════════════════════
if [ "$MODE" = "prod" ]; then
  log "Parando containers de produção..."
  if [ "$CLEAN" = true ]; then
    docker compose down -v --remove-orphans
    ok "Containers parados e volumes removidos"
  else
    docker compose down --remove-orphans
    ok "Containers parados (dados preservados)"
  fi
  sep
  exit 0
fi

# ═════════════════════════════════════════════════════════════════════════════
# DESENVOLVIMENTO
# ═════════════════════════════════════════════════════════════════════════════

# 1. Para servidores dev
log "Parando servidores de desenvolvimento..."

STOPPED_DEV=false

if [ -f .dev.pid ]; then
  DEV_PID=$(cat .dev.pid)
  if kill -0 "$DEV_PID" 2>/dev/null; then
    kill "$DEV_PID" 2>/dev/null || true
    # aguarda até 5s pelo encerramento limpo
    for i in $(seq 1 5); do
      kill -0 "$DEV_PID" 2>/dev/null || break
      sleep 1
    done
    # força se ainda vivo
    kill -9 "$DEV_PID" 2>/dev/null || true
    ok "Servidor dev parado (PID $DEV_PID)"
    STOPPED_DEV=true
  else
    warn "PID $DEV_PID não encontrado (já estava parado)"
  fi
  rm -f .dev.pid
fi

# Garante que não sobrou nada
pkill -f "nest start" 2>/dev/null && { ok "Processo NestJS encerrado"; STOPPED_DEV=true; } || true
pkill -f "vite"       2>/dev/null && { ok "Processo Vite encerrado";   STOPPED_DEV=true; } || true
pkill -f "concurrently" 2>/dev/null || true

[ "$STOPPED_DEV" = false ] && warn "Nenhum servidor dev estava rodando"

# 2. Para infraestrutura
log "Parando infraestrutura Docker..."
if [ "$CLEAN" = true ]; then
  docker compose -f docker-compose.dev.yml down -v --remove-orphans
  ok "Containers parados e volumes removidos"
else
  docker compose -f docker-compose.dev.yml down --remove-orphans
  ok "Containers parados (dados preservados)"
fi

# Limpa log de dev se --clean
if [ "$CLEAN" = true ]; then
  rm -f .dev.log
  ok "Log de dev removido"
fi

sep
ok "Sistema parado"
[ "$CLEAN" = false ] && echo -e "  Dica: ${Y}./stop.sh --clean${N} remove os volumes do banco"
sep
