-- CreateTable
CREATE TABLE "pro_labore_sm_ia_textos" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pro_labore_sm_ia_textos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_sm_ia_usos" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "dia" TEXT NOT NULL,
    "chamadas" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "pro_labore_sm_ia_usos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_sm_ia_textos_usuarioId_tipo_chave_key" ON "pro_labore_sm_ia_textos"("usuarioId", "tipo", "chave");

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_sm_ia_usos_usuarioId_dia_key" ON "pro_labore_sm_ia_usos"("usuarioId", "dia");

-- AddForeignKey
ALTER TABLE "pro_labore_sm_ia_textos" ADD CONSTRAINT "pro_labore_sm_ia_textos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "pro_labore_usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_sm_ia_usos" ADD CONSTRAINT "pro_labore_sm_ia_usos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "pro_labore_usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

