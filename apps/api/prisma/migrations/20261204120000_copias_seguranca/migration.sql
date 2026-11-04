-- CreateTable
CREATE TABLE "pro_labore_copias_seguranca" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'EXPORTACAO',
    "status" TEXT NOT NULL DEFAULT 'EM_ANDAMENTO',
    "autor" TEXT,
    "estado" JSONB NOT NULL,
    "manifesto" JSONB,
    "erro" TEXT,
    "iniciadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluidoEm" TIMESTAMP(3),

    CONSTRAINT "pro_labore_copias_seguranca_pkey" PRIMARY KEY ("id")
);
