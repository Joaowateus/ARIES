-- AlterTable
ALTER TABLE "pro_labore_sm_preferencias" ADD COLUMN     "avisos" JSONB,
ADD COLUMN     "focoHora" INTEGER NOT NULL DEFAULT 9,
ADD COLUMN     "onboardingConcluidoEm" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "pro_labore_sm_rituais" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "ator" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "iniciadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rodadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluidoEm" TIMESTAMP(3),
    "tarefas" INTEGER NOT NULL DEFAULT 0,
    "leads" INTEGER NOT NULL DEFAULT 0,
    "adiadas" INTEGER NOT NULL DEFAULT 0,
    "feitas" JSONB NOT NULL DEFAULT '[]',
    "adiadasIds" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "pro_labore_sm_rituais_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_sm_rituais_usuarioId_ator_data_key" ON "pro_labore_sm_rituais"("usuarioId", "ator", "data");

-- AddForeignKey
ALTER TABLE "pro_labore_sm_rituais" ADD CONSTRAINT "pro_labore_sm_rituais_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "pro_labore_usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

