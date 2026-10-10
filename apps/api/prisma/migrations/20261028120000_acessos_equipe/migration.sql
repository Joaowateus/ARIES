-- AlterTable
ALTER TABLE "pro_labore_vendedores" ADD COLUMN     "permissoes" JSONB,
ADD COLUMN     "vende" BOOLEAN NOT NULL DEFAULT true;

