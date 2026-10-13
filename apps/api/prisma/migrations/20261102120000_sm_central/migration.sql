-- CreateTable
CREATE TABLE "pro_labore_sm_dossies" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'VIGENTE',
    "conteudo" JSONB NOT NULL,
    "nota" TEXT,
    "criadoPor" TEXT NOT NULL DEFAULT 'GESTOR',
    "decididoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pro_labore_sm_dossies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_sm_ciclos" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "mes" TEXT NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "dossieId" TEXT NOT NULL,
    "dias" JSONB NOT NULL,
    "horarios" JSONB NOT NULL,
    "origem" TEXT NOT NULL DEFAULT 'MANUAL',
    "geradoPor" TEXT NOT NULL DEFAULT 'GESTOR',
    "consideracoes" JSONB,
    "relatorio" JSONB,
    "aprovadoEm" TIMESTAMP(3),
    "fechadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_sm_ciclos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_sm_videos" (
    "id" TEXT NOT NULL,
    "cicloId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "semana" INTEGER NOT NULL,
    "diaCiclo" INTEGER NOT NULL,
    "data" TEXT NOT NULL,
    "horario" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "etapa" TEXT NOT NULL,
    "tema" TEXT NOT NULL,
    "temaChave" TEXT NOT NULL,
    "pilar" TEXT NOT NULL,
    "formato" TEXT NOT NULL,
    "alvoTipo" TEXT NOT NULL,
    "alvo" TEXT NOT NULL,
    "lente" TEXT NOT NULL,
    "lenteMotivo" TEXT,
    "persona" TEXT NOT NULL,
    "objetivo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "gancho" TEXT NOT NULL,
    "contexto" TEXT NOT NULL,
    "desenvolvimento" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "cta" TEXT NOT NULL,
    "gravacao" TEXT NOT NULL,
    "cenas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "textosTela" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "duracaoSeg" INTEGER NOT NULL DEFAULT 30,
    "legenda" TEXT NOT NULL,
    "provaNecessaria" TEXT,
    "provaId" TEXT,
    "pendenteConfirmacao" TEXT,
    "confirmadoEm" TIMESTAMP(3),
    "confirmacaoNota" TEXT,
    "ajusteComentario" TEXT,
    "responsavel" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANEJADO',
    "roteiroOrigem" TEXT NOT NULL DEFAULT 'MODELO',
    "aprovadoEm" TIMESTAMP(3),
    "pautaId" TEXT,
    "permalink" TEXT,
    "metricasManuais" JSONB,
    "resultado" TEXT,
    "aprendizado" TEXT,
    "melhoria" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_sm_videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_sm_central_itens" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "natureza" TEXT NOT NULL DEFAULT 'FATO',
    "tags" JSONB NOT NULL DEFAULT '{}',
    "resultado" TEXT,
    "ocorrencias" INTEGER NOT NULL DEFAULT 1,
    "usadoEm" TEXT,
    "criadoPor" TEXT NOT NULL DEFAULT 'SOCIAL_MEDIA',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pro_labore_sm_central_itens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_sm_provas" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "origem" TEXT,
    "link" TEXT,
    "responsavel" TEXT,
    "permissao" TEXT,
    "verificadoEm" TIMESTAMP(3),
    "validoAte" TIMESTAMP(3),
    "situacao" TEXT NOT NULL DEFAULT 'PENDENTE',
    "nota" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_sm_provas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_sm_dossies_usuarioId_versao_key" ON "pro_labore_sm_dossies"("usuarioId", "versao");

-- CreateIndex
CREATE INDEX "pro_labore_sm_ciclos_usuarioId_status_idx" ON "pro_labore_sm_ciclos"("usuarioId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_sm_ciclos_usuarioId_mes_versao_key" ON "pro_labore_sm_ciclos"("usuarioId", "mes", "versao");

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_sm_videos_pautaId_key" ON "pro_labore_sm_videos"("pautaId");

-- CreateIndex
CREATE INDEX "pro_labore_sm_videos_cicloId_data_idx" ON "pro_labore_sm_videos"("cicloId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_sm_videos_cicloId_codigo_key" ON "pro_labore_sm_videos"("cicloId", "codigo");

-- CreateIndex
CREATE INDEX "pro_labore_sm_central_itens_usuarioId_tipo_idx" ON "pro_labore_sm_central_itens"("usuarioId", "tipo");

-- CreateIndex
CREATE INDEX "pro_labore_sm_provas_usuarioId_idx" ON "pro_labore_sm_provas"("usuarioId");

-- AddForeignKey
ALTER TABLE "pro_labore_sm_dossies" ADD CONSTRAINT "pro_labore_sm_dossies_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "pro_labore_usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_sm_ciclos" ADD CONSTRAINT "pro_labore_sm_ciclos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "pro_labore_usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_sm_ciclos" ADD CONSTRAINT "pro_labore_sm_ciclos_dossieId_fkey" FOREIGN KEY ("dossieId") REFERENCES "pro_labore_sm_dossies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_sm_videos" ADD CONSTRAINT "pro_labore_sm_videos_cicloId_fkey" FOREIGN KEY ("cicloId") REFERENCES "pro_labore_sm_ciclos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_sm_central_itens" ADD CONSTRAINT "pro_labore_sm_central_itens_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "pro_labore_usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_sm_provas" ADD CONSTRAINT "pro_labore_sm_provas_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "pro_labore_usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

