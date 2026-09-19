-- AlterTable
ALTER TABLE "pro_labore_parametros" ADD COLUMN     "motivosOcorrenciaCsv" TEXT NOT NULL DEFAULT 'Atraso recorrente,Não cumprimento de meta,Não preenchimento do CRM,Postura com cliente,Quebra de processo comercial,Falta não justificada,Não cumprimento de protocolo';

-- CreateTable
CREATE TABLE "pro_labore_ocorrencias" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "protocolo" TEXT NOT NULL,
    "vendedorId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "gravidade" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "anexosCsv" TEXT,
    "dataOcorrencia" TIMESTAMP(3) NOT NULL,
    "dataRegistro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "registradoPor" TEXT NOT NULL,
    "planoDeCorrecao" TEXT,
    "prazoCorrecao" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ABERTA',
    "medidaAplicada" TEXT NOT NULL DEFAULT 'NENHUMA',
    "ocorrenciaAnteriorId" TEXT,
    "documentoGeradoUrl" TEXT,
    "documentoGeradoEm" TIMESTAMP(3),
    "assinaturaVendedorOk" BOOLEAN NOT NULL DEFAULT false,
    "assinaturaVendedorData" TIMESTAMP(3),
    "assinaturaGestorOk" BOOLEAN NOT NULL DEFAULT false,
    "assinaturaGestorData" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_ocorrencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_ocorrencia_historico" (
    "id" TEXT NOT NULL,
    "ocorrenciaId" TEXT NOT NULL,
    "autor" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "statusAnterior" TEXT,
    "statusNovo" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pro_labore_ocorrencia_historico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_ocorrencias_protocolo_key" ON "pro_labore_ocorrencias"("protocolo");

-- CreateIndex
CREATE INDEX "pro_labore_ocorrencias_usuarioId_idx" ON "pro_labore_ocorrencias"("usuarioId");

-- CreateIndex
CREATE INDEX "pro_labore_ocorrencias_usuarioId_status_idx" ON "pro_labore_ocorrencias"("usuarioId", "status");

-- CreateIndex
CREATE INDEX "pro_labore_ocorrencias_vendedorId_idx" ON "pro_labore_ocorrencias"("vendedorId");

-- CreateIndex
CREATE INDEX "pro_labore_ocorrencia_historico_ocorrenciaId_idx" ON "pro_labore_ocorrencia_historico"("ocorrenciaId");

-- AddForeignKey
ALTER TABLE "pro_labore_ocorrencias" ADD CONSTRAINT "pro_labore_ocorrencias_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "pro_labore_usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_ocorrencias" ADD CONSTRAINT "pro_labore_ocorrencias_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "pro_labore_vendedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_ocorrencias" ADD CONSTRAINT "pro_labore_ocorrencias_ocorrenciaAnteriorId_fkey" FOREIGN KEY ("ocorrenciaAnteriorId") REFERENCES "pro_labore_ocorrencias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_ocorrencia_historico" ADD CONSTRAINT "pro_labore_ocorrencia_historico_ocorrenciaId_fkey" FOREIGN KEY ("ocorrenciaId") REFERENCES "pro_labore_ocorrencias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
