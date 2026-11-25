-- ARIES Disparo sem travas para a equipe (pedido do dono em 25/11/2026): campanha de quem não é da
-- gestão deixa de passar por aprovação. O dono pode ligar de novo em Disparo › Configurações.
UPDATE "pro_labore_disparo_config"
SET "config" = jsonb_set("config"::jsonb, '{exigirAprovacao}', 'false', true)
WHERE jsonb_typeof("config"::jsonb) = 'object';
