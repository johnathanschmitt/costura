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

# ── Dependências ─────────────────────────────────────────────────────────────
#
# Uma instalação interrompida deixa diretórios temporários dentro do
# node_modules e o npm seguinte morre com ENOTEMPTY. Só que os metadados normais
# do npm (.bin, .package-lock.json, .prisma) também começam com ponto: a
# checagem antiga (`ls node_modules/.*-*`) casava com `.package-lock.json` e
# apagava o node_modules inteiro em TODA execução, quando era só para atualizar.
#
# Agora nada é apagado por precaução: instala normalmente e, se o npm falhar
# reclamando de resto de instalação, aí sim refaz do zero e tenta de novo.
npm_install() {
  local titulo="$1"; shift
  local log=/tmp/atelie_npm.log

  log "$titulo"
  if NODE_ENV=development npm "$@" 2>&1 | tee "$log"; then
    return 0
  fi

  if grep -qE "ENOTEMPTY|EEXIST|ENOENT: no such file or directory, rename" "$log"; then
    warn "A instalação esbarrou em restos de uma instalação anterior — refazendo o node_modules do zero."
    rm -rf node_modules
    log "$titulo (segunda tentativa)"
    NODE_ENV=development npm "$@" && return 0
  fi

  return 1
}

# ── Migrations ───────────────────────────────────────────────────────────────
# O Prisma registra cada migration aplicada em _prisma_migrations, com o nome
# da pasta como versão. Comparar essa tabela com as pastas do repositório diz
# exatamente o que falta rodar — bem melhor do que "deu erro?" no texto de saída
# ou contar tabelas, que não percebe um banco parado numa versão antiga.
MIGRATIONS_DIR="backend/prisma/migrations"

psql_db() {
  docker exec atelie_postgres psql -U "${POSTGRES_USER:-atelie}" -d "${POSTGRES_DB:-atelie}" -tAc "$1" 2>/dev/null || true
}

# Versões versionadas no repositório, em ordem cronológica (o nome começa com timestamp).
migrations_locais() {
  local d
  for d in "$MIGRATIONS_DIR"/*/; do
    if [ -f "$d/migration.sql" ]; then basename "$d"; fi
  done | sort
}

# Versões já registradas no banco. Sai vazio quando a tabela ainda não existe
# (banco novo) ou quando o postgres não está no ar.
migrations_aplicadas() {
  psql_db "select migration_name from _prisma_migrations where finished_at is not null and rolled_back_at is null;" | sed '/^$/d' | sort
}

# No repositório e ainda não no banco.
migrations_pendentes() {
  comm -23 <(migrations_locais) <(migrations_aplicadas)
}

# No banco e não no repositório — código mais antigo que o banco.
migrations_desconhecidas() {
  comm -13 <(migrations_locais) <(migrations_aplicadas)
}

historico_de_migrations_existe() {
  [ -n "$(psql_db "select to_regclass('public._prisma_migrations');")" ]
}

banco_tem_tabelas() {
  local n
  n="$(psql_db "select count(*) from information_schema.tables where table_schema='public';")"
  [ "${n:-0}" -gt 0 ]
}

# Banco com tabelas mas sem histórico: o migrate deploy aborta (P3005) porque não
# sabe o que já existe. Só o operador pode dizer quais versões já estão lá.
aborta_se_banco_sem_historico() {
  if ! historico_de_migrations_existe && banco_tem_tabelas; then
    err "O banco tem tabelas mas nenhum histórico de migrations (_prisma_migrations).
     O Prisma não consegue adivinhar em que versão ele está e recusa aplicar.
     Marque como já aplicadas as versões que o banco tem, da mais antiga para a mais nova:
$(migrations_locais | sed 's/^/       npx prisma migrate resolve --applied /')"
  fi
}

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

# Os contêineres têm `restart: unless-stopped` e voltam sozinhos depois de um
# reboot — mas só se o daemon do Docker também subir no boot. Sem isso, a
# máquina reinicia e o sistema fica fora do ar até alguém entrar no servidor.
if command -v systemctl >/dev/null 2>&1 \
  && systemctl list-unit-files docker.service >/dev/null 2>&1 \
  && [ "$(systemctl is-enabled docker.service 2>/dev/null || true)" != "enabled" ]; then
  warn "O Docker não está habilitado no boot: se a máquina reiniciar, nada sobe sozinho. Corrija com:"
  warn "  sudo systemctl enable docker"
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

  # Os três binários existirem não prova que a árvore bate com o lockfile: um
  # node_modules instalado antes de o package.json ganhar uma dependência
  # continua tendo nest, tsc e vite — e o build morre lá na frente reclamando
  # de um pacote que ninguém percebeu que faltava.
  #
  # O npm reescreve node_modules/.package-lock.json a cada instalação, então
  # comparar as datas responde "esta árvore é anterior ao lockfile atual?".
  if [ "$NEED_INSTALL" = false ]; then
    if [ ! -f node_modules/.package-lock.json ] \
      || [ package-lock.json -nt node_modules/.package-lock.json ]; then
      warn "O package-lock.json mudou desde a última instalação — reinstalando."
      NEED_INSTALL=true
    fi
  fi

  if [ "$NEED_INSTALL" = true ]; then
    # Sem lockfile o `npm ci` só cospe o texto de ajuda do comando, que não
    # explica nada. O arquivo é versionado, então normalmente é só restaurar.
    # Sem lockfile o `npm ci` só cospe o texto de ajuda do comando. Como o
    # arquivo é versionado, dá para restaurar sozinho em vez de abortar.
    if [ ! -f package-lock.json ]; then
      if git cat-file -e HEAD:package-lock.json 2>/dev/null; then
        warn "package-lock.json estava faltando — restaurando do git."
        git checkout -- package-lock.json || err "Falha ao restaurar package-lock.json."
      else
        err "package-lock.json não existe e não está no git — o npm ci não tem como rodar."
      fi
    fi

    npm_install "Instalando dependências de build (pode demorar na primeira vez)..." \
      ci --include=dev || err "npm ci falhou — veja o erro acima."
    for BIN in nest tsc vite; do
      [ -x "node_modules/.bin/$BIN" ] || err "$BIN continua ausente após o npm ci — build impossível."
    done
  fi

  # Quando um bind mount não existe no host, o Docker cria o diretório como
  # root. Se um `up` rodar antes do build (ou falhar antes dele), frontend/dist
  # nasce root e o vite morre depois com EACCES ao gravar dentro. Criar aqui,
  # antes de qualquer `docker compose up`, evita isso.
  for D in frontend/dist backend/dist; do
    if [ -d "$D" ] && [ ! -w "$D" ]; then
      warn "$D pertence a outro usuário (criado pelo Docker) — removendo."
      rmdir "$D" 2>/dev/null || err "Não foi possível remover $D — ele não está vazio.
     Remova manualmente e rode de novo:
       sudo rm -rf $D"
    fi
    mkdir -p "$D" || err "Não foi possível criar $D."
  done

  # Precisa vir ANTES do build: o backend importa tipos de @prisma/client
  # (Prisma.WorkOrderUpdateInput, Prisma.Decimal, ...) que só existem depois de
  # gerar o client. Sem isto o tsc falha com dezenas de TS2694 num node_modules
  # recém-instalado. Também é o que produz os engines nativos que o contêiner monta.
  log "Gerando Prisma Client..."
  npm run prisma:generate --workspace=backend >/dev/null || err "prisma generate falhou."

  log "Compilando backend e frontend no host..."
  npm run build || err "Build falhou — veja o erro acima."

  [ -f frontend/dist/index.html ] || err "frontend/dist/index.html não foi gerado — build incompleto."
  [ -f backend/dist/src/main.js ] || err "backend/dist/src/main.js não foi gerado — build incompleto."

  log "Subindo os containers..."
  docker compose $PROFILES up -d || err "docker compose up falhou — veja o erro acima."

  # O backend não compila nada: ele monta backend/dist do host. Para o Docker,
  # trocar o conteúdo de um bind mount não é mudança de configuração — o
  # `up -d` vê o container igual ao que já está no ar e deixa como está.
  #
  # O resultado é o pior tipo de deploy: tudo verde, nginx servindo o frontend
  # novo (esse é arquivo estático, lido a cada request) e o backend ainda
  # rodando o processo antigo. As telas novas chamam endpoints que "não
  # existem" e ninguém entende por quê.
  #
  # O restart é barato e idempotente: o CMD reaplica as migrations e sobe o
  # main.js recém-compilado.
  log "Reiniciando o backend para carregar o código novo..."
  docker compose restart backend >/dev/null \
    || err "Não foi possível reiniciar o backend — veja: docker compose logs backend"

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

  # As migrations rodam no CMD do container do backend, mas quando ele falha (ou
  # sobe antes do banco aceitar conexão) o banco fica atrasado e as telas novas
  # respondem 500 — antes o script anunciava "sistema em produção" mesmo assim.
  # Aqui a versão do banco é lida de _prisma_migrations e o que faltar é aplicado.
  PENDENTES="$(migrations_pendentes)"
  DESCONHECIDAS="$(migrations_desconhecidas)"

  if [ -n "$DESCONHECIDAS" ]; then
    warn "O banco tem migrations que não existem neste código — ele está mais novo que o repositório:"
    echo "$DESCONHECIDAS" | sed 's/^/       • /'
    warn "Faça um git pull antes de seguir, ou o backend vai rodar contra um schema à frente dele."
  fi

  if [ -n "$PENDENTES" ]; then
    aborta_se_banco_sem_historico
    log "Migrations que faltam no banco:"
    echo "$PENDENTES" | sed 's/^/    • /'
    # Container avulso: o backend pode ter morrido justamente por causa disso.
    docker compose run --rm --no-deps -T backend npx prisma migrate deploy \
      || err "Falha ao aplicar as migrations — veja o erro acima.
     Se alguma ficou marcada como falha, resolva antes de tentar de novo:
       docker compose run --rm --no-deps backend npx prisma migrate resolve --rolled-back <versão>"

    RESTANTES="$(migrations_pendentes)"
    if [ -n "$RESTANTES" ]; then
      err "Estas migrations continuam sem registro no banco:
$(echo "$RESTANTES" | sed 's/^/       • /')"
    fi
    ok "Migrations aplicadas — banco na versão $(migrations_locais | tail -1)"

    # O backend pode ter saído ao subir contra o banco desatualizado.
    docker compose up -d backend >/dev/null || err "Falha ao reiniciar o backend."
  else
    ok "Banco já está na última migration ($(migrations_locais | tail -1))"
  fi

  # Banco vazio não tem usuário nenhum e ninguém consegue entrar. O bootstrap
  # cria só permissões, papéis e um admin — sem os dados de demonstração do seed.
  USUARIOS=$(docker exec atelie_postgres psql -U "${POSTGRES_USER:-atelie}" -d "${POSTGRES_DB:-atelie}" -tAc \
    "select count(*) from users;" 2>/dev/null || echo 0)

  if [ "${USUARIOS:-0}" -eq 0 ]; then
    log "Banco sem usuários — criando administrador inicial..."
    docker compose exec -T backend node dist/prisma/bootstrap.js \
      || warn "Bootstrap falhou — crie o admin manualmente:
     docker compose exec backend node dist/prisma/bootstrap.js"
  fi

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
./stop.sh --dev
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
npm_install "Instalando/atualizando dependências..." \
  install --include=dev || err "npm install falhou — veja o erro acima."
ok "Dependências atualizadas"

# 4. Gera cliente Prisma
log "Gerando cliente Prisma..."
(cd backend && npx prisma generate --silent 2>/dev/null || npx prisma generate)
ok "Cliente Prisma gerado"

# 5. Migrations
# Compara as pastas do repositório com o que está registrado em _prisma_migrations:
# aplica só o que falta e confere depois se entrou mesmo. O grep por "error" na
# saída anterior tanto deixava passar falha quanto acusava erro em migration
# cujo SQL tivesse a palavra.
PENDENTES="$(migrations_pendentes)"
DESCONHECIDAS="$(migrations_desconhecidas)"

if [ -n "$DESCONHECIDAS" ]; then
  warn "O banco tem migrations que não existem neste código (branch antiga ou revertida):"
  echo "$DESCONHECIDAS" | sed 's/^/    • /'
fi

if [ -z "$PENDENTES" ]; then
  ok "Banco já está na última migration ($(migrations_locais | tail -1))"
else
  aborta_se_banco_sem_historico
  log "Aplicando migrations que faltam no banco:"
  echo "$PENDENTES" | sed 's/^/    • /'
  if (cd backend && npx prisma migrate deploy) > /tmp/atelie_migrate.log 2>&1; then
    RESTANTES="$(migrations_pendentes)"
    if [ -n "$RESTANTES" ]; then
      warn "Estas continuam sem registro no banco — veja /tmp/atelie_migrate.log:"
      echo "$RESTANTES" | sed 's/^/    • /'
    else
      ok "Migrations aplicadas — banco na versão $(migrations_locais | tail -1)"
    fi
  else
    warn "prisma migrate deploy falhou:"
    tail -n 15 /tmp/atelie_migrate.log | sed 's/^/    /'
    warn "As telas que dependem das migrations pendentes vão responder 500."
  fi
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
