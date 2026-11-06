-- PDF 02 · 4.4 Atividade (ATV): entidade única de tarefas.
-- Semana em paralelo: as telas atuais continuam gravando nas tabelas de
-- hoje (follow, ligação, rotina, follow do robô) e o banco copia cada
-- registro para a ATV na mesma transação (nada se perde). A régua de
-- cobrança roda em modo de registro: anota o que mandaria, sem mandar.

CREATE SEQUENCE IF NOT EXISTS "pro_labore_atividades_numero_seq";

CREATE TABLE "pro_labore_atividades" (
  "id"               TEXT PRIMARY KEY DEFAULT ('atv_' || md5(random()::text || clock_timestamp()::text)),
  "numero"           INTEGER NOT NULL DEFAULT nextval('pro_labore_atividades_numero_seq'),
  "codigo"           TEXT GENERATED ALWAYS AS ('ATV-' || lpad("numero"::text, 4, '0')) STORED,
  "usuarioId"        TEXT NOT NULL,
  "auditoriaAutor"   TEXT,
  -- FOLLOW | LIGACAO | ROTINA | FOLLOW_AUTOMATICO | REFAZER_PRE_ANALISE | PRIMEIRO_CONTATO | FOLLOW_PROPOSTA | CONFIRMAR_VISITA | VISITA | REMARCAR_VISITA | RESULTADO_VISITA | POS_ENTREGA | POS_DOCUMENTACAO | POS_REVISAO …
  "tipo"             TEXT NOT NULL,
  -- OPORTUNIDADE | RECOMENDACAO | ROTINA | REUNIAO | OCORRENCIA | PAUTA
  "origemTipo"       TEXT NOT NULL,
  "origemId"         TEXT NOT NULL,
  "leadId"           TEXT,
  -- id do Vendedor (SDR, vendedor, supervisor) ou o usuarioId do dono; null = o ARIES (automação)
  "responsavelId"    TEXT,
  "prazo"            TIMESTAMP(3) NOT NULL,
  "canal"            TEXT,
  "oQueFazer"        TEXT,
  "status"           TEXT NOT NULL DEFAULT 'PENDENTE', -- PENDENTE | EXECUTADA | CANCELADA
  "resultado"        TEXT,
  "executadaEm"      TIMESTAMP(3),
  "autorExecucao"    TEXT,
  "autorExecucaoTipo" TEXT, -- PESSOA | AUTOMACAO
  "modeloTipo"       TEXT, -- CADENCIA | ROTINA
  "modeloId"         TEXT,
  "exigeLocalizacao" BOOLEAN NOT NULL DEFAULT false,
  "latitude"         DOUBLE PRECISION,
  "longitude"        DOUBLE PRECISION,
  -- Estado da régua: NAO_INICIADA | LEMBRETE | ALERTA | ALERTA_2 | ESCALONADA | PARADA
  "reguaEstado"      TEXT NOT NULL DEFAULT 'NAO_INICIADA',
  -- De onde veio na semana em paralelo (tabela e id do registro atual)
  "registroTabela"   TEXT NOT NULL,
  "registroId"       TEXT NOT NULL,
  "criadoEm"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "pro_labore_atividades_numero_key" ON "pro_labore_atividades"("numero");
CREATE UNIQUE INDEX "pro_labore_atividades_registro_key" ON "pro_labore_atividades"("registroTabela", "registroId");
CREATE INDEX "pro_labore_atividades_fila_idx" ON "pro_labore_atividades"("usuarioId", "status", "prazo");
CREATE INDEX "pro_labore_atividades_lead_idx" ON "pro_labore_atividades"("leadId");
CREATE INDEX "pro_labore_atividades_resp_idx" ON "pro_labore_atividades"("responsavelId", "status", "prazo");

-- Régua de cobrança por tipo de origem (Configurações). Sem linha = padrão.
CREATE TABLE "pro_labore_regua_cobranca" (
  "id"                   TEXT PRIMARY KEY DEFAULT ('rg_' || md5(random()::text || clock_timestamp()::text)),
  "usuarioId"            TEXT NOT NULL,
  "origemTipo"           TEXT NOT NULL,
  "lembreteMinAntes"     INTEGER NOT NULL DEFAULT 30,
  "segundoAlertaMin"     INTEGER NOT NULL DEFAULT 120,
  "escalonamentoMin"     INTEGER NOT NULL DEFAULT 1440,
  "escalonarPara"        TEXT NOT NULL DEFAULT 'SUPERVISOR', -- SUPERVISOR | GESTOR | DONO
  "auditoriaAutor"       TEXT,
  "criadoEm"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "pro_labore_regua_cobranca_key" ON "pro_labore_regua_cobranca"("usuarioId", "origemTipo");

-- O que a régua mandaria (modo de registro) ou mandou. Só inclusão.
CREATE TABLE "pro_labore_regua_registros" (
  "id"            TEXT PRIMARY KEY DEFAULT ('rr_' || md5(random()::text || clock_timestamp()::text)),
  "atividadeId"   TEXT NOT NULL REFERENCES "pro_labore_atividades"("id") ON DELETE CASCADE,
  "etapa"         TEXT NOT NULL, -- LEMBRETE | ALERTA | ALERTA_2 | ESCALONAMENTO
  "previstoPara"  TIMESTAMP(3) NOT NULL,
  "registradoEm"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "destinatarioId" TEXT,
  "modo"          TEXT NOT NULL DEFAULT 'REGISTRO', -- REGISTRO (não envia) | ENVIO
  "enviado"       BOOLEAN NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX "pro_labore_regua_registros_key" ON "pro_labore_regua_registros"("atividadeId", "etapa");
CREATE TRIGGER aries_imutavel BEFORE UPDATE ON "pro_labore_regua_registros" FOR EACH ROW EXECUTE FUNCTION aries_imutavel();

CREATE TRIGGER aries_auditar AFTER INSERT OR UPDATE OR DELETE ON "pro_labore_atividades" FOR EACH ROW EXECUTE FUNCTION aries_auditar();
CREATE TRIGGER aries_auditar AFTER INSERT OR UPDATE OR DELETE ON "pro_labore_regua_cobranca" FOR EACH ROW EXECUTE FUNCTION aries_auditar();

-- Grava (ou atualiza) a ATV a partir do registro atual. Mantém o id e o
-- código; o autor da auditoria é o mesmo da escrita original.
CREATE OR REPLACE FUNCTION aries_atv_gravar(
  p_tabela text, p_registro text, p_usuario text, p_autor text, p_tipo text, p_origem_tipo text, p_origem_id text,
  p_lead text, p_resp text, p_prazo timestamp, p_canal text, p_fazer text, p_status text, p_resultado text,
  p_executada timestamp, p_autor_exec text, p_autor_exec_tipo text, p_modelo_tipo text, p_modelo_id text,
  p_local boolean, p_lat double precision, p_lng double precision, p_criado timestamp
) RETURNS void LANGUAGE plpgsql AS $fn$
BEGIN
  INSERT INTO "pro_labore_atividades" ("registroTabela", "registroId", "usuarioId", "auditoriaAutor", "tipo", "origemTipo", "origemId", "leadId",
    "responsavelId", "prazo", "canal", "oQueFazer", "status", "resultado", "executadaEm", "autorExecucao", "autorExecucaoTipo", "modeloTipo",
    "modeloId", "exigeLocalizacao", "latitude", "longitude", "reguaEstado", "criadoEm", "atualizadoEm")
  VALUES (p_tabela, p_registro, p_usuario, p_autor, p_tipo, p_origem_tipo, p_origem_id, p_lead, p_resp, p_prazo, p_canal, p_fazer, p_status,
    p_resultado, p_executada, p_autor_exec, p_autor_exec_tipo, p_modelo_tipo, p_modelo_id, COALESCE(p_local, false), p_lat, p_lng,
    CASE WHEN p_status = 'PENDENTE' THEN 'NAO_INICIADA' ELSE 'PARADA' END, COALESCE(p_criado, now()), now())
  ON CONFLICT ("registroTabela", "registroId") DO UPDATE SET
    "auditoriaAutor" = EXCLUDED."auditoriaAutor", "tipo" = EXCLUDED."tipo", "leadId" = EXCLUDED."leadId", "responsavelId" = EXCLUDED."responsavelId",
    "prazo" = EXCLUDED."prazo", "canal" = EXCLUDED."canal", "oQueFazer" = EXCLUDED."oQueFazer", "status" = EXCLUDED."status",
    "resultado" = EXCLUDED."resultado", "executadaEm" = EXCLUDED."executadaEm", "autorExecucao" = EXCLUDED."autorExecucao",
    "autorExecucaoTipo" = EXCLUDED."autorExecucaoTipo", "latitude" = COALESCE(EXCLUDED."latitude", "pro_labore_atividades"."latitude"),
    "longitude" = COALESCE(EXCLUDED."longitude", "pro_labore_atividades"."longitude"),
    "reguaEstado" = CASE WHEN EXCLUDED."status" <> 'PENDENTE' THEN 'PARADA' ELSE "pro_labore_atividades"."reguaEstado" END,
    "atualizadoEm" = now()
  WHERE ("pro_labore_atividades"."status", "pro_labore_atividades"."prazo", "pro_labore_atividades"."resultado", "pro_labore_atividades"."responsavelId", "pro_labore_atividades"."oQueFazer", "pro_labore_atividades"."canal", "pro_labore_atividades"."executadaEm")
    IS DISTINCT FROM (EXCLUDED."status", EXCLUDED."prazo", EXCLUDED."resultado", EXCLUDED."responsavelId", EXCLUDED."oQueFazer", EXCLUDED."canal", EXCLUDED."executadaEm");
END
$fn$;

-- Follow do CRM (comum, de crédito e as atividades obrigatórias da jornada)
CREATE OR REPLACE FUNCTION aries_atv_follow_linha(NEW "pro_labore_lead_follows") RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  t text := CASE NEW."tipo" WHEN 'CREDITO' THEN 'REFAZER_PRE_ANALISE' WHEN 'JORNADA' THEN COALESCE(NEW."contexto" ->> 'atividade', 'JORNADA') ELSE 'FOLLOW' END;
  st text := CASE NEW."status" WHEN 'FEITO' THEN 'EXECUTADA' WHEN 'CANCELADO' THEN 'CANCELADA' ELSE 'PENDENTE' END;
  quem text := NULLIF(split_part(COALESCE(NEW."auditoriaAutor", ''), '|', 2), '');
BEGIN
  PERFORM aries_atv_gravar('pro_labore_lead_follows', NEW."id", NEW."usuarioId", NEW."auditoriaAutor", t, 'OPORTUNIDADE', NEW."leadId", NEW."leadId",
    COALESCE(NEW."vendedorId", NEW."usuarioId"), NEW."agendadoPara", NEW."canal", NEW."nota", st, NEW."resultado", NEW."feitoEm",
    CASE WHEN st = 'EXECUTADA' THEN COALESCE(quem, NEW."vendedorId", NEW."usuarioId") END,
    CASE WHEN st = 'EXECUTADA' THEN CASE WHEN split_part(COALESCE(NEW."auditoriaAutor", ''), '|', 1) IN ('AUTOMACAO', 'SISTEMA') AND quem IS NULL THEN 'AUTOMACAO' ELSE 'PESSOA' END END,
    NULL, NULL, false, NULL, NULL, NEW."criadoEm");
END
$fn$;
CREATE OR REPLACE FUNCTION aries_atv_do_follow() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN PERFORM aries_atv_follow_linha(NEW); RETURN NULL; END
$fn$;
CREATE TRIGGER aries_atv AFTER INSERT OR UPDATE ON "pro_labore_lead_follows" FOR EACH ROW EXECUTE FUNCTION aries_atv_do_follow();

-- Ligação agendada (avulsa ou passo de cadência)
CREATE OR REPLACE FUNCTION aries_atv_ligacao_linha(NEW "pro_labore_ligacoes") RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  st text := CASE NEW."status" WHEN 'FEITA' THEN 'EXECUTADA' WHEN 'CANCELADA' THEN 'CANCELADA' ELSE 'PENDENTE' END;
BEGIN
  PERFORM aries_atv_gravar('pro_labore_ligacoes', NEW."id", NEW."usuarioId", NEW."auditoriaAutor", 'LIGACAO', 'OPORTUNIDADE', NEW."leadId", NEW."leadId",
    COALESCE(NEW."vendedorId", NEW."usuarioId"), NEW."agendadaPara", 'LIGACAO', NEW."instrucao", st,
    CASE WHEN st = 'CANCELADA' THEN COALESCE(NEW."motivoCancelada", NEW."resultado") ELSE NEW."resultado" END,
    NEW."registradaEm", CASE WHEN st = 'EXECUTADA' THEN COALESCE(NEW."registradaPorId", NEW."vendedorId", NEW."usuarioId") END,
    CASE WHEN st = 'EXECUTADA' THEN 'PESSOA' END,
    CASE WHEN NEW."cadenciaId" IS NOT NULL THEN 'CADENCIA' END, NEW."cadenciaId", false, NULL, NULL, NEW."criadoEm");
END
$fn$;
CREATE OR REPLACE FUNCTION aries_atv_da_ligacao() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN PERFORM aries_atv_ligacao_linha(NEW); RETURN NULL; END
$fn$;
CREATE TRIGGER aries_atv AFTER INSERT OR UPDATE ON "pro_labore_ligacoes" FOR EACH ROW EXECUTE FUNCTION aries_atv_da_ligacao();

-- Rotina da Agenda: cada conclusão é uma ocorrência executada (o ARIES
-- também cria a ocorrência pendente do dia; a chave é item|pessoa|dia).
CREATE OR REPLACE FUNCTION aries_atv_conclusao_linha(NEW "pro_labore_agenda_conclusoes") RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  it record;
  dia text := to_char(NEW."dataReferencia", 'YYYY-MM-DD');
  prazo timestamp;
BEGIN
  SELECT * INTO it FROM "pro_labore_agenda_itens" WHERE "id" = NEW."agendaItemId";
  IF NOT FOUND THEN RETURN; END IF;
  -- Hora do item em Brasília (UTC−3); sem hora, vale até o fim do dia.
  prazo := date_trunc('day', NEW."dataReferencia") + COALESCE(NULLIF(it."horario", '')::time, time '23:59') + interval '3 hours';
  PERFORM aries_atv_gravar('pro_labore_agenda_conclusoes', it."id" || '|' || NEW."autorId" || '|' || dia, it."usuarioId", 'USUARIO|' || NEW."autorId", 'ROTINA', 'ROTINA', it."id", NULL,
    NEW."autorId", prazo, NULL, it."titulo", 'EXECUTADA', 'Feito', NEW."concluidoEm", NEW."autorId", 'PESSOA', 'ROTINA', it."id",
    it."exigeLocalizacao", NEW."latitude", NEW."longitude", NEW."concluidoEm");
END
$fn$;
CREATE OR REPLACE FUNCTION aries_atv_da_rotina() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN PERFORM aries_atv_conclusao_linha(NEW); RETURN NULL; END
$fn$;
CREATE TRIGGER aries_atv AFTER INSERT ON "pro_labore_agenda_conclusoes" FOR EACH ROW EXECUTE FUNCTION aries_atv_da_rotina();

-- Desfazer o "feito" da rotina: a ocorrência volta a pendente.
CREATE OR REPLACE FUNCTION aries_atv_rotina_desfeita() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  UPDATE "pro_labore_atividades" SET "status" = 'PENDENTE', "resultado" = NULL, "executadaEm" = NULL, "autorExecucao" = NULL, "autorExecucaoTipo" = NULL,
    "reguaEstado" = 'NAO_INICIADA', "atualizadoEm" = now()
  WHERE "registroTabela" = 'pro_labore_agenda_conclusoes' AND "registroId" = OLD."agendaItemId" || '|' || OLD."autorId" || '|' || to_char(OLD."dataReferencia", 'YYYY-MM-DD');
  RETURN NULL;
END
$fn$;
CREATE TRIGGER aries_atv_desfeita AFTER DELETE ON "pro_labore_agenda_conclusoes" FOR EACH ROW EXECUTE FUNCTION aries_atv_rotina_desfeita();

-- Follow automático do robô: ATV executada pelo sistema, autor "automação".
CREATE OR REPLACE FUNCTION aries_atv_robo_linha(NEW "pro_labore_assistente_mensagens") RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  c record;
BEGIN
  IF NEW."origem" IS DISTINCT FROM 'FOLLOW' THEN RETURN; END IF;
  SELECT cv."leadId", v."usuarioId" INTO c FROM "pro_labore_assistente_conversas" cv
    JOIN "pro_labore_assistente_comercial" a ON a."id" = cv."assistenteId" JOIN "pro_labore_vendedores" v ON v."id" = a."vendedorId"
    WHERE cv."id" = NEW."conversaId";
  IF NOT FOUND OR c."leadId" IS NULL THEN RETURN; END IF;
  PERFORM aries_atv_gravar('pro_labore_assistente_mensagens', NEW."id", c."usuarioId", 'AUTOMACAO|||follow', 'FOLLOW_AUTOMATICO', 'OPORTUNIDADE', c."leadId", c."leadId",
    NULL, COALESCE(NEW."enviadaEm", NEW."criadoEm"), 'WHATSAPP', 'Follow automático' || COALESCE(' · ' || NEW."followFluxo", ''), 'EXECUTADA', 'Mensagem enviada',
    COALESCE(NEW."enviadaEm", NEW."criadoEm"), 'AUTOMACAO', 'AUTOMACAO', NULL, NULL, false, NULL, NULL, NEW."criadoEm");
END
$fn$;
CREATE OR REPLACE FUNCTION aries_atv_do_follow_robo() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN IF NEW."origem" = 'FOLLOW' THEN PERFORM aries_atv_robo_linha(NEW); END IF; RETURN NULL; END
$fn$;
CREATE TRIGGER aries_atv AFTER INSERT ON "pro_labore_assistente_mensagens" FOR EACH ROW EXECUTE FUNCTION aries_atv_do_follow_robo();

-- Cópia dos registros existentes, inclusive concluídos (data, autor e
-- resultado originais), na ordem em que foram criados.
DO $mig$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT 'f' k, id, "criadoEm" t FROM "pro_labore_lead_follows"
    UNION ALL SELECT 'l', id, "criadoEm" FROM "pro_labore_ligacoes"
    UNION ALL SELECT 'c', id, "concluidoEm" FROM "pro_labore_agenda_conclusoes"
    UNION ALL SELECT 'm', id, "criadoEm" FROM "pro_labore_assistente_mensagens" WHERE "origem" = 'FOLLOW'
    ORDER BY 3, 2
  LOOP
    IF r.k = 'f' THEN PERFORM aries_atv_follow_linha(x) FROM "pro_labore_lead_follows" x WHERE x.id = r.id;
    ELSIF r.k = 'l' THEN PERFORM aries_atv_ligacao_linha(x) FROM "pro_labore_ligacoes" x WHERE x.id = r.id;
    ELSIF r.k = 'c' THEN PERFORM aries_atv_conclusao_linha(x) FROM "pro_labore_agenda_conclusoes" x WHERE x.id = r.id;
    ELSE PERFORM aries_atv_robo_linha(x) FROM "pro_labore_assistente_mensagens" x WHERE x.id = r.id;
    END IF;
  END LOOP;
END
$mig$;

-- Copiados da carga inicial: a régua não cobra o passado (só o que vencer daqui para a frente).
UPDATE "pro_labore_atividades" SET "reguaEstado" = 'PARADA' WHERE "status" = 'PENDENTE' AND "prazo" < now() - interval '24 hours';
