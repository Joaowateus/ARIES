-- CreateTable
CREATE TABLE "pro_labore_cadencias_ligacao" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "gatilho" TEXT,
    "pararAoAtender" BOOLEAN NOT NULL DEFAULT true,
    "passos" JSONB NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_cadencias_ligacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_ligacoes" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "vendedorId" TEXT,
    "cadenciaId" TEXT,
    "passo" INTEGER,
    "totalPassos" INTEGER,
    "instrucao" TEXT,
    "agendadaPara" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "motivoCancelada" TEXT,
    "discadaEm" TIMESTAMP(3),
    "discagens" INTEGER NOT NULL DEFAULT 0,
    "dispositivo" TEXT,
    "registradaEm" TIMESTAMP(3),
    "registradaPorId" TEXT,
    "registradaPor" TEXT,
    "resultado" TEXT,
    "duracaoSeg" INTEGER,
    "resumo" TEXT,
    "alertas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "criadoPor" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_ligacoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pro_labore_cadencias_ligacao_usuarioId_ativa_idx" ON "pro_labore_cadencias_ligacao"("usuarioId", "ativa");

-- CreateIndex
CREATE INDEX "pro_labore_ligacoes_usuarioId_status_agendadaPara_idx" ON "pro_labore_ligacoes"("usuarioId", "status", "agendadaPara");

-- CreateIndex
CREATE INDEX "pro_labore_ligacoes_leadId_status_idx" ON "pro_labore_ligacoes"("leadId", "status");

-- CreateIndex
CREATE INDEX "pro_labore_ligacoes_vendedorId_status_agendadaPara_idx" ON "pro_labore_ligacoes"("vendedorId", "status", "agendadaPara");

-- AddForeignKey
ALTER TABLE "pro_labore_ligacoes" ADD CONSTRAINT "pro_labore_ligacoes_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "pro_labore_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
