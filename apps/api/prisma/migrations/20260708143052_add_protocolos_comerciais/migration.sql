-- CreateTable
CREATE TABLE "protocolos" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "categoria" TEXT NOT NULL DEFAULT 'Comercial',
    "nome" TEXT NOT NULL,
    "versao" TEXT NOT NULL DEFAULT '1.0.0',
    "status" TEXT NOT NULL DEFAULT 'ativo',
    "ordem" INTEGER,
    "objetivo" TEXT,
    "resultadoEsperado" JSONB,
    "responsaveis" JSONB,
    "processo" JSONB,
    "pop" JSONB,
    "regras" JSONB,
    "ferramentas" JSONB,
    "rotina" JSONB,
    "sla" JSONB,
    "kpis" JSONB,
    "auditoriaItens" JSONB,
    "frequenciaAuditoria" TEXT,
    "criteriosConformidade" JSONB,
    "naoConformidadesCatalogo" JSONB,
    "reunioes" JSONB,
    "perguntasAnalise" JSONB,
    "riscos" JSONB,
    "planoContingencia" JSONB,
    "oportunidadesMelhoriaNotas" JSONB,
    "automacoesPossiveis" JSONB,
    "iaAplicavel" JSONB,
    "revisaoFrequencia" TEXT,
    "revisaoResponsavel" TEXT,
    "anexos" JSONB,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "protocolos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditorias_protocolo" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "protocoloId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responsavelId" TEXT,
    "conforme" BOOLEAN NOT NULL,
    "itensVerificados" JSONB,
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditorias_protocolo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nao_conformidades_protocolo" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "protocoloId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'ABERTA',
    "resolvidoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nao_conformidades_protocolo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planos_acao_protocolo" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "protocoloId" TEXT NOT NULL,
    "naoConformidadeId" TEXT,
    "problema" TEXT NOT NULL,
    "causa" TEXT,
    "solucao" TEXT,
    "responsavelId" TEXT,
    "prazo" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "concluidoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "planos_acao_protocolo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "melhorias_protocolo" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "protocoloId" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ABERTA',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "melhorias_protocolo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "protocolos_empresaId_idx" ON "protocolos"("empresaId");

-- CreateIndex
CREATE INDEX "protocolos_empresaId_categoria_idx" ON "protocolos"("empresaId", "categoria");

-- CreateIndex
CREATE INDEX "auditorias_protocolo_empresaId_idx" ON "auditorias_protocolo"("empresaId");

-- CreateIndex
CREATE INDEX "auditorias_protocolo_protocoloId_idx" ON "auditorias_protocolo"("protocoloId");

-- CreateIndex
CREATE INDEX "nao_conformidades_protocolo_empresaId_idx" ON "nao_conformidades_protocolo"("empresaId");

-- CreateIndex
CREATE INDEX "nao_conformidades_protocolo_protocoloId_idx" ON "nao_conformidades_protocolo"("protocoloId");

-- CreateIndex
CREATE INDEX "nao_conformidades_protocolo_protocoloId_status_idx" ON "nao_conformidades_protocolo"("protocoloId", "status");

-- CreateIndex
CREATE INDEX "planos_acao_protocolo_empresaId_idx" ON "planos_acao_protocolo"("empresaId");

-- CreateIndex
CREATE INDEX "planos_acao_protocolo_protocoloId_idx" ON "planos_acao_protocolo"("protocoloId");

-- CreateIndex
CREATE INDEX "planos_acao_protocolo_protocoloId_status_idx" ON "planos_acao_protocolo"("protocoloId", "status");

-- CreateIndex
CREATE INDEX "melhorias_protocolo_empresaId_idx" ON "melhorias_protocolo"("empresaId");

-- CreateIndex
CREATE INDEX "melhorias_protocolo_protocoloId_idx" ON "melhorias_protocolo"("protocoloId");

-- AddForeignKey
ALTER TABLE "protocolos" ADD CONSTRAINT "protocolos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "protocolos" ADD CONSTRAINT "protocolos_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditorias_protocolo" ADD CONSTRAINT "auditorias_protocolo_protocoloId_fkey" FOREIGN KEY ("protocoloId") REFERENCES "protocolos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditorias_protocolo" ADD CONSTRAINT "auditorias_protocolo_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nao_conformidades_protocolo" ADD CONSTRAINT "nao_conformidades_protocolo_protocoloId_fkey" FOREIGN KEY ("protocoloId") REFERENCES "protocolos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planos_acao_protocolo" ADD CONSTRAINT "planos_acao_protocolo_protocoloId_fkey" FOREIGN KEY ("protocoloId") REFERENCES "protocolos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planos_acao_protocolo" ADD CONSTRAINT "planos_acao_protocolo_naoConformidadeId_fkey" FOREIGN KEY ("naoConformidadeId") REFERENCES "nao_conformidades_protocolo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planos_acao_protocolo" ADD CONSTRAINT "planos_acao_protocolo_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "melhorias_protocolo" ADD CONSTRAINT "melhorias_protocolo_protocoloId_fkey" FOREIGN KEY ("protocoloId") REFERENCES "protocolos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
