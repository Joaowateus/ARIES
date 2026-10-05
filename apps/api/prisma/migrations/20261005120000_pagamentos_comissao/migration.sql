-- AlterTable
ALTER TABLE "pro_labore_vendas" ADD COLUMN     "pagamentoComissaoId" TEXT;

-- CreateTable
CREATE TABLE "pro_labore_pagamentos_comissao" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "vendedorId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "pagoEm" TIMESTAMP(3) NOT NULL,
    "formaPagamento" TEXT,
    "observacao" TEXT,
    "pagador" TEXT NOT NULL,
    "valorTotal" DOUBLE PRECISION NOT NULL,
    "canceladoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pro_labore_pagamentos_comissao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pro_labore_pagamentos_comissao_vendedorId_idx" ON "pro_labore_pagamentos_comissao"("vendedorId");

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_pagamentos_comissao_usuarioId_numero_key" ON "pro_labore_pagamentos_comissao"("usuarioId", "numero");

-- CreateIndex
CREATE INDEX "pro_labore_vendas_pagamentoComissaoId_idx" ON "pro_labore_vendas"("pagamentoComissaoId");

-- AddForeignKey
ALTER TABLE "pro_labore_vendas" ADD CONSTRAINT "pro_labore_vendas_pagamentoComissaoId_fkey" FOREIGN KEY ("pagamentoComissaoId") REFERENCES "pro_labore_pagamentos_comissao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_pagamentos_comissao" ADD CONSTRAINT "pro_labore_pagamentos_comissao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "pro_labore_usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_pagamentos_comissao" ADD CONSTRAINT "pro_labore_pagamentos_comissao_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "pro_labore_vendedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

