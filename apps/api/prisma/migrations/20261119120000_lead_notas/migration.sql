-- CreateTable
CREATE TABLE "pro_labore_lead_notas" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "autorNome" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_lead_notas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pro_labore_lead_notas_leadId_criadoEm_idx" ON "pro_labore_lead_notas"("leadId", "criadoEm");

-- AddForeignKey
ALTER TABLE "pro_labore_lead_notas" ADD CONSTRAINT "pro_labore_lead_notas_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "pro_labore_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
