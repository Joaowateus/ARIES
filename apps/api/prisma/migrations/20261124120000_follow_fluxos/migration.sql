-- AlterTable
ALTER TABLE "pro_labore_assistente_conversas" ADD COLUMN "followFluxo" TEXT;

-- AlterTable
ALTER TABLE "pro_labore_assistente_mensagens" ADD COLUMN "followFluxo" TEXT;

-- AlterTable
ALTER TABLE "pro_labore_lead_follows" ADD COLUMN "avisadoEm" TIMESTAMP(3),
ADD COLUMN "contexto" JSONB,
ADD COLUMN "tipo" TEXT NOT NULL DEFAULT 'CONTATO';

-- CreateIndex
CREATE INDEX "pro_labore_lead_follows_tipo_status_agendadoPara_idx" ON "pro_labore_lead_follows"("tipo", "status", "agendadoPara");
