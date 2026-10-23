-- AlterTable
ALTER TABLE "pro_labore_assistente_conversas" ADD COLUMN     "followParado" TEXT,
ADD COLUMN     "followPasso" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "followUltimoEm" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "pro_labore_assistente_loja" ADD COLUMN     "followAtivo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "followConfig" JSONB;

-- AlterTable
ALTER TABLE "pro_labore_assistente_mensagens" ADD COLUMN     "origem" TEXT;

