-- Social Media passa a ser por pessoa: além da conta do dono, cada
-- vendedor/supervisor pode conectar o próprio Instagram. A conta que já
-- existe continua sendo do dono.
DROP INDEX "pro_labore_social_media_contas_usuarioId_key";

ALTER TABLE "pro_labore_social_media_contas" ADD COLUMN "titular" TEXT,
ADD COLUMN "vendedorId" TEXT;

UPDATE "pro_labore_social_media_contas" SET "titular" = 'dono:' || "usuarioId";

ALTER TABLE "pro_labore_social_media_contas" ALTER COLUMN "titular" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_social_media_contas_titular_key" ON "pro_labore_social_media_contas"("titular");

-- Um mesmo Instagram não pode ser conectado por duas pessoas.
CREATE UNIQUE INDEX "pro_labore_social_media_contas_instagramUserId_key" ON "pro_labore_social_media_contas"("instagramUserId");

-- CreateIndex
CREATE INDEX "pro_labore_social_media_contas_usuarioId_idx" ON "pro_labore_social_media_contas"("usuarioId");

-- AddForeignKey
ALTER TABLE "pro_labore_social_media_contas" ADD CONSTRAINT "pro_labore_social_media_contas_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "pro_labore_vendedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
