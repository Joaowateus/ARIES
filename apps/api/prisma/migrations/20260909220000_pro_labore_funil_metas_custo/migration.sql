-- AlterTable
ALTER TABLE "pro_labore_parametros" ADD COLUMN     "custoPorLeadTopo" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "pro_labore_metas_funil" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "etapa" TEXT NOT NULL,
    "metaPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "metaCusto" DOUBLE PRECISION,
    "tipoMeta" TEXT NOT NULL DEFAULT 'MINIMO',
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_metas_funil_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_metas_funil_usuarioId_etapa_key" ON "pro_labore_metas_funil"("usuarioId", "etapa");

-- AddForeignKey
ALTER TABLE "pro_labore_metas_funil" ADD CONSTRAINT "pro_labore_metas_funil_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "pro_labore_usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
