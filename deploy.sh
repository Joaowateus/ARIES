#!/usr/bin/env bash
# ARIES v1.0 — Deploy Script
# Executa o deploy completo: Neon (DB) + Railway (API) + Vercel (Frontend)
# Pré-requisitos: node, npm, railway CLI, vercel CLI instalados
# Uso: bash deploy.sh

set -e
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✅ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
fail() { echo -e "${RED}❌ $1${NC}"; exit 1; }
step() { echo -e "\n${YELLOW}▶ $1${NC}"; }

ROOT="$(cd "$(dirname "$0")" && pwd)"
API_DIR="$ROOT/apps/api"
WEB_DIR="$ROOT/apps/web"

# ─── VALIDAÇÕES ───────────────────────────────────────────────────────────────

step "Verificando pré-requisitos"
command -v node   >/dev/null || fail "node não instalado"
command -v npm    >/dev/null || fail "npm não instalado"
command -v railway >/dev/null || warn "railway CLI não instalado — instale: npm i -g @railway/cli"
command -v vercel  >/dev/null || warn "vercel CLI não instalado — instale: npm i -g vercel"
ok "Node $(node -v)"

# ─── BUILD LOCAL ──────────────────────────────────────────────────────────────

step "Instalando dependências"
cd "$API_DIR" && npm ci --silent
cd "$WEB_DIR" && npm ci --silent
ok "Dependências instaladas"

step "Build da API"
cd "$API_DIR" && npm run build
ok "API compilada"

step "Build do Frontend"
cd "$WEB_DIR" && npm run build
ok "Frontend compilado"

# ─── VARIÁVEIS DE PRODUÇÃO ────────────────────────────────────────────────────

step "Configuração de variáveis de produção"
echo ""
echo "Você precisará de:"
echo "  1. DATABASE_URL — PostgreSQL em produção (Neon: https://neon.tech)"
echo "  2. JWT_SECRET   — String aleatória de 64+ caracteres"
echo "  3. FRONTEND_URL — URL do frontend após deploy no Vercel"
echo ""

read -p "DATABASE_URL de produção: " PROD_DB_URL
[[ -z "$PROD_DB_URL" ]] && fail "DATABASE_URL obrigatório"

JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
echo "JWT_SECRET gerado automaticamente: ${JWT_SECRET:0:20}..."

read -p "URL do frontend (ex: https://app.ariesnegocios.com.br): " FRONTEND_URL
[[ -z "$FRONTEND_URL" ]] && FRONTEND_URL="https://aries.vercel.app"

# ─── MIGRATIONS E SEED ────────────────────────────────────────────────────────

step "Executando migrations em produção"
cd "$API_DIR"
DATABASE_URL="$PROD_DB_URL" npx prisma migrate deploy
ok "Migrations aplicadas"

step "Executando seed em produção"
DATABASE_URL="$PROD_DB_URL" npx ts-node --project tsconfig.seed.json prisma/seed.ts
ok "Seed executado — usuário admin@ariesnegocios.com.br / aries2026"

# ─── DEPLOY API (RAILWAY) ─────────────────────────────────────────────────────

if command -v railway >/dev/null; then
  step "Deploy da API no Railway"
  cd "$API_DIR"
  railway login --browserless || warn "Login Railway necessário"
  railway up --service aries-api \
    --set "DATABASE_URL=$PROD_DB_URL" \
    --set "JWT_SECRET=$JWT_SECRET" \
    --set "FRONTEND_URL=$FRONTEND_URL" \
    --set "NODE_ENV=production" \
    --set "LOG_LEVEL=info" \
    2>&1 || warn "Deploy Railway falhou — configure manualmente em railway.app"
  API_URL=$(railway status --json 2>/dev/null | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); try{console.log(JSON.parse(d).deploymentDomain)}catch{}" || echo "")
  [[ -n "$API_URL" ]] && ok "API: https://$API_URL" || warn "Configure a URL da API no Railway dashboard"
else
  warn "railway CLI não instalado. Passos manuais:"
  echo "  1. Acesse https://railway.app → New Project → Deploy from GitHub"
  echo "  2. Selecione o repo ARIES, root: apps/api"
  echo "  3. Adicione as variáveis:"
  echo "     DATABASE_URL=$PROD_DB_URL"
  echo "     JWT_SECRET=$JWT_SECRET"
  echo "     FRONTEND_URL=$FRONTEND_URL"
  echo "     NODE_ENV=production"
  read -p "URL da API no Railway (ex: https://aries-api.railway.app): " API_URL
fi

# ─── DEPLOY FRONTEND (VERCEL) ─────────────────────────────────────────────────

if command -v vercel >/dev/null; then
  step "Deploy do Frontend no Vercel"
  cd "$WEB_DIR"
  vercel --prod \
    --env "NEXT_PUBLIC_API_URL=${API_URL:-https://aries-api.railway.app}" \
    --yes 2>&1 || warn "Deploy Vercel falhou — configure manualmente em vercel.com"
  ok "Frontend publicado"
else
  warn "vercel CLI não instalado. Passos manuais:"
  echo "  1. Acesse https://vercel.com → New Project → Import ARIES"
  echo "  2. Root directory: apps/web"
  echo "  3. Adicione variável de ambiente:"
  echo "     NEXT_PUBLIC_API_URL=${API_URL:-https://aries-api.railway.app}"
fi

# ─── VALIDAÇÃO FINAL ──────────────────────────────────────────────────────────

step "Validando deploy"
[[ -n "$API_URL" ]] && {
  HEALTH=$(curl -sf "${API_URL}/health" 2>/dev/null || echo "")
  [[ -n "$HEALTH" ]] && ok "Health check: $HEALTH" || warn "Health check falhou — aguarde o deploy terminar"
}

echo ""
echo "══════════════════════════════════════════════"
echo "  ARIES Business OS v1.0 — Deploy concluído"
echo "══════════════════════════════════════════════"
echo ""
echo "  Credenciais iniciais:"
echo "  Email: admin@ariesnegocios.com.br"
echo "  Senha: aries2026"
echo ""
echo "  ⚠️  Troque a senha imediatamente após o primeiro login"
echo ""
