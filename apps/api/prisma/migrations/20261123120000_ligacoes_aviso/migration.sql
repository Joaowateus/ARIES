-- AlterTable
ALTER TABLE "pro_labore_ligacoes" ADD COLUMN "avisadaEm" TIMESTAMP(3),
ADD COLUMN "relembradaEm" TIMESTAMP(3),
ADD COLUMN "adiamentos" INTEGER NOT NULL DEFAULT 0;
