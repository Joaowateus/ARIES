-- AlterTable
ALTER TABLE "pro_labore_vendas" ADD COLUMN "placa" TEXT;

-- Placa que já estava escrita na observação (antiga ABC1234 ou Mercosul ABC1D23).
UPDATE "pro_labore_vendas" SET "placa" = m[1] || m[2]
FROM (SELECT id, regexp_match(upper(coalesce(observacao, '')), '(?:^|[^A-Z0-9])([A-Z]{3})[- ]?([0-9][A-Z0-9][0-9]{2})(?![A-Z0-9])') AS m FROM "pro_labore_vendas") x
WHERE x.id = "pro_labore_vendas".id AND x.m IS NOT NULL;

-- CreateIndex
CREATE INDEX "pro_labore_vendas_usuarioId_placa_idx" ON "pro_labore_vendas"("usuarioId", "placa");

-- CreateTable
CREATE TABLE "pro_labore_fechamentos_mes_vendas" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "mes" TEXT NOT NULL,
    "fechadoEm" TIMESTAMP(3),
    "historico" JSONB NOT NULL DEFAULT '[]',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pro_labore_fechamentos_mes_vendas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_fechamentos_mes_vendas_usuarioId_mes_key" ON "pro_labore_fechamentos_mes_vendas"("usuarioId", "mes");
