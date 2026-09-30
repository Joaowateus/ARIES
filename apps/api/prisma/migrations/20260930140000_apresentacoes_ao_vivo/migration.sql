-- Apresentações ao vivo da aba Reuniões (mapa mental transmitido pra equipe).
-- CreateTable
CREATE TABLE "pro_labore_apresentacoes" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "icone" TEXT,
    "arvore" JSONB NOT NULL,
    "configuracao" JSONB,
    "notas" JSONB,
    "notasPrivadas" TEXT,
    "lembretes" JSONB,
    "visivelEquipe" BOOLEAN NOT NULL DEFAULT true,
    "versao" INTEGER NOT NULL DEFAULT 0,
    "palco" JSONB,
    "palcoVersao" INTEGER NOT NULL DEFAULT 0,
    "aoVivo" BOOLEAN NOT NULL DEFAULT false,
    "aoVivoDesde" TIMESTAMP(3),
    "apresentadorSinalEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_apresentacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_apresentacoes_espectadores" (
    "id" TEXT NOT NULL,
    "apresentacaoId" TEXT NOT NULL,
    "pessoa" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "entrouEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimoSinalEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pro_labore_apresentacoes_espectadores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pro_labore_apresentacoes_usuarioId_idx" ON "pro_labore_apresentacoes"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_apresentacoes_espectadores_apresentacaoId_pessoa_key" ON "pro_labore_apresentacoes_espectadores"("apresentacaoId", "pessoa");

-- AddForeignKey
ALTER TABLE "pro_labore_apresentacoes" ADD CONSTRAINT "pro_labore_apresentacoes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "pro_labore_usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_apresentacoes_espectadores" ADD CONSTRAINT "pro_labore_apresentacoes_espectadores_apresentacaoId_fkey" FOREIGN KEY ("apresentacaoId") REFERENCES "pro_labore_apresentacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

