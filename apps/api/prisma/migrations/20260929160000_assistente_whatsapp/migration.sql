-- Até aqui o Assistente Comercial só simulava a conexão: todo registro
-- existente de conversa/mensagem é exemplo gerado pela tela (nunca veio de
-- um WhatsApp real). Apaga esses exemplos e volta os assistentes pra "não
-- conectado", pra que só dado real apareça daqui pra frente.
DELETE FROM "pro_labore_assistente_mensagens";
DELETE FROM "pro_labore_assistente_conversas";
UPDATE "pro_labore_assistente_comercial" SET "status" = 'NAO_CONECTADO', "numeroWhatsapp" = NULL;

-- AlterTable
ALTER TABLE "pro_labore_assistente_comercial" ADD COLUMN     "atendimentoAutomatico" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "conectadoEm" TIMESTAMP(3),
ADD COLUMN     "configuracao" JSONB,
ADD COLUMN     "fotoPerfilUrl" TEXT,
ADD COLUMN     "instancia" TEXT,
ADD COLUMN     "ultimoEventoEm" TIMESTAMP(3),
ADD COLUMN     "webhookSegredo" TEXT;

-- AlterTable
ALTER TABLE "pro_labore_assistente_conversas" ADD COLUMN     "aguardandoVendedorEm" TIMESTAMP(3),
ADD COLUMN     "assumidaEm" TIMESTAMP(3),
ADD COLUMN     "encerradaEm" TIMESTAMP(3),
ADD COLUMN     "etapaRoteiro" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "jid" TEXT,
ADD COLUMN     "origem" TEXT,
ADD COLUMN     "respostas" JSONB,
ADD COLUMN     "resultado" TEXT;

-- AlterTable
ALTER TABLE "pro_labore_assistente_mensagens" ADD COLUMN     "providerId" TEXT;

-- CreateTable
CREATE TABLE "pro_labore_assistente_contatos_ignorados" (
    "id" TEXT NOT NULL,
    "assistenteId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pro_labore_assistente_contatos_ignorados_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_assistente_contatos_ignorados_assistenteId_numer_key" ON "pro_labore_assistente_contatos_ignorados"("assistenteId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_assistente_comercial_instancia_key" ON "pro_labore_assistente_comercial"("instancia");

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_assistente_comercial_webhookSegredo_key" ON "pro_labore_assistente_comercial"("webhookSegredo");

-- CreateIndex
CREATE INDEX "pro_labore_assistente_conversas_assistenteId_numeroContato_idx" ON "pro_labore_assistente_conversas"("assistenteId", "numeroContato");

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_assistente_mensagens_providerId_key" ON "pro_labore_assistente_mensagens"("providerId");

-- AddForeignKey
ALTER TABLE "pro_labore_assistente_contatos_ignorados" ADD CONSTRAINT "pro_labore_assistente_contatos_ignorados_assistenteId_fkey" FOREIGN KEY ("assistenteId") REFERENCES "pro_labore_assistente_comercial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

