-- AlterTable
ALTER TABLE "pro_labore_sm_motos_estoque" ADD COLUMN "placa" TEXT;
ALTER TABLE "pro_labore_vendas" ADD COLUMN "motoId" TEXT;

-- CreateIndex
CREATE INDEX "pro_labore_sm_motos_estoque_usuarioId_placa_idx" ON "pro_labore_sm_motos_estoque"("usuarioId", "placa");
CREATE INDEX "pro_labore_vendas_motoId_idx" ON "pro_labore_vendas"("motoId");

-- AddForeignKey
ALTER TABLE "pro_labore_vendas" ADD CONSTRAINT "pro_labore_vendas_motoId_fkey" FOREIGN KEY ("motoId") REFERENCES "pro_labore_sm_motos_estoque"("id") ON DELETE SET NULL ON UPDATE CASCADE;
