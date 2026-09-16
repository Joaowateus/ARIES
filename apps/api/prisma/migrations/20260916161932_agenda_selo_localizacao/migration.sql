-- AlterTable
ALTER TABLE "pro_labore_agenda_conclusoes" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "pro_labore_agenda_itens" ADD COLUMN     "exigeLocalizacao" BOOLEAN NOT NULL DEFAULT false;
