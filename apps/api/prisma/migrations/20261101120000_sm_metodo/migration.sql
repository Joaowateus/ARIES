-- AlterTable
ALTER TABLE "pro_labore_sm_config" ADD COLUMN     "escadaDefinidaEm" TIMESTAMP(3),
ADD COLUMN     "escadaDegrau" INTEGER,
ADD COLUMN     "escadaNota" TEXT;

-- AlterTable
ALTER TABLE "pro_labore_sm_pautas" ADD COLUMN     "etapaFunil" TEXT;

