// Números do painel do Assistente Comercial — só conversas de LEAD que
// começaram no período. Tudo é contagem direta do que aconteceu nas
// conversas registradas; nada estimado.

import { diaBrasilia } from './socialMediaSync'
import type { ConfigAssistente } from './assistenteRoteiro'

const HORAS_ABANDONO = 24
const ESTAGIOS_CRM = ['LEAD', 'ABORDADO', 'NEGOCIACAO', 'PROPOSTA', 'FECHADO', 'PERDIDO'] as const

export interface ConversaResumo {
  criadoEm: Date
  status: string
  resultado: string | null
  origem: string | null
  etapaRoteiro: number
  ultimaMensagemEm: Date
  aguardandoVendedorEm: Date | null
  assumidaEm: Date | null
  leadId: string | null
  lead: { estagio: string } | null
}

function chaveDia(d: Date): string {
  return diaBrasilia(d).toISOString().slice(0, 10)
}

function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null
  const v = [...valores].sort((a, b) => a - b)
  const m = Math.floor(v.length / 2)
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2
}

export function montarResumoAssistente({ conversas, aguardandoAgora, dias, inicioDia, cfg }: {
  conversas: ConversaResumo[]
  aguardandoAgora: number
  dias: number
  inicioDia: Date
  cfg: ConfigAssistente
}) {
  const agora = Date.now()
  const conta = (f: (c: ConversaResumo) => boolean) => conversas.filter(f).length
  const concluiu = (c: ConversaResumo) => c.resultado === 'QUALIFICADO' || c.resultado === 'PEDIU_ATENDENTE'
  const parada = (c: ConversaResumo) => c.status === 'ATIVA' && agora - c.ultimaMensagemEm.getTime() >= HORAS_ABANDONO * 3_600_000

  const atendidos = conversas.length
  const concluidos = conta(concluiu)

  // Tempo entre o assistente passar a conversa e o vendedor responder.
  const esperas = conversas
    .filter(c => c.aguardandoVendedorEm && c.assumidaEm && c.assumidaEm >= c.aguardandoVendedorEm)
    .map(c => (c.assumidaEm!.getTime() - c.aguardandoVendedorEm!.getTime()) / 60_000)

  const origens = ['ANUNCIO', 'GATILHO', 'CONTATO_NOVO'].map(origem => {
    const grupo = conversas.filter(c => c.origem === origem)
    return { origem, total: grupo.length, concluidos: grupo.filter(concluiu).length }
  })

  // Funil do roteiro: quantos responderam cada pergunta. `etapaRoteiro` é a
  // pergunta que estava esperando resposta quando a conversa parou.
  const funilRoteiro = [
    { rotulo: 'Começaram a conversa', total: atendidos },
    ...cfg.perguntas.map((p, i) => ({ rotulo: p.rotulo, total: conta(c => c.etapaRoteiro > i || c.resultado === 'QUALIFICADO') })),
  ]

  const comLead = conversas.filter(c => c.lead)
  const funilCrm = ESTAGIOS_CRM.map(estagio => ({ estagio, total: comLead.filter(c => c.lead!.estagio === estagio).length }))

  const serie: Array<{ data: string; atendidos: number; concluidos: number }> = []
  const indice = new Map<string, number>()
  for (let i = 0; i < dias; i++) {
    const data = new Date(inicioDia.getTime() + i * 86_400_000).toISOString().slice(0, 10)
    indice.set(data, serie.length)
    serie.push({ data, atendidos: 0, concluidos: 0 })
  }
  const porHora = Array.from({ length: 24 }, (_, hora) => ({ hora, total: 0 }))
  const porDiaSemana = Array.from({ length: 7 }, (_, dia) => ({ dia, total: 0 }))
  for (const c of conversas) {
    const i = indice.get(chaveDia(c.criadoEm))
    if (i != null) {
      serie[i].atendidos += 1
      if (concluiu(c)) serie[i].concluidos += 1
    }
    const brt = new Date(c.criadoEm.getTime() - 3 * 3_600_000)
    porHora[brt.getUTCHours()].total += 1
    porDiaSemana[brt.getUTCDay()].total += 1
  }

  return {
    periodo: { dias, inicio: serie[0]?.data ?? null, fim: serie[serie.length - 1]?.data ?? null },
    totais: {
      atendidos,
      concluidos,
      qualificados: conta(c => c.resultado === 'QUALIFICADO'),
      pediramAtendente: conta(c => c.resultado === 'PEDIU_ATENDENTE'),
      desistiram: conta(c => c.resultado === 'DESISTIU'),
      naoEraLead: conta(c => c.resultado === 'NAO_E_LEAD'),
      emAndamento: conta(c => c.status === 'ATIVA' && !parada(c)),
      pararamDeResponder: conta(parada),
      assumidas: conta(c => !!c.assumidaEm),
      leadsNoCrm: conta(c => !!c.leadId),
      vendas: conta(c => c.lead?.estagio === 'FECHADO'),
      aguardandoAgora,
    },
    taxaConclusao: atendidos > 0 ? concluidos / atendidos : null,
    tempoResposta: {
      medianaMin: mediana(esperas),
      ate15MinPct: esperas.length > 0 ? esperas.filter(m => m <= 15).length / esperas.length : null,
      amostras: esperas.length,
    },
    porOrigem: origens,
    funilRoteiro,
    funilCrm,
    serie,
    porHora,
    porDiaSemana,
  }
}
