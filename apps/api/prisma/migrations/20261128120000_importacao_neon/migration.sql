-- Importação do histórico do banco antigo (Neon).
CREATE TABLE "pro_labore_importacoes_neon" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "relatorio" JSONB,
    "estado" JSONB NOT NULL,
    "simuladoEm" TIMESTAMP(3),
    "iniciadoEm" TIMESTAMP(3),
    "concluidoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pro_labore_importacoes_neon_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pro_labore_importacoes_neon_usuarioId_key" ON "pro_labore_importacoes_neon"("usuarioId");
