-- CreateTable
CREATE TABLE "pro_labore_meta_saude" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "bloqueadoDesde" TIMESTAMP(3),
    "bloqueioOrigem" TEXT,
    "bloqueioMensagem" TEXT,
    "verificadoEm" TIMESTAMP(3),
    "liberadoEm" TIMESTAMP(3),
    "lembreteEm" TIMESTAMP(3),

    CONSTRAINT "pro_labore_meta_saude_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_meta_saude_usuarioId_key" ON "pro_labore_meta_saude"("usuarioId");

-- AddForeignKey
ALTER TABLE "pro_labore_meta_saude" ADD CONSTRAINT "pro_labore_meta_saude_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "pro_labore_usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

