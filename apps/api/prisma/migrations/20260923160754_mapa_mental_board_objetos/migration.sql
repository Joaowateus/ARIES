-- AlterTable
ALTER TABLE "pro_labore_mapas_mentais" ADD COLUMN     "conectores" JSONB,
ADD COLUMN     "objetos" JSONB,
ALTER COLUMN "raiz" DROP NOT NULL;
