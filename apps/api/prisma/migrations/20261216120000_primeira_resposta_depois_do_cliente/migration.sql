-- PDF 02 · 4.1: "primeira resposta humana" é a 1ª mensagem de uma pessoa da
-- loja DEPOIS de uma mensagem do cliente. Conversa aberta pela loja (o
-- vendedor escreveu primeiro para um lead do CRM) não conta como resposta até
-- o cliente escrever. Só muda a marca (dado derivado); nenhuma mensagem muda.

CREATE OR REPLACE FUNCTION aries_mensagem_na_hora() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  NEW."enviadaEm" := COALESCE(NEW."enviadaEm", NEW."criadoEm", now());
  IF NEW.remetente = 'VENDEDOR'
     AND EXISTS (SELECT 1 FROM "pro_labore_assistente_conversas" c WHERE c.id = NEW."conversaId" AND c.tipo = 'LEAD')
     AND EXISTS (SELECT 1 FROM "pro_labore_assistente_mensagens" x WHERE x."conversaId" = NEW."conversaId" AND x.remetente = 'CONTATO')
     AND NOT EXISTS (SELECT 1 FROM "pro_labore_assistente_mensagens" x WHERE x."conversaId" = NEW."conversaId" AND x."primeiraRespostaHumana") THEN
    NEW."primeiraRespostaHumana" := true;
  END IF;
  RETURN NEW;
END
$fn$;

-- Marcas já gravadas: refaz pela regra certa (a 1ª mensagem da loja gravada depois da 1ª do cliente).
UPDATE "pro_labore_assistente_mensagens" SET "primeiraRespostaHumana" = false WHERE "primeiraRespostaHumana";
UPDATE "pro_labore_assistente_mensagens" m SET "primeiraRespostaHumana" = true
FROM (
  SELECT DISTINCT ON (v."conversaId") v.id
  FROM "pro_labore_assistente_mensagens" v
  JOIN "pro_labore_assistente_conversas" c ON c.id = v."conversaId" AND c.tipo = 'LEAD'
  JOIN LATERAL (SELECT min(x."criadoEm") primeira FROM "pro_labore_assistente_mensagens" x WHERE x."conversaId" = v."conversaId" AND x.remetente = 'CONTATO') k ON k.primeira IS NOT NULL
  WHERE v.remetente = 'VENDEDOR' AND v."criadoEm" >= k.primeira
  ORDER BY v."conversaId", v."criadoEm", v.id
) p
WHERE m.id = p.id;
