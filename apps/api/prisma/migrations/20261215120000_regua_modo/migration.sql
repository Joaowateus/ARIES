-- PDF 02 · régua de cobrança: modo por conta. REGISTRO (semana em paralelo,
-- só anota) ou ENVIO (manda pelo WhatsApp), ligado pelo dono.
ALTER TABLE "pro_labore_parametros" ADD COLUMN "reguaModo" TEXT NOT NULL DEFAULT 'REGISTRO';
