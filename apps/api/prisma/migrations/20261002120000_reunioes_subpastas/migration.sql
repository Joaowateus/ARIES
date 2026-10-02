-- AlterTable
ALTER TABLE "pro_labore_reunioes_pastas" ADD COLUMN     "paiId" TEXT;

-- AddForeignKey
ALTER TABLE "pro_labore_reunioes_pastas" ADD CONSTRAINT "pro_labore_reunioes_pastas_paiId_fkey" FOREIGN KEY ("paiId") REFERENCES "pro_labore_reunioes_pastas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

