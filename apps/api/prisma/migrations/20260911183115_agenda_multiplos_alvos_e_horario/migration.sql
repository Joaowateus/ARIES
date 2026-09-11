-- Adiciona as colunas novas antes de mexer nas antigas, pra poder migrar os
-- dados existentes (vendedorId/atribuidoAoDono) pro novo formato
-- multivalorado (vendedorIds/incluiDono) sem perder nenhuma atribuição já
-- cadastrada.

-- AlterTable: colunas novas
ALTER TABLE "pro_labore_agenda_itens" ADD COLUMN "horario" TEXT;
ALTER TABLE "pro_labore_agenda_itens" ADD COLUMN "incluiDono" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "pro_labore_agenda_itens" ADD COLUMN "vendedorIds" TEXT;

-- Backfill: um vendedorId único vira uma lista de um item só; o flag do
-- dono é copiado direto.
UPDATE "pro_labore_agenda_itens" SET "vendedorIds" = "vendedorId" WHERE "vendedorId" IS NOT NULL;
UPDATE "pro_labore_agenda_itens" SET "incluiDono" = "atribuidoAoDono";

-- DropForeignKey
ALTER TABLE "pro_labore_agenda_itens" DROP CONSTRAINT "pro_labore_agenda_itens_vendedorId_fkey";

-- DropIndex
DROP INDEX "pro_labore_agenda_itens_vendedorId_idx";

-- AlterTable: remove as colunas antigas, já migradas
ALTER TABLE "pro_labore_agenda_itens" DROP COLUMN "atribuidoAoDono";
ALTER TABLE "pro_labore_agenda_itens" DROP COLUMN "vendedorId";
