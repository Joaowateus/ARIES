-- AlterTable
ALTER TABLE "pro_labore_social_media_midias" ADD COLUMN     "alcance1h" INTEGER;

-- CreateTable
CREATE TABLE "pro_labore_sm_push_inscricoes" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "ator" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "navegador" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimoUsoEm" TIMESTAMP(3),

    CONSTRAINT "pro_labore_sm_push_inscricoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_sm_pulsos" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "ator" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "href" TEXT,
    "urgente" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviadoEm" TIMESTAMP(3),
    "lidoEm" TIMESTAMP(3),

    CONSTRAINT "pro_labore_sm_pulsos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_sm_push_inscricoes_endpoint_key" ON "pro_labore_sm_push_inscricoes"("endpoint");

-- CreateIndex
CREATE INDEX "pro_labore_sm_push_inscricoes_usuarioId_ator_idx" ON "pro_labore_sm_push_inscricoes"("usuarioId", "ator");

-- CreateIndex
CREATE INDEX "pro_labore_sm_pulsos_usuarioId_ator_criadoEm_idx" ON "pro_labore_sm_pulsos"("usuarioId", "ator", "criadoEm");

-- CreateIndex
CREATE INDEX "pro_labore_sm_pulsos_enviadoEm_idx" ON "pro_labore_sm_pulsos"("enviadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_sm_pulsos_usuarioId_ator_chave_key" ON "pro_labore_sm_pulsos"("usuarioId", "ator", "chave");

-- AddForeignKey
ALTER TABLE "pro_labore_sm_push_inscricoes" ADD CONSTRAINT "pro_labore_sm_push_inscricoes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "pro_labore_usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_sm_pulsos" ADD CONSTRAINT "pro_labore_sm_pulsos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "pro_labore_usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

