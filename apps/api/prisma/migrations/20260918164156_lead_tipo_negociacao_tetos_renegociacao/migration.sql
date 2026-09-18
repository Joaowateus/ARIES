-- AlterTable
ALTER TABLE "pro_labore_leads" ADD COLUMN     "tipoNegociacao" TEXT;

-- AlterTable
ALTER TABLE "pro_labore_parametros" ADD COLUMN     "tetoComissaoRenegociacao" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "tetoProLaboreRenegociacao" DOUBLE PRECISION NOT NULL DEFAULT 600;
