-- CreateIndex
CREATE INDEX "contas_receber_empresaId_idx" ON "contas_receber"("empresaId");

-- CreateIndex
CREATE INDEX "contas_receber_empresaId_status_idx" ON "contas_receber"("empresaId", "status");

-- CreateIndex
CREATE INDEX "contas_receber_contratoId_idx" ON "contas_receber"("contratoId");

-- CreateIndex
CREATE INDEX "contas_receber_vencimento_status_idx" ON "contas_receber"("vencimento", "status");

-- CreateIndex
CREATE INDEX "contratos_empresaId_idx" ON "contratos"("empresaId");

-- CreateIndex
CREATE INDEX "contratos_empresaId_status_idx" ON "contratos"("empresaId", "status");

-- CreateIndex
CREATE INDEX "oportunidades_empresaId_idx" ON "oportunidades"("empresaId");

-- CreateIndex
CREATE INDEX "oportunidades_empresaId_estagio_idx" ON "oportunidades"("empresaId", "estagio");

-- CreateIndex
CREATE INDEX "oportunidades_empresaId_responsavelId_idx" ON "oportunidades"("empresaId", "responsavelId");

-- CreateIndex
CREATE INDEX "unidades_empresaId_idx" ON "unidades"("empresaId");

-- CreateIndex
CREATE INDEX "unidades_empresaId_situacao_idx" ON "unidades"("empresaId", "situacao");

-- CreateIndex
CREATE INDEX "usuarios_empresaId_idx" ON "usuarios"("empresaId");

-- CreateIndex
CREATE INDEX "usuarios_empresaId_status_idx" ON "usuarios"("empresaId", "status");
