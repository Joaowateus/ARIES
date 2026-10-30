-- Referências v2: todos os formatos com miniatura, concorrentes x referências, histórico de seguidores e salvos.
ALTER TABLE "pro_labore_sm_referencia_perfis" ADD COLUMN "posts" INTEGER;
ALTER TABLE "pro_labore_sm_referencia_perfis" ADD COLUMN "tipo" TEXT NOT NULL DEFAULT 'REFERENCIA';
ALTER TABLE "pro_labore_sm_referencia_perfis" ADD COLUMN "historico" JSONB;
ALTER TABLE "pro_labore_sm_referencia_videos" ADD COLUMN "midiaUrl" TEXT;

CREATE TABLE "pro_labore_sm_referencia_salvas" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "fonte" TEXT NOT NULL,
    "autor" TEXT,
    "motoChave" TEXT,
    "permalink" TEXT NOT NULL,
    "legenda" TEXT,
    "curtidas" INTEGER,
    "comentarios" INTEGER,
    "formato" TEXT,
    "midiaUrl" TEXT,
    "publicadoEm" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'IDEIA',
    "nota" TEXT,
    "pautaId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_sm_referencia_salvas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pro_labore_sm_referencia_salvas_usuarioId_mediaId_key" ON "pro_labore_sm_referencia_salvas"("usuarioId", "mediaId");
