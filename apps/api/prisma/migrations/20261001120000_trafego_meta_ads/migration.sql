-- CreateTable
CREATE TABLE "pro_labore_trafego_contas" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "adAccountId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "moeda" TEXT NOT NULL DEFAULT 'BRL',
    "fuso" TEXT,
    "accessToken" TEXT NOT NULL,
    "conectadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimaSincronizacaoEm" TIMESTAMP(3),
    "ultimoErroSync" TEXT,
    "historicoDesde" TIMESTAMP(3),
    "configuracao" JSONB,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_trafego_contas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_trafego_insights" (
    "id" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "adId" TEXT NOT NULL,
    "adNome" TEXT NOT NULL,
    "adsetId" TEXT NOT NULL,
    "adsetNome" TEXT NOT NULL,
    "campanhaId" TEXT NOT NULL,
    "campanhaNome" TEXT NOT NULL,
    "objetivo" TEXT,
    "gasto" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "impressoes" INTEGER NOT NULL DEFAULT 0,
    "alcance" INTEGER NOT NULL DEFAULT 0,
    "cliques" INTEGER NOT NULL DEFAULT 0,
    "cliquesLink" INTEGER NOT NULL DEFAULT 0,
    "lpv" INTEGER NOT NULL DEFAULT 0,
    "conversas" INTEGER NOT NULL DEFAULT 0,
    "leads" INTEGER NOT NULL DEFAULT 0,
    "videoViews" INTEGER NOT NULL DEFAULT 0,
    "thruplays" INTEGER NOT NULL DEFAULT 0,
    "videoP25" INTEGER NOT NULL DEFAULT 0,
    "videoP50" INTEGER NOT NULL DEFAULT 0,
    "videoP75" INTEGER NOT NULL DEFAULT 0,
    "videoP100" INTEGER NOT NULL DEFAULT 0,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_trafego_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_trafego_alcance" (
    "id" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "inicio" DATE NOT NULL,
    "fim" DATE NOT NULL,
    "chave" TEXT NOT NULL,
    "alcance" INTEGER NOT NULL,
    "frequencia" DOUBLE PRECISION NOT NULL,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_trafego_alcance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_trafego_contas_usuarioId_key" ON "pro_labore_trafego_contas"("usuarioId");

-- CreateIndex
CREATE INDEX "pro_labore_trafego_insights_contaId_data_idx" ON "pro_labore_trafego_insights"("contaId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_trafego_insights_contaId_data_adId_key" ON "pro_labore_trafego_insights"("contaId", "data", "adId");

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_trafego_alcance_contaId_inicio_fim_chave_key" ON "pro_labore_trafego_alcance"("contaId", "inicio", "fim", "chave");

-- AddForeignKey
ALTER TABLE "pro_labore_trafego_insights" ADD CONSTRAINT "pro_labore_trafego_insights_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "pro_labore_trafego_contas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

