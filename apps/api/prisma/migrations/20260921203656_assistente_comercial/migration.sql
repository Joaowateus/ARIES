-- CreateTable
CREATE TABLE "pro_labore_assistente_comercial" (
    "id" TEXT NOT NULL,
    "vendedorId" TEXT NOT NULL,
    "numeroWhatsapp" TEXT,
    "nomeExibicao" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NAO_CONECTADO',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_assistente_comercial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_assistente_conversas" (
    "id" TEXT NOT NULL,
    "assistenteId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "nomeContato" TEXT NOT NULL,
    "numeroContato" TEXT NOT NULL,
    "leadId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ATIVA',
    "ultimaMensagemEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pro_labore_assistente_conversas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_assistente_mensagens" (
    "id" TEXT NOT NULL,
    "conversaId" TEXT NOT NULL,
    "remetente" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pro_labore_assistente_mensagens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_assistente_comercial_vendedorId_key" ON "pro_labore_assistente_comercial"("vendedorId");

-- CreateIndex
CREATE INDEX "pro_labore_assistente_conversas_assistenteId_idx" ON "pro_labore_assistente_conversas"("assistenteId");

-- CreateIndex
CREATE INDEX "pro_labore_assistente_conversas_assistenteId_tipo_idx" ON "pro_labore_assistente_conversas"("assistenteId", "tipo");

-- CreateIndex
CREATE INDEX "pro_labore_assistente_mensagens_conversaId_idx" ON "pro_labore_assistente_mensagens"("conversaId");

-- AddForeignKey
ALTER TABLE "pro_labore_assistente_comercial" ADD CONSTRAINT "pro_labore_assistente_comercial_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "pro_labore_vendedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_assistente_conversas" ADD CONSTRAINT "pro_labore_assistente_conversas_assistenteId_fkey" FOREIGN KEY ("assistenteId") REFERENCES "pro_labore_assistente_comercial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_assistente_conversas" ADD CONSTRAINT "pro_labore_assistente_conversas_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "pro_labore_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_assistente_mensagens" ADD CONSTRAINT "pro_labore_assistente_mensagens_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "pro_labore_assistente_conversas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
