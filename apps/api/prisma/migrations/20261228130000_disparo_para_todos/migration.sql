-- ARIES Disparo liberado para todo o time (pedido do dono em 24/11/2026).
-- Quem já tem permissões salvas e estava sem o módulo passa a ter "EDITAR"; quem tem outro nível
-- escolhido (VER) fica como está. Sem permissões salvas, vale o novo padrão do código.
-- O dono ajusta depois em Configurações › Acessos. Nada é apagado.
UPDATE "pro_labore_vendedores"
SET "permissoes" = jsonb_set("permissoes"::jsonb, '{disparo}', '"EDITAR"', true)
WHERE "permissoes" IS NOT NULL
  AND jsonb_typeof("permissoes"::jsonb) = 'object'
  AND COALESCE("permissoes"::jsonb ->> 'disparo', 'NENHUM') = 'NENHUM';
