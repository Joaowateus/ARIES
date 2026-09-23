-- CreateTable
CREATE TABLE "pro_labore_plano_crescimento_snapshots" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "mesReferencia" TIMESTAMP(3) NOT NULL,
    "estagioGeral" TEXT NOT NULL,
    "estagioAquisicao" TEXT NOT NULL,
    "estagioConversao" TEXT NOT NULL,
    "estagioExecucao" TEXT NOT NULL,
    "estagioFinanceiro" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_plano_crescimento_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_plano_crescimento_snapshots_usuarioId_mesReferen_key" ON "pro_labore_plano_crescimento_snapshots"("usuarioId", "mesReferencia");

-- AddForeignKey
ALTER TABLE "pro_labore_plano_crescimento_snapshots" ADD CONSTRAINT "pro_labore_plano_crescimento_snapshots_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "pro_labore_usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
