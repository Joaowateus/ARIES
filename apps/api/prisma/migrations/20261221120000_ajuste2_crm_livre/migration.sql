-- Ajuste 2 (CRM): avanço livre com pendência registrada e temperatura ajustável. Só acrescenta.
ALTER TABLE "pro_labore_leads" ADD COLUMN IF NOT EXISTS "pendenciasEtapa" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "pro_labore_leads" ADD COLUMN IF NOT EXISTS "temperaturaManual" TEXT;
