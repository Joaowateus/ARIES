#!/usr/bin/env bash
# Inicia API e Web em paralelo para desenvolvimento
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "▶ Iniciando API (porta 3001)..."
cd "$ROOT/api" && node --require ts-node/register src/index.ts &
API_PID=$!

echo "▶ Iniciando Web (porta 3000)..."
cd "$ROOT/web" && npm run dev &
WEB_PID=$!

echo ""
echo "✅ ARIES em execução:"
echo "   Web:  http://localhost:3000"
echo "   API:  http://localhost:3001"
echo ""
echo "Para parar: Ctrl+C"

trap "kill $API_PID $WEB_PID 2>/dev/null; echo ''; echo 'Encerrado.'" EXIT INT TERM
wait
