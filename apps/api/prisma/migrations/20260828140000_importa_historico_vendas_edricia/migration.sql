-- Importa o histórico real de vendas da Edricia (jun-jul/2026), extraído do
-- relatório de balanceamento comercial (BALANCEAMENTO.pdf) — mesmo padrão
-- usado pro Wanderson, pra Ellen e pra Naiza: só alimenta a produção do
-- vendedor (Meu Painel: quantidade, faturamento, balanceamento mês a mês),
-- não cria EstagioHistorico, porque a fonte não tem a jornada do lead (só
-- mês do fechamento). Sem nome de cliente na fonte: usa um rótulo claro de
-- venda histórica em vez de inventar uma pessoa.
--
-- É condicional (CTE "v" busca o usuário pelo e-mail real da Edricia) e
-- vira no-op silencioso em qualquer banco onde essa conta não existir — só
-- popula de fato em produção.

WITH v AS (
  SELECT id AS usuario_id, "empresaId" AS empresa_id FROM usuarios WHERE email = 'consultoraedriciammnegocios@gmail.com' LIMIT 1
), nova_oportunidade AS (
  INSERT INTO oportunidades (id, "empresaId", "responsavelId", "nomeCliente", estagio, origem, valor, "statusFinal", "fechadaEm", "criadaEm", "atualizadaEm", observacoes)
  SELECT md5(random()::text || clock_timestamp()::text || '2026-06-10-op'), v.empresa_id, v.usuario_id, 'Venda histórica — BIZ 2017 CINZA', 'COMPRADO', 'SDR', 14900.00, 'COMPRADO', '2026-06-10'::timestamp, '2026-06-10'::timestamp, now(), 'Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: BIZ 2017 CINZA · Banco: PAN'
  FROM v
  WHERE NOT EXISTS (SELECT 1 FROM oportunidades WHERE "nomeCliente" = 'Venda histórica — BIZ 2017 CINZA' AND "criadaEm" = '2026-06-10'::timestamp)
  RETURNING id
)
INSERT INTO contratos (id, "empresaId", "oportunidadeId", "vendedorId", "nomeCliente", "valorTotal", status, "processoAdministrativoStatus", "criadoEm", "atualizadoEm", observacoes)
SELECT md5(random()::text || clock_timestamp()::text || '2026-06-10-ct'), v.empresa_id, no.id, v.usuario_id, 'Venda histórica — BIZ 2017 CINZA', 14900.00, 'ATIVO', 'CONCLUIDO', '2026-06-10'::timestamp, now(), 'Importado do relatório de balanceamento comercial. Modelo: BIZ 2017 CINZA · Banco: PAN'
FROM nova_oportunidade no, v;

WITH v AS (
  SELECT id AS usuario_id, "empresaId" AS empresa_id FROM usuarios WHERE email = 'consultoraedriciammnegocios@gmail.com' LIMIT 1
), nova_oportunidade AS (
  INSERT INTO oportunidades (id, "empresaId", "responsavelId", "nomeCliente", estagio, origem, valor, "statusFinal", "fechadaEm", "criadaEm", "atualizadaEm", observacoes)
  SELECT md5(random()::text || clock_timestamp()::text || '2026-06-20-op'), v.empresa_id, v.usuario_id, 'Venda histórica — SH 2017 AZUL', 'COMPRADO', 'SDR', 15000.00, 'COMPRADO', '2026-06-20'::timestamp, '2026-06-20'::timestamp, now(), 'Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: SH 2017 AZUL · Banco: A VISTA'
  FROM v
  WHERE NOT EXISTS (SELECT 1 FROM oportunidades WHERE "nomeCliente" = 'Venda histórica — SH 2017 AZUL' AND "criadaEm" = '2026-06-20'::timestamp)
  RETURNING id
)
INSERT INTO contratos (id, "empresaId", "oportunidadeId", "vendedorId", "nomeCliente", "valorTotal", status, "processoAdministrativoStatus", "criadoEm", "atualizadoEm", observacoes)
SELECT md5(random()::text || clock_timestamp()::text || '2026-06-20-ct'), v.empresa_id, no.id, v.usuario_id, 'Venda histórica — SH 2017 AZUL', 15000.00, 'ATIVO', 'CONCLUIDO', '2026-06-20'::timestamp, now(), 'Importado do relatório de balanceamento comercial. Modelo: SH 2017 AZUL · Banco: A VISTA'
FROM nova_oportunidade no, v;

WITH v AS (
  SELECT id AS usuario_id, "empresaId" AS empresa_id FROM usuarios WHERE email = 'consultoraedriciammnegocios@gmail.com' LIMIT 1
), nova_oportunidade AS (
  INSERT INTO oportunidades (id, "empresaId", "responsavelId", "nomeCliente", estagio, origem, valor, "statusFinal", "fechadaEm", "criadaEm", "atualizadaEm", observacoes)
  SELECT md5(random()::text || clock_timestamp()::text || '2026-07-15-op'), v.empresa_id, v.usuario_id, 'Venda histórica — FZ 15 VERMELHA', 'COMPRADO', 'SDR', 20900.00, 'COMPRADO', '2026-07-15'::timestamp, '2026-07-15'::timestamp, now(), 'Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: FZ 15 VERMELHA · Banco: PAN'
  FROM v
  WHERE NOT EXISTS (SELECT 1 FROM oportunidades WHERE "nomeCliente" = 'Venda histórica — FZ 15 VERMELHA' AND "criadaEm" = '2026-07-15'::timestamp)
  RETURNING id
)
INSERT INTO contratos (id, "empresaId", "oportunidadeId", "vendedorId", "nomeCliente", "valorTotal", status, "processoAdministrativoStatus", "criadoEm", "atualizadoEm", observacoes)
SELECT md5(random()::text || clock_timestamp()::text || '2026-07-15-ct'), v.empresa_id, no.id, v.usuario_id, 'Venda histórica — FZ 15 VERMELHA', 20900.00, 'ATIVO', 'CONCLUIDO', '2026-07-15'::timestamp, now(), 'Importado do relatório de balanceamento comercial. Modelo: FZ 15 VERMELHA · Banco: PAN'
FROM nova_oportunidade no, v;
