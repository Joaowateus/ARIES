-- Stories: o arquivo (foto/vídeo e capa) é guardado no armazenamento enquanto o story está no ar,
-- para o Disparo poder usar depois que o Instagram apaga (24 h). Só acrescenta colunas.
ALTER TABLE "pro_labore_social_media_midias"
  ADD COLUMN "arquivoBlobUrl" TEXT,
  ADD COLUMN "arquivoMime" TEXT,
  ADD COLUMN "arquivoTamanho" INTEGER,
  ADD COLUMN "capaBlobUrl" TEXT,
  ADD COLUMN "arquivoGuardadoEm" TIMESTAMP(3),
  ADD COLUMN "arquivoErro" TEXT;
