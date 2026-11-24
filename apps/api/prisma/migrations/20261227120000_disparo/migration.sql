-- ARIES DISPARO — central de campanhas e distribuição de mensagens (WhatsApp).
-- Só cria tabelas novas; nenhuma tabela existente é alterada (as chaves estrangeiras para
-- Lead, Cliente e AssistenteComercial ficam do lado das tabelas novas, com ON DELETE SET NULL).
-- Eventos, tentativas e autorizações são imutáveis (gatilho aries_imutavel, já existente).

CREATE TABLE "pro_labore_disparo_campanhas" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "objetivo" TEXT,
    "finalidade" TEXT NOT NULL DEFAULT 'MARKETING',
    "canal" TEXT NOT NULL DEFAULT 'WHATSAPP',
    "assistenteId" TEXT,
    "publicoId" TEXT,
    "publico" JSONB NOT NULL,
    "conteudo" JSONB NOT NULL,
    "config" JSONB NOT NULL,
    "agendadaPara" TIMESTAMP(3),
    "recorrencia" JSONB,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "versao" INTEGER NOT NULL DEFAULT 1,
    "responsavelId" TEXT,
    "responsavelNome" TEXT,
    "criadoPorId" TEXT,
    "criadoPorNome" TEXT,
    "aprovadoPorNome" TEXT,
    "aprovadoEm" TIMESTAMP(3),
    "preparadaEm" TIMESTAMP(3),
    "iniciadaEm" TIMESTAMP(3),
    "pausadaEm" TIMESTAMP(3),
    "concluidaEm" TIMESTAMP(3),
    "canceladaEm" TIMESTAMP(3),
    "origemId" TEXT,
    "totais" JSONB,
    "preparo" JSONB,
    "erro" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_disparo_campanhas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pro_labore_disparo_campanha_versoes" (
    "id" TEXT NOT NULL,
    "campanhaId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "publico" JSONB NOT NULL,
    "conteudo" JSONB NOT NULL,
    "config" JSONB NOT NULL,
    "autorNome" TEXT,
    "motivo" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pro_labore_disparo_campanha_versoes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pro_labore_disparo_publicos" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "definicao" JSONB NOT NULL,
    "criadoPorNome" TEXT,
    "arquivadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_disparo_publicos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pro_labore_disparo_destinatarios" (
    "id" TEXT NOT NULL,
    "campanhaId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "nome" TEXT,
    "leadId" TEXT,
    "clienteId" TEXT,
    "conversaId" TEXT,
    "vendedorId" TEXT,
    "dados" JSONB,
    "status" TEXT NOT NULL DEFAULT 'ELEGIVEL',
    "motivoExclusao" TEXT,
    "passoAtual" INTEGER NOT NULL DEFAULT 0,
    "interrompidoPor" TEXT,
    "respondeuEm" TIMESTAMP(3),
    "respostaConversaId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_disparo_destinatarios_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pro_labore_disparo_mensagens" (
    "id" TEXT NOT NULL,
    "campanhaId" TEXT NOT NULL,
    "destinatarioId" TEXT NOT NULL,
    "passo" INTEGER NOT NULL,
    "chave" TEXT NOT NULL,
    "assistenteId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'TEXTO',
    "texto" TEXT,
    "midiaId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AGENDADA',
    "enviarApos" TIMESTAMP(3) NOT NULL,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "proximaTentativaEm" TIMESTAMP(3),
    "travadaEm" TIMESTAMP(3),
    "providerId" TEXT,
    "ultimoErro" TEXT,
    "erroClasse" TEXT,
    "aceitaEm" TIMESTAMP(3),
    "entregueEm" TIMESTAMP(3),
    "lidaEm" TIMESTAMP(3),
    "falhouEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_disparo_mensagens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pro_labore_disparo_tentativas" (
    "id" TEXT NOT NULL,
    "mensagemId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fim" TIMESTAMP(3),
    "resultado" TEXT NOT NULL,
    "erro" TEXT,
    "codigo" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pro_labore_disparo_tentativas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pro_labore_disparo_eventos" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "campanhaId" TEXT,
    "destinatarioId" TEXT,
    "mensagemId" TEXT,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT,
    "dados" JSONB,
    "autorNome" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pro_labore_disparo_eventos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pro_labore_disparo_modelos" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "conteudo" JSONB NOT NULL,
    "criadoPorNome" TEXT,
    "arquivadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_disparo_modelos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pro_labore_disparo_midias" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "blobUrl" TEXT,
    "blobAcesso" TEXT,
    "dados" BYTEA,
    "criadoPorNome" TEXT,
    "arquivadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pro_labore_disparo_midias_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pro_labore_contato_autorizacoes" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "canal" TEXT NOT NULL DEFAULT 'WHATSAPP',
    "finalidade" TEXT NOT NULL DEFAULT 'MARKETING',
    "situacao" TEXT NOT NULL,
    "baseLegal" TEXT,
    "evidencia" TEXT,
    "origem" TEXT NOT NULL,
    "leadId" TEXT,
    "registradoPorNome" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pro_labore_contato_autorizacoes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pro_labore_disparo_config" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pro_labore_disparo_config_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pro_labore_disparo_campanhas_usuarioId_status_idx" ON "pro_labore_disparo_campanhas"("usuarioId", "status");

CREATE INDEX "pro_labore_disparo_campanhas_status_agendadaPara_idx" ON "pro_labore_disparo_campanhas"("status", "agendadaPara");

CREATE UNIQUE INDEX "pro_labore_disparo_campanha_versoes_campanhaId_versao_key" ON "pro_labore_disparo_campanha_versoes"("campanhaId", "versao");

CREATE INDEX "pro_labore_disparo_publicos_usuarioId_idx" ON "pro_labore_disparo_publicos"("usuarioId");

CREATE INDEX "pro_labore_disparo_destinatarios_campanhaId_status_idx" ON "pro_labore_disparo_destinatarios"("campanhaId", "status");

CREATE INDEX "pro_labore_disparo_destinatarios_usuarioId_telefone_idx" ON "pro_labore_disparo_destinatarios"("usuarioId", "telefone");

CREATE INDEX "pro_labore_disparo_destinatarios_leadId_idx" ON "pro_labore_disparo_destinatarios"("leadId");

CREATE UNIQUE INDEX "pro_labore_disparo_destinatarios_campanhaId_versao_telefone_key" ON "pro_labore_disparo_destinatarios"("campanhaId", "versao", "telefone");

CREATE UNIQUE INDEX "pro_labore_disparo_mensagens_chave_key" ON "pro_labore_disparo_mensagens"("chave");

CREATE UNIQUE INDEX "pro_labore_disparo_mensagens_providerId_key" ON "pro_labore_disparo_mensagens"("providerId");

CREATE INDEX "pro_labore_disparo_mensagens_status_enviarApos_idx" ON "pro_labore_disparo_mensagens"("status", "enviarApos");

CREATE INDEX "pro_labore_disparo_mensagens_campanhaId_status_idx" ON "pro_labore_disparo_mensagens"("campanhaId", "status");

CREATE INDEX "pro_labore_disparo_mensagens_assistenteId_status_idx" ON "pro_labore_disparo_mensagens"("assistenteId", "status");

CREATE INDEX "pro_labore_disparo_mensagens_destinatarioId_idx" ON "pro_labore_disparo_mensagens"("destinatarioId");

CREATE INDEX "pro_labore_disparo_tentativas_mensagemId_idx" ON "pro_labore_disparo_tentativas"("mensagemId");

CREATE INDEX "pro_labore_disparo_eventos_campanhaId_criadoEm_idx" ON "pro_labore_disparo_eventos"("campanhaId", "criadoEm");

CREATE INDEX "pro_labore_disparo_eventos_usuarioId_criadoEm_idx" ON "pro_labore_disparo_eventos"("usuarioId", "criadoEm");

CREATE INDEX "pro_labore_disparo_eventos_destinatarioId_idx" ON "pro_labore_disparo_eventos"("destinatarioId");

CREATE INDEX "pro_labore_disparo_modelos_usuarioId_idx" ON "pro_labore_disparo_modelos"("usuarioId");

CREATE INDEX "pro_labore_disparo_midias_usuarioId_idx" ON "pro_labore_disparo_midias"("usuarioId");

CREATE INDEX "pro_labore_contato_autorizacoes_usuarioId_telefone_criadoEm_idx" ON "pro_labore_contato_autorizacoes"("usuarioId", "telefone", "criadoEm");

CREATE UNIQUE INDEX "pro_labore_disparo_config_usuarioId_key" ON "pro_labore_disparo_config"("usuarioId");

ALTER TABLE "pro_labore_disparo_campanhas" ADD CONSTRAINT "pro_labore_disparo_campanhas_assistenteId_fkey" FOREIGN KEY ("assistenteId") REFERENCES "pro_labore_assistente_comercial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "pro_labore_disparo_campanha_versoes" ADD CONSTRAINT "pro_labore_disparo_campanha_versoes_campanhaId_fkey" FOREIGN KEY ("campanhaId") REFERENCES "pro_labore_disparo_campanhas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pro_labore_disparo_destinatarios" ADD CONSTRAINT "pro_labore_disparo_destinatarios_campanhaId_fkey" FOREIGN KEY ("campanhaId") REFERENCES "pro_labore_disparo_campanhas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pro_labore_disparo_destinatarios" ADD CONSTRAINT "pro_labore_disparo_destinatarios_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "pro_labore_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "pro_labore_disparo_destinatarios" ADD CONSTRAINT "pro_labore_disparo_destinatarios_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "pro_labore_clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "pro_labore_disparo_mensagens" ADD CONSTRAINT "pro_labore_disparo_mensagens_campanhaId_fkey" FOREIGN KEY ("campanhaId") REFERENCES "pro_labore_disparo_campanhas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pro_labore_disparo_mensagens" ADD CONSTRAINT "pro_labore_disparo_mensagens_destinatarioId_fkey" FOREIGN KEY ("destinatarioId") REFERENCES "pro_labore_disparo_destinatarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pro_labore_disparo_tentativas" ADD CONSTRAINT "pro_labore_disparo_tentativas_mensagemId_fkey" FOREIGN KEY ("mensagemId") REFERENCES "pro_labore_disparo_mensagens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Linha do tempo, tentativas e autorizações: só se acrescenta (auditoria intacta).
CREATE TRIGGER aries_imutavel BEFORE UPDATE OR DELETE ON "pro_labore_disparo_eventos" FOR EACH ROW EXECUTE FUNCTION aries_imutavel();
CREATE TRIGGER aries_imutavel BEFORE DELETE ON "pro_labore_disparo_tentativas" FOR EACH ROW EXECUTE FUNCTION aries_imutavel();
CREATE TRIGGER aries_imutavel BEFORE UPDATE OR DELETE ON "pro_labore_contato_autorizacoes" FOR EACH ROW EXECUTE FUNCTION aries_imutavel();
