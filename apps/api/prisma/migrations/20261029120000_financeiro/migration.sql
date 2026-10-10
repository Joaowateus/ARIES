-- AlterTable
ALTER TABLE "pro_labore_vendedores" ADD COLUMN     "salarioBase" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "pro_labore_lancamentos_financeiros" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "vendedorId" TEXT,
    "favorecido" TEXT NOT NULL,
    "documento" TEXT,
    "pagador" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "competencia" TEXT,
    "itens" JSONB NOT NULL,
    "valorTotal" DOUBLE PRECISION NOT NULL,
    "pagoEm" TIMESTAMP(3) NOT NULL,
    "formaPagamento" TEXT,
    "observacao" TEXT,
    "canceladoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pro_labore_lancamentos_financeiros_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pro_labore_lancamentos_financeiros_usuarioId_pagoEm_idx" ON "pro_labore_lancamentos_financeiros"("usuarioId", "pagoEm");

-- CreateIndex
CREATE INDEX "pro_labore_lancamentos_financeiros_vendedorId_idx" ON "pro_labore_lancamentos_financeiros"("vendedorId");

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_lancamentos_financeiros_usuarioId_categoria_nume_key" ON "pro_labore_lancamentos_financeiros"("usuarioId", "categoria", "numero");

-- AddForeignKey
ALTER TABLE "pro_labore_lancamentos_financeiros" ADD CONSTRAINT "pro_labore_lancamentos_financeiros_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "pro_labore_usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_lancamentos_financeiros" ADD CONSTRAINT "pro_labore_lancamentos_financeiros_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "pro_labore_vendedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

