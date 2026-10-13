-- AlterTable
ALTER TABLE "pro_labore_sm_membros" ADD COLUMN     "vendedorId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_sm_membros_vendedorId_key" ON "pro_labore_sm_membros"("vendedorId");

-- AddForeignKey
ALTER TABLE "pro_labore_sm_membros" ADD CONSTRAINT "pro_labore_sm_membros_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "pro_labore_vendedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

