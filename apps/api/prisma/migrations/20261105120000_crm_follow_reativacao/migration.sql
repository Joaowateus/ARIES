-- AlterTable
ALTER TABLE "pro_labore_leads" ADD COLUMN     "motivoPerda" TEXT,
ADD COLUMN     "notaPerda" TEXT,
ADD COLUMN     "perdidoEm" TIMESTAMP(3),
ADD COLUMN     "reativacoes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reativadoEm" TIMESTAMP(3),
ADD COLUMN     "temperatura" TEXT;

-- CreateTable
CREATE TABLE "pro_labore_lead_follows" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "vendedorId" TEXT,
    "agendadoPara" TIMESTAMP(3) NOT NULL,
    "canal" TEXT,
    "nota" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "feitoEm" TIMESTAMP(3),
    "resultado" TEXT,
    "criadoPor" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_lead_follows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pro_labore_lead_follows_usuarioId_status_agendadoPara_idx" ON "pro_labore_lead_follows"("usuarioId", "status", "agendadoPara");

-- CreateIndex
CREATE INDEX "pro_labore_lead_follows_leadId_status_idx" ON "pro_labore_lead_follows"("leadId", "status");

-- AddForeignKey
ALTER TABLE "pro_labore_lead_follows" ADD CONSTRAINT "pro_labore_lead_follows_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "pro_labore_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

