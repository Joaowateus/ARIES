-- AlterTable
ALTER TABLE "pro_labore_assistente_comercial" ADD COLUMN     "cadastroAutomatico" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "pro_labore_leads" ADD COLUMN     "origemCadastro" TEXT;

