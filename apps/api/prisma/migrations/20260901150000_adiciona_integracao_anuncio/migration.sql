-- CreateTable
CREATE TABLE "integracoes_anuncio" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "plataforma" TEXT NOT NULL DEFAULT 'META',
    "status" TEXT NOT NULL DEFAULT 'DESCONECTADO',
    "contaAnuncioExternaId" TEXT,
    "contaAnuncioNome" TEXT,
    "accessTokenCifrado" TEXT,
    "tokenExpiraEm" TIMESTAMP(3),
    "ultimaSincronizacaoEm" TIMESTAMP(3),
    "ultimoErro" TEXT,
    "conectadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integracoes_anuncio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "integracoes_anuncio_empresaId_plataforma_key" ON "integracoes_anuncio"("empresaId", "plataforma");

-- AddForeignKey
ALTER TABLE "integracoes_anuncio" ADD CONSTRAINT "integracoes_anuncio_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integracoes_anuncio" ADD CONSTRAINT "integracoes_anuncio_conectadoPorId_fkey" FOREIGN KEY ("conectadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
