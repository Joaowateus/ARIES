-- CreateTable
CREATE TABLE "pro_labore_preferencias" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "pessoa" TEXT NOT NULL,
    "dados" JSONB NOT NULL,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_preferencias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_preferencias_usuarioId_pessoa_key" ON "pro_labore_preferencias"("usuarioId", "pessoa");

