-- CreateTable
CREATE TABLE "pro_labore_social_media_contas" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "instagramUserId" TEXT NOT NULL,
    "nomeUsuario" TEXT NOT NULL,
    "nomeExibicao" TEXT,
    "fotoUrl" TEXT,
    "seguidores" INTEGER NOT NULL DEFAULT 0,
    "seguindo" INTEGER NOT NULL DEFAULT 0,
    "publicacoesTotal" INTEGER NOT NULL DEFAULT 0,
    "accessToken" TEXT NOT NULL,
    "tokenExpiraEm" TIMESTAMP(3) NOT NULL,
    "conectadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_social_media_contas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_social_media_midias" (
    "id" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "instagramMediaId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "legenda" TEXT,
    "urlMidia" TEXT,
    "urlPermalink" TEXT,
    "publicadoEm" TIMESTAMP(3) NOT NULL,
    "curtidas" INTEGER NOT NULL DEFAULT 0,
    "comentarios" INTEGER NOT NULL DEFAULT 0,
    "salvamentos" INTEGER NOT NULL DEFAULT 0,
    "compartilhamentos" INTEGER NOT NULL DEFAULT 0,
    "alcance" INTEGER NOT NULL DEFAULT 0,
    "impressoes" INTEGER NOT NULL DEFAULT 0,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_social_media_midias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_social_media_snapshots" (
    "id" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "seguidores" INTEGER NOT NULL,
    "novosSeguidoresDia" INTEGER NOT NULL DEFAULT 0,
    "alcanceContaDia" INTEGER NOT NULL DEFAULT 0,
    "impressoesContaDia" INTEGER NOT NULL DEFAULT 0,
    "visitasPerfilDia" INTEGER NOT NULL DEFAULT 0,
    "publicacoesNoDia" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pro_labore_social_media_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_social_media_contas_usuarioId_key" ON "pro_labore_social_media_contas"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_social_media_midias_instagramMediaId_key" ON "pro_labore_social_media_midias"("instagramMediaId");

-- CreateIndex
CREATE INDEX "pro_labore_social_media_midias_contaId_publicadoEm_idx" ON "pro_labore_social_media_midias"("contaId", "publicadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_social_media_snapshots_contaId_data_key" ON "pro_labore_social_media_snapshots"("contaId", "data");

-- AddForeignKey
ALTER TABLE "pro_labore_social_media_contas" ADD CONSTRAINT "pro_labore_social_media_contas_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "pro_labore_usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_social_media_midias" ADD CONSTRAINT "pro_labore_social_media_midias_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "pro_labore_social_media_contas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_social_media_snapshots" ADD CONSTRAINT "pro_labore_social_media_snapshots_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "pro_labore_social_media_contas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
