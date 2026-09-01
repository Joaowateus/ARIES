-- CreateTable
CREATE TABLE "metricas_trafego_pago" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "plataforma" TEXT NOT NULL DEFAULT 'META',
    "data" TIMESTAMP(3) NOT NULL,
    "impressoes" INTEGER NOT NULL DEFAULT 0,
    "cliques" INTEGER NOT NULL DEFAULT 0,
    "visitasLp" INTEGER NOT NULL DEFAULT 0,
    "leadsCapturados" INTEGER NOT NULL DEFAULT 0,
    "valorInvestido" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "metricas_trafego_pago_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "metricas_trafego_pago_empresaId_data_idx" ON "metricas_trafego_pago"("empresaId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "metricas_trafego_pago_empresaId_usuarioId_plataforma_data_key" ON "metricas_trafego_pago"("empresaId", "usuarioId", "plataforma", "data");

-- AddForeignKey
ALTER TABLE "metricas_trafego_pago" ADD CONSTRAINT "metricas_trafego_pago_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metricas_trafego_pago" ADD CONSTRAINT "metricas_trafego_pago_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
