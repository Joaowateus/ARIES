-- CreateTable
CREATE TABLE "metas_comerciais_padrao" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "supermetaVendasMes" INTEGER NOT NULL DEFAULT 10,
    "metaAnunciosMes" INTEGER NOT NULL DEFAULT 2000,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "metas_comerciais_padrao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "metas_comerciais_padrao_empresaId_key" ON "metas_comerciais_padrao"("empresaId");

-- AddForeignKey
ALTER TABLE "metas_comerciais_padrao" ADD CONSTRAINT "metas_comerciais_padrao_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
