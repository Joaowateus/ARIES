-- CreateTable
CREATE TABLE "pro_labore_imagens" (
    "id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "dados" BYTEA NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pro_labore_imagens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_imagens_chave_key" ON "pro_labore_imagens"("chave");

-- CreateIndex
CREATE INDEX "pro_labore_imagens_usuarioId_idx" ON "pro_labore_imagens"("usuarioId");

