/**
 * Funil de Tráfego Pago — jornada ANTES do lead virar Oportunidade no CRM.
 * v1: os números vêm de lançamento manual (o que o gerenciador de anúncios
 * mostra), não de integração automática com Meta/Google Ads — ver
 * MetricaTrafegoPago no schema. O formato já é o final: quando a extração
 * automática via API existir, ela só passa a preencher esta mesma tabela.
 */

export const ETAPAS_TRAFEGO = ['IMPRESSOES', 'CLIQUES', 'VISITAS_LP', 'LEADS_CAPTURADOS', 'LEADS_CRM'] as const

export type EtapaTrafego = (typeof ETAPAS_TRAFEGO)[number]

export const ETAPA_TRAFEGO_LABEL: Record<EtapaTrafego, string> = {
  IMPRESSOES: 'Impressões',
  CLIQUES: 'Cliques',
  VISITAS_LP: 'Visitas à LP',
  LEADS_CAPTURADOS: 'Leads Capturados',
  LEADS_CRM: 'Leads no CRM',
}

export const PLATAFORMAS_TRAFEGO = ['META', 'GOOGLE', 'TIKTOK', 'OUTRO'] as const

export interface AgregadoTrafego {
  impressoes: number
  cliques: number
  visitasLp: number
  leadsCapturados: number
  valorInvestido: number
}

export interface EtapaConversaoTrafego {
  estagio: EtapaTrafego
  label: string
  quantidade: number
  conversaoReal: number
}

export interface ConversaoTrafego {
  etapas: EtapaConversaoTrafego[]
  valorInvestido: number
  /** Cliques / Impressões */
  ctr: number
  /** Investimento / Cliques */
  cpc: number
  /** Investimento / Leads capturados pela plataforma */
  cpl: number
  /** Investimento / Leads que de fato entraram no CRM — o custo real por lead comercial */
  custoPorLeadCrm: number
  /** Leads no CRM / Leads capturados pela plataforma — quanto do que a
   * plataforma reporta como "resultado" realmente virou Oportunidade;
   * é o número que expõe perda de atribuição/qualidade sem depender de
   * UTM/click id. */
  taxaLeadPlataformaParaCrm: number
}

/** Monta a conversão etapa-a-etapa a partir do agregado do período (soma de
 * MetricaTrafegoPago) e da contagem de LeadRegistrado(tipoLead=TRAFEGO) no
 * mesmo período/escopo — o ponto onde este funil encosta no funil de vendas
 * (`montarConversaoFunil`, em funil.ts). */
export function montarConversaoTrafego(agregado: AgregadoTrafego, leadsCrm: number): ConversaoTrafego {
  const base = agregado.impressoes

  const quantidadesPorEtapa: Record<EtapaTrafego, number> = {
    IMPRESSOES: agregado.impressoes,
    CLIQUES: agregado.cliques,
    VISITAS_LP: agregado.visitasLp,
    LEADS_CAPTURADOS: agregado.leadsCapturados,
    LEADS_CRM: leadsCrm,
  }

  const etapas = ETAPAS_TRAFEGO.map(estagio => {
    const quantidade = quantidadesPorEtapa[estagio]
    return {
      estagio,
      label: ETAPA_TRAFEGO_LABEL[estagio],
      quantidade,
      conversaoReal: base > 0 ? quantidade / base : 0,
    }
  })

  return {
    etapas,
    valorInvestido: agregado.valorInvestido,
    ctr: agregado.impressoes > 0 ? agregado.cliques / agregado.impressoes : 0,
    cpc: agregado.cliques > 0 ? agregado.valorInvestido / agregado.cliques : 0,
    cpl: agregado.leadsCapturados > 0 ? agregado.valorInvestido / agregado.leadsCapturados : 0,
    custoPorLeadCrm: leadsCrm > 0 ? agregado.valorInvestido / leadsCrm : 0,
    taxaLeadPlataformaParaCrm: agregado.leadsCapturados > 0 ? leadsCrm / agregado.leadsCapturados : 0,
  }
}

export interface CampanhaTrafego extends AgregadoTrafego {
  campanha: string
  leadsCrm: number
}

export interface CampanhaConversao {
  campanha: string
  impressoes: number
  cliques: number
  leadsCapturados: number
  leadsCrm: number
  valorInvestido: number
  cpl: number
  custoPorLeadCrm: number
  taxaLeadPlataformaParaCrm: number
}

/** Mesmas contas de `montarConversaoTrafego`, mas uma linha por campanha —
 * é o que finalmente responde "qual campanha está trazendo lead barato e
 * qual está só gastando verba": Oportunidade.campanhaTrafego (espelhado em
 * LeadRegistrado) precisa bater com MetricaTrafegoPago.campanha pro
 * cruzamento funcionar; campanhas sem nome ("") ficam agrupadas juntas. */
export function montarConversaoPorCampanha(linhas: CampanhaTrafego[]): CampanhaConversao[] {
  return linhas
    .map(l => ({
      campanha: l.campanha,
      impressoes: l.impressoes,
      cliques: l.cliques,
      leadsCapturados: l.leadsCapturados,
      leadsCrm: l.leadsCrm,
      valorInvestido: l.valorInvestido,
      cpl: l.leadsCapturados > 0 ? l.valorInvestido / l.leadsCapturados : 0,
      custoPorLeadCrm: l.leadsCrm > 0 ? l.valorInvestido / l.leadsCrm : 0,
      taxaLeadPlataformaParaCrm: l.leadsCapturados > 0 ? l.leadsCrm / l.leadsCapturados : 0,
    }))
    .sort((a, b) => b.valorInvestido - a.valorInvestido)
}
