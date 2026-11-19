-- Perfil do cliente (Funil, 19/11): campo opcional, sem mexer nos dados existentes.
ALTER TABLE "pro_labore_leads" ADD COLUMN IF NOT EXISTS "perfilCliente" TEXT;
