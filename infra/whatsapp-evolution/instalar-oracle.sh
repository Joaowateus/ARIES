#!/usr/bin/env bash
# Instala o servidor do WhatsApp (Evolution API) numa máquina Ubuntu do
# Oracle Cloud (Always Free). Um servidor atende a equipe toda: cada vendedor
# vira uma "instância" quando lê o QR Code no sistema.
#
# Uso, já conectado na máquina por SSH:
#   curl -fsSL https://raw.githubusercontent.com/Joaowateus/ARIES/claude/soe-project-setup-sqgryt/infra/whatsapp-evolution/instalar-oracle.sh -o instalar.sh
#   sudo bash instalar.sh
#
# Pode rodar de novo sem medo: reaproveita a chave e os dados já criados.
# Antes, libere as portas 80 e 443 na Security List da rede (ver LEIA-ME.md).
set -euo pipefail

# A 2.4 passou a exigir ativação de licença: fica fixo na última 2.3 estável.
VERSAO_EVOLUTION="v2.3.7"
DIR=/opt/evolution

if [ "$(id -u)" != "0" ]; then echo "Rode com sudo: sudo bash $0"; exit 1; fi
passo() { echo; echo "==> $*"; }

passo "Descobrindo o IP público da máquina"
IP=$(curl -fsS -m 10 https://api.ipify.org || curl -fsS -m 10 https://ifconfig.me)
if ! [[ "$IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then echo "Não consegui descobrir o IP público ($IP)."; exit 1; fi
# Endereço com HTTPS sem precisar comprar domínio: 1-2-3-4.sslip.io aponta para 1.2.3.4.
DOMINIO="${IP//./-}.sslip.io"
echo "IP $IP -> https://$DOMINIO"

# Máquina pequena (ex.: AMD micro de 1 GB): memória extra em disco evita travar.
if [ "$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)" -lt 3000 ] && ! swapon --show | grep -q /swapfile; then
  passo "Criando 2 GB de memória extra (swap)"
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

if ! command -v docker >/dev/null 2>&1; then
  passo "Instalando o Docker"
  # Na primeira vez a máquina costuma estar atualizando sozinha: tenta de novo.
  for tentativa in 1 2 3 4 5; do
    if curl -fsSL https://get.docker.com | sh; then break; fi
    echo "Instalação ocupada, tentando de novo em 30 s ($tentativa/5)..."; sleep 30
  done
  command -v docker >/dev/null 2>&1 || { echo "Não deu para instalar o Docker."; exit 1; }
fi
systemctl enable --now docker >/dev/null

passo "Liberando as portas 80 e 443 no firewall da máquina"
# As imagens Ubuntu do Oracle bloqueiam tudo além do SSH dentro da própria máquina.
for porta in 80 443; do
  iptables -C INPUT -p tcp -m state --state NEW --dport "$porta" -j ACCEPT 2>/dev/null \
    || iptables -I INPUT 1 -p tcp -m state --state NEW --dport "$porta" -j ACCEPT
done
if command -v netfilter-persistent >/dev/null 2>&1; then netfilter-persistent save >/dev/null 2>&1 || true; fi

mkdir -p "$DIR"
cd "$DIR"
if [ ! -f .env ]; then
  passo "Gerando a chave do servidor e a senha do banco"
  CHAVE=$(openssl rand -hex 24)
  SENHA_BANCO=$(openssl rand -hex 16)
  umask 077
  cat > .env <<EOF
# Gerado por instalar-oracle.sh. A chave abaixo só vai na Vercel (EVOLUTION_API_KEY).
SERVER_URL=https://$DOMINIO
SERVER_PORT=8080
AUTHENTICATION_API_KEY=$CHAVE
POSTGRES_PASSWORD=$SENHA_BANCO
DATABASE_PROVIDER=postgresql
DATABASE_CONNECTION_URI=postgresql://evolution:$SENHA_BANCO@postgres:5432/evolution?schema=public
DATABASE_CONNECTION_CLIENT_NAME=aries
DATABASE_SAVE_DATA_INSTANCE=true
# Histórico das conversas: é com ele que o sistema sabe se o contato é novo.
DATABASE_SAVE_DATA_NEW_MESSAGE=true
DATABASE_SAVE_DATA_HISTORIC=true
DATABASE_SAVE_DATA_CONTACTS=true
DATABASE_SAVE_DATA_CHATS=true
DATABASE_SAVE_MESSAGE_UPDATE=false
DATABASE_SAVE_DATA_LABELS=false
CACHE_REDIS_ENABLED=true
CACHE_REDIS_URI=redis://redis:6379/6
CACHE_REDIS_PREFIX_KEY=evolution
CACHE_REDIS_SAVE_INSTANCES=false
CACHE_LOCAL_ENABLED=false
# Nome que aparece em "Aparelhos conectados" no celular do vendedor.
CONFIG_SESSION_PHONE_CLIENT=Aries CRM
CONFIG_SESSION_PHONE_NAME=Chrome
QRCODE_LIMIT=30
DEL_INSTANCE=false
WEBHOOK_GLOBAL_ENABLED=false
LANGUAGE=pt-BR
LOG_LEVEL=ERROR,WARN,INFO
TELEMETRY_ENABLED=false
EOF
fi
# Endereço segue o IP atual (se a máquina mudar de IP, rodar de novo corrige).
sed -i "s#^SERVER_URL=.*#SERVER_URL=https://$DOMINIO#" .env

cat > docker-compose.yml <<EOF
services:
  evolution:
    image: evoapicloud/evolution-api:$VERSAO_EVOLUTION
    restart: always
    env_file: .env
    ports:
      - "127.0.0.1:8080:8080"
    volumes:
      - evolution_instances:/evolution/instances
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started

  postgres:
    image: postgres:15-alpine
    restart: always
    environment:
      POSTGRES_USER: evolution
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD}
      POSTGRES_DB: evolution
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U evolution -d evolution"]
      interval: 5s
      timeout: 5s
      retries: 30

  redis:
    image: redis:7-alpine
    restart: always
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

  # HTTPS automático (Let's Encrypt) na frente da Evolution.
  caddy:
    image: caddy:2-alpine
    restart: always
    network_mode: host
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config

volumes:
  evolution_instances:
  postgres_data:
  redis_data:
  caddy_data:
  caddy_config:
EOF

cat > Caddyfile <<EOF
$DOMINIO {
  reverse_proxy 127.0.0.1:8080
}
EOF

passo "Baixando e ligando os serviços (leva uns 2 a 5 minutos na primeira vez)"
docker compose pull -q
docker compose up -d --remove-orphans

passo "Esperando a Evolution responder"
pronto=""
for _ in $(seq 1 90); do
  if curl -fsS -m 5 http://127.0.0.1:8080 2>/dev/null | grep -qi "welcome"; then pronto=1; break; fi
  sleep 4
done
if [ -z "$pronto" ]; then
  echo "A Evolution não respondeu. Últimas linhas do registro:"
  docker compose logs --tail 40 evolution
  exit 1
fi
echo "Evolution no ar."

passo "Esperando o certificado HTTPS"
# O certificado só sai se a internet alcançar as portas 80/443; a conferência
# é feita por dentro (--resolve) para não depender de a máquina enxergar o
# próprio IP público.
https_ok=""
for _ in $(seq 1 40); do
  if curl -fsS -m 8 --resolve "$DOMINIO:443:127.0.0.1" "https://$DOMINIO" 2>/dev/null | grep -qi "welcome"; then https_ok=1; break; fi
  sleep 5
done

CHAVE_ATUAL=$(grep '^AUTHENTICATION_API_KEY=' .env | cut -d= -f2)
echo
echo "=================================================================="
if [ -n "$https_ok" ]; then
  echo " PRONTO! O servidor do WhatsApp está no ar."
else
  echo " A Evolution está ligada, mas o HTTPS ainda não respondeu de fora."
  echo " Confira se as portas 80 e 443 estão liberadas na Security List da"
  echo " rede (LEIA-ME.md, passo 3) e rode este instalador de novo."
fi
echo
echo " Cadastre na Vercel (projeto da API, ariessistemacomercial):"
echo "   EVOLUTION_API_URL = https://$DOMINIO"
echo "   EVOLUTION_API_KEY = $CHAVE_ATUAL"
echo
echo " A chave é a senha do servidor: cole só na Vercel. Não mande em"
echo " print nem em conversa. Para ver de novo:"
echo "   sudo grep AUTHENTICATION_API_KEY $DIR/.env"
echo "=================================================================="
