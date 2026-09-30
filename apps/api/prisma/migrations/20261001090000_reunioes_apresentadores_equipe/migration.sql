-- AlterTable
ALTER TABLE "pro_labore_apresentacoes" ADD COLUMN     "aprovacao" TEXT NOT NULL DEFAULT 'APROVADA',
ADD COLUMN     "aprovacaoMotivo" TEXT,
ADD COLUMN     "autorNome" TEXT,
ADD COLUMN     "autorPessoa" TEXT,
ADD COLUMN     "pedidoEm" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "pro_labore_reunioes_permissoes" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "pessoa" TEXT NOT NULL,
    "modo" TEXT NOT NULL,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_reunioes_permissoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_reunioes_permissoes_usuarioId_pessoa_key" ON "pro_labore_reunioes_permissoes"("usuarioId", "pessoa");

-- CreateIndex
CREATE INDEX "pro_labore_apresentacoes_usuarioId_aprovacao_idx" ON "pro_labore_apresentacoes"("usuarioId", "aprovacao");

