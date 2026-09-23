-- AlterTable
ALTER TABLE "pro_labore_notas" ADD COLUMN     "pastaId" TEXT;

-- CreateTable
CREATE TABLE "pro_labore_pastas" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "vendedorId" TEXT,
    "nome" TEXT NOT NULL,
    "paiId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_pastas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pro_labore_pastas_usuarioId_vendedorId_idx" ON "pro_labore_pastas"("usuarioId", "vendedorId");

-- CreateIndex
CREATE INDEX "pro_labore_pastas_paiId_idx" ON "pro_labore_pastas"("paiId");

-- CreateIndex
CREATE INDEX "pro_labore_notas_pastaId_idx" ON "pro_labore_notas"("pastaId");

-- AddForeignKey
ALTER TABLE "pro_labore_notas" ADD CONSTRAINT "pro_labore_notas_pastaId_fkey" FOREIGN KEY ("pastaId") REFERENCES "pro_labore_pastas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_pastas" ADD CONSTRAINT "pro_labore_pastas_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "pro_labore_usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_pastas" ADD CONSTRAINT "pro_labore_pastas_paiId_fkey" FOREIGN KEY ("paiId") REFERENCES "pro_labore_pastas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
