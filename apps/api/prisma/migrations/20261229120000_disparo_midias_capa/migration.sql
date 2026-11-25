-- ARIES Disparo: biblioteca com vídeos grandes (upload direto para o armazenamento), capa do vídeo,
-- dimensões, duração e importação do Instagram. Só acrescenta colunas.
ALTER TABLE "pro_labore_disparo_midias"
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'PRONTA',
  ADD COLUMN "largura" INTEGER,
  ADD COLUMN "altura" INTEGER,
  ADD COLUMN "duracaoSeg" DOUBLE PRECISION,
  ADD COLUMN "capaBlobUrl" TEXT,
  ADD COLUMN "capaBlobAcesso" TEXT,
  ADD COLUMN "capaDados" BYTEA,
  ADD COLUMN "capaMime" TEXT,
  ADD COLUMN "origem" TEXT NOT NULL DEFAULT 'UPLOAD',
  ADD COLUMN "origemRef" TEXT,
  ADD COLUMN "origemLink" TEXT,
  ADD COLUMN "legenda" TEXT;
