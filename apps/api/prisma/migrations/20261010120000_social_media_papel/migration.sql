-- CreateTable
CREATE TABLE "pro_labore_sm_membros" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tratamento" TEXT,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "conviteHash" TEXT,
    "conviteExpiraEm" TIMESTAMP(3),
    "convidadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ativadoEm" TIMESTAMP(3),
    "primeiroAcessoEm" TIMESTAMP(3),
    "ultimoAcessoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_sm_membros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_sm_permissoes" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "niveis" JSONB NOT NULL DEFAULT '{}',
    "aprovacaoGestor" BOOLEAN NOT NULL DEFAULT true,
    "mostrarValores" BOOLEAN NOT NULL DEFAULT true,
    "relatorioSemanal" BOOLEAN NOT NULL DEFAULT true,
    "assistenteIA" BOOLEAN NOT NULL DEFAULT false,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pro_labore_sm_permissoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_sm_membros_usuarioId_key" ON "pro_labore_sm_membros"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_sm_membros_email_key" ON "pro_labore_sm_membros"("email");

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_sm_membros_conviteHash_key" ON "pro_labore_sm_membros"("conviteHash");

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_sm_permissoes_usuarioId_key" ON "pro_labore_sm_permissoes"("usuarioId");

-- AddForeignKey
ALTER TABLE "pro_labore_sm_membros" ADD CONSTRAINT "pro_labore_sm_membros_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "pro_labore_usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_sm_permissoes" ADD CONSTRAINT "pro_labore_sm_permissoes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "pro_labore_usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

