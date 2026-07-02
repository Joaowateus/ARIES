import { AprendizadoGerado } from '@soe/cap-08'
import { AlertaView } from './AlertaView'
import { DiagnosticoView } from './DiagnosticoView'
import { PlanoAcaoView } from './PlanoAcaoView'
import { DecisaoView } from './DecisaoView'

/**
 * TimelineView — rastreamento completo de um incidente operacional.
 *
 * Responde às 8 perguntas do Centro de Inteligência sem consultar múltiplos módulos:
 *   O que aconteceu? → alerta
 *   Por que aconteceu? → diagnostico.hipotesePrincipal
 *   Qual o impacto? → diagnostico.impactoFinanceiroEstimado
 *   Quem está responsável? → planoAcao.criadoPor + acoes[].responsavelId
 *   O que está sendo feito? → planoAcao.acoes
 *   Qual decisão foi tomada? → decisao.decisaoTomada
 *   Qual foi o resultado? → decisao.resultado
 *   O que o sistema aprendeu? → decisao.aprendizado
 */
export interface TimelineView {
  incidenteId: string           // diagnosticoId como chave do incidente
  titulo: string
  statusGlobal: 'ABERTO' | 'EM_TRATAMENTO' | 'RESOLVIDO' | 'DESCARTADO'
  alerta?: AlertaView           // KpiSnapshot que originou o diagnóstico
  diagnostico: DiagnosticoView
  planoAcao?: PlanoAcaoView
  decisao?: DecisaoView
  aprendizado?: AprendizadoGerado
}
