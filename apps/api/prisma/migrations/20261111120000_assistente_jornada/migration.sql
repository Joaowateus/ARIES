-- AlterTable
ALTER TABLE "pro_labore_assistente_loja" ADD COLUMN     "avancoAutomatico" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "pro_labore_lead_estagio_historico" ADD COLUMN     "motivo" TEXT,
ADD COLUMN     "origem" TEXT;

-- AlterTable
ALTER TABLE "pro_labore_leads" ADD COLUMN     "avancosDesfeitos" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "etiquetas" TEXT[] DEFAULT ARRAY[]::TEXT[];

