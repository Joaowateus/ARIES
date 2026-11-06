-- PDF 01 · passo 5: com SDRs cadastrados, todo lead novo da jornada vai para
-- um SDR pelo rodízio (responsável pela qualificação). Enquanto os SDRs não
-- têm número próprio no WhatsApp, o lead continua entrando pelo número do
-- vendedor (responsável operacional) e é só direcionado ao SDR. Sem SDR,
-- nada muda: o vendedor qualifica e fecha.
CREATE OR REPLACE FUNCTION aries_lead_entra_na_jornada() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE
  sdr text;
BEGIN
  IF NEW."etapa" IS NULL AND EXISTS (SELECT 1 FROM "pro_labore_parametros" p WHERE p."usuarioId" = NEW."usuarioId" AND p."jornadaAtivaEm" IS NOT NULL) THEN
    NEW."etapa" := 'LEAD';
    NEW."fase" := 'PRE_VENDA';
    NEW."entrouNaEtapaEm" := COALESCE(NEW."criadoEm", now());
    NEW."responsavelFechamentoId" := COALESCE(NEW."responsavelFechamentoId", NEW."vendedorId");
    IF NEW."responsavelQualificacaoId" IS NULL THEN
      SELECT v.id INTO sdr
      FROM "pro_labore_vendedores" v
      LEFT JOIN "pro_labore_rodizio_leads" r ON r."vendedorId" = v.id AND r."papel" = 'SDR'
      WHERE v."usuarioId" = NEW."usuarioId" AND v."ativo" AND v."vende" AND v."papel" = 'SDR' AND COALESCE(r."disponivel", true)
      ORDER BY r."ultimoRecebidoEm" ASC NULLS FIRST, v.id
      LIMIT 1;
      IF sdr IS NOT NULL THEN
        NEW."responsavelQualificacaoId" := sdr;
        INSERT INTO "pro_labore_rodizio_leads" (id, "usuarioId", "vendedorId", "papel", "ultimoRecebidoEm", "atualizadoEm")
        VALUES (gen_random_uuid()::text, NEW."usuarioId", sdr, 'SDR', now(), now())
        ON CONFLICT ("vendedorId", "papel") DO UPDATE SET "ultimoRecebidoEm" = now(), "atualizadoEm" = now();
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END
$fn$;
