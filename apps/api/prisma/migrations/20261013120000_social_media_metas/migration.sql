-- AlterTable
ALTER TABLE "pro_labore_sm_config" ADD COLUMN     "metaLeadsSemana" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "metaRespostaMin" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "metaRetencao" INTEGER NOT NULL DEFAULT 45;

