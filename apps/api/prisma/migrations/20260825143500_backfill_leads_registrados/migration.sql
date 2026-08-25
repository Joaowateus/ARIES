-- Preenche leads_registrados com todo lead que já existe hoje (inclusive o
-- histórico real do Wanderson importado do relatório de balanceamento), pra
-- o contador começar refletindo o que já aconteceu, em vez de zerado.
-- Idempotente: WHERE NOT EXISTS evita duplicar se rodar mais de uma vez.
INSERT INTO leads_registrados (id, "empresaId", "usuarioId", "criadoEm")
SELECT md5(random()::text || clock_timestamp()::text || o.id), o."empresaId", o."responsavelId", o."criadaEm"
FROM oportunidades o
WHERE o."responsavelId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM leads_registrados lr
    WHERE lr."empresaId" = o."empresaId" AND lr."usuarioId" = o."responsavelId" AND lr."criadoEm" = o."criadaEm"
  );
