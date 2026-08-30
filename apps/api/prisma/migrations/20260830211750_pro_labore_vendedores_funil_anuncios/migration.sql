-- AlterTable
ALTER TABLE "pro_labore_vendas" ADD COLUMN     "vendedorId" TEXT;

-- CreateTable
CREATE TABLE "pro_labore_vendedores" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_vendedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_funil_mensal" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "mesReferencia" TIMESTAMP(3) NOT NULL,
    "leads" INTEGER NOT NULL DEFAULT 0,
    "abordados" INTEGER NOT NULL DEFAULT 0,
    "negociacao" INTEGER NOT NULL DEFAULT 0,
    "proposta" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_funil_mensal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_gasto_anuncios_mensal" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "mesReferencia" TIMESTAMP(3) NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_gasto_anuncios_mensal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pro_labore_vendedores_usuarioId_idx" ON "pro_labore_vendedores"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_funil_mensal_usuarioId_mesReferencia_key" ON "pro_labore_funil_mensal"("usuarioId", "mesReferencia");

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_gasto_anuncios_mensal_usuarioId_mesReferencia_key" ON "pro_labore_gasto_anuncios_mensal"("usuarioId", "mesReferencia");

-- CreateIndex
CREATE INDEX "pro_labore_vendas_vendedorId_idx" ON "pro_labore_vendas"("vendedorId");

-- AddForeignKey
ALTER TABLE "pro_labore_vendedores" ADD CONSTRAINT "pro_labore_vendedores_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "pro_labore_usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_funil_mensal" ADD CONSTRAINT "pro_labore_funil_mensal_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "pro_labore_usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_gasto_anuncios_mensal" ADD CONSTRAINT "pro_labore_gasto_anuncios_mensal_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "pro_labore_usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_vendas" ADD CONSTRAINT "pro_labore_vendas_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "pro_labore_vendedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
