-- CreateTable
CREATE TABLE "pro_labore_agenda_itens" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "categoria" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "data" TIMESTAMP(3),
    "diasSemana" TEXT,
    "dataInicio" TIMESTAMP(3),
    "dataFim" TIMESTAMP(3),
    "vendedorId" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_agenda_itens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_agenda_conclusoes" (
    "id" TEXT NOT NULL,
    "agendaItemId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "dataReferencia" TIMESTAMP(3) NOT NULL,
    "concluidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pro_labore_agenda_conclusoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pro_labore_agenda_itens_usuarioId_idx" ON "pro_labore_agenda_itens"("usuarioId");

-- CreateIndex
CREATE INDEX "pro_labore_agenda_itens_vendedorId_idx" ON "pro_labore_agenda_itens"("vendedorId");

-- CreateIndex
CREATE INDEX "pro_labore_agenda_conclusoes_agendaItemId_idx" ON "pro_labore_agenda_conclusoes"("agendaItemId");

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_agenda_conclusoes_agendaItemId_autorId_dataRefer_key" ON "pro_labore_agenda_conclusoes"("agendaItemId", "autorId", "dataReferencia");

-- AddForeignKey
ALTER TABLE "pro_labore_agenda_itens" ADD CONSTRAINT "pro_labore_agenda_itens_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "pro_labore_usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_agenda_itens" ADD CONSTRAINT "pro_labore_agenda_itens_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "pro_labore_vendedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_agenda_conclusoes" ADD CONSTRAINT "pro_labore_agenda_conclusoes_agendaItemId_fkey" FOREIGN KEY ("agendaItemId") REFERENCES "pro_labore_agenda_itens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
