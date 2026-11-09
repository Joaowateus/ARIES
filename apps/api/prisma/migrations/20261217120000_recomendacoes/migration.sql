-- PDF 03 · Onda 2: Recomendação (REC), detectores da área comercial,
-- memória, sugestões mensais de ajuste e a avaliação da amostra de utilidade.
-- Só acrescenta tabelas e colunas.

CREATE SEQUENCE IF NOT EXISTS "pro_labore_recomendacoes_numero_seq";
CREATE TABLE "pro_labore_recomendacoes" (
  "id"             TEXT PRIMARY KEY DEFAULT ('rec_' || md5(random()::text || clock_timestamp()::text)),
  "numero"         INTEGER NOT NULL DEFAULT nextval('pro_labore_recomendacoes_numero_seq'),
  "codigo"         TEXT GENERATED ALWAYS AS ('REC-' || lpad("numero"::text, 4, '0')) STORED,
  "usuarioId"      TEXT NOT NULL,
  "auditoriaAutor" TEXT,
  "titulo"         TEXT NOT NULL,
  "area"           TEXT NOT NULL,           -- ATENDIMENTO | FUNIL | ATIVIDADES | CREDITO | ANUNCIOS | RESULTADO
  "detector"       TEXT NOT NULL,
  "tipo"           TEXT NOT NULL DEFAULT 'PROBLEMA', -- PROBLEMA | FUNCIONANDO
  "evidencia"      JSONB NOT NULL,          -- métricas do dicionário: valores, período, comparação
  "forca"          TEXT NOT NULL,           -- COMPROVADA | PADRAO | HIPOTESE
  "impacto"        JSONB,                   -- { unidade, valor, texto } — sempre estimativa
  "acaoSugerida"   TEXT NOT NULL,
  "nivelAutonomia" INTEGER NOT NULL DEFAULT 1,
  "alvoTipo"       TEXT NOT NULL,           -- PESSOA | EQUIPE | ETAPA | CREDITO | BANCO | ANUNCIOS | RESULTADO
  "alvoId"         TEXT,
  "destinatarioId" TEXT,                    -- quem recebe pelo roteamento normal (vendedor/SDR/supervisor) ou o dono
  "acompanhaIds"   TEXT[] NOT NULL DEFAULT '{}',
  "visivelPara"    TEXT[] NOT NULL DEFAULT '{}', -- quem vê agora (modo silencioso: dono e supervisor)
  "prazo"          TIMESTAMP(3) NOT NULL,
  "status"         TEXT NOT NULL DEFAULT 'NOVA', -- NOVA | ACEITA | DESCARTADA | EM_EXECUCAO | AVALIADA | ENCERRADA
  "motivoDescarte" TEXT,
  "contexto"       TEXT NOT NULL,           -- detector|alvo|tipo: não repetir o que foi descartado
  "indicadorAntes" JSONB,
  "indicadorDepois" JSONB,
  "resultado"      TEXT,                    -- MANTER | AJUSTAR | REVERTER
  "resultadoNota"  TEXT,
  "decididoPor"    TEXT,
  "aceitaEm"       TIMESTAMP(3),
  "executadaEm"    TIMESTAMP(3),
  "avaliadaEm"     TIMESTAMP(3),
  "encerradaEm"    TIMESTAMP(3),
  "criadoEm"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "pro_labore_recomendacoes_numero_key" ON "pro_labore_recomendacoes"("numero");
CREATE INDEX "pro_labore_recomendacoes_idx" ON "pro_labore_recomendacoes"("usuarioId", "status", "criadoEm");
CREATE INDEX "pro_labore_recomendacoes_ctx_idx" ON "pro_labore_recomendacoes"("usuarioId", "contexto");
CREATE TRIGGER aries_auditar AFTER INSERT OR UPDATE OR DELETE ON "pro_labore_recomendacoes" FOR EACH ROW EXECUTE FUNCTION aries_auditar();

-- Configuração de cada detector (sem linha = padrão do código). Só o dono edita.
CREATE TABLE "pro_labore_detectores" (
  "id"             TEXT PRIMARY KEY,
  "usuarioId"      TEXT NOT NULL,
  "chave"          TEXT NOT NULL,
  "ativo"          BOOLEAN NOT NULL DEFAULT true,
  "nivelAutonomia" INTEGER NOT NULL DEFAULT 1,
  "volumeMinimo"   INTEGER,
  "limite"         DOUBLE PRECISION,        -- variação que dispara (ex.: 0,2 = 20% pior)
  "auditoriaAutor" TEXT,
  "atualizadoEm"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "pro_labore_detectores_key" ON "pro_labore_detectores"("usuarioId", "chave");
CREATE TRIGGER aries_auditar AFTER INSERT OR UPDATE OR DELETE ON "pro_labore_detectores" FOR EACH ROW EXECUTE FUNCTION aries_auditar();

-- Memória: o que já foi tentado, em que contexto e o resultado (só inclusão).
CREATE TABLE "pro_labore_recomendacoes_memoria" (
  "id"            TEXT PRIMARY KEY,
  "usuarioId"     TEXT NOT NULL,
  "recomendacaoId" TEXT,
  "detector"      TEXT NOT NULL,
  "contexto"      TEXT NOT NULL,
  "acao"          TEXT NOT NULL,            -- CRIADA | DESCARTADA | ACEITA | AVALIADA | JUNTADA_A_CORRECAO | REPETICAO_EVITADA
  "resultado"     TEXT,
  "detalhe"       TEXT,
  "em"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "pro_labore_rec_memoria_idx" ON "pro_labore_recomendacoes_memoria"("usuarioId", "contexto", "em");
CREATE TRIGGER aries_imutavel BEFORE UPDATE OR DELETE ON "pro_labore_recomendacoes_memoria" FOR EACH ROW EXECUTE FUNCTION aries_imutavel();

-- Sugestões mensais de ajuste de parâmetro (valem só depois de aprovadas pelo dono).
CREATE TABLE "pro_labore_sugestoes_ajuste" (
  "id"            TEXT PRIMARY KEY,
  "usuarioId"     TEXT NOT NULL,
  "mes"           TEXT NOT NULL,            -- AAAA-MM
  "parametro"     TEXT NOT NULL,
  "valorAtual"    JSONB,
  "valorSugerido" JSONB,
  "justificativa" TEXT NOT NULL,
  "status"        TEXT NOT NULL DEFAULT 'PENDENTE', -- PENDENTE | APROVADA | RECUSADA
  "decididoPor"   TEXT,
  "decididoEm"    TIMESTAMP(3),
  "auditoriaAutor" TEXT,
  "criadoEm"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "pro_labore_sugestoes_ajuste_key" ON "pro_labore_sugestoes_ajuste"("usuarioId", "mes", "parametro");
CREATE TRIGGER aries_auditar AFTER INSERT OR UPDATE OR DELETE ON "pro_labore_sugestoes_ajuste" FOR EACH ROW EXECUTE FUNCTION aries_auditar();

-- Teste de utilidade: dono e supervisor marcam pertinente ou não.
CREATE TABLE "pro_labore_recomendacoes_avaliacoes" (
  "id"             TEXT PRIMARY KEY,
  "recomendacaoId" TEXT NOT NULL REFERENCES "pro_labore_recomendacoes"("id") ON DELETE CASCADE,
  "avaliadorId"    TEXT NOT NULL,
  "pertinente"     BOOLEAN NOT NULL,
  "comentario"     TEXT,
  "em"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "pro_labore_rec_avaliacoes_key" ON "pro_labore_recomendacoes_avaliacoes"("recomendacaoId", "avaliadorId");

-- Correção da qualidade que já cobre um achado de detector (não vira REC duplicada).
ALTER TABLE "pro_labore_correcoes_pendentes" ADD COLUMN "detectores" TEXT[] NOT NULL DEFAULT '{}';

-- Roteamento das RECs: SILENCIOSO (só dono e supervisor) até a liberação do dono; depois NORMAL.
ALTER TABLE "pro_labore_parametros" ADD COLUMN "recRoteamento" TEXT NOT NULL DEFAULT 'SILENCIOSO';
