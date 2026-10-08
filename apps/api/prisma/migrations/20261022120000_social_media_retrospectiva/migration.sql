-- CreateTable
CREATE TABLE "pro_labore_sm_retrospectivas" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "semana" TEXT NOT NULL,
    "ate" TEXT NOT NULL,
    "dados" JSONB NOT NULL,
    "titulo" TEXT NOT NULL,
    "tituloIA" BOOLEAN NOT NULL DEFAULT false,
    "geradaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadaEm" TIMESTAMP(3) NOT NULL,
    "enviadaGestorEm" TIMESTAMP(3),
    "relatorioEm" TIMESTAMP(3),

    CONSTRAINT "pro_labore_sm_retrospectivas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_sm_retrospectivas_usuarioId_semana_key" ON "pro_labore_sm_retrospectivas"("usuarioId", "semana");

-- AddForeignKey
ALTER TABLE "pro_labore_sm_retrospectivas" ADD CONSTRAINT "pro_labore_sm_retrospectivas_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "pro_labore_usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

