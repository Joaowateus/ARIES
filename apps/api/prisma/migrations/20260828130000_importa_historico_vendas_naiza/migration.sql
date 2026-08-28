-- Importa o histórico real de vendas da Naiza (jan-ago/2026), extraído do
-- relatório de balanceamento comercial (BALANCEAMENTO.pdf) — mesmo padrão
-- usado pro Wanderson e pra Ellen: só alimenta a produção do vendedor (Meu
-- Painel: quantidade, faturamento, balanceamento mês a mês), não cria
-- EstagioHistorico, porque a fonte não tem a jornada do lead (só mês do
-- fechamento). Sem nome de cliente na fonte: usa um rótulo claro de venda
-- histórica em vez de inventar uma pessoa.
--
-- É condicional (CTE "v" busca o usuário pelo e-mail real da Naiza) e vira
-- no-op silencioso em qualquer banco onde essa conta não existir — só
-- popula de fato em produção.

WITH v AS (
  SELECT id AS usuario_id, "empresaId" AS empresa_id FROM usuarios WHERE email = 'consultoranaizasouzammnegocios@gmail.com' LIMIT 1
), nova_oportunidade AS (
  INSERT INTO oportunidades (id, "empresaId", "responsavelId", "nomeCliente", estagio, origem, valor, "statusFinal", "fechadaEm", "criadaEm", "atualizadaEm", observacoes)
  SELECT md5(random()::text || clock_timestamp()::text || '2026-01-06-op'), v.empresa_id, v.usuario_id, 'Venda histórica — BROS 2020', 'COMPRADO', 'PATIO', 20000.00, 'COMPRADO', '2026-01-06'::timestamp, '2026-01-06'::timestamp, now(), 'Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: BROS 2020 · Banco: A VISTA'
  FROM v
  WHERE NOT EXISTS (SELECT 1 FROM oportunidades WHERE "nomeCliente" = 'Venda histórica — BROS 2020' AND "criadaEm" = '2026-01-06'::timestamp)
  RETURNING id
)
INSERT INTO contratos (id, "empresaId", "oportunidadeId", "vendedorId", "nomeCliente", "valorTotal", status, "processoAdministrativoStatus", "criadoEm", "atualizadoEm", observacoes)
SELECT md5(random()::text || clock_timestamp()::text || '2026-01-06-ct'), v.empresa_id, no.id, v.usuario_id, 'Venda histórica — BROS 2020', 20000.00, 'ATIVO', 'CONCLUIDO', '2026-01-06'::timestamp, now(), 'Importado do relatório de balanceamento comercial. Modelo: BROS 2020 · Banco: A VISTA'
FROM nova_oportunidade no, v;

WITH v AS (
  SELECT id AS usuario_id, "empresaId" AS empresa_id FROM usuarios WHERE email = 'consultoranaizasouzammnegocios@gmail.com' LIMIT 1
), nova_oportunidade AS (
  INSERT INTO oportunidades (id, "empresaId", "responsavelId", "nomeCliente", estagio, origem, valor, "statusFinal", "fechadaEm", "criadaEm", "atualizadaEm", observacoes)
  SELECT md5(random()::text || clock_timestamp()::text || '2026-01-16-op'), v.empresa_id, v.usuario_id, 'Venda histórica — LANDER 250', 'COMPRADO', 'PATIO', 30900.00, 'COMPRADO', '2026-01-16'::timestamp, '2026-01-16'::timestamp, now(), 'Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: LANDER 250 · Banco: BV'
  FROM v
  WHERE NOT EXISTS (SELECT 1 FROM oportunidades WHERE "nomeCliente" = 'Venda histórica — LANDER 250' AND "criadaEm" = '2026-01-16'::timestamp)
  RETURNING id
)
INSERT INTO contratos (id, "empresaId", "oportunidadeId", "vendedorId", "nomeCliente", "valorTotal", status, "processoAdministrativoStatus", "criadoEm", "atualizadoEm", observacoes)
SELECT md5(random()::text || clock_timestamp()::text || '2026-01-16-ct'), v.empresa_id, no.id, v.usuario_id, 'Venda histórica — LANDER 250', 30900.00, 'ATIVO', 'CONCLUIDO', '2026-01-16'::timestamp, now(), 'Importado do relatório de balanceamento comercial. Modelo: LANDER 250 · Banco: BV'
FROM nova_oportunidade no, v;

WITH v AS (
  SELECT id AS usuario_id, "empresaId" AS empresa_id FROM usuarios WHERE email = 'consultoranaizasouzammnegocios@gmail.com' LIMIT 1
), nova_oportunidade AS (
  INSERT INTO oportunidades (id, "empresaId", "responsavelId", "nomeCliente", estagio, origem, valor, "statusFinal", "fechadaEm", "criadaEm", "atualizadaEm", observacoes)
  SELECT md5(random()::text || clock_timestamp()::text || '2026-01-26-op'), v.empresa_id, v.usuario_id, 'Venda histórica — XRE 300', 'COMPRADO', 'PATIO', 32900.00, 'COMPRADO', '2026-01-26'::timestamp, '2026-01-26'::timestamp, now(), 'Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: XRE 300 · Banco: SANTANDER'
  FROM v
  WHERE NOT EXISTS (SELECT 1 FROM oportunidades WHERE "nomeCliente" = 'Venda histórica — XRE 300' AND "criadaEm" = '2026-01-26'::timestamp)
  RETURNING id
)
INSERT INTO contratos (id, "empresaId", "oportunidadeId", "vendedorId", "nomeCliente", "valorTotal", status, "processoAdministrativoStatus", "criadoEm", "atualizadoEm", observacoes)
SELECT md5(random()::text || clock_timestamp()::text || '2026-01-26-ct'), v.empresa_id, no.id, v.usuario_id, 'Venda histórica — XRE 300', 32900.00, 'ATIVO', 'CONCLUIDO', '2026-01-26'::timestamp, now(), 'Importado do relatório de balanceamento comercial. Modelo: XRE 300 · Banco: SANTANDER'
FROM nova_oportunidade no, v;

WITH v AS (
  SELECT id AS usuario_id, "empresaId" AS empresa_id FROM usuarios WHERE email = 'consultoranaizasouzammnegocios@gmail.com' LIMIT 1
), nova_oportunidade AS (
  INSERT INTO oportunidades (id, "empresaId", "responsavelId", "nomeCliente", estagio, origem, valor, "statusFinal", "fechadaEm", "criadaEm", "atualizadaEm", observacoes)
  SELECT md5(random()::text || clock_timestamp()::text || '2026-02-14-op'), v.empresa_id, v.usuario_id, 'Venda histórica — FZ 250 PRETA', 'COMPRADO', 'PATIO', 24500.00, 'COMPRADO', '2026-02-14'::timestamp, '2026-02-14'::timestamp, now(), 'Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: FZ 250 PRETA · Banco: A VISTA'
  FROM v
  WHERE NOT EXISTS (SELECT 1 FROM oportunidades WHERE "nomeCliente" = 'Venda histórica — FZ 250 PRETA' AND "criadaEm" = '2026-02-14'::timestamp)
  RETURNING id
)
INSERT INTO contratos (id, "empresaId", "oportunidadeId", "vendedorId", "nomeCliente", "valorTotal", status, "processoAdministrativoStatus", "criadoEm", "atualizadoEm", observacoes)
SELECT md5(random()::text || clock_timestamp()::text || '2026-02-14-ct'), v.empresa_id, no.id, v.usuario_id, 'Venda histórica — FZ 250 PRETA', 24500.00, 'ATIVO', 'CONCLUIDO', '2026-02-14'::timestamp, now(), 'Importado do relatório de balanceamento comercial. Modelo: FZ 250 PRETA · Banco: A VISTA'
FROM nova_oportunidade no, v;

WITH v AS (
  SELECT id AS usuario_id, "empresaId" AS empresa_id FROM usuarios WHERE email = 'consultoranaizasouzammnegocios@gmail.com' LIMIT 1
), nova_oportunidade AS (
  INSERT INTO oportunidades (id, "empresaId", "responsavelId", "nomeCliente", estagio, origem, valor, "statusFinal", "fechadaEm", "criadaEm", "atualizadaEm", observacoes)
  SELECT md5(random()::text || clock_timestamp()::text || '2026-04-10-op'), v.empresa_id, v.usuario_id, 'Venda histórica — FZ 15 CINZA', 'COMPRADO', 'PATIO', 26900.00, 'COMPRADO', '2026-04-10'::timestamp, '2026-04-10'::timestamp, now(), 'Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: FZ 15 CINZA · Banco: PAN'
  FROM v
  WHERE NOT EXISTS (SELECT 1 FROM oportunidades WHERE "nomeCliente" = 'Venda histórica — FZ 15 CINZA' AND "criadaEm" = '2026-04-10'::timestamp)
  RETURNING id
)
INSERT INTO contratos (id, "empresaId", "oportunidadeId", "vendedorId", "nomeCliente", "valorTotal", status, "processoAdministrativoStatus", "criadoEm", "atualizadoEm", observacoes)
SELECT md5(random()::text || clock_timestamp()::text || '2026-04-10-ct'), v.empresa_id, no.id, v.usuario_id, 'Venda histórica — FZ 15 CINZA', 26900.00, 'ATIVO', 'CONCLUIDO', '2026-04-10'::timestamp, now(), 'Importado do relatório de balanceamento comercial. Modelo: FZ 15 CINZA · Banco: PAN'
FROM nova_oportunidade no, v;

WITH v AS (
  SELECT id AS usuario_id, "empresaId" AS empresa_id FROM usuarios WHERE email = 'consultoranaizasouzammnegocios@gmail.com' LIMIT 1
), nova_oportunidade AS (
  INSERT INTO oportunidades (id, "empresaId", "responsavelId", "nomeCliente", estagio, origem, valor, "statusFinal", "fechadaEm", "criadaEm", "atualizadaEm", observacoes)
  SELECT md5(random()::text || clock_timestamp()::text || '2026-04-24-op'), v.empresa_id, v.usuario_id, 'Venda histórica — FZ 25 BRANCA', 'COMPRADO', 'SDR', 29900.00, 'COMPRADO', '2026-04-24'::timestamp, '2026-04-24'::timestamp, now(), 'Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: FZ 25 BRANCA · Banco: SANTANDER'
  FROM v
  WHERE NOT EXISTS (SELECT 1 FROM oportunidades WHERE "nomeCliente" = 'Venda histórica — FZ 25 BRANCA' AND "criadaEm" = '2026-04-24'::timestamp)
  RETURNING id
)
INSERT INTO contratos (id, "empresaId", "oportunidadeId", "vendedorId", "nomeCliente", "valorTotal", status, "processoAdministrativoStatus", "criadoEm", "atualizadoEm", observacoes)
SELECT md5(random()::text || clock_timestamp()::text || '2026-04-24-ct'), v.empresa_id, no.id, v.usuario_id, 'Venda histórica — FZ 25 BRANCA', 29900.00, 'ATIVO', 'CONCLUIDO', '2026-04-24'::timestamp, now(), 'Importado do relatório de balanceamento comercial. Modelo: FZ 25 BRANCA · Banco: SANTANDER'
FROM nova_oportunidade no, v;

WITH v AS (
  SELECT id AS usuario_id, "empresaId" AS empresa_id FROM usuarios WHERE email = 'consultoranaizasouzammnegocios@gmail.com' LIMIT 1
), nova_oportunidade AS (
  INSERT INTO oportunidades (id, "empresaId", "responsavelId", "nomeCliente", estagio, origem, valor, "statusFinal", "fechadaEm", "criadaEm", "atualizadaEm", observacoes)
  SELECT md5(random()::text || clock_timestamp()::text || '2026-05-16-op'), v.empresa_id, v.usuario_id, 'Venda histórica — FAN 160 2023', 'COMPRADO', 'SDR', 24725.00, 'COMPRADO', '2026-05-16'::timestamp, '2026-05-16'::timestamp, now(), 'Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: FAN 160 2023 · Banco: SANTANDER'
  FROM v
  WHERE NOT EXISTS (SELECT 1 FROM oportunidades WHERE "nomeCliente" = 'Venda histórica — FAN 160 2023' AND "criadaEm" = '2026-05-16'::timestamp)
  RETURNING id
)
INSERT INTO contratos (id, "empresaId", "oportunidadeId", "vendedorId", "nomeCliente", "valorTotal", status, "processoAdministrativoStatus", "criadoEm", "atualizadoEm", observacoes)
SELECT md5(random()::text || clock_timestamp()::text || '2026-05-16-ct'), v.empresa_id, no.id, v.usuario_id, 'Venda histórica — FAN 160 2023', 24725.00, 'ATIVO', 'CONCLUIDO', '2026-05-16'::timestamp, now(), 'Importado do relatório de balanceamento comercial. Modelo: FAN 160 2023 · Banco: SANTANDER'
FROM nova_oportunidade no, v;

WITH v AS (
  SELECT id AS usuario_id, "empresaId" AS empresa_id FROM usuarios WHERE email = 'consultoranaizasouzammnegocios@gmail.com' LIMIT 1
), nova_oportunidade AS (
  INSERT INTO oportunidades (id, "empresaId", "responsavelId", "nomeCliente", estagio, origem, valor, "statusFinal", "fechadaEm", "criadaEm", "atualizadaEm", observacoes)
  SELECT md5(random()::text || clock_timestamp()::text || '2026-06-05-op'), v.empresa_id, v.usuario_id, 'Venda histórica — BIZ 2021 BRANCA', 'COMPRADO', 'SDR', 17000.00, 'COMPRADO', '2026-06-05'::timestamp, '2026-06-05'::timestamp, now(), 'Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: BIZ 2021 BRANCA · Banco: BV'
  FROM v
  WHERE NOT EXISTS (SELECT 1 FROM oportunidades WHERE "nomeCliente" = 'Venda histórica — BIZ 2021 BRANCA' AND "criadaEm" = '2026-06-05'::timestamp)
  RETURNING id
)
INSERT INTO contratos (id, "empresaId", "oportunidadeId", "vendedorId", "nomeCliente", "valorTotal", status, "processoAdministrativoStatus", "criadoEm", "atualizadoEm", observacoes)
SELECT md5(random()::text || clock_timestamp()::text || '2026-06-05-ct'), v.empresa_id, no.id, v.usuario_id, 'Venda histórica — BIZ 2021 BRANCA', 17000.00, 'ATIVO', 'CONCLUIDO', '2026-06-05'::timestamp, now(), 'Importado do relatório de balanceamento comercial. Modelo: BIZ 2021 BRANCA · Banco: BV'
FROM nova_oportunidade no, v;

WITH v AS (
  SELECT id AS usuario_id, "empresaId" AS empresa_id FROM usuarios WHERE email = 'consultoranaizasouzammnegocios@gmail.com' LIMIT 1
), nova_oportunidade AS (
  INSERT INTO oportunidades (id, "empresaId", "responsavelId", "nomeCliente", estagio, origem, valor, "statusFinal", "fechadaEm", "criadaEm", "atualizadaEm", observacoes)
  SELECT md5(random()::text || clock_timestamp()::text || '2026-06-12-op'), v.empresa_id, v.usuario_id, 'Venda histórica — POP 110I', 'COMPRADO', 'SDR', 11463.00, 'COMPRADO', '2026-06-12'::timestamp, '2026-06-12'::timestamp, now(), 'Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: POP 110I · Banco: PAN'
  FROM v
  WHERE NOT EXISTS (SELECT 1 FROM oportunidades WHERE "nomeCliente" = 'Venda histórica — POP 110I' AND "criadaEm" = '2026-06-12'::timestamp)
  RETURNING id
)
INSERT INTO contratos (id, "empresaId", "oportunidadeId", "vendedorId", "nomeCliente", "valorTotal", status, "processoAdministrativoStatus", "criadoEm", "atualizadoEm", observacoes)
SELECT md5(random()::text || clock_timestamp()::text || '2026-06-12-ct'), v.empresa_id, no.id, v.usuario_id, 'Venda histórica — POP 110I', 11463.00, 'ATIVO', 'CONCLUIDO', '2026-06-12'::timestamp, now(), 'Importado do relatório de balanceamento comercial. Modelo: POP 110I · Banco: PAN'
FROM nova_oportunidade no, v;

WITH v AS (
  SELECT id AS usuario_id, "empresaId" AS empresa_id FROM usuarios WHERE email = 'consultoranaizasouzammnegocios@gmail.com' LIMIT 1
), nova_oportunidade AS (
  INSERT INTO oportunidades (id, "empresaId", "responsavelId", "nomeCliente", estagio, origem, valor, "statusFinal", "fechadaEm", "criadaEm", "atualizadaEm", observacoes)
  SELECT md5(random()::text || clock_timestamp()::text || '2026-06-19-op'), v.empresa_id, v.usuario_id, 'Venda histórica — FAN 160 2023 (2)', 'COMPRADO', 'SDR', 15000.00, 'COMPRADO', '2026-06-19'::timestamp, '2026-06-19'::timestamp, now(), 'Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: FAN 160 2023 · Banco: PAN'
  FROM v
  WHERE NOT EXISTS (SELECT 1 FROM oportunidades WHERE "nomeCliente" = 'Venda histórica — FAN 160 2023 (2)' AND "criadaEm" = '2026-06-19'::timestamp)
  RETURNING id
)
INSERT INTO contratos (id, "empresaId", "oportunidadeId", "vendedorId", "nomeCliente", "valorTotal", status, "processoAdministrativoStatus", "criadoEm", "atualizadoEm", observacoes)
SELECT md5(random()::text || clock_timestamp()::text || '2026-06-19-ct'), v.empresa_id, no.id, v.usuario_id, 'Venda histórica — FAN 160 2023 (2)', 15000.00, 'ATIVO', 'CONCLUIDO', '2026-06-19'::timestamp, now(), 'Importado do relatório de balanceamento comercial. Modelo: FAN 160 2023 · Banco: PAN'
FROM nova_oportunidade no, v;

WITH v AS (
  SELECT id AS usuario_id, "empresaId" AS empresa_id FROM usuarios WHERE email = 'consultoranaizasouzammnegocios@gmail.com' LIMIT 1
), nova_oportunidade AS (
  INSERT INTO oportunidades (id, "empresaId", "responsavelId", "nomeCliente", estagio, origem, valor, "statusFinal", "fechadaEm", "criadaEm", "atualizadaEm", observacoes)
  SELECT md5(random()::text || clock_timestamp()::text || '2026-06-26-op'), v.empresa_id, v.usuario_id, 'Venda histórica — TITAN 150 EX 2015', 'COMPRADO', 'SDR', 11000.00, 'COMPRADO', '2026-06-26'::timestamp, '2026-06-26'::timestamp, now(), 'Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: TITAN 150 EX 2015 · Banco: A VISTA'
  FROM v
  WHERE NOT EXISTS (SELECT 1 FROM oportunidades WHERE "nomeCliente" = 'Venda histórica — TITAN 150 EX 2015' AND "criadaEm" = '2026-06-26'::timestamp)
  RETURNING id
)
INSERT INTO contratos (id, "empresaId", "oportunidadeId", "vendedorId", "nomeCliente", "valorTotal", status, "processoAdministrativoStatus", "criadoEm", "atualizadoEm", observacoes)
SELECT md5(random()::text || clock_timestamp()::text || '2026-06-26-ct'), v.empresa_id, no.id, v.usuario_id, 'Venda histórica — TITAN 150 EX 2015', 11000.00, 'ATIVO', 'CONCLUIDO', '2026-06-26'::timestamp, now(), 'Importado do relatório de balanceamento comercial. Modelo: TITAN 150 EX 2015 · Banco: A VISTA'
FROM nova_oportunidade no, v;

WITH v AS (
  SELECT id AS usuario_id, "empresaId" AS empresa_id FROM usuarios WHERE email = 'consultoranaizasouzammnegocios@gmail.com' LIMIT 1
), nova_oportunidade AS (
  INSERT INTO oportunidades (id, "empresaId", "responsavelId", "nomeCliente", estagio, origem, valor, "statusFinal", "fechadaEm", "criadaEm", "atualizadaEm", observacoes)
  SELECT md5(random()::text || clock_timestamp()::text || '2026-07-16-op'), v.empresa_id, v.usuario_id, 'Venda histórica — FZ 25 CINZA', 'COMPRADO', 'SDR', 26900.00, 'COMPRADO', '2026-07-16'::timestamp, '2026-07-16'::timestamp, now(), 'Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: FZ 25 CINZA · Banco: PAN'
  FROM v
  WHERE NOT EXISTS (SELECT 1 FROM oportunidades WHERE "nomeCliente" = 'Venda histórica — FZ 25 CINZA' AND "criadaEm" = '2026-07-16'::timestamp)
  RETURNING id
)
INSERT INTO contratos (id, "empresaId", "oportunidadeId", "vendedorId", "nomeCliente", "valorTotal", status, "processoAdministrativoStatus", "criadoEm", "atualizadoEm", observacoes)
SELECT md5(random()::text || clock_timestamp()::text || '2026-07-16-ct'), v.empresa_id, no.id, v.usuario_id, 'Venda histórica — FZ 25 CINZA', 26900.00, 'ATIVO', 'CONCLUIDO', '2026-07-16'::timestamp, now(), 'Importado do relatório de balanceamento comercial. Modelo: FZ 25 CINZA · Banco: PAN'
FROM nova_oportunidade no, v;

WITH v AS (
  SELECT id AS usuario_id, "empresaId" AS empresa_id FROM usuarios WHERE email = 'consultoranaizasouzammnegocios@gmail.com' LIMIT 1
), nova_oportunidade AS (
  INSERT INTO oportunidades (id, "empresaId", "responsavelId", "nomeCliente", estagio, origem, valor, "statusFinal", "fechadaEm", "criadaEm", "atualizadaEm", observacoes)
  SELECT md5(random()::text || clock_timestamp()::text || '2026-08-14-op'), v.empresa_id, v.usuario_id, 'Venda histórica — FZ 25 AZUL', 'COMPRADO', 'SDR', 28000.00, 'COMPRADO', '2026-08-14'::timestamp, '2026-08-14'::timestamp, now(), 'Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: FZ 25 AZUL · Banco: A VISTA'
  FROM v
  WHERE NOT EXISTS (SELECT 1 FROM oportunidades WHERE "nomeCliente" = 'Venda histórica — FZ 25 AZUL' AND "criadaEm" = '2026-08-14'::timestamp)
  RETURNING id
)
INSERT INTO contratos (id, "empresaId", "oportunidadeId", "vendedorId", "nomeCliente", "valorTotal", status, "processoAdministrativoStatus", "criadoEm", "atualizadoEm", observacoes)
SELECT md5(random()::text || clock_timestamp()::text || '2026-08-14-ct'), v.empresa_id, no.id, v.usuario_id, 'Venda histórica — FZ 25 AZUL', 28000.00, 'ATIVO', 'CONCLUIDO', '2026-08-14'::timestamp, now(), 'Importado do relatório de balanceamento comercial. Modelo: FZ 25 AZUL · Banco: A VISTA'
FROM nova_oportunidade no, v;
