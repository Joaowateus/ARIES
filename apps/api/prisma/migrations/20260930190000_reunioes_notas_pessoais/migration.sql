-- CreateTable
CREATE TABLE "pro_labore_apresentacoes_notas_pessoais" (
    "id" TEXT NOT NULL,
    "apresentacaoId" TEXT NOT NULL,
    "pessoa" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_apresentacoes_notas_pessoais_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_apresentacoes_notas_pessoais_apresentacaoId_pess_key" ON "pro_labore_apresentacoes_notas_pessoais"("apresentacaoId", "pessoa");

-- AddForeignKey
ALTER TABLE "pro_labore_apresentacoes_notas_pessoais" ADD CONSTRAINT "pro_labore_apresentacoes_notas_pessoais_apresentacaoId_fkey" FOREIGN KEY ("apresentacaoId") REFERENCES "pro_labore_apresentacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

