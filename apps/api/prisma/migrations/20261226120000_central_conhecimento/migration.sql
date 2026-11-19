-- PDF 07 · Central de Conhecimento (Fase 2, arquitetura aprovada pelo dono em 19/11/2026).
-- Tudo aditivo (P11): tabelas novas e campos opcionais. Nada é apagado nem renomeado.

-- ---------------------------------------------------------------------
-- Fontes: catálogo de cada fonte da Central e a saúde dela, por loja.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "pro_labore_cc_fontes" (
  "id"                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "usuarioId"           TEXT NOT NULL,
  "chave"               TEXT NOT NULL,
  "situacao"            TEXT NOT NULL DEFAULT 'EM_DIA', -- EM_DIA | ATRASADA | FALHA | NAO_INTEGRADA
  "ultimaAtualizacaoEm" TIMESTAMP(3),                   -- último dado novo processado ou sincronizado
  "ultimoErro"          TEXT,
  "ultimoErroEm"        TIMESTAMP(3),
  "itensIndexados"      INTEGER NOT NULL DEFAULT 0,
  "ultimaConferenciaEm" TIMESTAMP(3),
  "cargaInicialEm"      TIMESTAMP(3),
  "cargaCursor"         TEXT,                            -- carga inicial em rodadas: último id processado
  "atualizadoEm"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "pro_labore_cc_fontes_key" ON "pro_labore_cc_fontes"("usuarioId", "chave");

-- ---------------------------------------------------------------------
-- Eventos: o que mudou e precisa ir para o índice. Uma linha por registro
-- (fonte + id): cada nova mudança rearma a linha, então reprocessar nunca
-- duplica e a tabela não cresce além do número de registros.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "pro_labore_cc_eventos" (
  "id"                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "usuarioId"         TEXT,
  "fonte"             TEXT NOT NULL,                    -- nome da tabela de origem (ou fonte da integração)
  "registroId"        TEXT NOT NULL,                    -- id do registro; '*:<usuarioId>' = a fonte inteira
  "tipo"              TEXT NOT NULL,                    -- CRIADO | ALTERADO | EXCLUIDO | SINCRONIZADO
  "origem"            TEXT NOT NULL DEFAULT 'GATILHO',  -- GATILHO | SINCRONIZACAO | CARGA | CONFERENCIA
  "criadoEm"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processadoEm"      TIMESTAMP(3),
  "tentativas"        INTEGER NOT NULL DEFAULT 0,
  "ultimoErro"        TEXT,
  "proximaTentativaEm" TIMESTAMP(3)
);
CREATE UNIQUE INDEX IF NOT EXISTS "pro_labore_cc_eventos_key" ON "pro_labore_cc_eventos"("fonte", "registroId");
CREATE INDEX IF NOT EXISTS "pro_labore_cc_eventos_pendentes_idx" ON "pro_labore_cc_eventos"("criadoEm") WHERE "processadoEm" IS NULL;

-- Detecção na mesma transação da gravação: o gatilho grava (ou rearma) o evento.
-- Não depende de aries.sem_auditoria: importações em lote também chegam ao índice.
CREATE OR REPLACE FUNCTION aries_cc_evento() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE
  j jsonb;
  reg text;
BEGIN
  IF TG_OP = 'DELETE' THEN j := to_jsonb(OLD); ELSE j := to_jsonb(NEW); END IF;
  reg := j ->> 'id';
  IF reg IS NULL THEN RETURN NULL; END IF;
  INSERT INTO "pro_labore_cc_eventos" ("usuarioId", "fonte", "registroId", "tipo", "origem")
  VALUES (j ->> 'usuarioId', TG_TABLE_NAME, reg, CASE TG_OP WHEN 'INSERT' THEN 'CRIADO' WHEN 'DELETE' THEN 'EXCLUIDO' ELSE 'ALTERADO' END, 'GATILHO')
  ON CONFLICT ("fonte", "registroId") DO UPDATE SET
    "tipo" = EXCLUDED."tipo", "origem" = 'GATILHO', "criadoEm" = CURRENT_TIMESTAMP, "processadoEm" = NULL,
    "tentativas" = 0, "ultimoErro" = NULL, "proximaTentativaEm" = NULL,
    "usuarioId" = COALESCE(EXCLUDED."usuarioId", "pro_labore_cc_eventos"."usuarioId");
  RETURN NULL;
END
$fn$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'pro_labore_leads', 'pro_labore_clientes', 'pro_labore_vendas', 'pro_labore_sm_motos_estoque',
    'pro_labore_atividades', 'pro_labore_assistente_conhecimento', 'pro_labore_recomendacoes',
    'pro_labore_ocorrencias', 'pro_labore_reunioes', 'pro_labore_notas', 'pro_labore_sm_pautas',
    'pro_labore_lancamentos_financeiros', 'pro_labore_daily_decisoes', 'pro_labore_metricas_versoes'
  ] LOOP
    IF to_regclass(format('%I', t)) IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'aries_cc_evento' AND tgrelid = to_regclass(format('%I', t))) THEN
      EXECUTE format('CREATE TRIGGER aries_cc_evento AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION aries_cc_evento()', t);
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- Índice de pesquisa: só o necessário para achar e abrir a tela de origem.
-- Nunca entram: CPF, nascimento, valores em R$, custos, texto das conversas,
-- notas da negociação, Processo e anotações de outra pessoa (lista de campos
-- permitidos por fonte em lib/centralConhecimento/fontes.ts, com teste).
-- textoBusca já vem sem acento e em minúsculas (feito no servidor).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "pro_labore_cc_documentos" (
  "id"            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "usuarioId"     TEXT NOT NULL,
  "fonte"         TEXT NOT NULL,
  "registroId"    TEXT NOT NULL,
  "tipo"          TEXT NOT NULL,
  "titulo"        TEXT NOT NULL,
  "resumo"        TEXT,
  "palavrasChave" TEXT[] NOT NULL DEFAULT '{}',
  "textoBusca"    TEXT NOT NULL,
  "tsv"           tsvector GENERATED ALWAYS AS (to_tsvector('portuguese'::regconfig, "textoBusca")) STORED,
  "papeis"        TEXT[] NOT NULL DEFAULT '{}',         -- papéis que podem ver
  "vendedorId"    TEXT,                                 -- dono do registro (escopo pessoal)
  "autorId"       TEXT,                                 -- anotações: só o autor
  "link"          TEXT NOT NULL,
  "dataRegistro"  TIMESTAMP(3),
  "versaoFonte"   TIMESTAMP(3),
  "atualizadoEm"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "pro_labore_cc_documentos_key" ON "pro_labore_cc_documentos"("fonte", "registroId");
CREATE INDEX IF NOT EXISTS "pro_labore_cc_documentos_usuario_idx" ON "pro_labore_cc_documentos"("usuarioId", "tipo");
CREATE INDEX IF NOT EXISTS "pro_labore_cc_documentos_tsv_idx" ON "pro_labore_cc_documentos" USING GIN ("tsv");

-- Pesquisa aproximada (erros de digitação): pg_trgm, nativa do Postgres/Supabase.
-- Se a extensão não puder ser criada, a busca segue sem ela e a Saúde avisa.
DO $$
DECLARE esquema text;
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_trgm indisponível: %', SQLERRM;
  END;
  SELECT n.nspname INTO esquema FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace WHERE e.extname = 'pg_trgm';
  IF esquema IS NOT NULL THEN
    EXECUTE format('CREATE INDEX IF NOT EXISTS "pro_labore_cc_documentos_trgm_idx" ON "pro_labore_cc_documentos" USING GIN ("textoBusca" %I.gin_trgm_ops)', esquema);
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- Carga e conferência diária; cada diferença encontrada vira uma divergência.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "pro_labore_cc_conferencias" (
  "id"            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "usuarioId"     TEXT NOT NULL,
  "fonte"         TEXT NOT NULL,
  "tipo"          TEXT NOT NULL,                       -- CARGA_INICIAL | DIARIA
  "inicio"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fim"           TIMESTAMP(3),
  "contagemFonte" INTEGER,
  "contagemIndice" INTEGER,
  "divergencias"  INTEGER NOT NULL DEFAULT 0,
  "situacao"      TEXT NOT NULL DEFAULT 'RODANDO',     -- RODANDO | OK | DIVERGENTE | FALHA
  "erro"          TEXT
);
CREATE INDEX IF NOT EXISTS "pro_labore_cc_conferencias_idx" ON "pro_labore_cc_conferencias"("usuarioId", "inicio");

CREATE TABLE IF NOT EXISTS "pro_labore_cc_divergencias" (
  "id"           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "usuarioId"    TEXT NOT NULL,
  "fonte"        TEXT NOT NULL,
  "registroId"   TEXT,
  "descricao"    TEXT NOT NULL,
  "desde"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvidaEm"  TIMESTAMP(3),
  "resolvidaPor" TEXT
);
CREATE INDEX IF NOT EXISTS "pro_labore_cc_divergencias_idx" ON "pro_labore_cc_divergencias"("usuarioId", "resolvidaEm");

-- Pesquisas feitas no Explorar (números do topo e "sem resultado" na Saúde).
CREATE TABLE IF NOT EXISTS "pro_labore_cc_pesquisas" (
  "id"         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "usuarioId"  TEXT NOT NULL,
  "pessoaId"   TEXT NOT NULL,
  "papel"      TEXT NOT NULL,
  "termo"      TEXT NOT NULL,
  "resultados" INTEGER NOT NULL DEFAULT 0,
  "criadoEm"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "pro_labore_cc_pesquisas_idx" ON "pro_labore_cc_pesquisas"("usuarioId", "criadoEm");

-- ---------------------------------------------------------------------
-- Conhecimento comercial: versões dos verbetes (D4), validade e fontes ligadas.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "pro_labore_assistente_conhecimento_versoes" (
  "id"             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "conhecimentoId" TEXT NOT NULL,
  "usuarioId"      TEXT NOT NULL,
  "versao"         INTEGER NOT NULL,
  "titulo"         TEXT NOT NULL,
  "resposta"       TEXT,
  "palavrasChave"  TEXT[] NOT NULL DEFAULT '{}',
  "status"         TEXT NOT NULL,
  "autor"          TEXT,
  "motivo"         TEXT,
  "criadoEm"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "pro_labore_assistente_conhecimento_versoes_key" ON "pro_labore_assistente_conhecimento_versoes"("conhecimentoId", "versao");
CREATE TRIGGER aries_imutavel BEFORE UPDATE OR DELETE ON "pro_labore_assistente_conhecimento_versoes" FOR EACH ROW EXECUTE FUNCTION aries_imutavel();

ALTER TABLE "pro_labore_assistente_conhecimento" ADD COLUMN IF NOT EXISTS "validadeAte" TIMESTAMP(3);
ALTER TABLE "pro_labore_assistente_conhecimento" ADD COLUMN IF NOT EXISTS "fontesLigadas" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "pro_labore_assistente_conhecimento" ADD COLUMN IF NOT EXISTS "versaoAtual" INTEGER NOT NULL DEFAULT 1;

-- Versão 1 de cada verbete que já existe (o histórico começa do estado atual).
INSERT INTO "pro_labore_assistente_conhecimento_versoes" ("conhecimentoId", "usuarioId", "versao", "titulo", "resposta", "palavrasChave", "status", "autor", "motivo", "criadoEm")
SELECT c.id, c."usuarioId", 1, c.titulo, c.resposta, c."palavrasChave", c.status, COALESCE(c."aprovadoPor", c."criadoPor"), 'Estado na criação da Central de Conhecimento', CURRENT_TIMESTAMP
FROM "pro_labore_assistente_conhecimento" c
WHERE NOT EXISTS (SELECT 1 FROM "pro_labore_assistente_conhecimento_versoes" v WHERE v."conhecimentoId" = c.id);

-- Cada mudança de título, resposta, palavras-chave ou situação grava a próxima versão
-- (no banco, para valer em todo caminho: tela, aprendizado e robô).
CREATE OR REPLACE FUNCTION aries_cc_versao_verbete() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE v integer;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.titulo IS NOT DISTINCT FROM OLD.titulo AND NEW.resposta IS NOT DISTINCT FROM OLD.resposta
     AND NEW."palavrasChave" IS NOT DISTINCT FROM OLD."palavrasChave" AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  SELECT COALESCE(max("versao"), 0) + 1 INTO v FROM "pro_labore_assistente_conhecimento_versoes" WHERE "conhecimentoId" = NEW.id;
  INSERT INTO "pro_labore_assistente_conhecimento_versoes" ("conhecimentoId", "usuarioId", "versao", "titulo", "resposta", "palavrasChave", "status", "autor", "motivo")
  VALUES (NEW.id, NEW."usuarioId", v, NEW.titulo, NEW.resposta, NEW."palavrasChave", NEW.status,
          COALESCE(NULLIF(current_setting('aries.autor', true), ''), CASE WHEN NEW.status = 'ATIVO' THEN NEW."aprovadoPor" END, NEW."criadoPor"),
          CASE WHEN TG_OP = 'INSERT' THEN 'Criado' WHEN NEW.status IS DISTINCT FROM OLD.status THEN 'Situação: ' || NEW.status ELSE 'Editado' END);
  NEW."versaoAtual" := v;
  RETURN NEW;
END
$fn$;
CREATE TRIGGER aries_cc_versao_verbete BEFORE INSERT OR UPDATE ON "pro_labore_assistente_conhecimento" FOR EACH ROW EXECUTE FUNCTION aries_cc_versao_verbete();

-- ---------------------------------------------------------------------
-- Pergunte: o que cada resposta usou (consultas, fichas e frescor das fontes)
-- e a marcação "resposta errada" para a Saúde e o aceite.
-- ---------------------------------------------------------------------
ALTER TABLE "pro_labore_pergunte_conversas" ADD COLUMN IF NOT EXISTS "consultas" JSONB;
ALTER TABLE "pro_labore_pergunte_conversas" ADD COLUMN IF NOT EXISTS "fontes" JSONB;
ALTER TABLE "pro_labore_pergunte_conversas" ADD COLUMN IF NOT EXISTS "marcadaErradaEm" TIMESTAMP(3);
ALTER TABLE "pro_labore_pergunte_conversas" ADD COLUMN IF NOT EXISTS "marcadaErradaPor" TEXT;
ALTER TABLE "pro_labore_pergunte_conversas" ADD COLUMN IF NOT EXISTS "tratadaEm" TIMESTAMP(3);

-- Dicionário: situação da versão da ficha (RASCUNHO aguarda o dono; APROVADA vale).
ALTER TABLE "pro_labore_metricas_versoes" ADD COLUMN IF NOT EXISTS "situacao" TEXT NOT NULL DEFAULT 'APROVADA';
