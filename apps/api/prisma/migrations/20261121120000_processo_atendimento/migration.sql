-- CreateTable
CREATE TABLE "pro_labore_processo_atendimento" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "conteudo" JSONB NOT NULL,
    "atualizadoPor" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_processo_atendimento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_processo_atendimento_usuarioId_key" ON "pro_labore_processo_atendimento"("usuarioId");
