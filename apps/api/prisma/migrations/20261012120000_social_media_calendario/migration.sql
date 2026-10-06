-- CreateTable
CREATE TABLE "pro_labore_sm_config" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "minDiasSemana" INTEGER NOT NULL DEFAULT 4,
    "maxPostsDia" INTEGER NOT NULL DEFAULT 2,
    "maxDiasSemPost" INTEGER NOT NULL DEFAULT 2,
    "mixMeta" JSONB NOT NULL DEFAULT '{"ESTOQUE":40,"PROVA":20,"EDUCACAO":25,"BASTIDORES":15}',
    "horizonteDias" INTEGER NOT NULL DEFAULT 21,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pro_labore_sm_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_sm_config_usuarioId_key" ON "pro_labore_sm_config"("usuarioId");

-- AddForeignKey
ALTER TABLE "pro_labore_sm_config" ADD CONSTRAINT "pro_labore_sm_config_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "pro_labore_usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

