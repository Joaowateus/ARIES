-- AlterTable
ALTER TABLE "pro_labore_vendedores" ADD COLUMN     "metaMensal" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "pro_labore_parametros" ADD COLUMN     "metaMensalPadrao" DOUBLE PRECISION NOT NULL DEFAULT 0;
