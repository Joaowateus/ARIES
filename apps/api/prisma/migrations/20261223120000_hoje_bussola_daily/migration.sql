-- PDF 06 · Hoje (bússola) e Daily (decisões). Só acrescenta.
-- Expediente (prazos de atividades no fim do expediente) no parâmetro da loja.
ALTER TABLE "pro_labore_parametros" ADD COLUMN IF NOT EXISTS "expediente" JSONB;

-- Biblioteca de frases (autor e fonte obrigatórios; só aparece aprovada e ativa).
CREATE TABLE IF NOT EXISTS "pro_labore_frases" (
  "id" TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "texto" TEXT NOT NULL,
  "autor" TEXT NOT NULL,
  "fonte" TEXT NOT NULL,
  "temas" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "ativa" BOOLEAN NOT NULL DEFAULT false,
  "aprovadaPor" TEXT,
  "aprovadaEm" TIMESTAMP(3),
  "origem" TEXT NOT NULL DEFAULT 'DONO',
  "ultimaVezUsada" TIMESTAMP(3),
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pro_labore_frases_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "pro_labore_frases_usuarioId_idx" ON "pro_labore_frases"("usuarioId");

-- Frase usada em cada dia (a mesma frase não volta antes de 30 dias).
CREATE TABLE IF NOT EXISTS "pro_labore_frases_uso" (
  "id" TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "fraseId" TEXT NOT NULL,
  "dia" TEXT NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pro_labore_frases_uso_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "pro_labore_frases_uso_usuarioId_dia_key" ON "pro_labore_frases_uso"("usuarioId", "dia");

-- Resumo diário do Hoje por pessoa (texto, cartões por área, frase do dia).
CREATE TABLE IF NOT EXISTS "pro_labore_hoje_resumos" (
  "id" TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "pessoaId" TEXT NOT NULL,
  "papel" TEXT NOT NULL,
  "dia" TEXT NOT NULL,
  "texto" TEXT NOT NULL,
  "origemTexto" TEXT NOT NULL DEFAULT 'MODELO',
  "cartoes" JSONB,
  "fraseId" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pro_labore_hoje_resumos_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "pro_labore_hoje_resumos_usuarioId_pessoaId_dia_key" ON "pro_labore_hoje_resumos"("usuarioId", "pessoaId", "dia");

-- Itens da pauta do Daily (enviados do Hoje, adiados de um Daily anterior) e a situação de cada item.
CREATE TABLE IF NOT EXISTS "pro_labore_daily_itens" (
  "id" TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "bloco" TEXT NOT NULL,
  "origem" TEXT NOT NULL,
  "texto" TEXT NOT NULL,
  "detalhe" TEXT,
  "refTipo" TEXT,
  "refId" TEXT,
  "enviadoPorId" TEXT,
  "enviadoPorNome" TEXT,
  "enviadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "situacao" TEXT NOT NULL DEFAULT 'ABERTO',
  "reuniaoId" TEXT,
  "motivoAdiamento" TEXT,
  "adiadoDeId" TEXT,
  "resolvidoEm" TIMESTAMP(3),
  CONSTRAINT "pro_labore_daily_itens_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "pro_labore_daily_itens_usuarioId_situacao_idx" ON "pro_labore_daily_itens"("usuarioId", "situacao");

-- Decisões do Daily: uma decisão, um ou mais responsáveis, uma atividade por responsável.
CREATE TABLE IF NOT EXISTS "pro_labore_daily_decisoes" (
  "id" TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "reuniaoId" TEXT NOT NULL,
  "bloco" TEXT NOT NULL,
  "itemId" TEXT,
  "itemTipo" TEXT,
  "texto" TEXT NOT NULL,
  "responsaveis" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "prazo" TIMESTAMP(3) NOT NULL,
  "prioridade" TEXT NOT NULL DEFAULT 'MEDIA',
  "atividadeIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pro_labore_daily_decisoes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "pro_labore_daily_decisoes_usuarioId_reuniaoId_idx" ON "pro_labore_daily_decisoes"("usuarioId", "reuniaoId");
