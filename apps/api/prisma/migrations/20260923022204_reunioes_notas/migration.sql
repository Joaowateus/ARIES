-- CreateTable
CREATE TABLE "pro_labore_reunioes" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "vendedorId" TEXT,
    "titulo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'REUNIAO',
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duracaoSegundos" INTEGER,
    "nomeArquivoOriginal" TEXT,
    "transcricao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_reunioes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_notas" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "vendedorId" TEXT,
    "reuniaoId" TEXT,
    "titulo" TEXT,
    "conteudo" TEXT NOT NULL,
    "categoria" TEXT NOT NULL DEFAULT 'TRABALHO',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_notas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pro_labore_reunioes_usuarioId_vendedorId_idx" ON "pro_labore_reunioes"("usuarioId", "vendedorId");

-- CreateIndex
CREATE INDEX "pro_labore_notas_usuarioId_vendedorId_idx" ON "pro_labore_notas"("usuarioId", "vendedorId");

-- CreateIndex
CREATE INDEX "pro_labore_notas_reuniaoId_idx" ON "pro_labore_notas"("reuniaoId");

-- AddForeignKey
ALTER TABLE "pro_labore_reunioes" ADD CONSTRAINT "pro_labore_reunioes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "pro_labore_usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_notas" ADD CONSTRAINT "pro_labore_notas_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "pro_labore_usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_notas" ADD CONSTRAINT "pro_labore_notas_reuniaoId_fkey" FOREIGN KEY ("reuniaoId") REFERENCES "pro_labore_reunioes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
