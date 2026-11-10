-- Ajuste 1 (Hoje do dono): configuração do Daily, metas por etapa da jornada e ata do Daily em Reuniões. Só acrescenta.
ALTER TABLE "pro_labore_parametros" ADD COLUMN IF NOT EXISTS "dailyConfig" JSONB;
ALTER TABLE "pro_labore_parametros" ADD COLUMN IF NOT EXISTS "metasEtapas" JSONB;
ALTER TABLE "pro_labore_reunioes" ADD COLUMN IF NOT EXISTS "ata" JSONB;
ALTER TABLE "pro_labore_reunioes" ADD COLUMN IF NOT EXISTS "modo" TEXT;
ALTER TABLE "pro_labore_reunioes" ADD COLUMN IF NOT EXISTS "autorId" TEXT;
