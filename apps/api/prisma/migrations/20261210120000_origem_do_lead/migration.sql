-- PDF 02 · 4.5 e 4.6: origem estruturada da oportunidade (só acrescenta).
-- AlterTable
ALTER TABLE "pro_labore_leads" ADD COLUMN     "origemAnuncio" TEXT,
ADD COLUMN     "origemAutomatica" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "origemCampanha" TEXT,
ADD COLUMN     "origemConfiabilidade" TEXT,
ADD COLUMN     "origemConjunto" TEXT,
ADD COLUMN     "origemLista" TEXT,
ADD COLUMN     "origemTipo" TEXT,
ADD COLUMN     "origemTituloAnuncio" TEXT;

-- AlterTable
ALTER TABLE "pro_labore_assistente_conversas" ADD COLUMN     "anuncioId" TEXT,
ADD COLUMN     "anuncioTitulo" TEXT;


-- Leads existentes (tabela 4.6): post rastreado é confirmado; "tráfego" vira
-- anúncio com campanha não identificada; "orgânico", canal não identificado;
-- sem origem, desconhecida. Os três últimos ficam incompletos.
UPDATE "pro_labore_leads" SET
  "origemTipo" = CASE
    WHEN "postCode" IS NOT NULL AND "canalEntrada" IN ('DIRECT', 'COMENTARIO', 'COMENTE_QUERO', 'RESPOSTA_STORY') THEN 'DIRECT_COMENTARIO'
    WHEN "postCode" IS NOT NULL THEN 'POST'
    WHEN "tipoLead" = 'TRAFEGO' THEN 'ANUNCIO'
    WHEN "tipoLead" = 'ORGANICO' THEN 'ORGANICO'
    ELSE 'DESCONHECIDA' END,
  "origemCampanha" = CASE WHEN "postCode" IS NULL AND "tipoLead" = 'TRAFEGO' THEN 'não identificada' ELSE NULL END,
  "origemConfiabilidade" = CASE WHEN "postCode" IS NOT NULL THEN 'CONFIRMADO' ELSE 'INCOMPLETO' END
WHERE "origemTipo" IS NULL;

-- Lead novo: a origem é derivada do que veio (anúncio, post, lista) e o
-- anúncio puxa campanha e conjunto do Tráfego; sem nada, "desconhecida".
-- Depois de confirmada, a origem não muda; incompleta pode ser corrigida.
CREATE OR REPLACE FUNCTION aries_origem_do_lead() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE
  camp text; conj text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD."origemConfiabilidade" = 'CONFIRMADO' THEN
      NEW."origemTipo" := OLD."origemTipo"; NEW."origemCampanha" := OLD."origemCampanha"; NEW."origemConjunto" := OLD."origemConjunto";
      NEW."origemAnuncio" := OLD."origemAnuncio"; NEW."origemTituloAnuncio" := OLD."origemTituloAnuncio"; NEW."origemLista" := OLD."origemLista";
      NEW."origemAutomatica" := OLD."origemAutomatica"; NEW."origemConfiabilidade" := OLD."origemConfiabilidade";
      RETURN NEW;
    END IF;
    IF NEW."origemLista" IS NOT NULL AND NEW."origemLista" IS DISTINCT FROM OLD."origemLista" THEN
      NEW."origemTipo" := 'LISTA'; NEW."origemConfiabilidade" := 'CONFIRMADO';
    ELSIF NEW."postCode" IS NOT NULL AND OLD."postCode" IS NULL THEN
      NEW."origemTipo" := CASE WHEN NEW."canalEntrada" IN ('DIRECT', 'COMENTARIO', 'COMENTE_QUERO', 'RESPOSTA_STORY') THEN 'DIRECT_COMENTARIO' ELSE 'POST' END;
      NEW."origemConfiabilidade" := 'CONFIRMADO';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW."origemTipo" IS NULL THEN
    NEW."origemTipo" := CASE
      WHEN NEW."origemLista" IS NOT NULL THEN 'LISTA'
      WHEN NEW."origemAnuncio" IS NOT NULL THEN 'ANUNCIO'
      WHEN NEW."postCode" IS NOT NULL AND NEW."canalEntrada" IN ('DIRECT', 'COMENTARIO', 'COMENTE_QUERO', 'RESPOSTA_STORY') THEN 'DIRECT_COMENTARIO'
      WHEN NEW."postCode" IS NOT NULL THEN 'POST'
      WHEN NEW."tipoLead" = 'TRAFEGO' THEN 'ANUNCIO'
      WHEN NEW."tipoLead" = 'ORGANICO' THEN 'ORGANICO'
      ELSE 'DESCONHECIDA' END;
  END IF;
  IF NEW."origemAnuncio" IS NOT NULL AND NEW."origemCampanha" IS NULL THEN
    SELECT i."campanhaNome", i."adsetNome" INTO camp, conj FROM "pro_labore_trafego_insights" i WHERE i."adId" = NEW."origemAnuncio" ORDER BY i.data DESC LIMIT 1;
    NEW."origemCampanha" := camp; NEW."origemConjunto" := COALESCE(NEW."origemConjunto", conj);
  END IF;
  IF NEW."origemConfiabilidade" IS NULL THEN
    NEW."origemConfiabilidade" := CASE
      WHEN NEW."origemTipo" IN ('LISTA', 'POST', 'DIRECT_COMENTARIO') THEN 'CONFIRMADO'
      WHEN NEW."origemTipo" = 'ANUNCIO' AND NEW."origemAnuncio" IS NOT NULL THEN 'CONFIRMADO'
      ELSE 'INCOMPLETO' END;
  END IF;
  RETURN NEW;
END
$fn$;
CREATE TRIGGER aries_origem_do_lead BEFORE INSERT OR UPDATE ON "pro_labore_leads" FOR EACH ROW EXECUTE FUNCTION aries_origem_do_lead();
