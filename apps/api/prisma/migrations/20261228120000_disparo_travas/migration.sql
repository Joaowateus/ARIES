-- ARIES Disparo: travas com prazo (substituem pg_advisory_lock, que não funciona no pooler de transação)
-- e o registro da última rodada do motor (para a tela mostrar se o envio automático está rodando).
CREATE TABLE "pro_labore_disparo_travas" (
    "chave" TEXT NOT NULL,
    "ate" TIMESTAMP(3) NOT NULL,
    "dados" JSONB,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "pro_labore_disparo_travas_pkey" PRIMARY KEY ("chave")
);
