-- CreateTable
CREATE TABLE "pro_labore_sm_motos_estoque" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "marca" TEXT,
    "ano" INTEGER,
    "cor" TEXT,
    "entradaEm" TIMESTAMP(3) NOT NULL,
    "situacao" TEXT NOT NULL DEFAULT 'DISPONIVEL',
    "saidaEm" TIMESTAMP(3),
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_sm_motos_estoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_sm_pautas" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "pilar" TEXT NOT NULL,
    "formato" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IDEIA',
    "ordem" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "prazo" TIMESTAMP(3),
    "origem" TEXT NOT NULL DEFAULT 'MANUAL',
    "origemRef" TEXT,
    "motoId" TEXT,
    "gancho" TEXT,
    "retencao" TEXT,
    "recompensa" TEXT,
    "cta" TEXT,
    "legenda" TEXT,
    "checklist" JSONB NOT NULL DEFAULT '{}',
    "agendadoPara" TIMESTAMP(3),
    "codigo" TEXT,
    "trial" BOOLEAN NOT NULL DEFAULT false,
    "aprovacao" TEXT,
    "enviadaAprovacaoEm" TIMESTAMP(3),
    "aprovadaEm" TIMESTAMP(3),
    "comentarioAprovacao" TEXT,
    "publicacaoStatus" TEXT,
    "publicacaoContainerId" TEXT,
    "publicacaoErro" TEXT,
    "publicacaoTentativas" INTEGER NOT NULL DEFAULT 0,
    "publicadaEm" TIMESTAMP(3),
    "igMediaId" TEXT,
    "permalink" TEXT,
    "autorizacaoImagem" BOOLEAN NOT NULL DEFAULT false,
    "criadoPor" TEXT NOT NULL DEFAULT 'SOCIAL_MEDIA',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_sm_pautas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_sm_pautas_midias" (
    "id" TEXT NOT NULL,
    "pautaId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pro_labore_sm_pautas_midias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pro_labore_sm_motos_estoque_usuarioId_situacao_idx" ON "pro_labore_sm_motos_estoque"("usuarioId", "situacao");

-- CreateIndex
CREATE INDEX "pro_labore_sm_pautas_usuarioId_status_idx" ON "pro_labore_sm_pautas"("usuarioId", "status");

-- CreateIndex
CREATE INDEX "pro_labore_sm_pautas_usuarioId_agendadoPara_idx" ON "pro_labore_sm_pautas"("usuarioId", "agendadoPara");

-- CreateIndex
CREATE INDEX "pro_labore_sm_pautas_motoId_idx" ON "pro_labore_sm_pautas"("motoId");

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_sm_pautas_usuarioId_codigo_key" ON "pro_labore_sm_pautas"("usuarioId", "codigo");

-- CreateIndex
CREATE INDEX "pro_labore_sm_pautas_midias_pautaId_idx" ON "pro_labore_sm_pautas_midias"("pautaId");

-- AddForeignKey
ALTER TABLE "pro_labore_sm_motos_estoque" ADD CONSTRAINT "pro_labore_sm_motos_estoque_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "pro_labore_usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_sm_pautas" ADD CONSTRAINT "pro_labore_sm_pautas_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "pro_labore_usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_sm_pautas" ADD CONSTRAINT "pro_labore_sm_pautas_motoId_fkey" FOREIGN KEY ("motoId") REFERENCES "pro_labore_sm_motos_estoque"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_sm_pautas_midias" ADD CONSTRAINT "pro_labore_sm_pautas_midias_pautaId_fkey" FOREIGN KEY ("pautaId") REFERENCES "pro_labore_sm_pautas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

