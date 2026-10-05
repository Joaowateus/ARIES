-- DropIndex
DROP INDEX "pro_labore_pagamentos_comissao_usuarioId_numero_key";

-- AlterTable
ALTER TABLE "pro_labore_pagamentos_comissao" ADD COLUMN     "recebedor" TEXT,
ADD COLUMN     "tipo" TEXT NOT NULL DEFAULT 'COMISSAO',
ALTER COLUMN "vendedorId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "pro_labore_vendas" ADD COLUMN     "pagamentoProLaboreId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_pagamentos_comissao_usuarioId_tipo_numero_key" ON "pro_labore_pagamentos_comissao"("usuarioId", "tipo", "numero");

-- CreateIndex
CREATE INDEX "pro_labore_vendas_pagamentoProLaboreId_idx" ON "pro_labore_vendas"("pagamentoProLaboreId");

-- AddForeignKey
ALTER TABLE "pro_labore_vendas" ADD CONSTRAINT "pro_labore_vendas_pagamentoProLaboreId_fkey" FOREIGN KEY ("pagamentoProLaboreId") REFERENCES "pro_labore_pagamentos_comissao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

