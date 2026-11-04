-- AlterTable
ALTER TABLE "pro_labore_leads" ADD COLUMN "estagioPerda" TEXT;
ALTER TABLE "pro_labore_parametros" ADD COLUMN "diasLeadParado" INTEGER NOT NULL DEFAULT 5;

-- Perdidos que já existem: a etapa de onde saíram, pelo histórico.
UPDATE "pro_labore_leads" l SET "estagioPerda" = h."estagioAnterior"
FROM (
  SELECT DISTINCT ON ("leadId") "leadId", "estagioAnterior"
  FROM "pro_labore_lead_estagio_historico" WHERE "estagioNovo" = 'PERDIDO'
  ORDER BY "leadId", "criadoEm" DESC
) h
WHERE h."leadId" = l.id AND l."perdidoEm" IS NOT NULL;
