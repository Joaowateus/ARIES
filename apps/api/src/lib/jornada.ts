// Jornada de compra do cliente: as regras oficiais de contagem do funil
// (Leads → Abordados → Negociação → Proposta → Fechamento), num só lugar.
// O Dashboard (/painel) e o Assistente Comercial leem daqui, para que os dois
// mostrem sempre os mesmos números.
//
// Três leituras, cada uma com um nome próprio (não se misturam):
// 1. MÊS DO DASHBOARD (oficial, igual ao Dashboard sem filtro): leads criados
//    no mês, contados pelo estágio em que estão agora; "Fechamento" = vendas
//    registradas no mês (data da venda). Mistura duas coortes — a venda pode
//    vir de um lead de outro mês —, e isso é dito na tela.
// 2. POR DATA DE AVANÇO (igual ao Dashboard com filtro de período): cada
//    etapa conta quem a ALCANÇOU dentro do período (pela data do histórico).
// 3. COORTE: leads criados no período e até onde cada um chegou (maior
//    estágio do histórico). É a leitura usada nas conversões entre etapas e
//    nas projeções, porque não mistura coortes.

export const ORDEM_ESTAGIO_LEAD = ['LEAD', 'ABORDADO', 'NEGOCIACAO', 'PROPOSTA', 'FECHADO'] as const
export type EstagioFunil = (typeof ORDEM_ESTAGIO_LEAD)[number]

export function estagioAtingiu(estagioAtual: string, alvo: EstagioFunil): boolean {
  if (estagioAtual === 'PERDIDO') return false
  return ORDEM_ESTAGIO_LEAD.indexOf(estagioAtual as EstagioFunil) >= ORDEM_ESTAGIO_LEAD.indexOf(alvo)
}

export interface FunilMes { leads: number; abordados: number; negociacao: number; proposta: number; fechamento: number }

/** Leitura 1: o funil do mês exatamente como o Dashboard monta. */
export function funilDoMesDashboard(
  leadsDoMes: Array<{ estagio: string }>,
  quantidadeVendas: number,
  manual?: { leads: number; abordados: number; negociacao: number; proposta: number } | null,
): FunilMes & { fonte: 'LEADS' | 'MANUAL' } {
  // Prefere o funil real (Leads) quando existe dado no mês; cai pro cadastro
  // manual (Indicadores → funil mensal) só em meses anteriores aos Leads.
  if (leadsDoMes.length > 0) {
    return {
      leads: leadsDoMes.length,
      abordados: leadsDoMes.filter(l => estagioAtingiu(l.estagio, 'ABORDADO')).length,
      negociacao: leadsDoMes.filter(l => estagioAtingiu(l.estagio, 'NEGOCIACAO')).length,
      proposta: leadsDoMes.filter(l => estagioAtingiu(l.estagio, 'PROPOSTA')).length,
      fechamento: quantidadeVendas,
      fonte: 'LEADS',
    }
  }
  return { leads: manual?.leads ?? 0, abordados: manual?.abordados ?? 0, negociacao: manual?.negociacao ?? 0, proposta: manual?.proposta ?? 0, fechamento: quantidadeVendas, fonte: 'MANUAL' }
}

type LeadComHistorico = { estagio: string; criadoEm: Date; historico: Array<{ estagioNovo: string; criadoEm: Date }> }

/** Quando o lead alcançou a etapa (ou uma posterior) pela primeira vez. */
export function dataAlcancouEtapa(lead: LeadComHistorico, etapa: EstagioFunil): Date | null {
  if (etapa === 'LEAD') return lead.criadoEm
  const alvo = ORDEM_ESTAGIO_LEAD.indexOf(etapa)
  const datas = lead.historico
    .filter(h => (ORDEM_ESTAGIO_LEAD as readonly string[]).includes(h.estagioNovo) && ORDEM_ESTAGIO_LEAD.indexOf(h.estagioNovo as EstagioFunil) >= alvo)
    .map(h => h.criadoEm.getTime())
  return datas.length ? new Date(Math.min(...datas)) : null
}

/** Leitura 2: quem alcançou cada etapa dentro do período (mesma regra do filtro do Dashboard). */
export function funilPorDataDeAvanco<T extends LeadComHistorico>(leads: T[], dentro: (d: Date) => boolean): Record<EstagioFunil, T[]> {
  const popular = (etapa: EstagioFunil) => (etapa === 'LEAD' ? leads : leads.filter(l => l.estagio !== 'PERDIDO'))
    .filter(l => { const d = dataAlcancouEtapa(l, etapa); return d != null && dentro(d) })
  return { LEAD: popular('LEAD'), ABORDADO: popular('ABORDADO'), NEGOCIACAO: popular('NEGOCIACAO'), PROPOSTA: popular('PROPOSTA'), FECHADO: popular('FECHADO') }
}

/** Maior estágio já alcançado (o PERDIDO conta pelo último estágio antes da perda). */
export function maiorEstagio(l: LeadComHistorico): number {
  const r = (e: string) => ORDEM_ESTAGIO_LEAD.indexOf(e as EstagioFunil)
  return Math.max(0, r(l.estagio), ...l.historico.map(h => r(h.estagioNovo)))
}

/** Leitura 3: coorte — dos leads criados no período, quantos chegaram a cada etapa (até agora). */
export function funilDaCoorte(leadsDaCoorte: LeadComHistorico[]): Record<EstagioFunil, number> {
  const alcancou = (i: number) => leadsDaCoorte.filter(l => maiorEstagio(l) >= i).length
  return { LEAD: leadsDaCoorte.length, ABORDADO: alcancou(1), NEGOCIACAO: alcancou(2), PROPOSTA: alcancou(3), FECHADO: alcancou(4) }
}
