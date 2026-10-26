-- AlterTable
ALTER TABLE "pro_labore_assistente_comercial" ADD COLUMN     "varreduraEm" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "pro_labore_assistente_conversas" ADD COLUMN     "etiquetasEm" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "pro_labore_assistente_fora_crm" (
    "id" TEXT NOT NULL,
    "assistenteId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "jid" TEXT NOT NULL,
    "nome" TEXT,
    "semTelefone" BOOLEAN NOT NULL DEFAULT false,
    "mensagens" INTEGER NOT NULL DEFAULT 1,
    "ultimaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pro_labore_assistente_fora_crm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pro_labore_assistente_fora_crm_assistenteId_ultimaEm_idx" ON "pro_labore_assistente_fora_crm"("assistenteId", "ultimaEm");

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_assistente_fora_crm_assistenteId_numero_key" ON "pro_labore_assistente_fora_crm"("assistenteId", "numero");

-- AddForeignKey
ALTER TABLE "pro_labore_assistente_fora_crm" ADD CONSTRAINT "pro_labore_assistente_fora_crm_assistenteId_fkey" FOREIGN KEY ("assistenteId") REFERENCES "pro_labore_assistente_comercial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

