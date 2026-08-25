-- CreateTable
CREATE TABLE "leads_registrados" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leads_registrados_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leads_registrados_empresaId_idx" ON "leads_registrados"("empresaId");

-- CreateIndex
CREATE INDEX "leads_registrados_empresaId_usuarioId_idx" ON "leads_registrados"("empresaId", "usuarioId");

-- CreateIndex
CREATE INDEX "leads_registrados_empresaId_criadoEm_idx" ON "leads_registrados"("empresaId", "criadoEm");

-- AddForeignKey
ALTER TABLE "leads_registrados" ADD CONSTRAINT "leads_registrados_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads_registrados" ADD CONSTRAINT "leads_registrados_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
