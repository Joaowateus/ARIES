-- CreateTable
CREATE TABLE "pro_labore_mapas_mentais" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "vendedorId" TEXT,
    "pastaId" TEXT,
    "titulo" TEXT,
    "icone" TEXT,
    "raiz" JSONB NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_mapas_mentais_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pro_labore_mapas_mentais_usuarioId_vendedorId_idx" ON "pro_labore_mapas_mentais"("usuarioId", "vendedorId");

-- CreateIndex
CREATE INDEX "pro_labore_mapas_mentais_pastaId_idx" ON "pro_labore_mapas_mentais"("pastaId");

-- AddForeignKey
ALTER TABLE "pro_labore_mapas_mentais" ADD CONSTRAINT "pro_labore_mapas_mentais_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "pro_labore_usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_mapas_mentais" ADD CONSTRAINT "pro_labore_mapas_mentais_pastaId_fkey" FOREIGN KEY ("pastaId") REFERENCES "pro_labore_pastas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
