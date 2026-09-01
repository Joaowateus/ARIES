-- AlterTable
ALTER TABLE "oportunidades" ADD COLUMN     "campanhaTrafego" TEXT;

-- AlterTable
ALTER TABLE "leads_registrados" ADD COLUMN     "campanhaTrafego" TEXT;

-- AlterTable
ALTER TABLE "metricas_trafego_pago" ADD COLUMN     "campanha" TEXT NOT NULL DEFAULT '';

-- DropIndex
DROP INDEX "metricas_trafego_pago_empresaId_usuarioId_plataforma_data_key";

-- CreateIndex
CREATE INDEX "metricas_trafego_pago_empresaId_campanha_idx" ON "metricas_trafego_pago"("empresaId", "campanha");

-- CreateIndex
CREATE UNIQUE INDEX "metricas_trafego_pago_empresaId_usuarioId_plataforma_campa_key" ON "metricas_trafego_pago"("empresaId", "usuarioId", "plataforma", "campanha", "data");
