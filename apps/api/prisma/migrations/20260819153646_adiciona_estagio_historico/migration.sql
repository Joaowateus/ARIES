-- CreateTable
CREATE TABLE "estagio_historico" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "oportunidadeId" TEXT NOT NULL,
    "estagioAnterior" TEXT,
    "estagioNovo" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estagio_historico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "estagio_historico_empresaId_idx" ON "estagio_historico"("empresaId");

-- CreateIndex
CREATE INDEX "estagio_historico_oportunidadeId_idx" ON "estagio_historico"("oportunidadeId");

-- AddForeignKey
ALTER TABLE "estagio_historico" ADD CONSTRAINT "estagio_historico_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estagio_historico" ADD CONSTRAINT "estagio_historico_oportunidadeId_fkey" FOREIGN KEY ("oportunidadeId") REFERENCES "oportunidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
