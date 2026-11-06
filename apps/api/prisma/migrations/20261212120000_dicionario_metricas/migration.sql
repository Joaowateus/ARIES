-- PDF 02 · 4.2 Dicionário de métricas. A ficha padrão (versão 1, aprovada
-- no PDF 02) fica no código; cada mudança aprovada pelo dono vira uma nova
-- versão aqui, com autor, data e justificativa (só inclusão).
CREATE TABLE "pro_labore_metricas_versoes" (
  "id"           TEXT PRIMARY KEY,
  "usuarioId"    TEXT NOT NULL,
  "chave"        TEXT NOT NULL,
  "versao"       INTEGER NOT NULL,
  "ficha"        JSONB NOT NULL,
  "justificativa" TEXT NOT NULL,
  "autorId"      TEXT NOT NULL,
  "aprovadoPor"  TEXT,
  "aprovadoEm"   TIMESTAMP(3),
  "criadoEm"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "pro_labore_metricas_versoes_key" ON "pro_labore_metricas_versoes"("usuarioId", "chave", "versao");
CREATE TRIGGER aries_imutavel BEFORE UPDATE OR DELETE ON "pro_labore_metricas_versoes" FOR EACH ROW EXECUTE FUNCTION aries_imutavel();

-- Padrão da loja por métrica e dia (mediana dos últimos 90 dias) e os
-- retratos diários das métricas de "agora". Recalculável a qualquer hora.
CREATE TABLE "pro_labore_metricas_padrao" (
  "id"        TEXT PRIMARY KEY,
  "usuarioId" TEXT NOT NULL,
  "chave"     TEXT NOT NULL,
  "escopo"    TEXT NOT NULL,
  "dia"       DATE NOT NULL,
  "valor"     DOUBLE PRECISION,
  "criadoEm"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "pro_labore_metricas_padrao_key" ON "pro_labore_metricas_padrao"("usuarioId", "chave", "escopo", "dia");
