-- AlterTable
ALTER TABLE "pro_labore_mapas_mentais" ADD COLUMN     "excluidoEm" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "pro_labore_mapas_mentais_versoes" (
    "id" TEXT NOT NULL,
    "mapaMentalId" TEXT NOT NULL,
    "objetos" JSONB,
    "conectores" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pro_labore_mapas_mentais_versoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pro_labore_mapas_mentais_versoes_mapaMentalId_criadoEm_idx" ON "pro_labore_mapas_mentais_versoes"("mapaMentalId", "criadoEm");

-- CreateIndex
CREATE INDEX "pro_labore_mapas_mentais_excluidoEm_idx" ON "pro_labore_mapas_mentais"("excluidoEm");

-- AddForeignKey
ALTER TABLE "pro_labore_mapas_mentais_versoes" ADD CONSTRAINT "pro_labore_mapas_mentais_versoes_mapaMentalId_fkey" FOREIGN KEY ("mapaMentalId") REFERENCES "pro_labore_mapas_mentais"("id") ON DELETE CASCADE ON UPDATE CASCADE;
