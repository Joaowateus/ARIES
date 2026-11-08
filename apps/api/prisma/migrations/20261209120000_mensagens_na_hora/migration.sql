-- PDF 02 · 4.1: mensagem do WhatsApp com a hora exata, a pessoa da loja e a
-- marca da primeira resposta humana. Só acrescenta.
ALTER TABLE "pro_labore_assistente_mensagens" ADD COLUMN "enviadaEm" TIMESTAMP(3);
ALTER TABLE "pro_labore_assistente_mensagens" ADD COLUMN "pessoaId" TEXT;
ALTER TABLE "pro_labore_assistente_mensagens" ADD COLUMN "primeiraRespostaHumana" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "pro_labore_assistente_mensagens_conversaId_primeiraRespostaHumana_idx" ON "pro_labore_assistente_mensagens"("conversaId", "primeiraRespostaHumana");

-- Mensagens antigas: a hora que havia (a do registro).
UPDATE "pro_labore_assistente_mensagens" SET "enviadaEm" = "criadoEm" WHERE "enviadaEm" IS NULL;
-- A 1ª mensagem de pessoa da loja em cada conversa de lead.
UPDATE "pro_labore_assistente_mensagens" m SET "primeiraRespostaHumana" = true
FROM (
  SELECT DISTINCT ON (x."conversaId") x.id
  FROM "pro_labore_assistente_mensagens" x JOIN "pro_labore_assistente_conversas" c ON c.id = x."conversaId"
  WHERE x.remetente = 'VENDEDOR' AND c.tipo = 'LEAD'
  ORDER BY x."conversaId", x."enviadaEm", x.id
) p
WHERE m.id = p.id;

-- Toda mensagem nova: hora exata (a do WhatsApp quando veio, senão a do registro)
-- e a marca da 1ª resposta de pessoa, venha de onde vier.
CREATE OR REPLACE FUNCTION aries_mensagem_na_hora() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  NEW."enviadaEm" := COALESCE(NEW."enviadaEm", NEW."criadoEm", now());
  IF NEW.remetente = 'VENDEDOR'
     AND EXISTS (SELECT 1 FROM "pro_labore_assistente_conversas" c WHERE c.id = NEW."conversaId" AND c.tipo = 'LEAD')
     AND NOT EXISTS (SELECT 1 FROM "pro_labore_assistente_mensagens" x WHERE x."conversaId" = NEW."conversaId" AND x.remetente = 'VENDEDOR') THEN
    NEW."primeiraRespostaHumana" := true;
  END IF;
  RETURN NEW;
END
$fn$;
CREATE TRIGGER aries_mensagem_na_hora BEFORE INSERT ON "pro_labore_assistente_mensagens" FOR EACH ROW EXECUTE FUNCTION aries_mensagem_na_hora();
