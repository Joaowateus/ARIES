-- Tela inicial do ARIES (17/11): tarefas e notas compartilhadas pela loja e as
-- preferências da tela (imagem de fundo e atalhos). Só acrescenta; excluir é
-- marcar "excluidaEm" (o registro fica para a auditoria).
ALTER TABLE "pro_labore_parametros" ADD COLUMN IF NOT EXISTS "inicioFundo" TEXT;
ALTER TABLE "pro_labore_parametros" ADD COLUMN IF NOT EXISTS "inicioAtalhos" JSONB;

CREATE TABLE IF NOT EXISTS "pro_labore_inicio_tarefas" (
  "id" TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "texto" TEXT NOT NULL,
  "feita" BOOLEAN NOT NULL DEFAULT false,
  "feitaEm" TIMESTAMP(3),
  "autorId" TEXT,
  "autorNome" TEXT,
  "excluidaEm" TIMESTAMP(3),
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pro_labore_inicio_tarefas_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "pro_labore_inicio_tarefas_usuario_idx" ON "pro_labore_inicio_tarefas"("usuarioId", "excluidaEm", "criadoEm");

CREATE TABLE IF NOT EXISTS "pro_labore_inicio_notas" (
  "id" TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "texto" TEXT NOT NULL DEFAULT '',
  "autorId" TEXT,
  "autorNome" TEXT,
  "excluidaEm" TIMESTAMP(3),
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pro_labore_inicio_notas_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "pro_labore_inicio_notas_usuario_idx" ON "pro_labore_inicio_notas"("usuarioId", "excluidaEm", "atualizadoEm");
