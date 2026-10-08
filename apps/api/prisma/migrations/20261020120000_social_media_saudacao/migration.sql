-- CreateTable
CREATE TABLE "pro_labore_sm_visitas" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "ator" TEXT NOT NULL,
    "inicioEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimaAtividadeEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "anteriorEm" TIMESTAMP(3),
    "momento" TEXT NOT NULL,
    "fraseId" TEXT,
    "recolhida" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "pro_labore_sm_visitas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_sm_saudacao_frases" (
    "id" TEXT NOT NULL,
    "momento" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "pro_labore_sm_saudacao_frases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_sm_saudacoes_exibidas" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "ator" TEXT NOT NULL,
    "fraseId" TEXT NOT NULL,
    "exibidaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pro_labore_sm_saudacoes_exibidas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_sm_preferencias" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "ator" TEXT NOT NULL,
    "genero" TEXT,

    CONSTRAINT "pro_labore_sm_preferencias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pro_labore_sm_visitas_usuarioId_ator_inicioEm_idx" ON "pro_labore_sm_visitas"("usuarioId", "ator", "inicioEm");

-- CreateIndex
CREATE INDEX "pro_labore_sm_saudacao_frases_momento_idx" ON "pro_labore_sm_saudacao_frases"("momento");

-- CreateIndex
CREATE INDEX "pro_labore_sm_saudacoes_exibidas_usuarioId_ator_exibidaEm_idx" ON "pro_labore_sm_saudacoes_exibidas"("usuarioId", "ator", "exibidaEm");

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_sm_preferencias_usuarioId_ator_key" ON "pro_labore_sm_preferencias"("usuarioId", "ator");

-- AddForeignKey
ALTER TABLE "pro_labore_sm_visitas" ADD CONSTRAINT "pro_labore_sm_visitas_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "pro_labore_usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_sm_saudacoes_exibidas" ADD CONSTRAINT "pro_labore_sm_saudacoes_exibidas_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "pro_labore_usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_sm_saudacoes_exibidas" ADD CONSTRAINT "pro_labore_sm_saudacoes_exibidas_fraseId_fkey" FOREIGN KEY ("fraseId") REFERENCES "pro_labore_sm_saudacao_frases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_sm_preferencias" ADD CONSTRAINT "pro_labore_sm_preferencias_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "pro_labore_usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

