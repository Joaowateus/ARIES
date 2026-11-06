-- PDF 01 · passo 5: a conta passa a usar a jornada de 10 etapas ao fim da
-- migração; a partir daí todo lead novo entra na etapa Lead, venha de onde
-- vier (cadastro, WhatsApp, Instagram, importação).
ALTER TABLE "pro_labore_parametros" ADD COLUMN "jornadaAtivaEm" TIMESTAMP(3);

CREATE OR REPLACE FUNCTION aries_lead_entra_na_jornada() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW."etapa" IS NULL AND EXISTS (SELECT 1 FROM "pro_labore_parametros" p WHERE p."usuarioId" = NEW."usuarioId" AND p."jornadaAtivaEm" IS NOT NULL) THEN
    NEW."etapa" := 'LEAD';
    NEW."fase" := 'PRE_VENDA';
    NEW."entrouNaEtapaEm" := COALESCE(NEW."criadoEm", now());
    NEW."responsavelFechamentoId" := COALESCE(NEW."responsavelFechamentoId", NEW."vendedorId");
  END IF;
  RETURN NEW;
END
$fn$;
CREATE TRIGGER aries_lead_entra_na_jornada BEFORE INSERT ON "pro_labore_leads" FOR EACH ROW EXECUTE FUNCTION aries_lead_entra_na_jornada();

-- Conta já migrada antes desta versão (ambiente de teste): ativa agora.
UPDATE "pro_labore_parametros" p SET "jornadaAtivaEm" = now()
WHERE p."jornadaAtivaEm" IS NULL
  AND EXISTS (SELECT 1 FROM "pro_labore_leads" l WHERE l."usuarioId" = p."usuarioId")
  AND NOT EXISTS (SELECT 1 FROM "pro_labore_leads" l WHERE l."usuarioId" = p."usuarioId" AND l."etapa" IS NULL);
