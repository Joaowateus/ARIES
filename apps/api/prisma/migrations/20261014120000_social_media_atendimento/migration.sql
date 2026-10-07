-- AlterTable
ALTER TABLE "pro_labore_leads" ADD COLUMN     "canalEntrada" TEXT,
ADD COLUMN     "conversaId" TEXT,
ADD COLUMN     "midiaId" TEXT,
ADD COLUMN     "origem" TEXT,
ADD COLUMN     "postCode" TEXT;

-- AlterTable
ALTER TABLE "pro_labore_sm_config" ADD COLUMN     "expedienteDias" TEXT NOT NULL DEFAULT '1,2,3,4,5',
ADD COLUMN     "expedienteFim" INTEGER NOT NULL DEFAULT 18,
ADD COLUMN     "expedienteInicio" INTEGER NOT NULL DEFAULT 8,
ADD COLUMN     "rodizioUltimoVendedorId" TEXT;

-- CreateTable
CREATE TABLE "pro_labore_sm_conversas" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "canal" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "clienteIgId" TEXT NOT NULL,
    "clienteNome" TEXT,
    "clienteUsuario" TEXT,
    "midiaIgId" TEXT,
    "postCode" TEXT,
    "postTitulo" TEXT,
    "motoInteresse" TEXT,
    "comentarioIgId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ABERTA',
    "ultimaMsgEm" TIMESTAMP(3) NOT NULL,
    "ultimaEntradaEm" TIMESTAMP(3),
    "aguardandoDesde" TIMESTAMP(3),
    "foraHorarioEm" TIMESTAMP(3),
    "leadId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_sm_conversas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_sm_mensagens" (
    "id" TEXT NOT NULL,
    "conversaId" TEXT NOT NULL,
    "direcao" TEXT NOT NULL,
    "autor" TEXT NOT NULL,
    "automacao" TEXT,
    "texto" TEXT NOT NULL,
    "igMensagemId" TEXT,
    "respostaMin" DOUBLE PRECISION,
    "enviadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pro_labore_sm_mensagens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_sm_automacoes" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "palavra" TEXT,
    "resposta" TEXT NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pro_labore_sm_automacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_sm_respostas_rapidas" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "pro_labore_sm_respostas_rapidas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pro_labore_sm_conversas_usuarioId_aguardandoDesde_idx" ON "pro_labore_sm_conversas"("usuarioId", "aguardandoDesde");

-- CreateIndex
CREATE INDEX "pro_labore_sm_conversas_usuarioId_ultimaMsgEm_idx" ON "pro_labore_sm_conversas"("usuarioId", "ultimaMsgEm");

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_sm_conversas_usuarioId_canal_chave_key" ON "pro_labore_sm_conversas"("usuarioId", "canal", "chave");

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_sm_mensagens_igMensagemId_key" ON "pro_labore_sm_mensagens"("igMensagemId");

-- CreateIndex
CREATE INDEX "pro_labore_sm_mensagens_conversaId_enviadaEm_idx" ON "pro_labore_sm_mensagens"("conversaId", "enviadaEm");

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_sm_automacoes_usuarioId_tipo_key" ON "pro_labore_sm_automacoes"("usuarioId", "tipo");

-- CreateIndex
CREATE INDEX "pro_labore_sm_respostas_rapidas_usuarioId_ordem_idx" ON "pro_labore_sm_respostas_rapidas"("usuarioId", "ordem");

-- AddForeignKey
ALTER TABLE "pro_labore_sm_conversas" ADD CONSTRAINT "pro_labore_sm_conversas_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "pro_labore_usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_sm_mensagens" ADD CONSTRAINT "pro_labore_sm_mensagens_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "pro_labore_sm_conversas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_sm_automacoes" ADD CONSTRAINT "pro_labore_sm_automacoes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "pro_labore_usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_sm_respostas_rapidas" ADD CONSTRAINT "pro_labore_sm_respostas_rapidas_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "pro_labore_usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

