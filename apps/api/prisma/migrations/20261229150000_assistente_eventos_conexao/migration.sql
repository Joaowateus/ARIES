-- WhatsApp: últimos eventos de conexão (estado e motivo da queda) e o motivo da última queda.
ALTER TABLE "pro_labore_assistente_comercial" ADD COLUMN IF NOT EXISTS "eventosConexao" JSONB, ADD COLUMN IF NOT EXISTS "motivoQueda" TEXT;
