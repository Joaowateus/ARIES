-- Ajusta a meta de conversão padrão: MQL passa a ser 70% (era 20%) e SQL
-- passa a ser 20% (era 70%) — atualiza tanto o default (lib/funil.ts, já
-- alterado no código) quanto as linhas já existentes em metas_funil_etapa,
-- que não são reescritas automaticamente pelo default (só preenchidas se
-- ainda não existirem pra aquela empresa).
UPDATE "metas_funil_etapa" SET "metaPct" = 0.70, "atualizadoEm" = now() WHERE "etapa" = 'MQL';
UPDATE "metas_funil_etapa" SET "metaPct" = 0.20, "atualizadoEm" = now() WHERE "etapa" = 'SQL';
