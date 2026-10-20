-- AlterTable
ALTER TABLE "pro_labore_trafego_contas" ADD COLUMN     "totaisDesde" TIMESTAMP(3),
ADD COLUMN     "totaisEm" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "pro_labore_trafego_insights" ADD COLUMN     "novosContatos" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "pro_labore_trafego_conta_diario" (
    "id" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "gasto" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "impressoes" INTEGER NOT NULL DEFAULT 0,
    "alcance" INTEGER NOT NULL DEFAULT 0,
    "cliques" INTEGER NOT NULL DEFAULT 0,
    "cliquesLink" INTEGER NOT NULL DEFAULT 0,
    "lpv" INTEGER NOT NULL DEFAULT 0,
    "conversas" INTEGER NOT NULL DEFAULT 0,
    "leads" INTEGER NOT NULL DEFAULT 0,
    "novosContatos" INTEGER NOT NULL DEFAULT 0,
    "videoViews" INTEGER NOT NULL DEFAULT 0,
    "thruplays" INTEGER NOT NULL DEFAULT 0,
    "videoP25" INTEGER NOT NULL DEFAULT 0,
    "videoP50" INTEGER NOT NULL DEFAULT 0,
    "videoP75" INTEGER NOT NULL DEFAULT 0,
    "videoP100" INTEGER NOT NULL DEFAULT 0,
    "videoP95" INTEGER NOT NULL DEFAULT 0,
    "videoPlays" INTEGER NOT NULL DEFAULT 0,
    "videoTempoTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cliquesSaida" INTEGER NOT NULL DEFAULT 0,
    "engajamento" INTEGER NOT NULL DEFAULT 0,
    "reacoes" INTEGER NOT NULL DEFAULT 0,
    "comentarios" INTEGER NOT NULL DEFAULT 0,
    "compartilhamentos" INTEGER NOT NULL DEFAULT 0,
    "salvamentos" INTEGER NOT NULL DEFAULT 0,
    "conversasProf2" INTEGER NOT NULL DEFAULT 0,
    "conversasProf3" INTEGER NOT NULL DEFAULT 0,
    "conversasProf5" INTEGER NOT NULL DEFAULT 0,
    "bloqueios" INTEGER NOT NULL DEFAULT 0,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_trafego_conta_diario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_trafego_conta_diario_contaId_data_key" ON "pro_labore_trafego_conta_diario"("contaId", "data");

-- AddForeignKey
ALTER TABLE "pro_labore_trafego_conta_diario" ADD CONSTRAINT "pro_labore_trafego_conta_diario_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "pro_labore_trafego_contas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

