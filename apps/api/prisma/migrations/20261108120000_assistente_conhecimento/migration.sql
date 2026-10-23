-- CreateTable
CREATE TABLE "pro_labore_assistente_conhecimento" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "resposta" TEXT,
    "rascunho" TEXT,
    "rascunhoOrigem" TEXT,
    "palavrasChave" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "respostasEquipe" JSONB,
    "modelo" TEXT,
    "etapa" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PARA_REVISAR',
    "origem" TEXT NOT NULL DEFAULT 'MANUAL',
    "chave" TEXT,
    "ocorrencias" INTEGER NOT NULL DEFAULT 0,
    "usos" INTEGER NOT NULL DEFAULT 0,
    "avancos" INTEGER NOT NULL DEFAULT 0,
    "ultimaOcorrenciaEm" TIMESTAMP(3),
    "criadoPor" TEXT,
    "aprovadoPor" TEXT,
    "aprovadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_assistente_conhecimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_assistente_conhecimento_ocorrencias" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "conhecimentoId" TEXT NOT NULL,
    "mensagemId" TEXT NOT NULL,
    "conversaId" TEXT NOT NULL,
    "leadId" TEXT,
    "vendedorId" TEXT,
    "texto" TEXT NOT NULL,
    "estagioNaHora" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pro_labore_assistente_conhecimento_ocorrencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_assistente_aprendizado_estado" (
    "usuarioId" TEXT NOT NULL,
    "lidoAte" TIMESTAMP(3) NOT NULL,
    "rodadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_assistente_aprendizado_estado_pkey" PRIMARY KEY ("usuarioId")
);

-- CreateIndex
CREATE INDEX "pro_labore_assistente_conhecimento_usuarioId_status_idx" ON "pro_labore_assistente_conhecimento"("usuarioId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_assistente_conhecimento_usuarioId_chave_key" ON "pro_labore_assistente_conhecimento"("usuarioId", "chave");

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_assistente_conhecimento_ocorrencias_mensagemId_key" ON "pro_labore_assistente_conhecimento_ocorrencias"("mensagemId");

-- CreateIndex
CREATE INDEX "pro_labore_assistente_conhecimento_ocorrencias_usuarioId_cr_idx" ON "pro_labore_assistente_conhecimento_ocorrencias"("usuarioId", "criadoEm");

-- CreateIndex
CREATE INDEX "pro_labore_assistente_conhecimento_ocorrencias_conhecimento_idx" ON "pro_labore_assistente_conhecimento_ocorrencias"("conhecimentoId", "criadoEm");

-- AddForeignKey
ALTER TABLE "pro_labore_assistente_conhecimento_ocorrencias" ADD CONSTRAINT "pro_labore_assistente_conhecimento_ocorrencias_conheciment_fkey" FOREIGN KEY ("conhecimentoId") REFERENCES "pro_labore_assistente_conhecimento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

