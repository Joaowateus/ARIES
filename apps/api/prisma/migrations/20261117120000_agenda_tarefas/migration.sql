-- CreateTable
CREATE TABLE "pro_labore_agenda_tarefas" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "dia" TIMESTAMP(3) NOT NULL,
    "horario" TEXT,
    "leadId" TEXT,
    "feitaEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_agenda_tarefas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pro_labore_agenda_tarefas_usuarioId_autorId_dia_idx" ON "pro_labore_agenda_tarefas"("usuarioId", "autorId", "dia");

