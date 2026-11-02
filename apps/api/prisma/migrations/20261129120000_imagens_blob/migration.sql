-- Imagens no Vercel Blob: o arquivo sai do banco (que tem limite de 500 MB no plano gratuito).
ALTER TABLE "pro_labore_imagens" ALTER COLUMN "dados" DROP NOT NULL;
ALTER TABLE "pro_labore_imagens" ADD COLUMN "blobUrl" TEXT;
ALTER TABLE "pro_labore_imagens" ADD COLUMN "blobAcesso" TEXT;
