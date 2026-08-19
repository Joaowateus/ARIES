-- AlterTable
ALTER TABLE "contratos" ADD COLUMN     "processoAdministrativoStatus" TEXT NOT NULL DEFAULT 'PENDENTE';

-- AlterTable
ALTER TABLE "metas" ADD COLUMN     "usuarioId" TEXT;

-- AlterTable
ALTER TABLE "oportunidades" ADD COLUMN     "proximaAcaoDescricao" TEXT,
ADD COLUMN     "proximaAcaoEm" TIMESTAMP(3),
ADD COLUMN     "ultimaInteracaoEm" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "departamento" TEXT,
ADD COLUMN     "gestorId" TEXT;

-- CreateTable
CREATE TABLE "atividades_oportunidade" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "oportunidadeId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atividades_oportunidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metas_funil_etapa" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "etapa" TEXT NOT NULL,
    "metaPct" DOUBLE PRECISION NOT NULL,
    "tipoMeta" TEXT NOT NULL DEFAULT 'MINIMO',
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "metas_funil_etapa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contas_anuncio" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "plataforma" TEXT NOT NULL DEFAULT 'MARKETPLACE',
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contas_anuncio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anuncios_producao" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "unidadeId" TEXT,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "horario" TEXT,
    "produto" TEXT,
    "quantidade" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'PUBLICADO',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anuncios_producao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conteudo_social_media" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "plataforma" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "objetivo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PUBLICADO',
    "link" TEXT,
    "alcance" INTEGER,
    "visualizacoes" INTEGER,
    "interacoes" INTEGER,
    "leadsGerados" INTEGER DEFAULT 0,
    "vendasOriginadas" INTEGER DEFAULT 0,
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conteudo_social_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rotinas" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "papelAlvo" TEXT,
    "departamento" TEXT,
    "frequencia" TEXT NOT NULL DEFAULT 'DIARIA',
    "horario" TEXT,
    "blocos" JSONB NOT NULL,
    "evidenciaNecessaria" BOOLEAN NOT NULL DEFAULT false,
    "protocoloId" TEXT,
    "processoId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ATIVA',
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rotinas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rotina_execucoes" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "rotinaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "itensStatus" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "evidencia" TEXT,
    "observacao" TEXT,
    "concluidoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rotina_execucoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tarefas" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "responsavelId" TEXT NOT NULL,
    "criadoPorId" TEXT NOT NULL,
    "prazo" TIMESTAMP(3),
    "prioridade" TEXT NOT NULL DEFAULT 'NORMAL',
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "vinculoTipo" TEXT,
    "vinculoId" TEXT,
    "concluidoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tarefas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processos" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "departamento" TEXT,
    "responsavelId" TEXT,
    "cargo" TEXT,
    "objetivo" TEXT,
    "fluxo" JSONB,
    "pop" JSONB,
    "protocoloId" TEXT,
    "ferramentas" JSONB,
    "kpis" JSONB,
    "auditoria" JSONB,
    "contingencia" JSONB,
    "status" TEXT NOT NULL DEFAULT 'ativo',
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "processos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treinamentos" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "categoria" TEXT,
    "papelAlvo" TEXT,
    "departamento" TEXT,
    "descricao" TEXT,
    "videoUrl" TEXT,
    "pdfUrl" TEXT,
    "documentoUrl" TEXT,
    "link" TEXT,
    "materialComplementar" JSONB,
    "avaliacao" JSONB,
    "status" TEXT NOT NULL DEFAULT 'ativo',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "treinamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treinamento_progresso" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "treinamentoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DISPONIVEL',
    "percentual" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "nota" DOUBLE PRECISION,
    "concluidoEm" TIMESTAMP(3),
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "treinamento_progresso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditorias" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "entidadeTipo" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "responsavelId" TEXT,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conforme" BOOLEAN NOT NULL,
    "itensVerificados" JSONB,
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planos_acao" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "auditoriaId" TEXT,
    "origemTipo" TEXT,
    "problema" TEXT NOT NULL,
    "causa" TEXT,
    "solucao" TEXT,
    "responsavelId" TEXT,
    "prazo" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "concluidoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "planos_acao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificacoes" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "entidadeTipo" TEXT,
    "entidadeId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "score_config" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "pesoComercial" DOUBLE PRECISION NOT NULL DEFAULT 0.40,
    "pesoProdutividade" DOUBLE PRECISION NOT NULL DEFAULT 0.20,
    "pesoProcessos" DOUBLE PRECISION NOT NULL DEFAULT 0.15,
    "pesoCrm" DOUBLE PRECISION NOT NULL DEFAULT 0.10,
    "pesoConteudo" DOUBLE PRECISION NOT NULL DEFAULT 0.05,
    "pesoTreinamentos" DOUBLE PRECISION NOT NULL DEFAULT 0.05,
    "pesoRotinas" DOUBLE PRECISION NOT NULL DEFAULT 0.05,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "score_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "log_auditoria" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "entidadeTipo" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "acao" TEXT NOT NULL,
    "campoAlterado" TEXT,
    "valorAnterior" TEXT,
    "valorNovo" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "log_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "atividades_oportunidade_empresaId_idx" ON "atividades_oportunidade"("empresaId");

-- CreateIndex
CREATE INDEX "atividades_oportunidade_oportunidadeId_idx" ON "atividades_oportunidade"("oportunidadeId");

-- CreateIndex
CREATE UNIQUE INDEX "metas_funil_etapa_empresaId_etapa_key" ON "metas_funil_etapa"("empresaId", "etapa");

-- CreateIndex
CREATE INDEX "contas_anuncio_empresaId_usuarioId_idx" ON "contas_anuncio"("empresaId", "usuarioId");

-- CreateIndex
CREATE INDEX "anuncios_producao_empresaId_usuarioId_idx" ON "anuncios_producao"("empresaId", "usuarioId");

-- CreateIndex
CREATE INDEX "anuncios_producao_empresaId_data_idx" ON "anuncios_producao"("empresaId", "data");

-- CreateIndex
CREATE INDEX "conteudo_social_media_empresaId_usuarioId_idx" ON "conteudo_social_media"("empresaId", "usuarioId");

-- CreateIndex
CREATE INDEX "conteudo_social_media_empresaId_data_idx" ON "conteudo_social_media"("empresaId", "data");

-- CreateIndex
CREATE INDEX "rotinas_empresaId_idx" ON "rotinas"("empresaId");

-- CreateIndex
CREATE INDEX "rotina_execucoes_empresaId_usuarioId_idx" ON "rotina_execucoes"("empresaId", "usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "rotina_execucoes_rotinaId_usuarioId_data_key" ON "rotina_execucoes"("rotinaId", "usuarioId", "data");

-- CreateIndex
CREATE INDEX "tarefas_empresaId_responsavelId_idx" ON "tarefas"("empresaId", "responsavelId");

-- CreateIndex
CREATE INDEX "tarefas_empresaId_status_idx" ON "tarefas"("empresaId", "status");

-- CreateIndex
CREATE INDEX "processos_empresaId_idx" ON "processos"("empresaId");

-- CreateIndex
CREATE INDEX "treinamentos_empresaId_idx" ON "treinamentos"("empresaId");

-- CreateIndex
CREATE INDEX "treinamento_progresso_empresaId_usuarioId_idx" ON "treinamento_progresso"("empresaId", "usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "treinamento_progresso_treinamentoId_usuarioId_key" ON "treinamento_progresso"("treinamentoId", "usuarioId");

-- CreateIndex
CREATE INDEX "auditorias_empresaId_idx" ON "auditorias"("empresaId");

-- CreateIndex
CREATE INDEX "auditorias_empresaId_entidadeTipo_entidadeId_idx" ON "auditorias"("empresaId", "entidadeTipo", "entidadeId");

-- CreateIndex
CREATE INDEX "planos_acao_empresaId_idx" ON "planos_acao"("empresaId");

-- CreateIndex
CREATE INDEX "notificacoes_empresaId_usuarioId_lida_idx" ON "notificacoes"("empresaId", "usuarioId", "lida");

-- CreateIndex
CREATE UNIQUE INDEX "score_config_empresaId_key" ON "score_config"("empresaId");

-- CreateIndex
CREATE INDEX "log_auditoria_empresaId_entidadeTipo_entidadeId_idx" ON "log_auditoria"("empresaId", "entidadeTipo", "entidadeId");

-- CreateIndex
CREATE INDEX "metas_empresaId_usuarioId_idx" ON "metas"("empresaId", "usuarioId");

-- CreateIndex
CREATE INDEX "oportunidades_empresaId_proximaAcaoEm_idx" ON "oportunidades"("empresaId", "proximaAcaoEm");

-- CreateIndex
CREATE INDEX "usuarios_gestorId_idx" ON "usuarios"("gestorId");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_gestorId_fkey" FOREIGN KEY ("gestorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metas" ADD CONSTRAINT "metas_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atividades_oportunidade" ADD CONSTRAINT "atividades_oportunidade_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atividades_oportunidade" ADD CONSTRAINT "atividades_oportunidade_oportunidadeId_fkey" FOREIGN KEY ("oportunidadeId") REFERENCES "oportunidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atividades_oportunidade" ADD CONSTRAINT "atividades_oportunidade_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metas_funil_etapa" ADD CONSTRAINT "metas_funil_etapa_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contas_anuncio" ADD CONSTRAINT "contas_anuncio_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contas_anuncio" ADD CONSTRAINT "contas_anuncio_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anuncios_producao" ADD CONSTRAINT "anuncios_producao_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anuncios_producao" ADD CONSTRAINT "anuncios_producao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anuncios_producao" ADD CONSTRAINT "anuncios_producao_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "contas_anuncio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anuncios_producao" ADD CONSTRAINT "anuncios_producao_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "unidades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conteudo_social_media" ADD CONSTRAINT "conteudo_social_media_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conteudo_social_media" ADD CONSTRAINT "conteudo_social_media_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rotinas" ADD CONSTRAINT "rotinas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rotinas" ADD CONSTRAINT "rotinas_protocoloId_fkey" FOREIGN KEY ("protocoloId") REFERENCES "protocolos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rotinas" ADD CONSTRAINT "rotinas_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "processos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rotina_execucoes" ADD CONSTRAINT "rotina_execucoes_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rotina_execucoes" ADD CONSTRAINT "rotina_execucoes_rotinaId_fkey" FOREIGN KEY ("rotinaId") REFERENCES "rotinas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rotina_execucoes" ADD CONSTRAINT "rotina_execucoes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processos" ADD CONSTRAINT "processos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processos" ADD CONSTRAINT "processos_protocoloId_fkey" FOREIGN KEY ("protocoloId") REFERENCES "protocolos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treinamentos" ADD CONSTRAINT "treinamentos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treinamento_progresso" ADD CONSTRAINT "treinamento_progresso_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treinamento_progresso" ADD CONSTRAINT "treinamento_progresso_treinamentoId_fkey" FOREIGN KEY ("treinamentoId") REFERENCES "treinamentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treinamento_progresso" ADD CONSTRAINT "treinamento_progresso_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditorias" ADD CONSTRAINT "auditorias_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditorias" ADD CONSTRAINT "auditorias_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planos_acao" ADD CONSTRAINT "planos_acao_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planos_acao" ADD CONSTRAINT "planos_acao_auditoriaId_fkey" FOREIGN KEY ("auditoriaId") REFERENCES "auditorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planos_acao" ADD CONSTRAINT "planos_acao_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_config" ADD CONSTRAINT "score_config_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log_auditoria" ADD CONSTRAINT "log_auditoria_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
