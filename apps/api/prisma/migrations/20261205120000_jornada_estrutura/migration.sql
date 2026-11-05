-- ARIES 2.0 · PDF 01 · passo 3: estrutura de dados da nova jornada de compra.
-- Só acrescenta: nenhuma coluna ou tabela existente é apagada ou alterada de
-- tipo. As 5 etapas atuais continuam funcionando; a passagem para as 10
-- etapas é uma migração separada (passo 4), conferida antes de valer.

-- AlterTable
ALTER TABLE "pro_labore_parametros" ADD COLUMN     "jornadaCriteriosLevantamento" JSONB,
ADD COLUMN     "jornadaFaltasAtePerda" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "jornadaTemposMaximos" JSONB,
ADD COLUMN     "posVendaPrazos" JSONB;

-- AlterTable
ALTER TABLE "pro_labore_vendas" ADD COLUMN     "auditoriaAutor" TEXT,
ADD COLUMN     "canceladaEm" TIMESTAMP(3),
ADD COLUMN     "confirmadaEm" TIMESTAMP(3),
ADD COLUMN     "confirmadaPor" TEXT,
ADD COLUMN     "motivoCancelamento" TEXT,
ADD COLUMN     "situacao" TEXT NOT NULL DEFAULT 'CONFIRMADA';

-- AlterTable
ALTER TABLE "pro_labore_leads" ADD COLUMN     "anteriorMigracao" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "auditoriaAutor" TEXT,
ADD COLUMN     "clienteId" TEXT,
ADD COLUMN     "destinoPerda" TEXT,
ADD COLUMN     "entrouNaEtapaEm" TIMESTAMP(3),
ADD COLUMN     "estagioLegado" TEXT,
ADD COLUMN     "etapa" TEXT,
ADD COLUMN     "fase" TEXT,
ADD COLUMN     "formaPagamento" TEXT,
ADD COLUMN     "levantamentoCompleto" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "responsavelFechamentoId" TEXT,
ADD COLUMN     "responsavelQualificacaoId" TEXT,
ADD COLUMN     "revisarEtapa" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "situacaoCnh" TEXT,
ADD COLUMN     "temEntrada" BOOLEAN,
ADD COLUMN     "vendaSemVisita" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "pro_labore_lead_estagio_historico" ADD COLUMN     "autorId" TEXT,
ADD COLUMN     "autorNome" TEXT,
ADD COLUMN     "autorOrigem" TEXT,
ADD COLUMN     "saiuEm" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "pro_labore_agenda_itens" ADD COLUMN     "auditoriaAutor" TEXT;

-- AlterTable
ALTER TABLE "pro_labore_assistente_fichas_credito" ADD COLUMN     "auditoriaAutor" TEXT,
ADD COLUMN     "leadId" TEXT;

-- AlterTable
ALTER TABLE "pro_labore_assistente_analises_credito" ADD COLUMN     "auditoriaAutor" TEXT,
ADD COLUMN     "condicaoAprovada" TEXT,
ADD COLUMN     "enviadaEm" TIMESTAMP(3),
ADD COLUMN     "validadeAte" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "pro_labore_copiloto_sugestoes" ADD COLUMN     "auditoriaAutor" TEXT;

-- AlterTable
ALTER TABLE "pro_labore_lead_follows" ADD COLUMN     "auditoriaAutor" TEXT;

-- AlterTable
ALTER TABLE "pro_labore_ligacoes" ADD COLUMN     "auditoriaAutor" TEXT;

-- CreateTable
CREATE TABLE "pro_labore_clientes" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT,
    "email" TEXT,
    "endereco" TEXT,
    "bloqueado" BOOLEAN NOT NULL DEFAULT false,
    "bloqueadoEm" TIMESTAMP(3),
    "motivoBloqueio" TEXT,
    "auditoriaAutor" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_lead_propostas" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "preco" DOUBLE PRECISION NOT NULL,
    "entrada" DOUBLE PRECISION,
    "parcela" DOUBLE PRECISION,
    "prazo" INTEGER,
    "validade" TIMESTAMP(3),
    "enviadaEm" TIMESTAMP(3),
    "respondidaEm" TIMESTAMP(3),
    "resultado" TEXT,
    "autorId" TEXT,
    "auditoriaAutor" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_lead_propostas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_lead_visitas" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "vendedorId" TEXT,
    "marcadaPara" TIMESTAMP(3) NOT NULL,
    "confirmadaEm" TIMESTAMP(3),
    "checkinEm" TIMESTAMP(3),
    "falta" BOOLEAN NOT NULL DEFAULT false,
    "remarcacoes" INTEGER NOT NULL DEFAULT 0,
    "resultado" TEXT,
    "resultadoEm" TIMESTAMP(3),
    "auditoriaAutor" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_lead_visitas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_lead_passagens" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "sdrId" TEXT,
    "vendedorId" TEXT,
    "passadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resumo" TEXT,
    "devolvida" BOOLEAN NOT NULL DEFAULT false,
    "devolvidaEm" TIMESTAMP(3),
    "motivoDevolucao" TEXT,
    "auditoriaAutor" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_lead_passagens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_rodizio_leads" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "vendedorId" TEXT NOT NULL,
    "papel" TEXT NOT NULL,
    "disponivel" BOOLEAN NOT NULL DEFAULT true,
    "posicao" INTEGER NOT NULL DEFAULT 0,
    "ultimoRecebidoEm" TIMESTAMP(3),
    "auditoriaAutor" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_rodizio_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_acessos_dado_sensivel" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "leadId" TEXT,
    "fichaId" TEXT,
    "dado" TEXT NOT NULL,
    "quemId" TEXT NOT NULL,
    "quemNome" TEXT,
    "quemPapel" TEXT,
    "em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pro_labore_acessos_dado_sensivel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pro_labore_eventos_auditoria" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "tabela" TEXT NOT NULL,
    "registroId" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "campo" TEXT,
    "valorAnterior" TEXT,
    "valorNovo" TEXT,
    "autorOrigem" TEXT NOT NULL,
    "autorId" TEXT,
    "autorPapel" TEXT,
    "em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pro_labore_eventos_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pro_labore_clientes_usuarioId_idx" ON "pro_labore_clientes"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_clientes_usuarioId_telefone_key" ON "pro_labore_clientes"("usuarioId", "telefone");

-- CreateIndex
CREATE INDEX "pro_labore_lead_propostas_leadId_idx" ON "pro_labore_lead_propostas"("leadId");

-- CreateIndex
CREATE INDEX "pro_labore_lead_propostas_usuarioId_criadoEm_idx" ON "pro_labore_lead_propostas"("usuarioId", "criadoEm");

-- CreateIndex
CREATE INDEX "pro_labore_lead_visitas_leadId_idx" ON "pro_labore_lead_visitas"("leadId");

-- CreateIndex
CREATE INDEX "pro_labore_lead_visitas_usuarioId_marcadaPara_idx" ON "pro_labore_lead_visitas"("usuarioId", "marcadaPara");

-- CreateIndex
CREATE INDEX "pro_labore_lead_passagens_leadId_idx" ON "pro_labore_lead_passagens"("leadId");

-- CreateIndex
CREATE INDEX "pro_labore_lead_passagens_usuarioId_passadaEm_idx" ON "pro_labore_lead_passagens"("usuarioId", "passadaEm");

-- CreateIndex
CREATE INDEX "pro_labore_rodizio_leads_usuarioId_papel_idx" ON "pro_labore_rodizio_leads"("usuarioId", "papel");

-- CreateIndex
CREATE UNIQUE INDEX "pro_labore_rodizio_leads_vendedorId_papel_key" ON "pro_labore_rodizio_leads"("vendedorId", "papel");

-- CreateIndex
CREATE INDEX "pro_labore_acessos_dado_sensivel_usuarioId_em_idx" ON "pro_labore_acessos_dado_sensivel"("usuarioId", "em");

-- CreateIndex
CREATE INDEX "pro_labore_acessos_dado_sensivel_leadId_idx" ON "pro_labore_acessos_dado_sensivel"("leadId");

-- CreateIndex
CREATE INDEX "pro_labore_eventos_auditoria_tabela_registroId_em_idx" ON "pro_labore_eventos_auditoria"("tabela", "registroId", "em");

-- CreateIndex
CREATE INDEX "pro_labore_eventos_auditoria_em_idx" ON "pro_labore_eventos_auditoria"("em");

-- CreateIndex
CREATE INDEX "pro_labore_leads_usuarioId_etapa_idx" ON "pro_labore_leads"("usuarioId", "etapa");

-- CreateIndex
CREATE INDEX "pro_labore_leads_clienteId_idx" ON "pro_labore_leads"("clienteId");

-- CreateIndex
CREATE INDEX "pro_labore_leads_responsavelQualificacaoId_idx" ON "pro_labore_leads"("responsavelQualificacaoId");

-- CreateIndex
CREATE INDEX "pro_labore_leads_responsavelFechamentoId_idx" ON "pro_labore_leads"("responsavelFechamentoId");

-- CreateIndex
CREATE INDEX "pro_labore_assistente_fichas_credito_leadId_idx" ON "pro_labore_assistente_fichas_credito"("leadId");

-- AddForeignKey
ALTER TABLE "pro_labore_leads" ADD CONSTRAINT "pro_labore_leads_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "pro_labore_clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_leads" ADD CONSTRAINT "pro_labore_leads_responsavelQualificacaoId_fkey" FOREIGN KEY ("responsavelQualificacaoId") REFERENCES "pro_labore_vendedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_leads" ADD CONSTRAINT "pro_labore_leads_responsavelFechamentoId_fkey" FOREIGN KEY ("responsavelFechamentoId") REFERENCES "pro_labore_vendedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_assistente_fichas_credito" ADD CONSTRAINT "pro_labore_assistente_fichas_credito_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "pro_labore_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_lead_propostas" ADD CONSTRAINT "pro_labore_lead_propostas_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "pro_labore_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_lead_visitas" ADD CONSTRAINT "pro_labore_lead_visitas_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "pro_labore_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pro_labore_lead_passagens" ADD CONSTRAINT "pro_labore_lead_passagens_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "pro_labore_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------
-- Preenchimentos (antes dos gatilhos de auditoria, para não gerar eventos)
-- ---------------------------------------------------------------------

-- Toda venda já registrada é tratada como confirmada (decisão aprovada).
UPDATE "pro_labore_vendas" SET "confirmadaEm" = "criadoEm" WHERE "situacao" = 'CONFIRMADA' AND "confirmadaEm" IS NULL;

-- Histórico de etapas: a saída de cada registro é a entrada do seguinte.
UPDATE "pro_labore_lead_estagio_historico" h SET "saiuEm" = s.prox
FROM (
  SELECT id, LEAD("criadoEm") OVER (PARTITION BY "leadId" ORDER BY "criadoEm", id) AS prox
  FROM "pro_labore_lead_estagio_historico"
) s
WHERE s.id = h.id AND s.prox IS NOT NULL;
UPDATE "pro_labore_lead_estagio_historico" SET "autorOrigem" = CASE WHEN "origem" = 'ASSISTENTE' THEN 'AUTOMACAO' ELSE 'USUARIO' END WHERE "autorOrigem" IS NULL;

-- Ficha de crédito ligada à oportunidade da conversa.
UPDATE "pro_labore_assistente_fichas_credito" f SET "leadId" = c."leadId"
FROM "pro_labore_assistente_conversas" c
WHERE c.id = f."conversaId" AND f."leadId" IS NULL AND c."leadId" IS NOT NULL
  AND EXISTS (SELECT 1 FROM "pro_labore_leads" l WHERE l.id = c."leadId");

-- Prazos do Pós-venda aprovados (dias a partir da confirmação).
UPDATE "pro_labore_parametros" SET "posVendaPrazos" = '{"entrega":3,"documentacao":15,"primeiraRevisao":180}'::jsonb WHERE "posVendaPrazos" IS NULL;

-- ---------------------------------------------------------------------
-- Auditoria imutável (PDF 00, P5)
-- ---------------------------------------------------------------------
-- O próprio banco grava um evento por campo alterado. O autor vem da coluna
-- "auditoriaAutor", preenchida pelo sistema a cada escrita
-- ("ORIGEM|id|papel|marca"); escrita sem autor novo fica como SISTEMA.
-- CPF e data de nascimento entram mascarados.
CREATE OR REPLACE FUNCTION aries_auditar() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE
  antes jsonb;
  depois jsonb;
  k text;
  autor text;
  partes text[];
  reg text;
  ignorar text[] := ARRAY['atualizadoEm', 'auditoriaAutor'];
  sensiveis text[] := ARRAY['cpf', 'nascimento'];
  va text;
  vn text;
BEGIN
  IF current_setting('aries.sem_auditoria', true) = '1' THEN RETURN NULL; END IF;
  IF TG_OP <> 'INSERT' THEN antes := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN depois := to_jsonb(NEW); END IF;
  IF TG_OP = 'DELETE' THEN
    autor := NULLIF(current_setting('aries.autor', true), '');
  ELSIF TG_OP = 'UPDATE' AND (depois ->> 'auditoriaAutor') IS NOT DISTINCT FROM (antes ->> 'auditoriaAutor') THEN
    autor := NULL;
  ELSE
    autor := depois ->> 'auditoriaAutor';
  END IF;
  partes := string_to_array(COALESCE(autor, 'SISTEMA'), '|');
  reg := COALESCE(depois ->> 'id', antes ->> 'id');
  IF TG_OP <> 'UPDATE' THEN
    FOREACH k IN ARRAY sensiveis LOOP
      IF antes IS NOT NULL AND (antes ->> k) IS NOT NULL THEN antes := jsonb_set(antes, ARRAY[k], '"***"'); END IF;
      IF depois IS NOT NULL AND (depois ->> k) IS NOT NULL THEN depois := jsonb_set(depois, ARRAY[k], '"***"'); END IF;
    END LOOP;
  END IF;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO "pro_labore_eventos_auditoria" ("tabela", "registroId", "acao", "valorNovo", "autorOrigem", "autorId", "autorPapel")
    VALUES (TG_TABLE_NAME, reg, 'CRIACAO', (depois - ignorar)::text, partes[1], NULLIF(partes[2], ''), NULLIF(partes[3], ''));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO "pro_labore_eventos_auditoria" ("tabela", "registroId", "acao", "valorAnterior", "autorOrigem", "autorId", "autorPapel")
    VALUES (TG_TABLE_NAME, reg, 'EXCLUSAO', (antes - ignorar)::text, partes[1], NULLIF(partes[2], ''), NULLIF(partes[3], ''));
  ELSE
    FOR k IN SELECT jsonb_object_keys(depois) LOOP
      CONTINUE WHEN k = ANY(ignorar);
      IF (antes -> k) IS DISTINCT FROM (depois -> k) THEN
        va := antes ->> k;
        vn := depois ->> k;
        IF k = ANY(sensiveis) THEN
          va := CASE WHEN va IS NULL THEN NULL ELSE '***' END;
          vn := CASE WHEN vn IS NULL THEN NULL ELSE '***' END;
        END IF;
        INSERT INTO "pro_labore_eventos_auditoria" ("tabela", "registroId", "acao", "campo", "valorAnterior", "valorNovo", "autorOrigem", "autorId", "autorPapel")
        VALUES (TG_TABLE_NAME, reg, 'ALTERACAO', k, va, vn, partes[1], NULLIF(partes[2], ''), NULLIF(partes[3], ''));
      END IF;
    END LOOP;
  END IF;
  RETURN NULL;
END
$fn$;

CREATE OR REPLACE FUNCTION aries_imutavel() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  RAISE EXCEPTION 'Registro de auditoria não pode ser alterado nem apagado (%)', TG_TABLE_NAME;
END
$fn$;

CREATE TRIGGER aries_imutavel BEFORE UPDATE OR DELETE ON "pro_labore_eventos_auditoria" FOR EACH ROW EXECUTE FUNCTION aries_imutavel();
CREATE TRIGGER aries_imutavel BEFORE UPDATE OR DELETE ON "pro_labore_acessos_dado_sensivel" FOR EACH ROW EXECUTE FUNCTION aries_imutavel();

CREATE TRIGGER aries_auditar AFTER INSERT OR UPDATE OR DELETE ON "pro_labore_clientes" FOR EACH ROW EXECUTE FUNCTION aries_auditar();
CREATE TRIGGER aries_auditar AFTER INSERT OR UPDATE OR DELETE ON "pro_labore_leads" FOR EACH ROW EXECUTE FUNCTION aries_auditar();
CREATE TRIGGER aries_auditar AFTER INSERT OR UPDATE OR DELETE ON "pro_labore_lead_follows" FOR EACH ROW EXECUTE FUNCTION aries_auditar();
CREATE TRIGGER aries_auditar AFTER INSERT OR UPDATE OR DELETE ON "pro_labore_ligacoes" FOR EACH ROW EXECUTE FUNCTION aries_auditar();
CREATE TRIGGER aries_auditar AFTER INSERT OR UPDATE OR DELETE ON "pro_labore_agenda_itens" FOR EACH ROW EXECUTE FUNCTION aries_auditar();
CREATE TRIGGER aries_auditar AFTER INSERT OR UPDATE OR DELETE ON "pro_labore_copiloto_sugestoes" FOR EACH ROW EXECUTE FUNCTION aries_auditar();
CREATE TRIGGER aries_auditar AFTER INSERT OR UPDATE OR DELETE ON "pro_labore_assistente_fichas_credito" FOR EACH ROW EXECUTE FUNCTION aries_auditar();
CREATE TRIGGER aries_auditar AFTER INSERT OR UPDATE OR DELETE ON "pro_labore_assistente_analises_credito" FOR EACH ROW EXECUTE FUNCTION aries_auditar();
CREATE TRIGGER aries_auditar AFTER INSERT OR UPDATE OR DELETE ON "pro_labore_lead_propostas" FOR EACH ROW EXECUTE FUNCTION aries_auditar();
CREATE TRIGGER aries_auditar AFTER INSERT OR UPDATE OR DELETE ON "pro_labore_lead_visitas" FOR EACH ROW EXECUTE FUNCTION aries_auditar();
CREATE TRIGGER aries_auditar AFTER INSERT OR UPDATE OR DELETE ON "pro_labore_lead_passagens" FOR EACH ROW EXECUTE FUNCTION aries_auditar();
CREATE TRIGGER aries_auditar AFTER INSERT OR UPDATE OR DELETE ON "pro_labore_rodizio_leads" FOR EACH ROW EXECUTE FUNCTION aries_auditar();
CREATE TRIGGER aries_auditar AFTER INSERT OR UPDATE OR DELETE ON "pro_labore_vendas" FOR EACH ROW EXECUTE FUNCTION aries_auditar();
