-- PDF 05 · Onda 4 — detectores de Reativação, Marketing, Gestão e Pessoas.
-- Não há estrutura nova de detector (são registros na estrutura do PDF 03);
-- cada área ganha só o indicador de ligada/desligada e o de modo silencioso.
-- Formato: { "REATIVACAO": { "ligada": true, "modo": "SILENCIOSO", "ligadaEm": "...", "liberadaEm": null }, ... }
-- Sem valor: todas as áreas desligadas (as telas e métricas seguem como antes).
ALTER TABLE "pro_labore_parametros" ADD COLUMN IF NOT EXISTS "areasDetectores" JSONB;
