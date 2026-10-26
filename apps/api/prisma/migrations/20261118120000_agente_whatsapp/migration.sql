-- CreateTable
CREATE TABLE "pro_labore_agente_whatsapp" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "instancia" TEXT NOT NULL,
    "segredo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DESCONECTADO',
    "numero" TEXT,
    "nome" TEXT NOT NULL DEFAULT 'Aries',
    "perfilEm" TIMESTAMP(3),
    "manhaHora" TEXT NOT NULL DEFAULT '08:00',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_agente_whatsapp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_agente_vinculos" (
    "id" TEXT NOT NULL,
    "agenteId" TEXT NOT NULL,
    "pessoa" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "numero" TEXT,
    "verificadoEm" TIMESTAMP(3),
    "manha" BOOLEAN NOT NULL DEFAULT true,
    "alertas" BOOLEAN NOT NULL DEFAULT true,
    "ultimaManhaEm" TIMESTAMP(3),
    "ultimoAlertaEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_agente_vinculos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_agente_mensagens" (
    "id" TEXT NOT NULL,
    "vinculoId" TEXT NOT NULL,
    "direcao" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "intencao" TEXT,
    "externoId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pro_labore_agente_mensagens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_agente_whatsapp_usuarioId_key" ON "pro_labore_agente_whatsapp"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_agente_whatsapp_instancia_key" ON "pro_labore_agente_whatsapp"("instancia");

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_agente_whatsapp_segredo_key" ON "pro_labore_agente_whatsapp"("segredo");

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_agente_vinculos_agenteId_pessoa_key" ON "pro_labore_agente_vinculos"("agenteId", "pessoa");

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_agente_vinculos_agenteId_codigo_key" ON "pro_labore_agente_vinculos"("agenteId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_agente_vinculos_agenteId_numero_key" ON "pro_labore_agente_vinculos"("agenteId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_agente_mensagens_externoId_key" ON "pro_labore_agente_mensagens"("externoId");

-- CreateIndex
CREATE INDEX "pro_labore_agente_mensagens_vinculoId_criadoEm_idx" ON "pro_labore_agente_mensagens"("vinculoId", "criadoEm");

-- AddForeignKey
ALTER TABLE "pro_labore_agente_vinculos" ADD CONSTRAINT "pro_labore_agente_vinculos_agenteId_fkey" FOREIGN KEY ("agenteId") REFERENCES "pro_labore_agente_whatsapp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_agente_mensagens" ADD CONSTRAINT "pro_labore_agente_mensagens_vinculoId_fkey" FOREIGN KEY ("vinculoId") REFERENCES "pro_labore_agente_vinculos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

