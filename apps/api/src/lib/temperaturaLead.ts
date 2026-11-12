// Temperatura do lead no CRM (Ajuste 2): diz quem merece atenção primeiro.
// Calculada só com o que o sistema já sabe (etapa, nota e etiquetas da
// conversa, há quanto tempo não há contato, follow atrasado). O vendedor
// pode fixar à mão; aí vale a dele até ele tirar.
export type Temperatura = 'FRIO' | 'MORNO' | 'QUENTE'

const BASE_ETAPA: Record<string, number> = { LEAD: 25, ABORDADO: 35, LEVANTAMENTO: 45, MQL: 55, SQL: 65, NEGOCIACAO: 65, PROPOSTA: 75, AGENDAMENTO: 85, VISITA: 90, VENDA: 90 }
const BASE_ESTAGIO: Record<string, number> = { LEAD: 25, ABORDADO: 35, NEGOCIACAO: 60, PROPOSTA: 75, FECHADO: 90 }

export interface LeadTemperatura {
  etapa?: string | null; estagio: string; pontuacao?: number | null; etiquetas?: string[]
  temperaturaManual?: string | null; entrouNaEtapaEm?: Date | null; criadoEm: Date
  ultimoContatoEm?: Date | null; followAtrasado?: boolean
}

export function temperaturaDoLead(l: LeadTemperatura, agora = new Date()): { valor: Temperatura; pontos: number; manual: boolean; motivo: string } {
  const base = l.etapa ? BASE_ETAPA[l.etapa] ?? 40 : BASE_ESTAGIO[l.estagio] ?? 40
  let pontos = l.pontuacao != null ? Math.round((base + l.pontuacao) / 2) : base
  const motivos: string[] = []
  const et = l.etiquetas ?? []
  if (et.includes('QUENTE')) { pontos += 15; motivos.push('conversa quente') }
  if (et.includes('PEDIU_VISITA')) { pontos += 10; motivos.push('pediu visita') }
  if (et.includes('PEDIU_SIMULACAO')) { pontos += 5; motivos.push('pediu simulação') }
  if (et.includes('SUMIU_24H')) { pontos -= 15; motivos.push('sumiu há 24 h') }
  const ref = l.ultimoContatoEm ?? l.entrouNaEtapaEm ?? l.criadoEm
  const dias = Math.max(0, Math.floor((agora.getTime() - new Date(ref).getTime()) / 86_400_000))
  if (dias <= 1) { pontos += 10; motivos.push(dias === 0 ? 'contato hoje' : 'contato ontem') }
  else if (dias > 14) { pontos -= 40; motivos.push(`${dias} dias sem contato`) }
  else if (dias > 7) { pontos -= 25; motivos.push(`${dias} dias sem contato`) }
  else if (dias > 3) { pontos -= 10; motivos.push(`${dias} dias sem contato`) }
  if (l.followAtrasado) motivos.push('follow atrasado')
  pontos = Math.max(0, Math.min(100, pontos))
  const calculada: Temperatura = pontos >= 65 ? 'QUENTE' : pontos >= 40 ? 'MORNO' : 'FRIO'
  const manual = l.temperaturaManual === 'FRIO' || l.temperaturaManual === 'MORNO' || l.temperaturaManual === 'QUENTE'
  return { valor: manual ? (l.temperaturaManual as Temperatura) : calculada, pontos, manual, motivo: manual ? `definida à mão (o sistema calcula ${calculada.toLowerCase()})` : motivos.join(' · ') || 'pela etapa' }
}
