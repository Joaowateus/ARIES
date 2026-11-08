-- PDF 02 · ATV: registro apagado na tela atual (ex.: lead excluído) não some
-- da ATV; a atividade pendente vira cancelada e a régua para.
CREATE OR REPLACE FUNCTION aries_atv_origem_apagada() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  UPDATE "pro_labore_atividades" SET
    "status" = CASE WHEN "status" = 'PENDENTE' THEN 'CANCELADA' ELSE "status" END,
    "resultado" = CASE WHEN "status" = 'PENDENTE' THEN 'Registro apagado na tela atual' ELSE "resultado" END,
    "reguaEstado" = 'PARADA', "auditoriaAutor" = 'SISTEMA|||origem apagada', "atualizadoEm" = now()
  WHERE "registroTabela" = TG_TABLE_NAME AND "registroId" = OLD."id";
  RETURN NULL;
END
$fn$;
CREATE TRIGGER aries_atv_apagada AFTER DELETE ON "pro_labore_lead_follows" FOR EACH ROW EXECUTE FUNCTION aries_atv_origem_apagada();
CREATE TRIGGER aries_atv_apagada AFTER DELETE ON "pro_labore_ligacoes" FOR EACH ROW EXECUTE FUNCTION aries_atv_origem_apagada();
CREATE TRIGGER aries_atv_apagada AFTER DELETE ON "pro_labore_assistente_mensagens" FOR EACH ROW EXECUTE FUNCTION aries_atv_origem_apagada();
