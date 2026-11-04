-- CreateTable
CREATE TABLE "pro_labore_correcoes_auditoria" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL DEFAULT 0,
    "backup" JSONB NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "desfeitaEm" TIMESTAMP(3),

    CONSTRAINT "pro_labore_correcoes_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pro_labore_correcoes_auditoria_usuarioId_criadoEm_idx" ON "pro_labore_correcoes_auditoria"("usuarioId", "criadoEm");
