-- AlterTable
ALTER TABLE "pro_labore_parametros" ADD COLUMN     "tetoComissaoPadrao" DOUBLE PRECISION NOT NULL DEFAULT 900;

-- AlterTable
ALTER TABLE "pro_labore_vendas" ADD COLUMN     "valorComissao" DOUBLE PRECISION;

-- AlterTable
-- Renomeia em vez de dropar+recriar: preserva qualquer comissão individual
-- já configurada em produção (a coluna se chamava tetoProLaborePorVenda
-- antes de "pró-labore" e "comissão" virarem conceitos separados).
ALTER TABLE "pro_labore_vendedores" RENAME COLUMN "tetoProLaborePorVenda" TO "tetoComissaoPorVenda";
