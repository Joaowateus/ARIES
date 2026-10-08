-- CreateTable
CREATE TABLE "pro_labore_sm_concorrentes" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "usuario" TEXT NOT NULL,
    "nome" TEXT,
    "fotoUrl" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3),
    "ultimoErro" TEXT,

    CONSTRAINT "pro_labore_sm_concorrentes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_sm_concorrentes_retratos" (
    "id" TEXT NOT NULL,
    "concorrenteId" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "seguidores" INTEGER NOT NULL,
    "posts" INTEGER NOT NULL,
    "postsSemana" DOUBLE PRECISION,
    "engajamentoMedio" DOUBLE PRECISION,
    "ultimoPostEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pro_labore_sm_concorrentes_retratos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_sm_planejamentos" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "mes" TEXT NOT NULL,
    "pautas" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pro_labore_sm_planejamentos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_sm_concorrentes_usuarioId_usuario_key" ON "pro_labore_sm_concorrentes"("usuarioId", "usuario");

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_sm_concorrentes_retratos_concorrenteId_data_key" ON "pro_labore_sm_concorrentes_retratos"("concorrenteId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_sm_planejamentos_usuarioId_mes_key" ON "pro_labore_sm_planejamentos"("usuarioId", "mes");

-- AddForeignKey
ALTER TABLE "pro_labore_sm_concorrentes" ADD CONSTRAINT "pro_labore_sm_concorrentes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "pro_labore_usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_sm_concorrentes_retratos" ADD CONSTRAINT "pro_labore_sm_concorrentes_retratos_concorrenteId_fkey" FOREIGN KEY ("concorrenteId") REFERENCES "pro_labore_sm_concorrentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_sm_planejamentos" ADD CONSTRAINT "pro_labore_sm_planejamentos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "pro_labore_usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

