-- CreateTable
CREATE TABLE "pro_labore_assistente_fichas_credito" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "conversaId" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "nascimento" TEXT,
    "consentimento" JSONB NOT NULL,
    "origem" TEXT NOT NULL DEFAULT 'ROBO',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_assistente_fichas_credito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_assistente_analises_credito" (
    "id" TEXT NOT NULL,
    "fichaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "banco" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'A_ENVIAR',
    "entrada" DOUBLE PRECISION,
    "prazo" INTEGER,
    "parcela" DOUBLE PRECISION,
    "taxa" DOUBLE PRECISION,
    "observacao" TEXT,
    "respondidoEm" TIMESTAMP(3),
    "enviadaAoClienteEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_assistente_analises_credito_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_assistente_fichas_credito_conversaId_key" ON "pro_labore_assistente_fichas_credito"("conversaId");

-- CreateIndex
CREATE INDEX "pro_labore_assistente_fichas_credito_usuarioId_idx" ON "pro_labore_assistente_fichas_credito"("usuarioId");

-- CreateIndex
CREATE INDEX "pro_labore_assistente_analises_credito_usuarioId_criadoEm_idx" ON "pro_labore_assistente_analises_credito"("usuarioId", "criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_assistente_analises_credito_fichaId_banco_key" ON "pro_labore_assistente_analises_credito"("fichaId", "banco");

-- AddForeignKey
ALTER TABLE "pro_labore_assistente_fichas_credito" ADD CONSTRAINT "pro_labore_assistente_fichas_credito_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "pro_labore_assistente_conversas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_assistente_analises_credito" ADD CONSTRAINT "pro_labore_assistente_analises_credito_fichaId_fkey" FOREIGN KEY ("fichaId") REFERENCES "pro_labore_assistente_fichas_credito"("id") ON DELETE CASCADE ON UPDATE CASCADE;

