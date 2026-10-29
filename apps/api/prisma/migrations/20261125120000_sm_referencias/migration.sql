-- CreateTable
CREATE TABLE "pro_labore_sm_referencia_perfis" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "usuario" TEXT NOT NULL,
    "nome" TEXT,
    "fotoUrl" TEXT,
    "seguidores" INTEGER,
    "atualizadoEm" TIMESTAMP(3),
    "ultimoErro" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pro_labore_sm_referencia_perfis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_sm_referencia_motos" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "hashtags" TEXT[],
    "buscadoEm" TIMESTAMP(3),
    "ultimoErro" TEXT,
    "buscadas" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pro_labore_sm_referencia_motos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_sm_referencia_videos" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "fonte" TEXT NOT NULL,
    "motoChave" TEXT,
    "autor" TEXT,
    "permalink" TEXT NOT NULL,
    "legenda" TEXT,
    "curtidas" INTEGER,
    "comentarios" INTEGER,
    "formato" TEXT,
    "publicadoEm" TIMESTAMP(3),
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pro_labore_sm_referencia_videos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_sm_referencia_perfis_usuarioId_usuario_key" ON "pro_labore_sm_referencia_perfis"("usuarioId", "usuario");

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_sm_referencia_motos_usuarioId_chave_key" ON "pro_labore_sm_referencia_motos"("usuarioId", "chave");

-- CreateIndex
CREATE INDEX "pro_labore_sm_referencia_videos_usuarioId_motoChave_idx" ON "pro_labore_sm_referencia_videos"("usuarioId", "motoChave");

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_sm_referencia_videos_usuarioId_mediaId_key" ON "pro_labore_sm_referencia_videos"("usuarioId", "mediaId");

-- AddForeignKey
ALTER TABLE "pro_labore_sm_referencia_perfis" ADD CONSTRAINT "pro_labore_sm_referencia_perfis_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "pro_labore_usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

