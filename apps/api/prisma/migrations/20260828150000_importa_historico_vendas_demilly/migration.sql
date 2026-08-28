-- Importa o histórico real de vendas da Demilly (jul/2026), extraído do
-- relatório de balanceamento comercial (BALANCEAMENTO.pdf) — mesmo padrão
-- usado pro Wanderson, Ellen, Naiza e Edricia: só alimenta a produção do
-- vendedor (Meu Painel: quantidade, faturamento, balanceamento mês a mês),
-- não cria EstagioHistorico, porque a fonte não tem a jornada do lead (só
-- mês do fechamento). Sem nome de cliente na fonte: usa um rótulo claro de
-- venda histórica em vez de inventar uma pessoa.
--
-- É condicional (CTE "v" busca o usuário pelo e-mail real da Demilly) e
-- vira no-op silencioso em qualquer banco onde essa conta não existir — só
-- popula de fato em produção.

WITH v AS (
  SELECT id AS usuario_id, "empresaId" AS empresa_id FROM usuarios WHERE email = 'consultorademillymmnegocios@gmail.com' LIMIT 1
), nova_oportunidade AS (
  INSERT INTO oportunidades (id, "empresaId", "responsavelId", "nomeCliente", estagio, origem, valor, "statusFinal", "fechadaEm", "criadaEm", "atualizadaEm", observacoes)
  SELECT md5(random()::text || clock_timestamp()::text || '2026-07-20-op'), v.empresa_id, v.usuario_id, 'Venda histórica — FZ 25 CINZA', 'COMPRADO', 'SDR', 27900.00, 'COMPRADO', '2026-07-20'::timestamp, '2026-07-20'::timestamp, now(), 'Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: FZ 25 CINZA · Banco: PAN'
  FROM v
  WHERE NOT EXISTS (SELECT 1 FROM oportunidades WHERE "nomeCliente" = 'Venda histórica — FZ 25 CINZA' AND "criadaEm" = '2026-07-20'::timestamp)
  RETURNING id
)
INSERT INTO contratos (id, "empresaId", "oportunidadeId", "vendedorId", "nomeCliente", "valorTotal", status, "processoAdministrativoStatus", "criadoEm", "atualizadoEm", observacoes)
SELECT md5(random()::text || clock_timestamp()::text || '2026-07-20-ct'), v.empresa_id, no.id, v.usuario_id, 'Venda histórica — FZ 25 CINZA', 27900.00, 'ATIVO', 'CONCLUIDO', '2026-07-20'::timestamp, now(), 'Importado do relatório de balanceamento comercial. Modelo: FZ 25 CINZA · Banco: PAN'
FROM nova_oportunidade no, v;
