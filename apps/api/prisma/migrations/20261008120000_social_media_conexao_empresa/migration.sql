-- AlterTable
ALTER TABLE "pro_labore_social_media_contas" ADD COLUMN     "falhasSeguidas" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "paginaId" TEXT,
ADD COLUMN     "paginaNome" TEXT,
ADD COLUMN     "proximaTentativaEm" TIMESTAMP(3),
ADD COLUMN     "tipoConexao" TEXT NOT NULL DEFAULT 'PESSOAL';

-- CreateTable
CREATE TABLE "pro_labore_sm_sincronizacoes" (
    "id" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "job" TEXT NOT NULL,
    "iniciadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "terminadoEm" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'RODANDO',
    "erro" TEXT,
    "resumo" JSONB,

    CONSTRAINT "pro_labore_sm_sincronizacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_sm_webhook_eventos" (
    "id" TEXT NOT NULL,
    "contaId" TEXT,
    "objeto" TEXT NOT NULL,
    "campo" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "recebidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processadoEm" TIMESTAMP(3),

    CONSTRAINT "pro_labore_sm_webhook_eventos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_sm_notificacoes" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "destinatario" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "payload" JSONB,
    "ocorrencias" INTEGER NOT NULL DEFAULT 1,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lidaEm" TIMESTAMP(3),
    "enviadaEm" TIMESTAMP(3),

    CONSTRAINT "pro_labore_sm_notificacoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pro_labore_sm_sincronizacoes_contaId_iniciadoEm_idx" ON "pro_labore_sm_sincronizacoes"("contaId", "iniciadoEm");

-- CreateIndex
CREATE INDEX "pro_labore_sm_webhook_eventos_processadoEm_recebidoEm_idx" ON "pro_labore_sm_webhook_eventos"("processadoEm", "recebidoEm");

-- CreateIndex
CREATE INDEX "pro_labore_sm_webhook_eventos_contaId_campo_idx" ON "pro_labore_sm_webhook_eventos"("contaId", "campo");

-- CreateIndex
CREATE INDEX "pro_labore_sm_notificacoes_usuarioId_destinatario_lidaEm_idx" ON "pro_labore_sm_notificacoes"("usuarioId", "destinatario", "lidaEm");

-- CreateIndex
CREATE INDEX "pro_labore_sm_notificacoes_chave_idx" ON "pro_labore_sm_notificacoes"("chave");

-- AddForeignKey
ALTER TABLE "pro_labore_sm_sincronizacoes" ADD CONSTRAINT "pro_labore_sm_sincronizacoes_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "pro_labore_social_media_contas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_sm_webhook_eventos" ADD CONSTRAINT "pro_labore_sm_webhook_eventos_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "pro_labore_social_media_contas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_sm_notificacoes" ADD CONSTRAINT "pro_labore_sm_notificacoes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "pro_labore_usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

