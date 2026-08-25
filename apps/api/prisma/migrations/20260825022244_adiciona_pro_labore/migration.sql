-- CreateTable
CREATE TABLE "pro_labore_usuarios" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_parametros" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "percentualImpostos" DOUBLE PRECISION NOT NULL DEFAULT 0.06,
    "percentualCustosOperacionais" DOUBLE PRECISION NOT NULL DEFAULT 0.15,
    "percentualReservaCaixa" DOUBLE PRECISION NOT NULL DEFAULT 0.10,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_parametros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_faturamentos" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "referenciaSemana" TIMESTAMP(3) NOT NULL,
    "valorBruto" DOUBLE PRECISION NOT NULL,
    "percentualImpostosAplicado" DOUBLE PRECISION NOT NULL,
    "percentualCustosAplicado" DOUBLE PRECISION NOT NULL,
    "percentualReservaAplicado" DOUBLE PRECISION NOT NULL,
    "valorLiquido" DOUBLE PRECISION NOT NULL,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_faturamentos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_usuarios_email_key" ON "pro_labore_usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_parametros_usuarioId_key" ON "pro_labore_parametros"("usuarioId");

-- CreateIndex
CREATE INDEX "pro_labore_faturamentos_usuarioId_referenciaSemana_idx" ON "pro_labore_faturamentos"("usuarioId", "referenciaSemana");

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_faturamentos_usuarioId_referenciaSemana_key" ON "pro_labore_faturamentos"("usuarioId", "referenciaSemana");

-- AddForeignKey
ALTER TABLE "pro_labore_parametros" ADD CONSTRAINT "pro_labore_parametros_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "pro_labore_usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_faturamentos" ADD CONSTRAINT "pro_labore_faturamentos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "pro_labore_usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
