-- Importa o histórico real de vendas da Ellen (fev-ago/2026), extraído do
-- relatório de balanceamento comercial (BALANCEAMENTO.pdf) — mesmo padrão
-- usado pro Wanderson (20260821180000_importa_historico_vendas_wanderson):
-- só alimenta a produção do vendedor (Meu Painel: quantidade, faturamento,
-- balanceamento mês a mês), não cria EstagioHistorico, porque a fonte não
-- tem a jornada do lead (só mês do fechamento). Sem nome de cliente na
-- fonte: usa um rótulo claro de venda histórica em vez de inventar uma
-- pessoa.
--
-- É condicional (CTE "v" busca o usuário pelo e-mail real da Ellen) e vira
-- no-op silencioso em qualquer banco onde essa conta não existir — só
-- popula de fato em produção.

WITH v AS (
  SELECT id AS usuario_id, "empresaId" AS empresa_id FROM usuarios WHERE email = 'consultoraellenmmnegocios@gmail.com' LIMIT 1
), nova_oportunidade AS (
  INSERT INTO oportunidades (id, "empresaId", "responsavelId", "nomeCliente", estagio, origem, valor, "statusFinal", "fechadaEm", "criadaEm", "atualizadaEm", observacoes)
  SELECT md5(random()::text || clock_timestamp()::text || '2026-02-10-op'), v.empresa_id, v.usuario_id, 'Venda histórica — TITAN 160', 'COMPRADO', 'PATIO', 25900.00, 'COMPRADO', '2026-02-10'::timestamp, '2026-02-10'::timestamp, now(), 'Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: TITAN 160 · Banco: PAN'
  FROM v
  WHERE NOT EXISTS (SELECT 1 FROM oportunidades WHERE "nomeCliente" = 'Venda histórica — TITAN 160' AND "criadaEm" = '2026-02-10'::timestamp)
  RETURNING id
)
INSERT INTO contratos (id, "empresaId", "oportunidadeId", "vendedorId", "nomeCliente", "valorTotal", status, "processoAdministrativoStatus", "criadoEm", "atualizadoEm", observacoes)
SELECT md5(random()::text || clock_timestamp()::text || '2026-02-10-ct'), v.empresa_id, no.id, v.usuario_id, 'Venda histórica — TITAN 160', 25900.00, 'ATIVO', 'CONCLUIDO', '2026-02-10'::timestamp, now(), 'Importado do relatório de balanceamento comercial. Modelo: TITAN 160 · Banco: PAN'
FROM nova_oportunidade no, v;

WITH v AS (
  SELECT id AS usuario_id, "empresaId" AS empresa_id FROM usuarios WHERE email = 'consultoraellenmmnegocios@gmail.com' LIMIT 1
), nova_oportunidade AS (
  INSERT INTO oportunidades (id, "empresaId", "responsavelId", "nomeCliente", estagio, origem, valor, "statusFinal", "fechadaEm", "criadaEm", "atualizadaEm", observacoes)
  SELECT md5(random()::text || clock_timestamp()::text || '2026-02-24-op'), v.empresa_id, v.usuario_id, 'Venda histórica — CB 250 TW', 'COMPRADO', 'PATIO', 21900.00, 'COMPRADO', '2026-02-24'::timestamp, '2026-02-24'::timestamp, now(), 'Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: CB 250 TW · Banco: PAN'
  FROM v
  WHERE NOT EXISTS (SELECT 1 FROM oportunidades WHERE "nomeCliente" = 'Venda histórica — CB 250 TW' AND "criadaEm" = '2026-02-24'::timestamp)
  RETURNING id
)
INSERT INTO contratos (id, "empresaId", "oportunidadeId", "vendedorId", "nomeCliente", "valorTotal", status, "processoAdministrativoStatus", "criadoEm", "atualizadoEm", observacoes)
SELECT md5(random()::text || clock_timestamp()::text || '2026-02-24-ct'), v.empresa_id, no.id, v.usuario_id, 'Venda histórica — CB 250 TW', 21900.00, 'ATIVO', 'CONCLUIDO', '2026-02-24'::timestamp, now(), 'Importado do relatório de balanceamento comercial. Modelo: CB 250 TW · Banco: PAN'
FROM nova_oportunidade no, v;

WITH v AS (
  SELECT id AS usuario_id, "empresaId" AS empresa_id FROM usuarios WHERE email = 'consultoraellenmmnegocios@gmail.com' LIMIT 1
), nova_oportunidade AS (
  INSERT INTO oportunidades (id, "empresaId", "responsavelId", "nomeCliente", estagio, origem, valor, "statusFinal", "fechadaEm", "criadaEm", "atualizadaEm", observacoes)
  SELECT md5(random()::text || clock_timestamp()::text || '2026-04-08-op'), v.empresa_id, v.usuario_id, 'Venda histórica — XRE ADV', 'COMPRADO', 'PATIO', 34900.00, 'COMPRADO', '2026-04-08'::timestamp, '2026-04-08'::timestamp, now(), 'Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: XRE ADV · Banco: SANTANDER'
  FROM v
  WHERE NOT EXISTS (SELECT 1 FROM oportunidades WHERE "nomeCliente" = 'Venda histórica — XRE ADV' AND "criadaEm" = '2026-04-08'::timestamp)
  RETURNING id
)
INSERT INTO contratos (id, "empresaId", "oportunidadeId", "vendedorId", "nomeCliente", "valorTotal", status, "processoAdministrativoStatus", "criadoEm", "atualizadoEm", observacoes)
SELECT md5(random()::text || clock_timestamp()::text || '2026-04-08-ct'), v.empresa_id, no.id, v.usuario_id, 'Venda histórica — XRE ADV', 34900.00, 'ATIVO', 'CONCLUIDO', '2026-04-08'::timestamp, now(), 'Importado do relatório de balanceamento comercial. Modelo: XRE ADV · Banco: SANTANDER'
FROM nova_oportunidade no, v;

WITH v AS (
  SELECT id AS usuario_id, "empresaId" AS empresa_id FROM usuarios WHERE email = 'consultoraellenmmnegocios@gmail.com' LIMIT 1
), nova_oportunidade AS (
  INSERT INTO oportunidades (id, "empresaId", "responsavelId", "nomeCliente", estagio, origem, valor, "statusFinal", "fechadaEm", "criadaEm", "atualizadaEm", observacoes)
  SELECT md5(random()::text || clock_timestamp()::text || '2026-04-22-op'), v.empresa_id, v.usuario_id, 'Venda histórica — BROS 160 2024 BRANCA', 'COMPRADO', 'PATIO', 24900.00, 'COMPRADO', '2026-04-22'::timestamp, '2026-04-22'::timestamp, now(), 'Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: BROS 160 2024 BRANCA · Banco: SANTANDER'
  FROM v
  WHERE NOT EXISTS (SELECT 1 FROM oportunidades WHERE "nomeCliente" = 'Venda histórica — BROS 160 2024 BRANCA' AND "criadaEm" = '2026-04-22'::timestamp)
  RETURNING id
)
INSERT INTO contratos (id, "empresaId", "oportunidadeId", "vendedorId", "nomeCliente", "valorTotal", status, "processoAdministrativoStatus", "criadoEm", "atualizadoEm", observacoes)
SELECT md5(random()::text || clock_timestamp()::text || '2026-04-22-ct'), v.empresa_id, no.id, v.usuario_id, 'Venda histórica — BROS 160 2024 BRANCA', 24900.00, 'ATIVO', 'CONCLUIDO', '2026-04-22'::timestamp, now(), 'Importado do relatório de balanceamento comercial. Modelo: BROS 160 2024 BRANCA · Banco: SANTANDER'
FROM nova_oportunidade no, v;

WITH v AS (
  SELECT id AS usuario_id, "empresaId" AS empresa_id FROM usuarios WHERE email = 'consultoraellenmmnegocios@gmail.com' LIMIT 1
), nova_oportunidade AS (
  INSERT INTO oportunidades (id, "empresaId", "responsavelId", "nomeCliente", estagio, origem, valor, "statusFinal", "fechadaEm", "criadaEm", "atualizadaEm", observacoes)
  SELECT md5(random()::text || clock_timestamp()::text || '2026-05-06-op'), v.empresa_id, v.usuario_id, 'Venda histórica — TITAN 160 2023', 'COMPRADO', 'PATIO', 23500.00, 'COMPRADO', '2026-05-06'::timestamp, '2026-05-06'::timestamp, now(), 'Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: TITAN 160 2023 · Banco: PAN'
  FROM v
  WHERE NOT EXISTS (SELECT 1 FROM oportunidades WHERE "nomeCliente" = 'Venda histórica — TITAN 160 2023' AND "criadaEm" = '2026-05-06'::timestamp)
  RETURNING id
)
INSERT INTO contratos (id, "empresaId", "oportunidadeId", "vendedorId", "nomeCliente", "valorTotal", status, "processoAdministrativoStatus", "criadoEm", "atualizadoEm", observacoes)
SELECT md5(random()::text || clock_timestamp()::text || '2026-05-06-ct'), v.empresa_id, no.id, v.usuario_id, 'Venda histórica — TITAN 160 2023', 23500.00, 'ATIVO', 'CONCLUIDO', '2026-05-06'::timestamp, now(), 'Importado do relatório de balanceamento comercial. Modelo: TITAN 160 2023 · Banco: PAN'
FROM nova_oportunidade no, v;

WITH v AS (
  SELECT id AS usuario_id, "empresaId" AS empresa_id FROM usuarios WHERE email = 'consultoraellenmmnegocios@gmail.com' LIMIT 1
), nova_oportunidade AS (
  INSERT INTO oportunidades (id, "empresaId", "responsavelId", "nomeCliente", estagio, origem, valor, "statusFinal", "fechadaEm", "criadaEm", "atualizadaEm", observacoes)
  SELECT md5(random()::text || clock_timestamp()::text || '2026-05-16-op'), v.empresa_id, v.usuario_id, 'Venda histórica — BROS VERMELHA', 'COMPRADO', 'PATIO', 25900.00, 'COMPRADO', '2026-05-16'::timestamp, '2026-05-16'::timestamp, now(), 'Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: BROS VERMELHA · Banco: BV'
  FROM v
  WHERE NOT EXISTS (SELECT 1 FROM oportunidades WHERE "nomeCliente" = 'Venda histórica — BROS VERMELHA' AND "criadaEm" = '2026-05-16'::timestamp)
  RETURNING id
)
INSERT INTO contratos (id, "empresaId", "oportunidadeId", "vendedorId", "nomeCliente", "valorTotal", status, "processoAdministrativoStatus", "criadoEm", "atualizadoEm", observacoes)
SELECT md5(random()::text || clock_timestamp()::text || '2026-05-16-ct'), v.empresa_id, no.id, v.usuario_id, 'Venda histórica — BROS VERMELHA', 25900.00, 'ATIVO', 'CONCLUIDO', '2026-05-16'::timestamp, now(), 'Importado do relatório de balanceamento comercial. Modelo: BROS VERMELHA · Banco: BV'
FROM nova_oportunidade no, v;

WITH v AS (
  SELECT id AS usuario_id, "empresaId" AS empresa_id FROM usuarios WHERE email = 'consultoraellenmmnegocios@gmail.com' LIMIT 1
), nova_oportunidade AS (
  INSERT INTO oportunidades (id, "empresaId", "responsavelId", "nomeCliente", estagio, origem, valor, "statusFinal", "fechadaEm", "criadaEm", "atualizadaEm", observacoes)
  SELECT md5(random()::text || clock_timestamp()::text || '2026-05-27-op'), v.empresa_id, v.usuario_id, 'Venda histórica — POP 110 PRETA', 'COMPRADO', 'PATIO', 15000.00, 'COMPRADO', '2026-05-27'::timestamp, '2026-05-27'::timestamp, now(), 'Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: POP 110 PRETA · Banco: A VISTA'
  FROM v
  WHERE NOT EXISTS (SELECT 1 FROM oportunidades WHERE "nomeCliente" = 'Venda histórica — POP 110 PRETA' AND "criadaEm" = '2026-05-27'::timestamp)
  RETURNING id
)
INSERT INTO contratos (id, "empresaId", "oportunidadeId", "vendedorId", "nomeCliente", "valorTotal", status, "processoAdministrativoStatus", "criadoEm", "atualizadoEm", observacoes)
SELECT md5(random()::text || clock_timestamp()::text || '2026-05-27-ct'), v.empresa_id, no.id, v.usuario_id, 'Venda histórica — POP 110 PRETA', 15000.00, 'ATIVO', 'CONCLUIDO', '2026-05-27'::timestamp, now(), 'Importado do relatório de balanceamento comercial. Modelo: POP 110 PRETA · Banco: A VISTA'
FROM nova_oportunidade no, v;

WITH v AS (
  SELECT id AS usuario_id, "empresaId" AS empresa_id FROM usuarios WHERE email = 'consultoraellenmmnegocios@gmail.com' LIMIT 1
), nova_oportunidade AS (
  INSERT INTO oportunidades (id, "empresaId", "responsavelId", "nomeCliente", estagio, origem, valor, "statusFinal", "fechadaEm", "criadaEm", "atualizadaEm", observacoes)
  SELECT md5(random()::text || clock_timestamp()::text || '2026-06-03-op'), v.empresa_id, v.usuario_id, 'Venda histórica — NEO VERMELHA 2025', 'COMPRADO', 'SDR', 15000.00, 'COMPRADO', '2026-06-03'::timestamp, '2026-06-03'::timestamp, now(), 'Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: NEO VERMELHA 2025 · Banco: PAN'
  FROM v
  WHERE NOT EXISTS (SELECT 1 FROM oportunidades WHERE "nomeCliente" = 'Venda histórica — NEO VERMELHA 2025' AND "criadaEm" = '2026-06-03'::timestamp)
  RETURNING id
)
INSERT INTO contratos (id, "empresaId", "oportunidadeId", "vendedorId", "nomeCliente", "valorTotal", status, "processoAdministrativoStatus", "criadoEm", "atualizadoEm", observacoes)
SELECT md5(random()::text || clock_timestamp()::text || '2026-06-03-ct'), v.empresa_id, no.id, v.usuario_id, 'Venda histórica — NEO VERMELHA 2025', 15000.00, 'ATIVO', 'CONCLUIDO', '2026-06-03'::timestamp, now(), 'Importado do relatório de balanceamento comercial. Modelo: NEO VERMELHA 2025 · Banco: PAN'
FROM nova_oportunidade no, v;

WITH v AS (
  SELECT id AS usuario_id, "empresaId" AS empresa_id FROM usuarios WHERE email = 'consultoraellenmmnegocios@gmail.com' LIMIT 1
), nova_oportunidade AS (
  INSERT INTO oportunidades (id, "empresaId", "responsavelId", "nomeCliente", estagio, origem, valor, "statusFinal", "fechadaEm", "criadaEm", "atualizadaEm", observacoes)
  SELECT md5(random()::text || clock_timestamp()::text || '2026-06-07-op'), v.empresa_id, v.usuario_id, 'Venda histórica — FAN 2019', 'COMPRADO', 'SDR', 18000.00, 'COMPRADO', '2026-06-07'::timestamp, '2026-06-07'::timestamp, now(), 'Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: FAN 2019 · Banco: CONSULTAR'
  FROM v
  WHERE NOT EXISTS (SELECT 1 FROM oportunidades WHERE "nomeCliente" = 'Venda histórica — FAN 2019' AND "criadaEm" = '2026-06-07'::timestamp)
  RETURNING id
)
INSERT INTO contratos (id, "empresaId", "oportunidadeId", "vendedorId", "nomeCliente", "valorTotal", status, "processoAdministrativoStatus", "criadoEm", "atualizadoEm", observacoes)
SELECT md5(random()::text || clock_timestamp()::text || '2026-06-07-ct'), v.empresa_id, no.id, v.usuario_id, 'Venda histórica — FAN 2019', 18000.00, 'ATIVO', 'CONCLUIDO', '2026-06-07'::timestamp, now(), 'Importado do relatório de balanceamento comercial. Modelo: FAN 2019 · Banco: CONSULTAR'
FROM nova_oportunidade no, v;

WITH v AS (
  SELECT id AS usuario_id, "empresaId" AS empresa_id FROM usuarios WHERE email = 'consultoraellenmmnegocios@gmail.com' LIMIT 1
), nova_oportunidade AS (
  INSERT INTO oportunidades (id, "empresaId", "responsavelId", "nomeCliente", estagio, origem, valor, "statusFinal", "fechadaEm", "criadaEm", "atualizadaEm", observacoes)
  SELECT md5(random()::text || clock_timestamp()::text || '2026-06-11-op'), v.empresa_id, v.usuario_id, 'Venda histórica — FAN 2021', 'COMPRADO', 'SDR', 19000.00, 'COMPRADO', '2026-06-11'::timestamp, '2026-06-11'::timestamp, now(), 'Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: FAN 2021 · Banco: PAN'
  FROM v
  WHERE NOT EXISTS (SELECT 1 FROM oportunidades WHERE "nomeCliente" = 'Venda histórica — FAN 2021' AND "criadaEm" = '2026-06-11'::timestamp)
  RETURNING id
)
INSERT INTO contratos (id, "empresaId", "oportunidadeId", "vendedorId", "nomeCliente", "valorTotal", status, "processoAdministrativoStatus", "criadoEm", "atualizadoEm", observacoes)
SELECT md5(random()::text || clock_timestamp()::text || '2026-06-11-ct'), v.empresa_id, no.id, v.usuario_id, 'Venda histórica — FAN 2021', 19000.00, 'ATIVO', 'CONCLUIDO', '2026-06-11'::timestamp, now(), 'Importado do relatório de balanceamento comercial. Modelo: FAN 2021 · Banco: PAN'
FROM nova_oportunidade no, v;

WITH v AS (
  SELECT id AS usuario_id, "empresaId" AS empresa_id FROM usuarios WHERE email = 'consultoraellenmmnegocios@gmail.com' LIMIT 1
), nova_oportunidade AS (
  INSERT INTO oportunidades (id, "empresaId", "responsavelId", "nomeCliente", estagio, origem, valor, "statusFinal", "fechadaEm", "criadaEm", "atualizadaEm", observacoes)
  SELECT md5(random()::text || clock_timestamp()::text || '2026-06-15-op'), v.empresa_id, v.usuario_id, 'Venda histórica — FAN 160 2023', 'COMPRADO', 'SDR', 15600.00, 'COMPRADO', '2026-06-15'::timestamp, '2026-06-15'::timestamp, now(), 'Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: FAN 160 2023 · Banco: PAN'
  FROM v
  WHERE NOT EXISTS (SELECT 1 FROM oportunidades WHERE "nomeCliente" = 'Venda histórica — FAN 160 2023' AND "criadaEm" = '2026-06-15'::timestamp)
  RETURNING id
)
INSERT INTO contratos (id, "empresaId", "oportunidadeId", "vendedorId", "nomeCliente", "valorTotal", status, "processoAdministrativoStatus", "criadoEm", "atualizadoEm", observacoes)
SELECT md5(random()::text || clock_timestamp()::text || '2026-06-15-ct'), v.empresa_id, no.id, v.usuario_id, 'Venda histórica — FAN 160 2023', 15600.00, 'ATIVO', 'CONCLUIDO', '2026-06-15'::timestamp, now(), 'Importado do relatório de balanceamento comercial. Modelo: FAN 160 2023 · Banco: PAN'
FROM nova_oportunidade no, v;

WITH v AS (
  SELECT id AS usuario_id, "empresaId" AS empresa_id FROM usuarios WHERE email = 'consultoraellenmmnegocios@gmail.com' LIMIT 1
), nova_oportunidade AS (
  INSERT INTO oportunidades (id, "empresaId", "responsavelId", "nomeCliente", estagio, origem, valor, "statusFinal", "fechadaEm", "criadaEm", "atualizadaEm", observacoes)
  SELECT md5(random()::text || clock_timestamp()::text || '2026-06-19-op'), v.empresa_id, v.usuario_id, 'Venda histórica — FACTOR 150', 'COMPRADO', 'SDR', 9000.00, 'COMPRADO', '2026-06-19'::timestamp, '2026-06-19'::timestamp, now(), 'Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: FACTOR 150 · Banco: A VISTA'
  FROM v
  WHERE NOT EXISTS (SELECT 1 FROM oportunidades WHERE "nomeCliente" = 'Venda histórica — FACTOR 150' AND "criadaEm" = '2026-06-19'::timestamp)
  RETURNING id
)
INSERT INTO contratos (id, "empresaId", "oportunidadeId", "vendedorId", "nomeCliente", "valorTotal", status, "processoAdministrativoStatus", "criadoEm", "atualizadoEm", observacoes)
SELECT md5(random()::text || clock_timestamp()::text || '2026-06-19-ct'), v.empresa_id, no.id, v.usuario_id, 'Venda histórica — FACTOR 150', 9000.00, 'ATIVO', 'CONCLUIDO', '2026-06-19'::timestamp, now(), 'Importado do relatório de balanceamento comercial. Modelo: FACTOR 150 · Banco: A VISTA'
FROM nova_oportunidade no, v;

WITH v AS (
  SELECT id AS usuario_id, "empresaId" AS empresa_id FROM usuarios WHERE email = 'consultoraellenmmnegocios@gmail.com' LIMIT 1
), nova_oportunidade AS (
  INSERT INTO oportunidades (id, "empresaId", "responsavelId", "nomeCliente", estagio, origem, valor, "statusFinal", "fechadaEm", "criadaEm", "atualizadaEm", observacoes)
  SELECT md5(random()::text || clock_timestamp()::text || '2026-06-23-op'), v.empresa_id, v.usuario_id, 'Venda histórica — FAZER 150', 'COMPRADO', 'SDR', 10000.00, 'COMPRADO', '2026-06-23'::timestamp, '2026-06-23'::timestamp, now(), 'Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: FAZER 150 · Banco: PAN'
  FROM v
  WHERE NOT EXISTS (SELECT 1 FROM oportunidades WHERE "nomeCliente" = 'Venda histórica — FAZER 150' AND "criadaEm" = '2026-06-23'::timestamp)
  RETURNING id
)
INSERT INTO contratos (id, "empresaId", "oportunidadeId", "vendedorId", "nomeCliente", "valorTotal", status, "processoAdministrativoStatus", "criadoEm", "atualizadoEm", observacoes)
SELECT md5(random()::text || clock_timestamp()::text || '2026-06-23-ct'), v.empresa_id, no.id, v.usuario_id, 'Venda histórica — FAZER 150', 10000.00, 'ATIVO', 'CONCLUIDO', '2026-06-23'::timestamp, now(), 'Importado do relatório de balanceamento comercial. Modelo: FAZER 150 · Banco: PAN'
FROM nova_oportunidade no, v;

WITH v AS (
  SELECT id AS usuario_id, "empresaId" AS empresa_id FROM usuarios WHERE email = 'consultoraellenmmnegocios@gmail.com' LIMIT 1
), nova_oportunidade AS (
  INSERT INTO oportunidades (id, "empresaId", "responsavelId", "nomeCliente", estagio, origem, valor, "statusFinal", "fechadaEm", "criadaEm", "atualizadaEm", observacoes)
  SELECT md5(random()::text || clock_timestamp()::text || '2026-06-27-op'), v.empresa_id, v.usuario_id, 'Venda histórica — BROS 160 2015', 'COMPRADO', 'SDR', 15500.00, 'COMPRADO', '2026-06-27'::timestamp, '2026-06-27'::timestamp, now(), 'Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: BROS 160 2015 · Banco: A VISTA'
  FROM v
  WHERE NOT EXISTS (SELECT 1 FROM oportunidades WHERE "nomeCliente" = 'Venda histórica — BROS 160 2015' AND "criadaEm" = '2026-06-27'::timestamp)
  RETURNING id
)
INSERT INTO contratos (id, "empresaId", "oportunidadeId", "vendedorId", "nomeCliente", "valorTotal", status, "processoAdministrativoStatus", "criadoEm", "atualizadoEm", observacoes)
SELECT md5(random()::text || clock_timestamp()::text || '2026-06-27-ct'), v.empresa_id, no.id, v.usuario_id, 'Venda histórica — BROS 160 2015', 15500.00, 'ATIVO', 'CONCLUIDO', '2026-06-27'::timestamp, now(), 'Importado do relatório de balanceamento comercial. Modelo: BROS 160 2015 · Banco: A VISTA'
FROM nova_oportunidade no, v;

WITH v AS (
  SELECT id AS usuario_id, "empresaId" AS empresa_id FROM usuarios WHERE email = 'consultoraellenmmnegocios@gmail.com' LIMIT 1
), nova_oportunidade AS (
  INSERT INTO oportunidades (id, "empresaId", "responsavelId", "nomeCliente", estagio, origem, valor, "statusFinal", "fechadaEm", "criadaEm", "atualizadaEm", observacoes)
  SELECT md5(random()::text || clock_timestamp()::text || '2026-07-14-op'), v.empresa_id, v.usuario_id, 'Venda histórica — FAN 160 2019', 'COMPRADO', 'SDR', 21900.00, 'COMPRADO', '2026-07-14'::timestamp, '2026-07-14'::timestamp, now(), 'Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: FAN 160 2019 · Banco: PAN'
  FROM v
  WHERE NOT EXISTS (SELECT 1 FROM oportunidades WHERE "nomeCliente" = 'Venda histórica — FAN 160 2019' AND "criadaEm" = '2026-07-14'::timestamp)
  RETURNING id
)
INSERT INTO contratos (id, "empresaId", "oportunidadeId", "vendedorId", "nomeCliente", "valorTotal", status, "processoAdministrativoStatus", "criadoEm", "atualizadoEm", observacoes)
SELECT md5(random()::text || clock_timestamp()::text || '2026-07-14-ct'), v.empresa_id, no.id, v.usuario_id, 'Venda histórica — FAN 160 2019', 21900.00, 'ATIVO', 'CONCLUIDO', '2026-07-14'::timestamp, now(), 'Importado do relatório de balanceamento comercial. Modelo: FAN 160 2019 · Banco: PAN'
FROM nova_oportunidade no, v;

WITH v AS (
  SELECT id AS usuario_id, "empresaId" AS empresa_id FROM usuarios WHERE email = 'consultoraellenmmnegocios@gmail.com' LIMIT 1
), nova_oportunidade AS (
  INSERT INTO oportunidades (id, "empresaId", "responsavelId", "nomeCliente", estagio, origem, valor, "statusFinal", "fechadaEm", "criadaEm", "atualizadaEm", observacoes)
  SELECT md5(random()::text || clock_timestamp()::text || '2026-08-11-op'), v.empresa_id, v.usuario_id, 'Venda histórica — FAN 160 VERM', 'COMPRADO', 'SDR', 24000.00, 'COMPRADO', '2026-08-11'::timestamp, '2026-08-11'::timestamp, now(), 'Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: FAN 160 VERM · Banco: BV'
  FROM v
  WHERE NOT EXISTS (SELECT 1 FROM oportunidades WHERE "nomeCliente" = 'Venda histórica — FAN 160 VERM' AND "criadaEm" = '2026-08-11'::timestamp)
  RETURNING id
)
INSERT INTO contratos (id, "empresaId", "oportunidadeId", "vendedorId", "nomeCliente", "valorTotal", status, "processoAdministrativoStatus", "criadoEm", "atualizadoEm", observacoes)
SELECT md5(random()::text || clock_timestamp()::text || '2026-08-11-ct'), v.empresa_id, no.id, v.usuario_id, 'Venda histórica — FAN 160 VERM', 24000.00, 'ATIVO', 'CONCLUIDO', '2026-08-11'::timestamp, now(), 'Importado do relatório de balanceamento comercial. Modelo: FAN 160 VERM · Banco: BV'
FROM nova_oportunidade no, v;
