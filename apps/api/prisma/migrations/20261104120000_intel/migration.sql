-- CreateTable
CREATE TABLE "pro_labore_intel_planejamento" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "metaFaturamentoMensal" DOUBLE PRECISION NOT NULL DEFAULT 500000,
    "ticketMedio" DOUBLE PRECISION NOT NULL DEFAULT 20000,
    "orcamentoMarketing" DOUBLE PRECISION NOT NULL DEFAULT 8000,
    "vendedoresPlanejados" INTEGER,
    "metaLeadAbordado" DOUBLE PRECISION NOT NULL DEFAULT 0.9,
    "metaAbordadoNegociacao" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "metaNegociacaoProposta" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "metaPropostaFechamento" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
    "cenarioPersonalizado" JSONB,
    "margemContribuicaoVenda" DOUBLE PRECISION,
    "diasUteisSemana" TEXT NOT NULL DEFAULT '1,2,3,4,5,6',
    "criterios" JSONB,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "atualizadoPor" TEXT,

    CONSTRAINT "pro_labore_intel_planejamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_intel_relatorios" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "modulo" TEXT NOT NULL,
    "dia" TEXT NOT NULL,
    "periodoInicio" TEXT NOT NULL,
    "periodoFim" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'VALIDO',
    "indicadores" JSONB NOT NULL,
    "alertas" JSONB NOT NULL,
    "origem" JSONB NOT NULL,
    "hash" TEXT NOT NULL,
    "geradoPorId" TEXT NOT NULL,
    "geradoPorNome" TEXT NOT NULL,
    "confirmadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observacao" TEXT,

    CONSTRAINT "pro_labore_intel_relatorios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_intel_diagnosticos" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "departamento" TEXT NOT NULL,
    "severidade" TEXT NOT NULL,
    "problema" TEXT NOT NULL,
    "dados" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "ocorrencias" INTEGER NOT NULL DEFAULT 1,
    "primeiraVezEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimaVezEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvidoEm" TIMESTAMP(3),

    CONSTRAINT "pro_labore_intel_diagnosticos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_intel_acoes" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "diagnosticoId" TEXT,
    "titulo" TEXT NOT NULL,
    "problema" TEXT NOT NULL,
    "evidencias" TEXT,
    "objetivo" TEXT,
    "departamento" TEXT NOT NULL,
    "responsavelId" TEXT,
    "responsavelNome" TEXT,
    "colaboradores" JSONB,
    "prazo" TIMESTAMP(3),
    "prioridade" TEXT NOT NULL,
    "indicadorChave" TEXT,
    "indicadorNome" TEXT,
    "valorInicial" DOUBLE PRECISION,
    "metaEsperada" DOUBLE PRECISION,
    "melhorQuando" TEXT,
    "status" TEXT NOT NULL DEFAULT 'IDENTIFICADA',
    "justificativa" TEXT,
    "comentarios" JSONB,
    "evidenciasExecucao" TEXT,
    "resultadoValor" DOUBLE PRECISION,
    "resultadoEm" TIMESTAMP(3),
    "criadoPor" TEXT NOT NULL,
    "aprovadoPor" TEXT,
    "aprovadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_intel_acoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_intel_reunioes" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "titulo" TEXT NOT NULL,
    "notas" TEXT,
    "retrato" JSONB NOT NULL,
    "acoesIds" JSONB,
    "criadoPor" TEXT NOT NULL,

    CONSTRAINT "pro_labore_intel_reunioes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_intel_auditoria" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT,
    "acao" TEXT NOT NULL,
    "campo" TEXT,
    "antes" JSONB,
    "depois" JSONB,
    "autorId" TEXT NOT NULL,
    "autorNome" TEXT NOT NULL,
    "em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pro_labore_intel_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_intel_planejamento_usuarioId_key" ON "pro_labore_intel_planejamento"("usuarioId");

-- CreateIndex
CREATE INDEX "pro_labore_intel_relatorios_usuarioId_modulo_dia_idx" ON "pro_labore_intel_relatorios"("usuarioId", "modulo", "dia");

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_intel_relatorios_usuarioId_modulo_dia_versao_key" ON "pro_labore_intel_relatorios"("usuarioId", "modulo", "dia", "versao");

-- CreateIndex
CREATE INDEX "pro_labore_intel_diagnosticos_usuarioId_status_idx" ON "pro_labore_intel_diagnosticos"("usuarioId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_intel_diagnosticos_usuarioId_chave_periodo_key" ON "pro_labore_intel_diagnosticos"("usuarioId", "chave", "periodo");

-- CreateIndex
CREATE INDEX "pro_labore_intel_acoes_usuarioId_status_idx" ON "pro_labore_intel_acoes"("usuarioId", "status");

-- CreateIndex
CREATE INDEX "pro_labore_intel_reunioes_usuarioId_data_idx" ON "pro_labore_intel_reunioes"("usuarioId", "data");

-- CreateIndex
CREATE INDEX "pro_labore_intel_auditoria_usuarioId_em_idx" ON "pro_labore_intel_auditoria"("usuarioId", "em");

-- CreateIndex
CREATE INDEX "pro_labore_intel_auditoria_usuarioId_entidade_entidadeId_idx" ON "pro_labore_intel_auditoria"("usuarioId", "entidade", "entidadeId");

