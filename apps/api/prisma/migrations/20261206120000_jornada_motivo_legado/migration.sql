-- PDF 01 · passo 4: guarda o motivo de perda antigo quando a migração
-- traduz para a lista nova (permite conferir e desfazer).
ALTER TABLE "pro_labore_leads" ADD COLUMN "motivoPerdaLegado" TEXT;

-- Histórico de etapas: toda entrada nova fecha a anterior do mesmo lead
-- (saiuEm = hora da nova entrada), venha a mudança de onde vier.
CREATE OR REPLACE FUNCTION aries_fechar_etapa_anterior() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  UPDATE "pro_labore_lead_estagio_historico"
  SET "saiuEm" = NEW."criadoEm"
  WHERE "leadId" = NEW."leadId" AND id <> NEW.id AND "saiuEm" IS NULL AND "criadoEm" <= NEW."criadoEm";
  RETURN NULL;
END
$fn$;
CREATE TRIGGER aries_fechar_etapa_anterior AFTER INSERT ON "pro_labore_lead_estagio_historico" FOR EACH ROW EXECUTE FUNCTION aries_fechar_etapa_anterior();

-- Fecha o que ficou aberto entre a migração anterior e esta.
UPDATE "pro_labore_lead_estagio_historico" h SET "saiuEm" = s.prox
FROM (
  SELECT id, LEAD("criadoEm") OVER (PARTITION BY "leadId" ORDER BY "criadoEm", id) AS prox
  FROM "pro_labore_lead_estagio_historico"
) s
WHERE s.id = h.id AND s.prox IS NOT NULL AND h."saiuEm" IS NULL;
