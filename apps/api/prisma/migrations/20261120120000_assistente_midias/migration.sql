-- CreateTable
CREATE TABLE "pro_labore_assistente_midias" (
    "id" TEXT NOT NULL,
    "mensagemId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "mime" TEXT,
    "duracaoSeg" INTEGER,
    "tamanho" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "blobUrl" TEXT,
    "blobAcesso" TEXT,
    "dados" BYTEA,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_assistente_midias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_assistente_midias_mensagemId_key" ON "pro_labore_assistente_midias"("mensagemId");

-- CreateIndex
CREATE INDEX "pro_labore_assistente_midias_status_criadoEm_idx" ON "pro_labore_assistente_midias"("status", "criadoEm");

-- AddForeignKey
ALTER TABLE "pro_labore_assistente_midias" ADD CONSTRAINT "pro_labore_assistente_midias_mensagemId_fkey" FOREIGN KEY ("mensagemId") REFERENCES "pro_labore_assistente_mensagens"("id") ON DELETE CASCADE ON UPDATE CASCADE;
