-- Pré-venda do robô (Ajuste 3): levantamento estruturado no lead, pausa e retomada do robô por conversa,
-- e o follow pelo robô escolhido pelo vendedor (cadência por conversa + biblioteca de cadências da loja). Só acrescenta.
ALTER TABLE "pro_labore_leads" ADD COLUMN IF NOT EXISTS "levantamento" JSONB;
ALTER TABLE "pro_labore_assistente_conversas" ADD COLUMN IF NOT EXISTS "pausadoEm" TIMESTAMP(3);
ALTER TABLE "pro_labore_assistente_conversas" ADD COLUMN IF NOT EXISTS "retomadas" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "pro_labore_assistente_conversas" ADD COLUMN IF NOT EXISTS "retomadaEm" TIMESTAMP(3);
ALTER TABLE "pro_labore_assistente_conversas" ADD COLUMN IF NOT EXISTS "prontoEm" TIMESTAMP(3);
ALTER TABLE "pro_labore_assistente_conversas" ADD COLUMN IF NOT EXISTS "cadencia" JSONB;
ALTER TABLE "pro_labore_assistente_loja" ADD COLUMN IF NOT EXISTS "cadencias" JSONB;
