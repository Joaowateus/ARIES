-- CreateTable
CREATE TABLE "pro_labore_agenda_inicios" (
    "id" TEXT NOT NULL,
    "agendaItemId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "dataReferencia" TIMESTAMP(3) NOT NULL,
    "iniciadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pro_labore_agenda_inicios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pro_labore_agenda_inicios_agendaItemId_idx" ON "pro_labore_agenda_inicios"("agendaItemId");

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_agenda_inicios_agendaItemId_autorId_dataReferenc_key" ON "pro_labore_agenda_inicios"("agendaItemId", "autorId", "dataReferencia");

-- AddForeignKey
ALTER TABLE "pro_labore_agenda_inicios" ADD CONSTRAINT "pro_labore_agenda_inicios_agendaItemId_fkey" FOREIGN KEY ("agendaItemId") REFERENCES "pro_labore_agenda_itens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
