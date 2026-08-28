-- Reimporta o histórico real de vendas do Wanderson (jan-jul/2026) — mesma
-- SQL exata da migração original (20260821180000_importa_historico_vendas_
-- wanderson), reaplicada aqui porque a conta dele muito provavelmente foi
-- criada DEPOIS daquele deploy: o Prisma marca uma migração como "aplicada"
-- na primeira vez que ela roda, mesmo que o CTE não encontre a conta (fica
-- 0 linhas inseridas) — e nunca mais a executa de novo sozinho, mesmo que a
-- conta passe a existir depois. Rodar a mesma lógica de novo aqui é seguro:
-- cada bloco só insere se a combinação (nomeCliente + criadaEm) ainda não
-- existir, então se a importação original já tiver funcionado essa aqui
-- não duplica nada.
--
-- Continua condicional (CTE "v" busca o usuário pelo e-mail real do
-- Wanderson) e vira no-op silencioso em qualquer banco onde essa conta não
-- existir.

WITH v AS (
  SELECT id AS usuario_id, "empresaId" AS empresa_id FROM usuarios WHERE email = 'consultorwandersonmmnegocios@gmail.com' LIMIT 1
), nova_oportunidade AS (
  INSERT INTO oportunidades (id, "empresaId", "responsavelId", "nomeCliente", estagio, origem, valor, "statusFinal", "fechadaEm", "criadaEm", "atualizadaEm", observacoes)
  SELECT md5(random()::text || clock_timestamp()::text || '2026-01-04-op'), v.empresa_id, v.usuario_id, 'Venda histórica — CB 250', 'COMPRADO', 'SDR', 23900.00, 'COMPRADO', '2026-01-04'::timestamp, '2026-01-04'::timestamp, now(), 'Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: CB 250 · Banco: PAN'
  FROM v
  WHERE NOT EXISTS (SELECT 1 FROM oportunidades WHERE "nomeCliente" = 'Venda histórica — CB 250' AND "criadaEm" = '2026-01-04'::timestamp)
  RETURNING id
)
INSERT INTO contratos (id, "empresaId", "oportunidadeId", "vendedorId", "nomeCliente", "valorTotal", status, "processoAdministrativoStatus", "criadoEm", "atualizadoEm", observacoes)
SELECT md5(random()::text || clock_timestamp()::text || '2026-01-04-ct'), v.empresa_id, no.id, v.usuario_id, 'Venda histórica — CB 250', 23900.00, 'ATIVO', 'CONCLUIDO', '2026-01-04'::timestamp, now(), 'Importado do relatório de balanceamento comercial. Modelo: CB 250 · Banco: PAN'
FROM nova_oportunidade no, v;

WITH v AS (
  SELECT id AS usuario_id, "empresaId" AS empresa_id FROM usuarios WHERE email = 'consultorwandersonmmnegocios@gmail.com' LIMIT 1
), nova_oportunidade AS (
  INSERT INTO oportunidades (id, "empresaId", "responsavelId", "nomeCliente", estagio, origem, valor, "statusFinal", "fechadaEm", "criadaEm", "atualizadaEm", observacoes)
  SELECT md5(random()::text || clock_timestamp()::text || '2026-01-09-op'), v.empresa_id, v.usuario_id, 'Venda histórica — R15', 'COMPRADO', 'SDR', 18533.00, 'COMPRADO', '2026-01-09'::timestamp, '2026-01-09'::timestamp, now(), 'Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: R15 · Banco: PAN'
  FROM v
  WHERE NOT EXISTS (SELECT 1 FROM oportunidades WHERE "nomeCliente" = 'Venda histórica — R15' AND "criadaEm" = '2026-01-09'::timestamp)
  RETURNING id
)
INSERT INTO contratos (id, "empresaId", "oportunidadeId", "vendedorId", "nomeCliente", "valorTotal", status, "processoAdministrativoStatus", "criadoEm", "atualizadoEm", observacoes)
SELECT md5(random()::text || clock_timestamp()::text || '2026-01-09-ct'), v.empresa_id, no.id, v.usuario_id, 'Venda histórica — R15', 18533.00, 'ATIVO', 'CONCLUIDO', '2026-01-09'::timestamp, now(), 'Importado do relatório de balanceamento comercial. Modelo: R15 · Banco: PAN'
FROM nova_oportunidade no, v;

WITH v AS (
  SELECT id AS usuario_id, "empresaId" AS empresa_id FROM usuarios WHERE email = 'consultorwandersonmmnegocios@gmail.com' LIMIT 1
), nova_oportunidade AS (
  INSERT INTO oportunidades (id, "empresaId", "responsavelId", "nomeCliente", estagio, origem, valor, "statusFinal", "fechadaEm", "criadaEm", "atualizadaEm", observacoes)
  SELECT md5(random()::text || clock_timestamp()::text || '2026-01-14-op'), v.empresa_id, v.usuario_id, 'Venda histórica — 500 F', 'COMPRADO', 'SDR', 40900.00, 'COMPRADO', '2026-01-14'::timestamp, '2026-01-14'::timestamp, now(), 'Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: 500 F · Banco: SANTANDER'
  FROM v
  WHERE NOT EXISTS (SELECT 1 FROM oportunidades WHERE "nomeCliente" = 'Venda histórica — 500 F' AND "criadaEm" = '2026-01-14'::timestamp)
  RETURNING id
)
INSERT INTO contratos (id, "empresaId", "oportunidadeId", "vendedorId", "nomeCliente", "valorTotal", status, "processoAdministrativoStatus", "criadoEm", "atualizadoEm", observacoes)
SELECT md5(random()::text || clock_timestamp()::text || '2026-01-14-ct'), v.empresa_id, no.id, v.usuario_id, 'Venda histórica — 500 F', 40900.00, 'ATIVO', 'CONCLUIDO', '2026-01-14'::timestamp, now(), 'Importado do relatório de balanceamento comercial. Modelo: 500 F · Banco: SANTANDER'
FROM nova_oportunidade no, v;

WITH v AS (
  SELECT id AS usuario_id, "empresaId" AS empresa_id FROM usuarios WHERE email = 'consultorwandersonmmnegocios@gmail.com' LIMIT 1
), nova_oportunidade AS (
  INSERT INTO oportunidades (id, "empresaId", "responsavelId", "nomeCliente", estagio, origem, valor, "statusFinal", "fechadaEm", "criadaEm", "atualizadaEm", observacoes)
  SELECT md5(random()::text || clock_timestamp()::text || '2026-01-19-op'), v.empresa_id, v.usuario_id, 'Venda histórica — BROS 2020', 'COMPRADO', 'SDR', 22600.00, 'COMPRADO', '2026-01-19'::timestamp, '2026-01-19'::timestamp, now(), 'Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: BROS 2020 · Banco: PAN'
  FROM v
  WHERE NOT EXISTS (SELECT 1 FROM oportunidades WHERE "nomeCliente" = 'Venda histórica — BROS 2020' AND "criadaEm" = '2026-01-19'::timestamp)
  RETURNING id
)
INSERT INTO contratos (id, "empresaId", "oportunidadeId", "vendedorId", "nomeCliente", "valorTotal", status, "processoAdministrativoStatus", "criadoEm", "atualizadoEm", observacoes)
SELECT md5(random()::text || clock_timestamp()::text || '2026-01-19-ct'), v.empresa_id, no.id, v.usuario_id, 'Venda histórica — BROS 2020', 22600.00, 'ATIVO', 'CONCLUIDO', '2026-01-19'::timestamp, now(), 'Importado do relatório de balanceamento comercial. Modelo: BROS 2020 · Banco: PAN'
FROM nova_oportunidade no, v;

WITH v AS (
  SELECT id AS usuario_id, "empresaId" AS empresa_id FROM usuarios WHERE email = 'consultorwandersonmmnegocios@gmail.com' LIMIT 1
), nova_oportunidade AS (
  INSERT INTO oportunidades (id, "empresaId", "responsavelId", "nomeCliente", estagio, origem, valor, "statusFinal", "fechadaEm", "criadaEm", "atualizadaEm", observacoes)
  SELECT md5(random()::text || clock_timestamp()::text || '2026-02-03-op'), v.empresa_id, v.usuario_id, 'Venda histórica — XRE 2015', 'COMPRADO', 'SDR', 15900.00, 'COMPRADO', '2026-02-03'::timestamp, '2026-02-03'::timestamp, now(), 'Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: XRE 2015 · Banco: PAN'
  FROM v
  WHERE NOT EXISTS (SELECT 1 FROM oportunidades WHERE "nomeCliente" = 'Venda histórica — XRE 2015' AND "criadaEm" = '2026-02-03'::timestamp)
  RETURNING id
)
INSERT INTO contratos (id, "empresaId", "oportunidadeId", "vendedorId", "nomeCliente", "valorTotal", status, "processoAdministrativoStatus", "criadoEm", "atualizadoEm", observacoes)
SELECT md5(random()::text || clock_timestamp()::text || '2026-02-03-ct'), v.empresa_id, no.id, v.usuario_id, 'Venda histórica — XRE 2015', 15900.00, 'ATIVO', 'CONCLUIDO', '2026-02-03'::timestamp, now(), 'Importado do relatório de balanceamento comercial. Modelo: XRE 2015 · Banco: PAN'
FROM nova_oportunidade no, v;

WITH v AS (
  SELECT id AS usuario_id, "empresaId" AS empresa_id FROM usuarios WHERE email = 'consultorwandersonmmnegocios@gmail.com' LIMIT 1
), nova_oportunidade AS (
  INSERT INTO oportunidades (id, "empresaId", "responsavelId", "nomeCliente", estagio, origem, valor, "statusFinal", "fechadaEm", "criadaEm", "atualizadaEm", observacoes)
  SELECT md5(random()::text || clock_timestamp()::text || '2026-02-10-op'), v.empresa_id, v.usuario_id, 'Venda histórica — MT 03', 'COMPRADO', 'SDR', 27900.00, 'COMPRADO', '2026-02-10'::timestamp, '2026-02-10'::timestamp, now(), 'Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: MT 03 · Banco: SANTANDER'
  FROM v
  WHERE NOT EXISTS (SELECT 1 FROM oportunidades WHERE "nomeCliente" = 'Venda histórica — MT 03' AND "criadaEm" = '2026-02-10'::timestamp)
  RETURNING id
)
INSERT INTO contratos (id, "empresaId", "oportunidadeId", "vendedorId", "nomeCliente", "valorTotal", status, "processoAdministrativoStatus", "criadoEm", "atualizadoEm", observacoes)
SELECT md5(random()::text || clock_timestamp()::text || '2026-02-10-ct'), v.empresa_id, no.id, v.usuario_id, 'Venda histórica — MT 03', 27900.00, 'ATIVO', 'CONCLUIDO', '2026-02-10'::timestamp, now(), 'Importado do relatório de balanceamento comercial. Modelo: MT 03 · Banco: SANTANDER'
FROM nova_oportunidade no, v;

WITH v AS (
  SELECT id AS usuario_id, "empresaId" AS empresa_id FROM usuarios WHERE email = 'consultorwandersonmmnegocios@gmail.com' LIMIT 1
), nova_oportunidade AS (
  INSERT INTO oportunidades (id, "empresaId", "responsavelId", "nomeCliente", estagio, origem, valor, "statusFinal", "fechadaEm", "criadaEm", "atualizadaEm", observacoes)
  SELECT md5(random()::text || clock_timestamp()::text || '2026-02-25-op'), v.empresa_id, v.usuario_id, 'Venda histórica — TITAN 160', 'COMPRADO', 'SDR', 20000.00, 'COMPRADO', '2026-02-25'::timestamp, '2026-02-25'::timestamp, now(), 'Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: TITAN 160 · Banco: SANTANDER'
  FROM v
  WHERE NOT EXISTS (SELECT 1 FROM oportunidades WHERE "nomeCliente" = 'Venda histórica — TITAN 160' AND "criadaEm" = '2026-02-25'::timestamp)
  RETURNING id
)
INSERT INTO contratos (id, "empresaId", "oportunidadeId", "vendedorId", "nomeCliente", "valorTotal", status, "processoAdministrativoStatus", "criadoEm", "atualizadoEm", observacoes)
SELECT md5(random()::text || clock_timestamp()::text || '2026-02-25-ct'), v.empresa_id, no.id, v.usuario_id, 'Venda histórica — TITAN 160', 20000.00, 'ATIVO', 'CONCLUIDO', '2026-02-25'::timestamp, now(), 'Importado do relatório de balanceamento comercial. Modelo: TITAN 160 · Banco: SANTANDER'
FROM nova_oportunidade no, v;

WITH v AS (
  SELECT id AS usuario_id, "empresaId" AS empresa_id FROM usuarios WHERE email = 'consultorwandersonmmnegocios@gmail.com' LIMIT 1
), nova_oportunidade AS (
  INSERT INTO oportunidades (id, "empresaId", "responsavelId", "nomeCliente", estagio, origem, valor, "statusFinal", "fechadaEm", "criadaEm", "atualizadaEm", observacoes)
  SELECT md5(random()::text || clock_timestamp()::text || '2026-03-02-op'), v.empresa_id, v.usuario_id, 'Venda histórica — LANDER 250 AZUL', 'COMPRADO', 'SDR', 26900.00, 'COMPRADO', '2026-03-02'::timestamp, '2026-03-02'::timestamp, now(), 'Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: LANDER 250 AZUL · Banco: BV'
  FROM v
  WHERE NOT EXISTS (SELECT 1 FROM oportunidades WHERE "nomeCliente" = 'Venda histórica — LANDER 250 AZUL' AND "criadaEm" = '2026-03-02'::timestamp)
  RETURNING id
)
INSERT INTO contratos (id, "empresaId", "oportunidadeId", "vendedorId", "nomeCliente", "valorTotal", status, "processoAdministrativoStatus", "criadoEm", "atualizadoEm", observacoes)
SELECT md5(random()::text || clock_timestamp()::text || '2026-03-02-ct'), v.empresa_id, no.id, v.usuario_id, 'Venda histórica — LANDER 250 AZUL', 26900.00, 'ATIVO', 'CONCLUIDO', '2026-03-02'::timestamp, now(), 'Importado do relatório de balanceamento comercial. Modelo: LANDER 250 AZUL · Banco: BV'
FROM nova_oportunidade no, v;

WITH v AS (
  SELECT id AS usuario_id, "empresaId" AS empresa_id FROM usuarios WHERE email = 'consultorwandersonmmnegocios@gmail.com' LIMIT 1
), nova_oportunidade AS (
  INSERT INTO oportunidades (id, "empresaId", "responsavelId", "nomeCliente", estagio, origem, valor, "statusFinal", "fechadaEm", "criadaEm", "atualizadaEm", observacoes)
  SELECT md5(random()::text || clock_timestamp()::text || '2026-03-05-op'), v.empresa_id, v.usuario_id, 'Venda histórica — PCX 2024', 'COMPRADO', 'SDR', 24500.00, 'COMPRADO', '2026-03-05'::timestamp, '2026-03-05'::timestamp, now(), 'Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: PCX 2024 · Banco: A VISTA'
  FROM v
  WHERE NOT EXISTS (SELECT 1 FROM oportunidades WHERE "nomeCliente" = 'Venda histórica — PCX 2024' AND "criadaEm" = '2026-03-05'::timestamp)
  RETURNING id
)
INSERT INTO contratos (id, "empresaId", "oportunidadeId", "vendedorId", "nomeCliente", "valorTotal", status, "processoAdministrativoStatus", "criadoEm", "atualizadoEm", observacoes)
SELECT md5(random()::text || clock_timestamp()::text || '2026-03-05-ct'), v.empresa_id, no.id, v.usuario_id, 'Venda histórica — PCX 2024', 24500.00, 'ATIVO', 'CONCLUIDO', '2026-03-05'::timestamp, now(), 'Importado do relatório de balanceamento comercial. Modelo: PCX 2024 · Banco: A VISTA'
FROM nova_oportunidade no, v;

WITH v AS (
  SELECT id AS usuario_id, "empresaId" AS empresa_id FROM usuarios WHERE email = 'consultorwandersonmmnegocios@gmail.com' LIMIT 1
), nova_oportunidade AS (
  INSERT INTO oportunidades (id, "empresaId", "responsavelId", "nomeCliente", estagio, origem, valor, "statusFinal", "fechadaEm", "criadaEm", "atualizadaEm", observacoes)
  SELECT md5(random()::text || clock_timestamp()::text || '2026-03-08-op'), v.empresa_id, v.usuario_id, 'Venda histórica — FZ 25 AZUL', 'COMPRADO', 'SDR', 25900.00, 'COMPRADO', '2026-03-08'::timestamp, '2026-03-08'::timestamp, now(), 'Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: FZ 25 AZUL · Banco: BV'
  FROM v
  WHERE NOT EXISTS (SELECT 1 FROM oportunidades WHERE "nomeCliente" = 'Venda histórica — FZ 25 AZUL' AND "criadaEm" = '2026-03-08'::timestamp)
  RETURNING id
)
INSERT INTO contratos (id, "empresaId", "oportunidadeId", "vendedorId", "nomeCliente", "valorTotal", status, "processoAdministrativoStatus", "criadoEm", "atualizadoEm", observacoes)
SELECT md5(random()::text || clock_timestamp()::text || '2026-03-08-ct'), v.empresa_id, no.id, v.usuario_id, 'Venda histórica — FZ 25 AZUL', 25900.00, 'ATIVO', 'CONCLUIDO', '2026-03-08'::timestamp, now(), 'Importado do relatório de balanceamento comercial. Modelo: FZ 25 AZUL · Banco: BV'
FROM nova_oportunidade no, v;

WITH v AS (
  SELECT id AS usuario_id, "empresaId" AS empresa_id FROM usuarios WHERE email = 'consultorwandersonmmnegocios@gmail.com' LIMIT 1
), nova_oportunidade AS (
  INSERT INTO oportunidades (id, "empresaId", "responsavelId", "nomeCliente", estagio, origem, valor, "statusFinal", "fechadaEm", "criadaEm", "atualizadaEm", observacoes)
  SELECT md5(random()::text || clock_timestamp()::text || '2026-03-11-op'), v.empresa_id, v.usuario_id, 'Venda histórica — START VERMELHA', 'COMPRADO', 'SDR', 16000.00, 'COMPRADO', '2026-03-11'::timestamp, '2026-03-11'::timestamp, now(), 'Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: START VERMELHA · Banco: PAN'
  FROM v
  WHERE NOT EXISTS (SELECT 1 FROM oportunidades WHERE "nomeCliente" = 'Venda histórica — START VERMELHA' AND "criadaEm" = '2026-03-11'::timestamp)
  RETURNING id
)
INSERT INTO contratos (id, "empresaId", "oportunidadeId", "vendedorId", "nomeCliente", "valorTotal", status, "processoAdministrativoStatus", "criadoEm", "atualizadoEm", observacoes)
SELECT md5(random()::text || clock_timestamp()::text || '2026-03-11-ct'), v.empresa_id, no.id, v.usuario_id, 'Venda histórica — START VERMELHA', 16000.00, 'ATIVO', 'CONCLUIDO', '2026-03-11'::timestamp, now(), 'Importado do relatório de balanceamento comercial. Modelo: START VERMELHA · Banco: PAN'
FROM nova_oportunidade no, v;

WITH v AS (
  SELECT id AS usuario_id, "empresaId" AS empresa_id FROM usuarios WHERE email = 'consultorwandersonmmnegocios@gmail.com' LIMIT 1
), nova_oportunidade AS (
  INSERT INTO oportunidades (id, "empresaId", "responsavelId", "nomeCliente", estagio, origem, valor, "statusFinal", "fechadaEm", "criadaEm", "atualizadaEm", observacoes)
  SELECT md5(random()::text || clock_timestamp()::text || '2026-03-14-op'), v.empresa_id, v.usuario_id, 'Venda histórica — CB 250 TW BRANCA', 'COMPRADO', 'SDR', 24000.00, 'COMPRADO', '2026-03-14'::timestamp, '2026-03-14'::timestamp, now(), 'Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: CB 250 TW BRANCA · Banco: PAN'
  FROM v
  WHERE NOT EXISTS (SELECT 1 FROM oportunidades WHERE "nomeCliente" = 'Venda histórica — CB 250 TW BRANCA' AND "criadaEm" = '2026-03-14'::timestamp)
  RETURNING id
)
INSERT INTO contratos (id, "empresaId", "oportunidadeId", "vendedorId", "nomeCliente", "valorTotal", status, "processoAdministrativoStatus", "criadoEm", "atualizadoEm", observacoes)
SELECT md5(random()::text || clock_timestamp()::text || '2026-03-14-ct'), v.empresa_id, no.id, v.usuario_id, 'Venda histórica — CB 250 TW BRANCA', 24000.00, 'ATIVO', 'CONCLUIDO', '2026-03-14'::timestamp, now(), 'Importado do relatório de balanceamento comercial. Modelo: CB 250 TW BRANCA · Banco: PAN'
FROM nova_oportunidade no, v;

WITH v AS (
  SELECT id AS usuario_id, "empresaId" AS empresa_id FROM usuarios WHERE email = 'consultorwandersonmmnegocios@gmail.com' LIMIT 1
), nova_oportunidade AS (
  INSERT INTO oportunidades (id, "empresaId", "responsavelId", "nomeCliente", estagio, origem, valor, "statusFinal", "fechadaEm", "criadaEm", "atualizadaEm", observacoes)
  SELECT md5(random()::text || clock_timestamp()::text || '2026-03-17-op'), v.empresa_id, v.usuario_id, 'Venda histórica — CB 300F VERMELHA', 'COMPRADO', 'SDR', 28000.00, 'COMPRADO', '2026-03-17'::timestamp, '2026-03-17'::timestamp, now(), 'Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: CB 300F VERMELHA · Banco: BV'
  FROM v
  WHERE NOT EXISTS (SELECT 1 FROM oportunidades WHERE "nomeCliente" = 'Venda histórica — CB 300F VERMELHA' AND "criadaEm" = '2026-03-17'::timestamp)
  RETURNING id
)
INSERT INTO contratos (id, "empresaId", "oportunidadeId", "vendedorId", "nomeCliente", "valorTotal", status, "processoAdministrativoStatus", "criadoEm", "atualizadoEm", observacoes)
SELECT md5(random()::text || clock_timestamp()::text || '2026-03-17-ct'), v.empresa_id, no.id, v.usuario_id, 'Venda histórica — CB 300F VERMELHA', 28000.00, 'ATIVO', 'CONCLUIDO', '2026-03-17'::timestamp, now(), 'Importado do relatório de balanceamento comercial. Modelo: CB 300F VERMELHA · Banco: BV'
FROM nova_oportunidade no, v;

WITH v AS (
  SELECT id AS usuario_id, "empresaId" AS empresa_id FROM usuarios WHERE email = 'consultorwandersonmmnegocios@gmail.com' LIMIT 1
), nova_oportunidade AS (
  INSERT INTO oportunidades (id, "empresaId", "responsavelId", "nomeCliente", estagio, origem, valor, "statusFinal", "fechadaEm", "criadaEm", "atualizadaEm", observacoes)
  SELECT md5(random()::text || clock_timestamp()::text || '2026-03-20-op'), v.empresa_id, v.usuario_id, 'Venda histórica — R15', 'COMPRADO', 'SDR', 24900.00, 'COMPRADO', '2026-03-20'::timestamp, '2026-03-20'::timestamp, now(), 'Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: R15 · Banco: BV'
  FROM v
  WHERE NOT EXISTS (SELECT 1 FROM oportunidades WHERE "nomeCliente" = 'Venda histórica — R15' AND "criadaEm" = '2026-03-20'::timestamp)
  RETURNING id
)
INSERT INTO contratos (id, "empresaId", "oportunidadeId", "vendedorId", "nomeCliente", "valorTotal", status, "processoAdministrativoStatus", "criadoEm", "atualizadoEm", observacoes)
SELECT md5(random()::text || clock_timestamp()::text || '2026-03-20-ct'), v.empresa_id, no.id, v.usuario_id, 'Venda histórica — R15', 24900.00, 'ATIVO', 'CONCLUIDO', '2026-03-20'::timestamp, now(), 'Importado do relatório de balanceamento comercial. Modelo: R15 · Banco: BV'
FROM nova_oportunidade no, v;

WITH v AS (
  SELECT id AS usuario_id, "empresaId" AS empresa_id FROM usuarios WHERE email = 'consultorwandersonmmnegocios@gmail.com' LIMIT 1
), nova_oportunidade AS (
  INSERT INTO oportunidades (id, "empresaId", "responsavelId", "nomeCliente", estagio, origem, valor, "statusFinal", "fechadaEm", "criadaEm", "atualizadaEm", observacoes)
  SELECT md5(random()::text || clock_timestamp()::text || '2026-03-23-op'), v.empresa_id, v.usuario_id, 'Venda histórica — CB 300F VERMELHA 2', 'COMPRADO', 'SDR', 27000.00, 'COMPRADO', '2026-03-23'::timestamp, '2026-03-23'::timestamp, now(), 'Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: CB 300F VERMELHA 2 · Banco: PAN'
  FROM v
  WHERE NOT EXISTS (SELECT 1 FROM oportunidades WHERE "nomeCliente" = 'Venda histórica — CB 300F VERMELHA 2' AND "criadaEm" = '2026-03-23'::timestamp)
  RETURNING id
)
INSERT INTO contratos (id, "empresaId", "oportunidadeId", "vendedorId", "nomeCliente", "valorTotal", status, "processoAdministrativoStatus", "criadoEm", "atualizadoEm", observacoes)
SELECT md5(random()::text || clock_timestamp()::text || '2026-03-23-ct'), v.empresa_id, no.id, v.usuario_id, 'Venda histórica — CB 300F VERMELHA 2', 27000.00, 'ATIVO', 'CONCLUIDO', '2026-03-23'::timestamp, now(), 'Importado do relatório de balanceamento comercial. Modelo: CB 300F VERMELHA 2 · Banco: PAN'
FROM nova_oportunidade no, v;

WITH v AS (
  SELECT id AS usuario_id, "empresaId" AS empresa_id FROM usuarios WHERE email = 'consultorwandersonmmnegocios@gmail.com' LIMIT 1
), nova_oportunidade AS (
  INSERT INTO oportunidades (id, "empresaId", "responsavelId", "nomeCliente", estagio, origem, valor, "statusFinal", "fechadaEm", "criadaEm", "atualizadaEm", observacoes)
  SELECT md5(random()::text || clock_timestamp()::text || '2026-04-02-op'), v.empresa_id, v.usuario_id, 'Venda histórica — FAN 150 2021', 'COMPRADO', 'SDR', 18000.00, 'COMPRADO', '2026-04-02'::timestamp, '2026-04-02'::timestamp, now(), 'Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: FAN 150 2021 · Banco: PAN'
  FROM v
  WHERE NOT EXISTS (SELECT 1 FROM oportunidades WHERE "nomeCliente" = 'Venda histórica — FAN 150 2021' AND "criadaEm" = '2026-04-02'::timestamp)
  RETURNING id
)
INSERT INTO contratos (id, "empresaId", "oportunidadeId", "vendedorId", "nomeCliente", "valorTotal", status, "processoAdministrativoStatus", "criadoEm", "atualizadoEm", observacoes)
SELECT md5(random()::text || clock_timestamp()::text || '2026-04-02-ct'), v.empresa_id, no.id, v.usuario_id, 'Venda histórica — FAN 150 2021', 18000.00, 'ATIVO', 'CONCLUIDO', '2026-04-02'::timestamp, now(), 'Importado do relatório de balanceamento comercial. Modelo: FAN 150 2021 · Banco: PAN'
FROM nova_oportunidade no, v;

WITH v AS (
  SELECT id AS usuario_id, "empresaId" AS empresa_id FROM usuarios WHERE email = 'consultorwandersonmmnegocios@gmail.com' LIMIT 1
), nova_oportunidade AS (
  INSERT INTO oportunidades (id, "empresaId", "responsavelId", "nomeCliente", estagio, origem, valor, "statusFinal", "fechadaEm", "criadaEm", "atualizadaEm", observacoes)
  SELECT md5(random()::text || clock_timestamp()::text || '2026-04-07-op'), v.empresa_id, v.usuario_id, 'Venda histórica — TITAN LARANJA', 'COMPRADO', 'SDR', 26000.00, 'COMPRADO', '2026-04-07'::timestamp, '2026-04-07'::timestamp, now(), 'Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: TITAN LARANJA · Banco: SANTANDER'
  FROM v
  WHERE NOT EXISTS (SELECT 1 FROM oportunidades WHERE "nomeCliente" = 'Venda histórica — TITAN LARANJA' AND "criadaEm" = '2026-04-07'::timestamp)
  RETURNING id
)
INSERT INTO contratos (id, "empresaId", "oportunidadeId", "vendedorId", "nomeCliente", "valorTotal", status, "processoAdministrativoStatus", "criadoEm", "atualizadoEm", observacoes)
SELECT md5(random()::text || clock_timestamp()::text || '2026-04-07-ct'), v.empresa_id, no.id, v.usuario_id, 'Venda histórica — TITAN LARANJA', 26000.00, 'ATIVO', 'CONCLUIDO', '2026-04-07'::timestamp, now(), 'Importado do relatório de balanceamento comercial. Modelo: TITAN LARANJA · Banco: SANTANDER'
FROM nova_oportunidade no, v;

WITH v AS (
  SELECT id AS usuario_id, "empresaId" AS empresa_id FROM usuarios WHERE email = 'consultorwandersonmmnegocios@gmail.com' LIMIT 1
), nova_oportunidade AS (
  INSERT INTO oportunidades (id, "empresaId", "responsavelId", "nomeCliente", estagio, origem, valor, "statusFinal", "fechadaEm", "criadaEm", "atualizadaEm", observacoes)
  SELECT md5(random()::text || clock_timestamp()::text || '2026-04-12-op'), v.empresa_id, v.usuario_id, 'Venda histórica — MT 03', 'COMPRADO', 'SDR', 26000.00, 'COMPRADO', '2026-04-12'::timestamp, '2026-04-12'::timestamp, now(), 'Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: MT 03 · Banco: BV'
  FROM v
  WHERE NOT EXISTS (SELECT 1 FROM oportunidades WHERE "nomeCliente" = 'Venda histórica — MT 03' AND "criadaEm" = '2026-04-12'::timestamp)
  RETURNING id
)
INSERT INTO contratos (id, "empresaId", "oportunidadeId", "vendedorId", "nomeCliente", "valorTotal", status, "processoAdministrativoStatus", "criadoEm", "atualizadoEm", observacoes)
SELECT md5(random()::text || clock_timestamp()::text || '2026-04-12-ct'), v.empresa_id, no.id, v.usuario_id, 'Venda histórica — MT 03', 26000.00, 'ATIVO', 'CONCLUIDO', '2026-04-12'::timestamp, now(), 'Importado do relatório de balanceamento comercial. Modelo: MT 03 · Banco: BV'
FROM nova_oportunidade no, v;

WITH v AS (
  SELECT id AS usuario_id, "empresaId" AS empresa_id FROM usuarios WHERE email = 'consultorwandersonmmnegocios@gmail.com' LIMIT 1
), nova_oportunidade AS (
  INSERT INTO oportunidades (id, "empresaId", "responsavelId", "nomeCliente", estagio, origem, valor, "statusFinal", "fechadaEm", "criadaEm", "atualizadaEm", observacoes)
  SELECT md5(random()::text || clock_timestamp()::text || '2026-04-17-op'), v.empresa_id, v.usuario_id, 'Venda histórica — LANDER 250 PRETA', 'COMPRADO', 'SDR', 26000.00, 'COMPRADO', '2026-04-17'::timestamp, '2026-04-17'::timestamp, now(), 'Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: LANDER 250 PRETA · Banco: BV'
  FROM v
  WHERE NOT EXISTS (SELECT 1 FROM oportunidades WHERE "nomeCliente" = 'Venda histórica — LANDER 250 PRETA' AND "criadaEm" = '2026-04-17'::timestamp)
  RETURNING id
)
INSERT INTO contratos (id, "empresaId", "oportunidadeId", "vendedorId", "nomeCliente", "valorTotal", status, "processoAdministrativoStatus", "criadoEm", "atualizadoEm", observacoes)
SELECT md5(random()::text || clock_timestamp()::text || '2026-04-17-ct'), v.empresa_id, no.id, v.usuario_id, 'Venda histórica — LANDER 250 PRETA', 26000.00, 'ATIVO', 'CONCLUIDO', '2026-04-17'::timestamp, now(), 'Importado do relatório de balanceamento comercial. Modelo: LANDER 250 PRETA · Banco: BV'
FROM nova_oportunidade no, v;

WITH v AS (
  SELECT id AS usuario_id, "empresaId" AS empresa_id FROM usuarios WHERE email = 'consultorwandersonmmnegocios@gmail.com' LIMIT 1
), nova_oportunidade AS (
  INSERT INTO oportunidades (id, "empresaId", "responsavelId", "nomeCliente", estagio, origem, valor, "statusFinal", "fechadaEm", "criadaEm", "atualizadaEm", observacoes)
  SELECT md5(random()::text || clock_timestamp()::text || '2026-04-22-op'), v.empresa_id, v.usuario_id, 'Venda histórica — TITAN AZUL 2021', 'COMPRADO', 'SDR', 21000.00, 'COMPRADO', '2026-04-22'::timestamp, '2026-04-22'::timestamp, now(), 'Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: TITAN AZUL 2021 · Banco: SANTANDER'
  FROM v
  WHERE NOT EXISTS (SELECT 1 FROM oportunidades WHERE "nomeCliente" = 'Venda histórica — TITAN AZUL 2021' AND "criadaEm" = '2026-04-22'::timestamp)
  RETURNING id
)
INSERT INTO contratos (id, "empresaId", "oportunidadeId", "vendedorId", "nomeCliente", "valorTotal", status, "processoAdministrativoStatus", "criadoEm", "atualizadoEm", observacoes)
SELECT md5(random()::text || clock_timestamp()::text || '2026-04-22-ct'), v.empresa_id, no.id, v.usuario_id, 'Venda histórica — TITAN AZUL 2021', 21000.00, 'ATIVO', 'CONCLUIDO', '2026-04-22'::timestamp, now(), 'Importado do relatório de balanceamento comercial. Modelo: TITAN AZUL 2021 · Banco: SANTANDER'
FROM nova_oportunidade no, v;

WITH v AS (
  SELECT id AS usuario_id, "empresaId" AS empresa_id FROM usuarios WHERE email = 'consultorwandersonmmnegocios@gmail.com' LIMIT 1
), nova_oportunidade AS (
  INSERT INTO oportunidades (id, "empresaId", "responsavelId", "nomeCliente", estagio, origem, valor, "statusFinal", "fechadaEm", "criadaEm", "atualizadaEm", observacoes)
  SELECT md5(random()::text || clock_timestamp()::text || '2026-04-27-op'), v.empresa_id, v.usuario_id, 'Venda histórica — FZ 15 VERMELHA', 'COMPRADO', 'SDR', 26000.00, 'COMPRADO', '2026-04-27'::timestamp, '2026-04-27'::timestamp, now(), 'Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: FZ 15 VERMELHA · Banco: PAN'
  FROM v
  WHERE NOT EXISTS (SELECT 1 FROM oportunidades WHERE "nomeCliente" = 'Venda histórica — FZ 15 VERMELHA' AND "criadaEm" = '2026-04-27'::timestamp)
  RETURNING id
)
INSERT INTO contratos (id, "empresaId", "oportunidadeId", "vendedorId", "nomeCliente", "valorTotal", status, "processoAdministrativoStatus", "criadoEm", "atualizadoEm", observacoes)
SELECT md5(random()::text || clock_timestamp()::text || '2026-04-27-ct'), v.empresa_id, no.id, v.usuario_id, 'Venda histórica — FZ 15 VERMELHA', 26000.00, 'ATIVO', 'CONCLUIDO', '2026-04-27'::timestamp, now(), 'Importado do relatório de balanceamento comercial. Modelo: FZ 15 VERMELHA · Banco: PAN'
FROM nova_oportunidade no, v;

WITH v AS (
  SELECT id AS usuario_id, "empresaId" AS empresa_id FROM usuarios WHERE email = 'consultorwandersonmmnegocios@gmail.com' LIMIT 1
), nova_oportunidade AS (
  INSERT INTO oportunidades (id, "empresaId", "responsavelId", "nomeCliente", estagio, origem, valor, "statusFinal", "fechadaEm", "criadaEm", "atualizadaEm", observacoes)
  SELECT md5(random()::text || clock_timestamp()::text || '2026-05-08-op'), v.empresa_id, v.usuario_id, 'Venda histórica — BROS PRETA 2021', 'COMPRADO', 'SDR', 23900.00, 'COMPRADO', '2026-05-08'::timestamp, '2026-05-08'::timestamp, now(), 'Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: BROS PRETA 2021 · Banco: SANTANDER'
  FROM v
  WHERE NOT EXISTS (SELECT 1 FROM oportunidades WHERE "nomeCliente" = 'Venda histórica — BROS PRETA 2021' AND "criadaEm" = '2026-05-08'::timestamp)
  RETURNING id
)
INSERT INTO contratos (id, "empresaId", "oportunidadeId", "vendedorId", "nomeCliente", "valorTotal", status, "processoAdministrativoStatus", "criadoEm", "atualizadoEm", observacoes)
SELECT md5(random()::text || clock_timestamp()::text || '2026-05-08-ct'), v.empresa_id, no.id, v.usuario_id, 'Venda histórica — BROS PRETA 2021', 23900.00, 'ATIVO', 'CONCLUIDO', '2026-05-08'::timestamp, now(), 'Importado do relatório de balanceamento comercial. Modelo: BROS PRETA 2021 · Banco: SANTANDER'
FROM nova_oportunidade no, v;

WITH v AS (
  SELECT id AS usuario_id, "empresaId" AS empresa_id FROM usuarios WHERE email = 'consultorwandersonmmnegocios@gmail.com' LIMIT 1
), nova_oportunidade AS (
  INSERT INTO oportunidades (id, "empresaId", "responsavelId", "nomeCliente", estagio, origem, valor, "statusFinal", "fechadaEm", "criadaEm", "atualizadaEm", observacoes)
  SELECT md5(random()::text || clock_timestamp()::text || '2026-05-22-op'), v.empresa_id, v.usuario_id, 'Venda histórica — CB TWISTER 250', 'COMPRADO', 'SDR', 21000.00, 'COMPRADO', '2026-05-22'::timestamp, '2026-05-22'::timestamp, now(), 'Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: CB TWISTER 250 · Banco: SANTANDER'
  FROM v
  WHERE NOT EXISTS (SELECT 1 FROM oportunidades WHERE "nomeCliente" = 'Venda histórica — CB TWISTER 250' AND "criadaEm" = '2026-05-22'::timestamp)
  RETURNING id
)
INSERT INTO contratos (id, "empresaId", "oportunidadeId", "vendedorId", "nomeCliente", "valorTotal", status, "processoAdministrativoStatus", "criadoEm", "atualizadoEm", observacoes)
SELECT md5(random()::text || clock_timestamp()::text || '2026-05-22-ct'), v.empresa_id, no.id, v.usuario_id, 'Venda histórica — CB TWISTER 250', 21000.00, 'ATIVO', 'CONCLUIDO', '2026-05-22'::timestamp, now(), 'Importado do relatório de balanceamento comercial. Modelo: CB TWISTER 250 · Banco: SANTANDER'
FROM nova_oportunidade no, v;

WITH v AS (
  SELECT id AS usuario_id, "empresaId" AS empresa_id FROM usuarios WHERE email = 'consultorwandersonmmnegocios@gmail.com' LIMIT 1
), nova_oportunidade AS (
  INSERT INTO oportunidades (id, "empresaId", "responsavelId", "nomeCliente", estagio, origem, valor, "statusFinal", "fechadaEm", "criadaEm", "atualizadaEm", observacoes)
  SELECT md5(random()::text || clock_timestamp()::text || '2026-06-15-op'), v.empresa_id, v.usuario_id, 'Venda histórica — BROS AZUL 2021', 'COMPRADO', 'SDR', 22900.00, 'COMPRADO', '2026-06-15'::timestamp, '2026-06-15'::timestamp, now(), 'Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: BROS AZUL 2021 · Banco: PAN'
  FROM v
  WHERE NOT EXISTS (SELECT 1 FROM oportunidades WHERE "nomeCliente" = 'Venda histórica — BROS AZUL 2021' AND "criadaEm" = '2026-06-15'::timestamp)
  RETURNING id
)
INSERT INTO contratos (id, "empresaId", "oportunidadeId", "vendedorId", "nomeCliente", "valorTotal", status, "processoAdministrativoStatus", "criadoEm", "atualizadoEm", observacoes)
SELECT md5(random()::text || clock_timestamp()::text || '2026-06-15-ct'), v.empresa_id, no.id, v.usuario_id, 'Venda histórica — BROS AZUL 2021', 22900.00, 'ATIVO', 'CONCLUIDO', '2026-06-15'::timestamp, now(), 'Importado do relatório de balanceamento comercial. Modelo: BROS AZUL 2021 · Banco: PAN'
FROM nova_oportunidade no, v;

WITH v AS (
  SELECT id AS usuario_id, "empresaId" AS empresa_id FROM usuarios WHERE email = 'consultorwandersonmmnegocios@gmail.com' LIMIT 1
), nova_oportunidade AS (
  INSERT INTO oportunidades (id, "empresaId", "responsavelId", "nomeCliente", estagio, origem, valor, "statusFinal", "fechadaEm", "criadaEm", "atualizadaEm", observacoes)
  SELECT md5(random()::text || clock_timestamp()::text || '2026-07-15-op'), v.empresa_id, v.usuario_id, 'Venda histórica — CB 300F', 'COMPRADO', 'SDR', 28900.00, 'COMPRADO', '2026-07-15'::timestamp, '2026-07-15'::timestamp, now(), 'Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: CB 300F · Banco: PAN'
  FROM v
  WHERE NOT EXISTS (SELECT 1 FROM oportunidades WHERE "nomeCliente" = 'Venda histórica — CB 300F' AND "criadaEm" = '2026-07-15'::timestamp)
  RETURNING id
)
INSERT INTO contratos (id, "empresaId", "oportunidadeId", "vendedorId", "nomeCliente", "valorTotal", status, "processoAdministrativoStatus", "criadoEm", "atualizadoEm", observacoes)
SELECT md5(random()::text || clock_timestamp()::text || '2026-07-15-ct'), v.empresa_id, no.id, v.usuario_id, 'Venda histórica — CB 300F', 28900.00, 'ATIVO', 'CONCLUIDO', '2026-07-15'::timestamp, now(), 'Importado do relatório de balanceamento comercial. Modelo: CB 300F · Banco: PAN'
FROM nova_oportunidade no, v;

