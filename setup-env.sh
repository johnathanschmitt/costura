#!/bin/bash
#
# Gera o arquivo .env para um servidor de produção, com segredos aleatórios.
#
# Existe porque copiar o .env.example e subir assim deixa o sistema com o
# JWT_SECRET publicado no repositório — qualquer pessoa que conheça o projeto
# consegue forjar um login de administrador.
#
#   ./setup-env.sh                      # pergunta o endereço de acesso
#   ./setup-env.sh https://atelie.com   # informa direto
#
set -euo pipefail

B='\033[0;34m'; G='\033[0;32m'; Y='\033[1;33m'; R='\033[0;31m'; N='\033[0m'; BOLD='\033[1m'
log()  { echo -e "${B}▸${N} $1"; }
ok()   { echo -e "${G}✔${N} $1"; }
warn() { echo -e "${Y}⚠${N}  $1"; }
err()  { echo -e "${R}✖${N}  $1"; exit 1; }
sep()  { echo -e "${B}────────────────────────────────────────────────${N}"; }

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

command -v openssl >/dev/null 2>&1 || err "openssl não encontrado — necessário para gerar os segredos.
     Instale com:  sudo apt install openssl"

# Base64 sem caracteres que atrapalham em URL de conexão ou em shell.
secret() { openssl rand -base64 "${1:-36}" | tr -d '\n=+/' | cut -c1-"${2:-40}"; }

sep
echo -e "${BOLD}  Configuração do ambiente — Ateliê de Costura${N}"
sep

# ── 1. Protege um .env existente ──────────────────────────────────────────────
if [ -f .env ]; then
  warn "Já existe um arquivo .env aqui."
  echo "   Sobrescrever troca TODAS as senhas — inclusive a do banco."
  echo -e "   ${BOLD}Se o banco já tem dados, os containers não vão mais conectar${N}"
  echo "   com as senhas novas sem recriar os volumes."
  echo
  read -rp "   Sobrescrever mesmo assim? (digite SIM em maiúsculas): " CONFIRM
  [ "$CONFIRM" = "SIM" ] || { echo; log "Nada foi alterado."; exit 0; }
  BACKUP=".env.backup-$(date +%Y%m%d-%H%M%S)"
  cp .env "$BACKUP"
  ok "Backup do anterior salvo em $BACKUP"
  echo
fi

# ── 2. Endereço de acesso ─────────────────────────────────────────────────────
FRONTEND_URL="${1:-}"
if [ -z "$FRONTEND_URL" ]; then
  # Sugere o IP da interface que alcança a internet — o mais provável na rede.
  SUGGEST="http://$(ip route get 1.1.1.1 2>/dev/null | grep -oP 'src \K[\d.]+' | head -1 || echo localhost)"
  echo "   Endereço pelo qual o sistema será acessado."
  echo "   É usado no link público do orçamento que a cliente recebe —"
  echo "   se ficar errado, o link não abre no celular dela."
  echo
  read -rp "   Endereço [$SUGGEST]: " FRONTEND_URL
  FRONTEND_URL="${FRONTEND_URL:-$SUGGEST}"
fi

case "$FRONTEND_URL" in
  http://*|https://*) ;;
  *) err "O endereço precisa começar com http:// ou https:// — recebido: $FRONTEND_URL" ;;
esac
FRONTEND_URL="${FRONTEND_URL%/}"   # sem barra no fim

case "$FRONTEND_URL" in
  *localhost*|*127.0.0.1*)
    warn "O endereço aponta para localhost."
    echo "   Só funciona para quem acessa da própria máquina. O link do orçamento"
    echo "   enviado por WhatsApp não vai abrir no celular da cliente."
    echo
    ;;
esac

# ── 3. Gera os segredos ───────────────────────────────────────────────────────
log "Gerando senhas aleatórias..."
POSTGRES_PASSWORD=$(secret 24 32)
REDIS_PASSWORD=$(secret 24 32)
MINIO_ROOT_PASSWORD=$(secret 24 32)
PGADMIN_PASSWORD=$(secret 18 24)
JWT_SECRET=$(secret 48 64)
JWT_REFRESH_SECRET=$(secret 48 64)

POSTGRES_DB=atelie
POSTGRES_USER=atelie
MINIO_ROOT_USER=atelie_minio

# Este .env é lido pelos processos do host (backend em dev, prisma CLI), então
# os endereços aqui são localhost. Entre containers, quem manda são as variáveis
# definidas no docker-compose.yml, que usam os nomes de serviço da rede Docker.
cat > .env <<EOF
# ── Postgres ──────────────────────────────────────────────────────────────────
POSTGRES_DB=$POSTGRES_DB
POSTGRES_USER=$POSTGRES_USER
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
# localhost, não "postgres": quem lê este arquivo são os processos do host
# (backend em dev, prisma CLI). Os containers não usam esta linha — o
# docker-compose.yml sobrescreve DATABASE_URL com o hostname da rede Docker.
DATABASE_URL=postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@localhost:5432/$POSTGRES_DB

# ── Redis ─────────────────────────────────────────────────────────────────────
REDIS_PASSWORD=$REDIS_PASSWORD
# idem: localhost para o host, o compose sobrescreve para o container
REDIS_URL=redis://:$REDIS_PASSWORD@localhost:${REDIS_PORT:-6379}

# ── MinIO (armazenamento de arquivos) ─────────────────────────────────────────
MINIO_ROOT_USER=$MINIO_ROOT_USER
MINIO_ROOT_PASSWORD=$MINIO_ROOT_PASSWORD
MINIO_BUCKET=atelie
MINIO_ENDPOINT=minio
MINIO_PORT=9000

# ── JWT ───────────────────────────────────────────────────────────────────────
# Gerados aleatoriamente. Trocar estes valores desconecta todo mundo.
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET
JWT_REFRESH_EXPIRES_IN=30d

# ── App ───────────────────────────────────────────────────────────────────────
NODE_ENV=production
PORT=3001
# Endereço público: aparece no link do orçamento enviado à cliente.
FRONTEND_URL=$FRONTEND_URL

# ── PgAdmin (só sobe com --tools) ─────────────────────────────────────────────
PGADMIN_EMAIL=admin@atelie.local
PGADMIN_PASSWORD=$PGADMIN_PASSWORD
EOF

# O arquivo guarda todas as senhas: ninguém além do dono precisa lê-lo.
chmod 600 .env

sep
ok "Arquivo .env criado"
echo
echo "   Endereço de acesso : $FRONTEND_URL"
echo "   Banco              : $POSTGRES_USER / $(echo "$POSTGRES_PASSWORD" | cut -c1-6)…"
echo "   PgAdmin            : admin@atelie.local / $PGADMIN_PASSWORD"
echo "   Permissão          : $(stat -c '%a' .env) (só o dono lê)"
echo
warn "Guarde a senha do PgAdmin acima — ela não aparece de novo."
sep
echo
log "Próximo passo:"
echo -e "   ${BOLD}./start.sh --prod --seed${N}   ${Y}# --seed só na primeira vez${N}"
echo
echo "   O --seed cria o usuário inicial: admin@atelie.local / Admin@123"
echo -e "   ${Y}Troque essa senha no primeiro acesso.${N}"
sep
