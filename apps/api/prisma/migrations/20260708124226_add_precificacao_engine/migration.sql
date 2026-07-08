-- AlterTable
ALTER TABLE "unidades" ADD COLUMN     "custoAcessorios" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "custoCombustivel" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "custoDocumentacao" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "custoEstetica" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "custoFrete" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "custoOutros" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "custoRevisao" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "dataCompra" TIMESTAMP(3),
ADD COLUMN     "marketingInvestido" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "valorCompra" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "parametros_precificacao" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "margemEstrategica" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "margemComercial" DOUBLE PRECISION NOT NULL DEFAULT 0.16,
    "margemNegociacao" DOUBLE PRECISION NOT NULL DEFAULT 0.09,
    "margemLP" DOUBLE PRECISION NOT NULL DEFAULT 0.04,
    "impostosPct" DOUBLE PRECISION NOT NULL DEFAULT 0.06,
    "comissaoPadraoPct" DOUBLE PRECISION NOT NULL DEFAULT 0.03,
    "marketingProvisionadoPct" DOUBLE PRECISION NOT NULL DEFAULT 0.025,
    "reservaFinanceiraPct" DOUBLE PRECISION NOT NULL DEFAULT 0.02,
    "taxaFinanceiraMensal" DOUBLE PRECISION NOT NULL DEFAULT 0.02,
    "taxaOportunidadeMensal" DOUBLE PRECISION NOT NULL DEFAULT 0.015,
    "diasEstoqueMeta" INTEGER NOT NULL DEFAULT 45,
    "custoOperacionalRateio" DOUBLE PRECISION NOT NULL DEFAULT 180,
    "fase1MaxDias" INTEGER NOT NULL DEFAULT 30,
    "fase2MaxDias" INTEGER NOT NULL DEFAULT 60,
    "fase3MaxDias" INTEGER NOT NULL DEFAULT 90,
    "saudePremiumMaxDias" INTEGER NOT NULL DEFAULT 20,
    "saudeSaudavelMaxDias" INTEGER NOT NULL DEFAULT 45,
    "saudeAtencaoMaxDias" INTEGER NOT NULL DEFAULT 75,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parametros_precificacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historico_precificacao" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "precoAnterior" DOUBLE PRECISION,
    "precoNovo" DOUBLE PRECISION NOT NULL,
    "margemUtilizada" TEXT NOT NULL DEFAULT 'MANUAL',
    "motivo" TEXT NOT NULL,
    "nivelAprovacao" TEXT NOT NULL DEFAULT 'N0',
    "solicitanteId" TEXT,
    "aprovadorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historico_precificacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "parametros_precificacao_empresaId_key" ON "parametros_precificacao"("empresaId");

-- CreateIndex
CREATE INDEX "historico_precificacao_empresaId_idx" ON "historico_precificacao"("empresaId");

-- CreateIndex
CREATE INDEX "historico_precificacao_unidadeId_idx" ON "historico_precificacao"("unidadeId");

-- AddForeignKey
ALTER TABLE "parametros_precificacao" ADD CONSTRAINT "parametros_precificacao_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_precificacao" ADD CONSTRAINT "historico_precificacao_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_precificacao" ADD CONSTRAINT "historico_precificacao_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "unidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_precificacao" ADD CONSTRAINT "historico_precificacao_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_precificacao" ADD CONSTRAINT "historico_precificacao_aprovadorId_fkey" FOREIGN KEY ("aprovadorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
