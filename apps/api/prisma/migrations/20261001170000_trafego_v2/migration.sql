-- AlterTable
ALTER TABLE "pro_labore_trafego_contas" ADD COLUMN     "estruturaEm" TIMESTAMP(3),
ADD COLUMN     "versaoDados" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "pro_labore_trafego_insights" ADD COLUMN     "bloqueios" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "cliquesSaida" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "comentarios" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "compartilhamentos" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "conversasProf2" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "conversasProf3" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "conversasProf5" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "engajamento" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reacoes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "salvamentos" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "videoP95" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "videoPlays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "videoTempoTotal" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "pro_labore_trafego_estrutura" (
    "id" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "objetoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "status" TEXT,
    "dados" JSONB NOT NULL,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_trafego_estrutura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_trafego_publicos" (
    "id" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "inicio" DATE NOT NULL,
    "fim" DATE NOT NULL,
    "tipo" TEXT NOT NULL,
    "linhas" JSONB NOT NULL,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_trafego_publicos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pro_labore_trafego_estrutura_contaId_tipo_idx" ON "pro_labore_trafego_estrutura"("contaId", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_trafego_estrutura_contaId_tipo_objetoId_key" ON "pro_labore_trafego_estrutura"("contaId", "tipo", "objetoId");

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_trafego_publicos_contaId_inicio_fim_tipo_key" ON "pro_labore_trafego_publicos"("contaId", "inicio", "fim", "tipo");

