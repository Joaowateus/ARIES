-- ARIES Disparo: "excluir" campanha = tirar da tela (listas e relatórios). Nada é apagado: a campanha,
-- as mensagens, os destinatários e a auditoria ficam no banco.
ALTER TABLE "pro_labore_disparo_campanhas" ADD COLUMN "excluidaEm" TIMESTAMP(3), ADD COLUMN "excluidaPorNome" TEXT;
