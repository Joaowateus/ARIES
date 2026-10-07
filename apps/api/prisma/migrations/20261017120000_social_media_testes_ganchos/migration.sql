-- AlterTable
ALTER TABLE "pro_labore_sm_pautas" ADD COLUMN     "testeGrupo" TEXT,
ADD COLUMN     "testeId" TEXT;

-- CreateTable
CREATE TABLE "pro_labore_sm_testes" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "hipotese" TEXT NOT NULL,
    "descricao" TEXT,
    "variavel" TEXT NOT NULL,
    "grupoA" TEXT NOT NULL,
    "grupoB" TEXT NOT NULL,
    "horaA" INTEGER,
    "horaB" INTEGER,
    "metrica" TEXT NOT NULL DEFAULT 'ALCANCE',
    "amostraAlvo" INTEGER NOT NULL DEFAULT 6,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "resultado" JSONB,
    "vencedor" TEXT,
    "confianca" TEXT,
    "origem" TEXT NOT NULL DEFAULT 'MANUAL',
    "origemRef" TEXT,
    "criadoPor" TEXT NOT NULL DEFAULT 'SOCIAL_MEDIA',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluidoEm" TIMESTAMP(3),

    CONSTRAINT "pro_labore_sm_testes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_sm_ganchos" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "exemplos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "criadoPor" TEXT NOT NULL DEFAULT 'SOCIAL_MEDIA',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pro_labore_sm_ganchos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pro_labore_sm_testes_usuarioId_status_idx" ON "pro_labore_sm_testes"("usuarioId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_sm_ganchos_usuarioId_chave_key" ON "pro_labore_sm_ganchos"("usuarioId", "chave");

-- CreateIndex
CREATE INDEX "pro_labore_sm_pautas_testeId_idx" ON "pro_labore_sm_pautas"("testeId");

-- AddForeignKey
ALTER TABLE "pro_labore_sm_pautas" ADD CONSTRAINT "pro_labore_sm_pautas_testeId_fkey" FOREIGN KEY ("testeId") REFERENCES "pro_labore_sm_testes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_sm_testes" ADD CONSTRAINT "pro_labore_sm_testes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "pro_labore_usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_sm_ganchos" ADD CONSTRAINT "pro_labore_sm_ganchos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "pro_labore_usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

