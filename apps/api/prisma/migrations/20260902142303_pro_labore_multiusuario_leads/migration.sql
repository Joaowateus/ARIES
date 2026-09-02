-- AlterTable
ALTER TABLE "pro_labore_vendedores" ADD COLUMN     "email" TEXT,
ADD COLUMN     "senhaHash" TEXT;

-- CreateTable
CREATE TABLE "pro_labore_leads" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "vendedorId" TEXT,
    "nomeCliente" TEXT NOT NULL,
    "telefone" TEXT,
    "observacao" TEXT,
    "estagio" TEXT NOT NULL DEFAULT 'LEAD',
    "vendaId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "fechadoEm" TIMESTAMP(3),

    CONSTRAINT "pro_labore_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_lead_estagio_historico" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "estagioAnterior" TEXT,
    "estagioNovo" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pro_labore_lead_estagio_historico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_leads_vendaId_key" ON "pro_labore_leads"("vendaId");

-- CreateIndex
CREATE INDEX "pro_labore_leads_usuarioId_idx" ON "pro_labore_leads"("usuarioId");

-- CreateIndex
CREATE INDEX "pro_labore_leads_usuarioId_estagio_idx" ON "pro_labore_leads"("usuarioId", "estagio");

-- CreateIndex
CREATE INDEX "pro_labore_leads_vendedorId_idx" ON "pro_labore_leads"("vendedorId");

-- CreateIndex
CREATE INDEX "pro_labore_lead_estagio_historico_leadId_idx" ON "pro_labore_lead_estagio_historico"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_vendedores_email_key" ON "pro_labore_vendedores"("email");

-- AddForeignKey
ALTER TABLE "pro_labore_leads" ADD CONSTRAINT "pro_labore_leads_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "pro_labore_usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_leads" ADD CONSTRAINT "pro_labore_leads_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "pro_labore_vendedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_leads" ADD CONSTRAINT "pro_labore_leads_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "pro_labore_vendas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_lead_estagio_historico" ADD CONSTRAINT "pro_labore_lead_estagio_historico_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "pro_labore_leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

