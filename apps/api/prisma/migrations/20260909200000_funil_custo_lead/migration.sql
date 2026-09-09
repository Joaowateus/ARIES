-- AlterTable
ALTER TABLE "metas_funil_etapa" ADD COLUMN     "metaCusto" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "custo_lead_config" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "custoPorLead" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custo_lead_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "custo_lead_config_empresaId_key" ON "custo_lead_config"("empresaId");

-- AddForeignKey
ALTER TABLE "custo_lead_config" ADD CONSTRAINT "custo_lead_config_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
