-- PDF 04 · Onda 3 — Telas: Hoje por papel, Lente, Pergunte ao ARIES, novo menu e piloto.
-- Só acrescenta (tabelas e colunas novas); nada existente muda nem é apagado.

-- Função de quem tem login e não vende: GESTOR_TRAFEGO | FINANCEIRO (nulo = pelo papel).
-- Define o Hoje da pessoa e a exceção do P7 aprovada pelo dono em 09/11/2026:
-- o gestor de tráfego vê o gasto com anúncio; o financeiro, as comissões a pagar.
ALTER TABLE "pro_labore_vendedores" ADD COLUMN IF NOT EXISTS "funcao" TEXT;

-- Orçamento de anúncio planejado para o mês (Hoje do gestor de tráfego: gasto contra o planejado).
ALTER TABLE "pro_labore_parametros" ADD COLUMN IF NOT EXISTS "orcamentoAnuncioMensal" DOUBLE PRECISION;

-- Configuração do Hoje por papel: os três números (chaves do dicionário), a ordem da fila e a Lente.
CREATE TABLE "pro_labore_hoje_config" (
  "id"             TEXT PRIMARY KEY,
  "usuarioId"      TEXT NOT NULL,
  "papel"          TEXT NOT NULL,           -- VENDEDOR | SDR | SUPERVISOR | DONO | TRAFEGO | FINANCEIRO | SOCIAL_MEDIA
  "numeros"        TEXT[] NOT NULL DEFAULT '{}',
  "fila"           TEXT[] NOT NULL DEFAULT '{}',
  "lente"          TEXT,
  "auditoriaAutor" TEXT,
  "atualizadoEm"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "pro_labore_hoje_config_key" ON "pro_labore_hoje_config"("usuarioId", "papel");
CREATE TRIGGER aries_auditar AFTER INSERT OR UPDATE OR DELETE ON "pro_labore_hoje_config" FOR EACH ROW EXECUTE FUNCTION aries_auditar();

-- Conversa do Pergunte ao ARIES: pergunta, métricas escolhidas, valores preenchidos pelo sistema e resposta.
CREATE TABLE "pro_labore_pergunte_conversas" (
  "id"        TEXT PRIMARY KEY,
  "usuarioId" TEXT NOT NULL,
  "pessoaId"  TEXT NOT NULL,                -- vendedor ou o dono
  "papel"     TEXT NOT NULL,
  "canal"     TEXT NOT NULL DEFAULT 'TELA', -- TELA | WHATSAPP
  "pergunta"  TEXT NOT NULL,
  "metricas"  JSONB NOT NULL DEFAULT '[]',  -- [{ chave, periodo, escopo }]
  "valores"   JSONB NOT NULL DEFAULT '[]',  -- números preenchidos pelo sistema (nunca vão à IA)
  "resposta"  TEXT NOT NULL,
  "naoSabe"   BOOLEAN NOT NULL DEFAULT false,
  "acoes"     JSONB NOT NULL DEFAULT '[]',  -- ATVs criadas a partir da resposta
  "criadoEm"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "pro_labore_pergunte_conversas_idx" ON "pro_labore_pergunte_conversas"("usuarioId", "pessoaId", "criadoEm");

-- Registro do que foi enviado à IA (conferência do teste): imutável.
CREATE TABLE "pro_labore_ia_envios" (
  "id"         TEXT PRIMARY KEY,
  "usuarioId"  TEXT NOT NULL,
  "conversaId" TEXT,
  "finalidade" TEXT NOT NULL,               -- ENTENDER | ESCREVER
  "conteudo"   TEXT NOT NULL,
  "criadoEm"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "pro_labore_ia_envios_idx" ON "pro_labore_ia_envios"("usuarioId", "criadoEm");
CREATE TRIGGER aries_imutavel BEFORE UPDATE OR DELETE ON "pro_labore_ia_envios" FOR EACH ROW EXECUTE FUNCTION aries_imutavel();

-- Uso das telas (princípio visual 10): cada abertura e as ações feitas a partir dela.
CREATE TABLE "pro_labore_uso_telas" (
  "id"        TEXT PRIMARY KEY,
  "usuarioId" TEXT NOT NULL,
  "pessoaId"  TEXT NOT NULL,
  "papel"     TEXT NOT NULL,
  "aba"       TEXT NOT NULL,
  "versao"    TEXT NOT NULL DEFAULT 'ATUAL', -- NOVA | ATUAL
  "abertaEm"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acoes"     INTEGER NOT NULL DEFAULT 0,
  "ultimaAcao" TEXT
);
CREATE INDEX "pro_labore_uso_telas_idx" ON "pro_labore_uso_telas"("usuarioId", "aba", "abertaEm");

-- Participante do piloto: quem usa a versão nova das telas, de quando até quando.
CREATE TABLE "pro_labore_piloto" (
  "id"             TEXT PRIMARY KEY,
  "usuarioId"      TEXT NOT NULL,
  "pessoaId"       TEXT NOT NULL,
  "versao"         TEXT NOT NULL DEFAULT 'NOVA', -- NOVA | ATUAL
  "inicio"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fim"            TIMESTAMP(3),
  "auditoriaAutor" TEXT
);
CREATE UNIQUE INDEX "pro_labore_piloto_key" ON "pro_labore_piloto"("usuarioId", "pessoaId");
CREATE TRIGGER aries_auditar AFTER INSERT OR UPDATE OR DELETE ON "pro_labore_piloto" FOR EACH ROW EXECUTE FUNCTION aries_auditar();
-- Liberação para todos (registrada): data em que a versão nova passou a valer para a equipe inteira.
ALTER TABLE "pro_labore_parametros" ADD COLUMN IF NOT EXISTS "telasNovasParaTodosEm" TIMESTAMP(3);
