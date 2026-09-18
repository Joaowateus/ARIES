-- DataMigration: preenche o valor de negociação dos leads cadastrados antes
-- desse campo existir (todos ficaram com o default 0 na migration anterior)
-- com um valor de referência de R$ 20.000,00, só pra já ter uma dimensão
-- numérica do funil. Cada vendedor pode ajustar o valor real depois, pelo
-- card ou pela edição do lead — não mexe em quem já tem um valor != 0.
UPDATE "pro_labore_leads" SET "valorNegociacao" = 20000 WHERE "valorNegociacao" = 0;
