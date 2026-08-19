-- Remapeia os estágios do funil antigo (7 etapas) para o novo funil de 8
-- etapas do CRM individual. Sem isso, linhas já existentes em produção
-- ficariam com valores de estágio que a aplicação não reconhece mais.
--
-- Mapeamento:
--   CONTATO          -> NAO_RESPONDEU
--   VISITA_AGENDADA  -> RESPONDEU
--   PROPOSTA         -> SQL
--   NEGOCIACAO       -> MQL
--   GANHO            -> COMPRADO
-- (NOVO_LEAD e PERDIDO não mudam de nome.)

UPDATE "oportunidades" SET "estagio" = 'NAO_RESPONDEU' WHERE "estagio" = 'CONTATO';
UPDATE "oportunidades" SET "estagio" = 'RESPONDEU' WHERE "estagio" = 'VISITA_AGENDADA';
UPDATE "oportunidades" SET "estagio" = 'SQL' WHERE "estagio" = 'PROPOSTA';
UPDATE "oportunidades" SET "estagio" = 'MQL' WHERE "estagio" = 'NEGOCIACAO';
UPDATE "oportunidades" SET "estagio" = 'COMPRADO', "statusFinal" = 'COMPRADO' WHERE "estagio" = 'GANHO';
UPDATE "oportunidades" SET "statusFinal" = 'COMPRADO' WHERE "statusFinal" = 'GANHO';

UPDATE "estagio_historico" SET "estagioNovo" = 'NAO_RESPONDEU' WHERE "estagioNovo" = 'CONTATO';
UPDATE "estagio_historico" SET "estagioNovo" = 'RESPONDEU' WHERE "estagioNovo" = 'VISITA_AGENDADA';
UPDATE "estagio_historico" SET "estagioNovo" = 'SQL' WHERE "estagioNovo" = 'PROPOSTA';
UPDATE "estagio_historico" SET "estagioNovo" = 'MQL' WHERE "estagioNovo" = 'NEGOCIACAO';
UPDATE "estagio_historico" SET "estagioNovo" = 'COMPRADO' WHERE "estagioNovo" = 'GANHO';

UPDATE "estagio_historico" SET "estagioAnterior" = 'NAO_RESPONDEU' WHERE "estagioAnterior" = 'CONTATO';
UPDATE "estagio_historico" SET "estagioAnterior" = 'RESPONDEU' WHERE "estagioAnterior" = 'VISITA_AGENDADA';
UPDATE "estagio_historico" SET "estagioAnterior" = 'SQL' WHERE "estagioAnterior" = 'PROPOSTA';
UPDATE "estagio_historico" SET "estagioAnterior" = 'MQL' WHERE "estagioAnterior" = 'NEGOCIACAO';
UPDATE "estagio_historico" SET "estagioAnterior" = 'COMPRADO' WHERE "estagioAnterior" = 'GANHO';
