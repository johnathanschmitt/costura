#!/bin/bash
#
# Instala o que o sistema precisa numa máquina nova: Node.js (via nvm) e Docker.
#
# Só instala o que está faltando — rodar de novo numa máquina pronta não
# quebra nada nem reinstala por cima.
#
#   ./install-deps.sh          # instala Node e Docker
#   ./install-deps.sh --node   # só o Node (suficiente para desenvolvimento)
#   ./install-deps.sh --docker # só o Docker (suficiente para produção)
#
set -uo pipefail

B='\033[0;34m'; G='\033[0;32m'; Y='\033[1;33m'; R='\033[0;31m'; N='\033[0m'; BOLD='\033[1m'
log()  { echo -e "${B}▸${N} $1"; }
ok()   { echo -e "${G}✔${N} $1"; }
warn() { echo -e "${Y}⚠${N}  $1"; }
err()  { echo -e "${R}✖${N}  $1"; exit 1; }
sep()  { echo -e "${B}────────────────────────────────────────────────${N}"; }

# Versão usada no desenvolvimento — manter igual evita diferenças sutis.
NODE_VERSION=22
NVM_VERSION="v0.40.3"

WANT_NODE=true
WANT_DOCKER=true
for arg in "$@"; do
  case $arg in
    --node)   WANT_DOCKER=false ;;
    --docker) WANT_NODE=false ;;
    --help|-h)
      echo "Uso: ./install-deps.sh [--node|--docker]"
      echo "  sem opção   instala Node.js e Docker"
      echo "  --node      só Node.js (desenvolvimento)"
      echo "  --docker    só Docker (produção)"
      exit 0 ;;
  esac
done

[ "$(id -u)" -eq 0 ] && warn "Rodando como root: o Node seria instalado só para o root.
   O recomendado é rodar como o usuário que vai usar o sistema."

sep
echo -e "${BOLD}  Instalação de dependências — Ateliê de Costura${N}"
sep

NEEDS_RELOGIN=false

# ── Node.js ───────────────────────────────────────────────────────────────────
if [ "$WANT_NODE" = true ]; then
  # nvm é uma função de shell, não um executável: precisa ser carregada.
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  # shellcheck disable=SC1091
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

  if command -v node >/dev/null 2>&1; then
    CURRENT=$(node -v)
    MAJOR=$(echo "$CURRENT" | sed 's/^v//' | cut -d. -f1)
    if [ "$MAJOR" -ge 20 ] 2>/dev/null; then
      ok "Node.js já instalado ($CURRENT)"
    else
      warn "Node.js $CURRENT é antigo — o projeto precisa da 20 ou superior."
      log "Instalando a versão $NODE_VERSION pelo nvm..."
      command -v nvm >/dev/null 2>&1 || {
        curl -o- "https://raw.githubusercontent.com/nvm-sh/nvm/$NVM_VERSION/install.sh" | bash || err "Falha ao instalar o nvm"
        \. "$NVM_DIR/nvm.sh"
      }
      nvm install "$NODE_VERSION" && nvm alias default "$NODE_VERSION" && ok "Node.js $(node -v)"
      NEEDS_RELOGIN=true
    fi
  else
    log "Node.js não encontrado. Instalando pelo nvm..."
    if [ ! -s "$NVM_DIR/nvm.sh" ]; then
      curl -o- "https://raw.githubusercontent.com/nvm-sh/nvm/$NVM_VERSION/install.sh" | bash \
        || err "Falha ao baixar o nvm. Verifique a conexão com a internet."
      # shellcheck disable=SC1091
      \. "$NVM_DIR/nvm.sh"
    fi
    command -v nvm >/dev/null 2>&1 || err "nvm instalou mas não carregou.
     Feche e reabra o terminal, depois rode este script de novo."

    nvm install "$NODE_VERSION" || err "Falha ao instalar o Node.js $NODE_VERSION"
    nvm alias default "$NODE_VERSION" >/dev/null
    ok "Node.js $(node -v) e npm $(npm -v) instalados"
    NEEDS_RELOGIN=true
  fi
fi

# ── Docker ────────────────────────────────────────────────────────────────────
if [ "$WANT_DOCKER" = true ]; then
  if command -v docker >/dev/null 2>&1; then
    ok "Docker já instalado ($(docker --version | cut -d, -f1))"
  else
    log "Docker não encontrado. Instalando..."
    command -v curl >/dev/null 2>&1 || err "curl não encontrado.
     Instale com:  sudo apt install curl"
    curl -fsSL https://get.docker.com | sudo sh || err "Falha ao instalar o Docker"
    ok "Docker instalado"
  fi

  # Serviço ativo e subindo junto com a máquina.
  if systemctl list-unit-files docker.service >/dev/null 2>&1; then
    systemctl is-active --quiet docker || { log "Iniciando o serviço..."; sudo systemctl start docker; }
    systemctl is-enabled --quiet docker || { log "Habilitando no boot..."; sudo systemctl enable docker >/dev/null 2>&1; }
    ok "Serviço do Docker ativo"
  fi

  # Sem o grupo, todo comando docker exigiria sudo.
  if ! id -nG | tr ' ' '\n' | grep -qx docker; then
    log "Adicionando $USER ao grupo docker..."
    sudo usermod -aG docker "$USER" && ok "Usuário adicionado ao grupo docker"
    NEEDS_RELOGIN=true
  else
    ok "Usuário já está no grupo docker"
  fi
fi

sep
if [ "$NEEDS_RELOGIN" = true ]; then
  warn "Feche e reabra o terminal antes de continuar."
  echo "   Grupo de usuário e o nvm só valem em sessões novas — se continuar"
  echo "   neste terminal, os comandos vão falhar como se nada tivesse sido feito."
  echo
  echo -e "   Se estiver por SSH: ${BOLD}saia e conecte de novo${N}."
else
  ok "Tudo pronto."
fi
sep
echo
log "Depois disso:"
echo -e "   ${BOLD}./setup-env.sh${N}              # gera o .env com senhas próprias"
echo -e "   ${BOLD}./start.sh --prod --seed${N}    # sobe o sistema (produção)"
echo -e "   ${BOLD}./start.sh${N}                  # ou modo desenvolvimento"
sep
