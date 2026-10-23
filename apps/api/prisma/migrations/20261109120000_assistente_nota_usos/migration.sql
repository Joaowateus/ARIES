-- AlterTable
ALTER TABLE "pro_labore_assistente_conversas" ADD COLUMN     "nota" INTEGER,
ADD COLUMN     "sinais" JSONB;

-- AlterTable
ALTER TABLE "pro_labore_leads" ADD COLUMN     "pontuacao" INTEGER;

-- CreateTable
CREATE TABLE "pro_labore_assistente_conhecimento_usos" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "conhecimentoId" TEXT NOT NULL,
    "conversaId" TEXT NOT NULL,
    "leadId" TEXT,
    "canal" TEXT NOT NULL,
    "estagioNaHora" TEXT,
    "avancou" BOOLEAN,
    "verificadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pro_labore_assistente_conhecimento_usos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pro_labore_assistente_conhecimento_usos_usuarioId_verificad_idx" ON "pro_labore_assistente_conhecimento_usos"("usuarioId", "verificadoEm");

-- CreateIndex
CREATE INDEX "pro_labore_assistente_conhecimento_usos_conhecimentoId_idx" ON "pro_labore_assistente_conhecimento_usos"("conhecimentoId");

-- AddForeignKey
ALTER TABLE "pro_labore_assistente_conhecimento_usos" ADD CONSTRAINT "pro_labore_assistente_conhecimento_usos_conhecimentoId_fkey" FOREIGN KEY ("conhecimentoId") REFERENCES "pro_labore_assistente_conhecimento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

