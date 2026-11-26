-- ARIES Disparo: limite de 2.000 mensagens por dia por número (pedido do dono em 26/11/2026).
-- Antes o padrão era 400 por dia; o número somava as campanhas e parava no "Limite do dia".
-- Vale para a configuração da loja (padrão das campanhas novas) e para as campanhas ainda não
-- encerradas que estavam abaixo de 2.000. Cada campanha ajustada ganha um registro no histórico.
-- Nada é apagado; o teto do servidor continua 3.000 por dia e o limite por hora não muda.

UPDATE "pro_labore_disparo_config"
SET "config" = jsonb_set("config"::jsonb, '{envio,maxPorDia}', '2000', true)
WHERE jsonb_typeof("config"::jsonb -> 'envio') = 'object'
  AND (jsonb_typeof("config"::jsonb -> 'envio' -> 'maxPorDia') IS DISTINCT FROM 'number'
       OR ("config"::jsonb -> 'envio' ->> 'maxPorDia')::numeric < 2000);

INSERT INTO "pro_labore_disparo_eventos" ("id", "usuarioId", "campanhaId", "tipo", "descricao", "autorNome", "criadoEm")
SELECT md5(random()::text || clock_timestamp()::text || c."id"), c."usuarioId", c."id", 'CONFIG_AJUSTADA',
       'Limite por dia do número: de ' || (c."config"::jsonb ->> 'maxPorDia') || ' para 2000 (ajuste da loja: 2.000 por dia por número).',
       'ARIES', now()
FROM "pro_labore_disparo_campanhas" c
WHERE c."status" IN ('DRAFT', 'VALIDATING', 'NEEDS_REVIEW', 'READY', 'SCHEDULED', 'QUEUED', 'RUNNING', 'PAUSED')
  AND jsonb_typeof(c."config"::jsonb -> 'maxPorDia') = 'number'
  AND (c."config"::jsonb ->> 'maxPorDia')::numeric < 2000;

UPDATE "pro_labore_disparo_campanhas" c
SET "config" = jsonb_set(c."config"::jsonb, '{maxPorDia}', '2000', true)
WHERE c."status" IN ('DRAFT', 'VALIDATING', 'NEEDS_REVIEW', 'READY', 'SCHEDULED', 'QUEUED', 'RUNNING', 'PAUSED')
  AND jsonb_typeof(c."config"::jsonb -> 'maxPorDia') = 'number'
  AND (c."config"::jsonb ->> 'maxPorDia')::numeric < 2000;
