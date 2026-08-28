-- Importa o histórico real de vendas da Rafaela (jun-jul/2026), extraído do
-- relatório de balanceamento comercial (BALANCEAMENTO.pdf) — mesmo padrão
-- usado pro Wanderson, Ellen, Naiza, Edricia e Demilly: só alimenta a
-- produção do vendedor (Meu Painel: quantidade, faturamento, balanceamento
-- mês a mês), não cria EstagioHistorico, porque a fonte não tem a jornada
-- do lead (só mês do fechamento). Sem nome de cliente na fonte: usa um
-- rótulo claro de venda histórica em vez de inventar uma pessoa.
--
-- É condicional (CTE "v" busca o usuário pelo e-mail real da Rafaela) e
-- vira no-op silencioso em qualquer banco onde essa conta não existir — só
-- popula de fato em produção.

WITH v AS (
  SELECT id AS usuario_id, "empresaId" AS empresa_id FROM usuarios WHERE email = 'consultorarafaelammnegocios@gmail.com' LIMIT 1
), nova_oportunidade AS (
  INSERT INTO oportunidades (id, "empresaId", "responsavelId", "nomeCliente", estagio, origem, valor, "statusFinal", "fechadaEm", "criadaEm", "atualizadaEm", observacoes)
  SELECT md5(random()::text || clock_timestamp()::text || '2026-06-15-op'), v.empresa_id, v.usuario_id, 'Venda histórica — XRE 190 2025', 'COMPRADO', 'SDR', 32660.00, 'COMPRADO', '2026-06-15'::timestamp, '2026-06-15'::timestamp, now(), 'Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: XRE 190 2025 · Banco: BV'
  FROM v
  WHERE NOT EXISTS (SELECT 1 FROM oportunidades WHERE "nomeCliente" = 'Venda histórica — XRE 190 2025' AND "criadaEm" = '2026-06-15'::timestamp)
  RETURNING id
)
INSERT INTO contratos (id, "empresaId", "oportunidadeId", "vendedorId", "nomeCliente", "valorTotal", status, "processoAdministrativoStatus", "criadoEm", "atualizadoEm", observacoes)
SELECT md5(random()::text || clock_timestamp()::text || '2026-06-15-ct'), v.empresa_id, no.id, v.usuario_id, 'Venda histórica — XRE 190 2025', 32660.00, 'ATIVO', 'CONCLUIDO', '2026-06-15'::timestamp, now(), 'Importado do relatório de balanceamento comercial. Modelo: XRE 190 2025 · Banco: BV'
FROM nova_oportunidade no, v;

WITH v AS (
  SELECT id AS usuario_id, "empresaId" AS empresa_id FROM usuarios WHERE email = 'consultorarafaelammnegocios@gmail.com' LIMIT 1
), nova_oportunidade AS (
  INSERT INTO oportunidades (id, "empresaId", "responsavelId", "nomeCliente", estagio, origem, valor, "statusFinal", "fechadaEm", "criadaEm", "atualizadaEm", observacoes)
  SELECT md5(random()::text || clock_timestamp()::text || '2026-07-10-op'), v.empresa_id, v.usuario_id, 'Venda histórica — TITAN 150 EX 2014', 'COMPRADO', 'SDR', 9700.00, 'COMPRADO', '2026-07-10'::timestamp, '2026-07-10'::timestamp, now(), 'Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: TITAN 150 EX 2014 · Banco: A VISTA'
  FROM v
  WHERE NOT EXISTS (SELECT 1 FROM oportunidades WHERE "nomeCliente" = 'Venda histórica — TITAN 150 EX 2014' AND "criadaEm" = '2026-07-10'::timestamp)
  RETURNING id
)
INSERT INTO contratos (id, "empresaId", "oportunidadeId", "vendedorId", "nomeCliente", "valorTotal", status, "processoAdministrativoStatus", "criadoEm", "atualizadoEm", observacoes)
SELECT md5(random()::text || clock_timestamp()::text || '2026-07-10-ct'), v.empresa_id, no.id, v.usuario_id, 'Venda histórica — TITAN 150 EX 2014', 9700.00, 'ATIVO', 'CONCLUIDO', '2026-07-10'::timestamp, now(), 'Importado do relatório de balanceamento comercial. Modelo: TITAN 150 EX 2014 · Banco: A VISTA'
FROM nova_oportunidade no, v;
