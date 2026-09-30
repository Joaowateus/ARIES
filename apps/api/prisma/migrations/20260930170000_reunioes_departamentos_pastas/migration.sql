-- Departamentos (com senha) e pastas pra organizar as apresentações da aba Reuniões.
-- AlterTable
ALTER TABLE "pro_labore_apresentacoes" ADD COLUMN     "departamentoId" TEXT,
ADD COLUMN     "pastaId" TEXT;

-- CreateTable
CREATE TABLE "pro_labore_reunioes_departamentos" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "cor" TEXT NOT NULL DEFAULT '#5b8def',
    "senhaHash" TEXT NOT NULL,
    "senhaVersao" INTEGER NOT NULL DEFAULT 1,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_reunioes_departamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_reunioes_pastas" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "departamentoId" TEXT,
    "nome" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pro_labore_reunioes_pastas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_reunioes_departamentos_acessos" (
    "id" TEXT NOT NULL,
    "departamentoId" TEXT NOT NULL,
    "pessoa" TEXT NOT NULL,
    "senhaVersao" INTEGER NOT NULL,
    "liberadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pro_labore_reunioes_departamentos_acessos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pro_labore_reunioes_departamentos_usuarioId_idx" ON "pro_labore_reunioes_departamentos"("usuarioId");

-- CreateIndex
CREATE INDEX "pro_labore_reunioes_pastas_usuarioId_departamentoId_idx" ON "pro_labore_reunioes_pastas"("usuarioId", "departamentoId");

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_reunioes_departamentos_acessos_departamentoId_pe_key" ON "pro_labore_reunioes_departamentos_acessos"("departamentoId", "pessoa");

-- CreateIndex
CREATE INDEX "pro_labore_apresentacoes_departamentoId_idx" ON "pro_labore_apresentacoes"("departamentoId");

-- AddForeignKey
ALTER TABLE "pro_labore_apresentacoes" ADD CONSTRAINT "pro_labore_apresentacoes_departamentoId_fkey" FOREIGN KEY ("departamentoId") REFERENCES "pro_labore_reunioes_departamentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_apresentacoes" ADD CONSTRAINT "pro_labore_apresentacoes_pastaId_fkey" FOREIGN KEY ("pastaId") REFERENCES "pro_labore_reunioes_pastas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_reunioes_departamentos" ADD CONSTRAINT "pro_labore_reunioes_departamentos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "pro_labore_usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_reunioes_pastas" ADD CONSTRAINT "pro_labore_reunioes_pastas_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "pro_labore_usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_reunioes_pastas" ADD CONSTRAINT "pro_labore_reunioes_pastas_departamentoId_fkey" FOREIGN KEY ("departamentoId") REFERENCES "pro_labore_reunioes_departamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_reunioes_departamentos_acessos" ADD CONSTRAINT "pro_labore_reunioes_departamentos_acessos_departamentoId_fkey" FOREIGN KEY ("departamentoId") REFERENCES "pro_labore_reunioes_departamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

