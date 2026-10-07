-- CreateTable
CREATE TABLE "pro_labore_sm_insight_acoes" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "ator" TEXT NOT NULL,
    "aba" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "operacao" JSONB NOT NULL,
    "desfazer" JSONB,
    "mensagem" TEXT NOT NULL,
    "executadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "desfeitoEm" TIMESTAMP(3),

    CONSTRAINT "pro_labore_sm_insight_acoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_sm_assistente_estados" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "ator" TEXT NOT NULL,
    "aba" TEXT NOT NULL,
    "recolhido" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "pro_labore_sm_assistente_estados_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pro_labore_sm_insight_acoes_usuarioId_chave_idx" ON "pro_labore_sm_insight_acoes"("usuarioId", "chave");

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_sm_assistente_estados_usuarioId_ator_aba_key" ON "pro_labore_sm_assistente_estados"("usuarioId", "ator", "aba");

-- AddForeignKey
ALTER TABLE "pro_labore_sm_insight_acoes" ADD CONSTRAINT "pro_labore_sm_insight_acoes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "pro_labore_usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_sm_assistente_estados" ADD CONSTRAINT "pro_labore_sm_assistente_estados_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "pro_labore_usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

