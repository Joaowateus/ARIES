-- CreateTable
CREATE TABLE "pro_labore_plano_crescimento_acoes" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "pilar" TEXT NOT NULL,
    "chave" TEXT,
    "texto" TEXT NOT NULL,
    "concluida" BOOLEAN NOT NULL DEFAULT false,
    "origem" TEXT NOT NULL DEFAULT 'CUSTOMIZADA',
    "editadoManualmente" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_plano_crescimento_acoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pro_labore_plano_crescimento_acoes_usuarioId_pilar_idx" ON "pro_labore_plano_crescimento_acoes"("usuarioId", "pilar");

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_plano_crescimento_acoes_usuarioId_chave_key" ON "pro_labore_plano_crescimento_acoes"("usuarioId", "chave");

-- AddForeignKey
ALTER TABLE "pro_labore_plano_crescimento_acoes" ADD CONSTRAINT "pro_labore_plano_crescimento_acoes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "pro_labore_usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
