#!/bin/bash
set -euo pipefail

# ── Flags ────────────────────────────────────────────────────────────────────
MODE="dev"
WITH_SEED=false
WITH_TOOLS=false

for arg in "$@"; do
  case $arg in
    --prod)  MODE="prod" ;;
    --dev)   MODE="dev" ;;
    --seed)  WITH_SEED=true ;;
    --tools) WITH_TOOLS=true ;;
    --help|-h)
      echo "Uso: ./start.sh [--dev|--prod] [--seed] [--tools]"
      echo ""
      echo "  --dev    Infra no Docker + backend/frontend locais (padrão)"
      echo "  --prod   Compila no host e sobe tudo no Docker"
      echo "  --seed   Roda o seed após as migrations"
      echo "  --tools  Inclui PgAdmin"
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

# ── Pré-checagens ─────────────────────────────────────────────────────────────
command -v docker >/dev/null 2>&1 || err "Docker não encontrado.
     Instale com:  curl -fsSL https://get.docker.com | sudo sh"

# "daemon não responde" tem causas diferentes e soluções diferentes: distinguir
# aqui evita a caça ao erro no servidor.
if ! DOCKER_ERR="$(docker info 2>&1 >/dev/null)"; then
  if echo "$DOCKER_ERR" | grep -qi "permission denied"; then
    err "Sem permissão para falar com o Docker.
     Seu usuário ($USER) não está no grupo 'docker'. Resolva com:
       sudo usermod -aG docker $USER
     e DEPOIS saia e entre de novo na sessão (ou rode: newgrp docker)."
  elif systemctl list-unit-files docker.service >/dev/null 2>&1; then
    err "O serviço do Docker está parado. Inicie com:
       sudo systemctl start docker
       sudo systemctl enable docker   # para subir sozinho no boot"
  else
    err "Não foi possível falar com o Docker:
       $DOCKER_ERR"
  fi
fi

[ -f .env ] && export $(grep -v '^#' .env | grep -v '^$' | xargs) 2>/dev/null || true

sep
echo -e "${BOLD}  Ateliê de Costura — $( [ "$MODE" = "prod" ] && echo "Produção" || echo "Desenvolvimento" )${N}"
sep

# ═════════════════════════════════════════════════════════════════════════════
# PRODUÇÃO
# ═════════════════════════════════════════════════════════════════════════════
if [ "$MODE" = "prod" ]; then
  # Sem .env o docker-compose cai nos valores padrão embutidos — inclusive um
  # JWT_SECRET que está publicado no repositório. O sistema sobe e parece
  # normal, mas qualquer pessoa consegue forjar um login de administrador.
  if [ ! -f .env ]; then
    err "Não há arquivo .env — subir assim usaria as senhas padrão do repositório.
     Gere um com segredos aleatórios:
       ./setup-env.sh"
  fi

  INSECURE=""
  case "${JWT_SECRET:-}" in ''|*change_me*) INSECURE="$INSECURE JWT_SECRET" ;; esac
  case "${JWT_REFRESH_SECRET:-}" in ''|*change_me*) INSECURE="$INSECURE JWT_REFRESH_SECRET" ;; esac
  [ "${POSTGRES_PASSWORD:-}" = "atelie123" ] && INSECURE="$INSECURE POSTGRES_PASSWORD"
  [ "${REDIS_PASSWORD:-}" = "redis123" ] && INSECURE="$INSECURE REDIS_PASSWORD"
  [ "${MINIO_ROOT_PASSWORD:-}" = "minio123456" ] && INSECURE="$INSECURE MINIO_ROOT_PASSWORD"

  if [ -n "$INSECURE" ]; then
    err "Estes valores ainda são os padrão do repositório:$INSECURE
     Qualquer pessoa que conheça o projeto consegue entrar no sistema.
     Gere segredos novos com:
       ./setup-env.sh"
  fi

  case "${FRONTEND_URL:-}" in
    *localhost*|*127.0.0.1*|'')
      warn "FRONTEND_URL está como '${FRONTEND_URL:-vazio}'."
      warn "O link do orçamento enviado por WhatsApp não vai abrir no celular da cliente."
      ;;
  esac

  PROFILES=""
  [ "$WITH_TOOLS" = true ] && PROFILES="--profile tools"

  # Os containers não compilam nada: eles montam os artefatos do host.
  # dist/ e node_modules/ são gitignored, então um clone/pull limpo não os traz
  # e o nginx serviria um diretório vazio (403).
  command -v npm >/dev/null 2>&1 || err "npm não encontrado — o build de produção é feito no host.
     Instale as dependências do sistema com:
       ./install-deps.sh"

  # Não basta o node_modules existir: o .env exportado acima traz
  # NODE_ENV=production, e com ele o npm pula as devDependencies — que é onde
  # moram nest, tsc e vite. Um node_modules assim quebra o build com
  # "nest: not found". Por isso conferimos os binários, não a pasta.
  NEED_INSTALL=false
  for BIN in nest tsc vite; do
    [ -x "node_modules/.bin/$BIN" ] || NEED_INSTALL=true
  done

  if [ "$NEED_INSTALL" = true ]; then
    # Sem lockfile o `npm ci` só cospe o texto de ajuda do comando, que não
    # explica nada. O arquivo é versionado, então normalmente é só restaurar.
    if [ ! -f package-lock.json ]; then
      err "package-lock.json não existe — o npm ci não tem como rodar.
     Ele é versionado; restaure com:
       git checkout -- package-lock.json"
    fi

    # Restos de instalação interrompida (.pacote-XXXX) fazem o npm morrer com
    # ENOTEMPTY; nesse caso o node_modules precisa ser refeito do zero.
    if ls node_modules/.*-* >/dev/null 2>&1; then
      warn "node_modules tem restos de uma instalação interrompida — refazendo do zero."
      rm -rf node_modules
    fi
    log "Instalando dependências de build (pode demorar na primeira vez)..."
    NODE_ENV=development npm ci --include=dev || err "npm ci falhou — veja o erro acima."
    for BIN in nest tsc vite; do
      [ -x "node_modules/.bin/$BIN" ] || err "$BIN continua ausente após o npm ci — build impossível."
    done
  fi

  log "Compilando backend e frontend no host..."
  npm run build || err "Build falhou — veja o erro acima."

  # O container usa o node_modules do host, incluindo os engines do Prisma
  log "Gerando Prisma Client..."
  npm run prisma:generate --workspace=backend >/dev/null || err "prisma generate falhou."

  [ -f frontend/dist/index.html ] || err "frontend/dist/index.html não foi gerado — build incompleto."
  [ -f backend/dist/src/main.js ] || err "backend/dist/src/main.js não foi gerado — build incompleto."

  log "Subindo os containers..."
  docker compose $PROFILES up -d

  log "Aguardando backend ficar saudável..."
  for i in $(seq 1 60); do
    STATUS=$(docker inspect --format='{{.State.Health.Status}}' atelie_backend 2>/dev/null || echo "starting")
    [ "$STATUS" = "healthy" ] && break
    # sem healthcheck no backend — espera só o postgres
    if docker exec atelie_postgres pg_isready -U "${POSTGRES_USER:-atelie}" -q 2>/dev/null; then
      sleep 5 && break
    fi
    [ $i -eq 60 ] && warn "Timeout aguardando — verifique: docker compose logs backend"
    sleep 2
  done

  # Respeita HTTP_PORT do .env — em máquina com a 80 ocupada a URL muda
  BASE="http://localhost"
  [ "${HTTP_PORT:-80}" != "80" ] && BASE="http://localhost:${HTTP_PORT}"

  sep
  ok "Sistema em produção"
  ok "App:     $BASE"
  ok "API:     $BASE/api"
  ok "Swagger: $BASE/docs"
  [ "$WITH_TOOLS" = true ] && ok "PgAdmin: http://localhost:5050"
  sep
  echo -e "  Logs: ${Y}docker compose logs -f${N}"
  echo -e "  Para parar: ${Y}./stop.sh --prod${N}"
  sep
  exit 0
fi

# ═════════════════════════════════════════════════════════════════════════════
# DESENVOLVIMENTO
# ═════════════════════════════════════════════════════════════════════════════
command -v node >/dev/null 2>&1 || err "Node.js não encontrado"
command -v npm  >/dev/null 2>&1 || err "npm não encontrado"

PROFILES=""
[ "$WITH_TOOLS" = true ] && PROFILES="--profile tools"

# 1. Checagem de portas
check_port() {
  local port=$1 name=$2
  if ss -tlnp "sport = :$port" 2>/dev/null | grep -q ":$port" || \
     lsof -i ":$port" -sTCP:LISTEN -t 2>/dev/null | grep -q .; then
    # Verifica se é um container Docker nosso
    local container
    container=$(docker ps --format '{{.Names}}' 2>/dev/null | grep "^atelie_" | head -1 || true)
    if [ -z "$container" ]; then
      err "Porta $port ($name) já está em uso por outro processo.\nPare o serviço e tente novamente, ou mude a porta no .env e docker-compose.dev.yml"
    fi
  fi
}

log "Checando portas..."
check_port 5432 "PostgreSQL"
check_port 6380 "Redis"
check_port 9000 "MinIO"

# Remove containers anteriores que possam ter ficado presos (inclusive com porta antiga)
docker compose -f docker-compose.dev.yml down --remove-orphans 2>/dev/null || true
docker rm -f atelie_postgres atelie_redis atelie_minio atelie_pgadmin 2>/dev/null || true

# 1. Infra
log "Subindo infraestrutura (postgres, redis, minio)..."
docker compose -f docker-compose.dev.yml $PROFILES up -d
ok "Containers iniciados"

# 2. Aguarda Postgres
log "Aguardando PostgreSQL..."
for i in $(seq 1 45); do
  if docker exec atelie_postgres pg_isready -U "${POSTGRES_USER:-atelie}" -q 2>/dev/null; then
    ok "PostgreSQL pronto"
    break
  fi
  [ $i -eq 45 ] && err "PostgreSQL não respondeu em 45s — veja: docker compose -f docker-compose.dev.yml logs postgres"
  sleep 1
done

# 3. Instala/atualiza dependências
# Uma instalação interrompida deixa diretórios temporários (.pacote-XXXX) que
# fazem o npm seguinte morrer com ENOTEMPTY. Nesse caso não dá para instalar
# por cima: o node_modules precisa ser refeito.
if ls node_modules/.*-* >/dev/null 2>&1; then
  warn "node_modules tem restos de uma instalação interrompida — refazendo do zero."
  rm -rf node_modules
fi

log "Instalando/atualizando dependências..."
NODE_ENV=development npm install --include=dev || err "npm install falhou — veja o erro acima."
ok "Dependências atualizadas"

# 4. Gera cliente Prisma
log "Gerando cliente Prisma..."
(cd backend && npx prisma generate --silent 2>/dev/null || npx prisma generate)
ok "Cliente Prisma gerado"

# 5. Migrations
log "Aplicando migrations..."
if (cd backend && npx prisma migrate deploy 2>&1 | tee /tmp/atelie_migrate.log | grep -q "error\|Error"); then
  warn "Problema nas migrations — veja /tmp/atelie_migrate.log"
else
  ok "Migrations aplicadas"
fi

# 6. Seed (opcional)
if [ "$WITH_SEED" = true ]; then
  log "Rodando seed..."
  if (cd backend && npx prisma db seed 2>&1 | tee /tmp/atelie_seed.log | grep -q "error\|Error"); then
    warn "Problema no seed — veja /tmp/atelie_seed.log"
  else
    ok "Seed concluído"
  fi
fi

# 7. Inicia servidores dev
log "Iniciando backend (NestJS) e frontend (Vite)..."
npm run dev > .dev.log 2>&1 &
DEV_PID=$!
echo "$DEV_PID" > .dev.pid

# Aguarda uns segundos para checar se não crashou
sleep 4
if ! kill -0 "$DEV_PID" 2>/dev/null; then
  err "Servidores não iniciaram — veja .dev.log"
fi
ok "Servidores iniciados (PID $DEV_PID)"

sep
ok "Sistema em desenvolvimento"
ok "Frontend: http://localhost:5173"
ok "Backend:  http://localhost:3001/api"
ok "Swagger:  http://localhost:3001/docs"
ok "MinIO:    http://localhost:9001"
[ "$WITH_TOOLS" = true ] && ok "PgAdmin:  http://localhost:5050"
sep
echo -e "  Logs: ${Y}tail -f .dev.log${N}"
echo -e "  Para parar: ${Y}./stop.sh${N}"
sep
