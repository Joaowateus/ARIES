-- AlterTable
ALTER TABLE "pro_labore_assistente_conversas" ADD COLUMN     "simulacao" JSONB;

-- AlterTable
ALTER TABLE "pro_labore_assistente_loja" ADD COLUMN     "simulacaoAtiva" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "simulacaoConfig" JSONB;

