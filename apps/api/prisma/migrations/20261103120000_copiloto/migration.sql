-- CreateTable
CREATE TABLE "pro_labore_copiloto_perfis" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "pessoa" TEXT NOT NULL,
    "nivel" TEXT NOT NULL DEFAULT 'INTERMEDIARIO',
    "minutosEstudoDia" INTEGER NOT NULL DEFAULT 15,
    "objetivo" TEXT,
    "whatsappDiario" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ultimoAcessoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_copiloto_perfis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_copiloto_dias" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "pessoa" TEXT NOT NULL,
    "dia" TEXT NOT NULL,
    "fatos" JSONB NOT NULL,
    "achados" JSONB NOT NULL,
    "relatorio" JSONB NOT NULL,
    "origem" TEXT NOT NULL DEFAULT 'MODELO',
    "indice" INTEGER,
    "geradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "iaEm" TIMESTAMP(3),
    "lidoEm" TIMESTAMP(3),
    "whatsappEnviadoEm" TIMESTAMP(3),
    "util" BOOLEAN,
    "comentario" TEXT,

    CONSTRAINT "pro_labore_copiloto_dias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_copiloto_acoes" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "pessoa" TEXT NOT NULL,
    "dia" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "porque" TEXT NOT NULL,
    "refTipo" TEXT,
    "refId" TEXT,
    "estagioNaHora" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "feitaEm" TIMESTAMP(3),
    "resultado" TEXT,
    "verificadaEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pro_labore_copiloto_acoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_copiloto_estudos" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "pessoa" TEXT NOT NULL,
    "competencia" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fonte" TEXT,
    "porque" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUGERIDO',
    "util" BOOLEAN,
    "anotacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluidoEm" TIMESTAMP(3),

    CONSTRAINT "pro_labore_copiloto_estudos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_copiloto_memorias" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "pessoa" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "natureza" TEXT NOT NULL DEFAULT 'FATO',
    "origem" TEXT NOT NULL,
    "chave" TEXT,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_copiloto_memorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_copiloto_mensagens" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "pessoa" TEXT NOT NULL,
    "autor" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "origem" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pro_labore_copiloto_mensagens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_copiloto_sugestoes" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "pessoa" TEXT NOT NULL,
    "conversaId" TEXT NOT NULL,
    "conteudo" JSONB NOT NULL,
    "origem" TEXT NOT NULL,
    "usadaIndice" INTEGER,
    "usadaEm" TIMESTAMP(3),
    "util" BOOLEAN,
    "estagioNaHora" TEXT,
    "resultado" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pro_labore_copiloto_sugestoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_copiloto_perfis_usuarioId_pessoa_key" ON "pro_labore_copiloto_perfis"("usuarioId", "pessoa");

-- CreateIndex
CREATE INDEX "pro_labore_copiloto_dias_usuarioId_pessoa_idx" ON "pro_labore_copiloto_dias"("usuarioId", "pessoa");

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_copiloto_dias_usuarioId_pessoa_dia_key" ON "pro_labore_copiloto_dias"("usuarioId", "pessoa", "dia");

-- CreateIndex
CREATE INDEX "pro_labore_copiloto_acoes_usuarioId_pessoa_dia_idx" ON "pro_labore_copiloto_acoes"("usuarioId", "pessoa", "dia");

-- CreateIndex
CREATE INDEX "pro_labore_copiloto_estudos_usuarioId_pessoa_idx" ON "pro_labore_copiloto_estudos"("usuarioId", "pessoa");

-- CreateIndex
CREATE INDEX "pro_labore_copiloto_memorias_usuarioId_pessoa_idx" ON "pro_labore_copiloto_memorias"("usuarioId", "pessoa");

-- CreateIndex
CREATE INDEX "pro_labore_copiloto_mensagens_usuarioId_pessoa_criadoEm_idx" ON "pro_labore_copiloto_mensagens"("usuarioId", "pessoa", "criadoEm");

-- CreateIndex
CREATE INDEX "pro_labore_copiloto_sugestoes_usuarioId_pessoa_idx" ON "pro_labore_copiloto_sugestoes"("usuarioId", "pessoa");

-- CreateIndex
CREATE INDEX "pro_labore_copiloto_sugestoes_conversaId_idx" ON "pro_labore_copiloto_sugestoes"("conversaId");

