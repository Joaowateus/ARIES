/*
  Warnings:

  - You are about to drop the column `percentualCustosOperacionais` on the `pro_labore_parametros` table. All the data in the column will be lost.
  - You are about to drop the column `percentualImpostos` on the `pro_labore_parametros` table. All the data in the column will be lost.
  - You are about to drop the column `percentualReservaCaixa` on the `pro_labore_parametros` table. All the data in the column will be lost.
  - You are about to drop the `pro_labore_faturamentos` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "pro_labore_faturamentos" DROP CONSTRAINT "pro_labore_faturamentos_usuarioId_fkey";

-- AlterTable
ALTER TABLE "pro_labore_parametros" DROP COLUMN "percentualCustosOperacionais",
DROP COLUMN "percentualImpostos",
DROP COLUMN "percentualReservaCaixa",
ADD COLUMN     "tetoProLaborePorVenda" DOUBLE PRECISION NOT NULL DEFAULT 900;

-- DropTable
DROP TABLE "pro_labore_faturamentos";

-- CreateTable
CREATE TABLE "pro_labore_vendas" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "valorVenda" DOUBLE PRECISION NOT NULL,
    "valorProLabore" DOUBLE PRECISION NOT NULL,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_vendas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pro_labore_vendas_usuarioId_data_idx" ON "pro_labore_vendas"("usuarioId", "data");

-- AddForeignKey
ALTER TABLE "pro_labore_vendas" ADD CONSTRAINT "pro_labore_vendas_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "pro_labore_usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
