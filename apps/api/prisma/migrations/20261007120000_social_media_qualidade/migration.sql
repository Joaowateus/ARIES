-- AlterTable
ALTER TABLE "pro_labore_social_media_snapshots" ADD COLUMN     "sincronizado" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "pro_labore_social_media_alcance_periodo" (
    "id" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fim" TIMESTAMP(3) NOT NULL,
    "alcance" INTEGER NOT NULL,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pro_labore_social_media_alcance_periodo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_social_media_alcance_periodo_contaId_inicio_fim_key" ON "pro_labore_social_media_alcance_periodo"("contaId", "inicio", "fim");

-- AddForeignKey
ALTER TABLE "pro_labore_social_media_alcance_periodo" ADD CONSTRAINT "pro_labore_social_media_alcance_periodo_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "pro_labore_social_media_contas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

