-- PDF 02 · 4.3 parâmetros com histórico e 4.8 camada de qualidade dos dados.

-- Histórico de cada mudança de parâmetro: autor, data e justificativa (só inclusão).
CREATE TABLE "pro_labore_parametros_historico" (
  "id"            TEXT PRIMARY KEY,
  "usuarioId"     TEXT NOT NULL,
  "nome"          TEXT NOT NULL,
  "valorAnterior" JSONB,
  "valorNovo"     JSONB,
  "origem"        TEXT NOT NULL, -- HISTORICO | MANUAL
  "justificativa" TEXT NOT NULL,
  "autorId"       TEXT NOT NULL,
  "criadoEm"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "pro_labore_parametros_historico_idx" ON "pro_labore_parametros_historico"("usuarioId", "nome", "criadoEm");
CREATE TRIGGER aries_imutavel BEFORE UPDATE OR DELETE ON "pro_labore_parametros_historico" FOR EACH ROW EXECUTE FUNCTION aries_imutavel();

-- Parâmetros novos do 4.3 (valores iniciais; editáveis só pelo dono).
ALTER TABLE "pro_labore_parametros" ADD COLUMN "volumeMinimoDetectores" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "pro_labore_parametros" ADD COLUMN "metaDiariaSdr" DOUBLE PRECISION;

-- Classificação de confiabilidade de cada registro (a pior pendência aberta manda).
CREATE TABLE "pro_labore_confiabilidade" (
  "id"             TEXT PRIMARY KEY,
  "usuarioId"      TEXT NOT NULL,
  "registroTabela" TEXT NOT NULL,
  "registroId"     TEXT NOT NULL,
  "classificacao"  TEXT NOT NULL, -- CONFIRMADO | INCOMPLETO | SUSPEITO
  "motivo"         TEXT,
  "regra"          TEXT,
  "avaliadoEm"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "pro_labore_confiabilidade_key" ON "pro_labore_confiabilidade"("registroTabela", "registroId");
CREATE INDEX "pro_labore_confiabilidade_idx" ON "pro_labore_confiabilidade"("usuarioId", "classificacao");

-- Correções pendentes: o que corrigir, onde e quem corrige. Resolvida quando a regra deixa de valer.
CREATE TABLE "pro_labore_correcoes_pendentes" (
  "id"             TEXT PRIMARY KEY,
  "usuarioId"      TEXT NOT NULL,
  "registroTabela" TEXT NOT NULL,
  "registroId"     TEXT NOT NULL,
  "leadId"         TEXT,
  "regra"          TEXT NOT NULL,
  "classificacao"  TEXT NOT NULL, -- INCOMPLETO | SUSPEITO
  "oQueFalta"      TEXT NOT NULL,
  "responsavelId"  TEXT,
  "status"         TEXT NOT NULL DEFAULT 'ABERTA', -- ABERTA | RESOLVIDA
  "criadaEm"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvidaEm"    TIMESTAMP(3)
);
CREATE UNIQUE INDEX "pro_labore_correcoes_aberta_key" ON "pro_labore_correcoes_pendentes"("registroTabela", "registroId", "regra") WHERE "status" = 'ABERTA';
CREATE INDEX "pro_labore_correcoes_idx" ON "pro_labore_correcoes_pendentes"("usuarioId", "status", "responsavelId");
