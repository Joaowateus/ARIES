/**
 * Funil comercial único (CRM individual + Dashboard + Metas + Precificação
 * leem daqui). Substitui o funil antigo de 7 etapas.
 */

export const ESTAGIOS = [
  'NOVO_LEAD',
  'NAO_RESPONDEU',
  'FOLLOW_1_DIA',
  'RESPONDEU',
  'SQL',
  'MQL',
  'COMPRADO',
  'PROCESSO_ADMINISTRATIVO',
  'PERDIDO',
] as const

export type Estagio = (typeof ESTAGIOS)[number]

export const ESTAGIO_LABEL: Record<string, string> = {
  NOVO_LEAD: 'Leads',
  NAO_RESPONDEU: 'Não Responderam',
  FOLLOW_1_DIA: 'Follow — 01 dia',
  RESPONDEU: 'Responderam',
  SQL: 'SQL — Simulação',
  MQL: 'MQL — Qualificados',
  COMPRADO: 'Compraram',
  PROCESSO_ADMINISTRATIVO: 'Processo Administrativo',
  PERDIDO: 'Perdido',
}

/** Sequência linear de conversão — exclui PERDIDO, que é saída de qualquer etapa. */
export const ETAPAS_FUNIL_ORDEM = [
  'NOVO_LEAD',
  'NAO_RESPONDEU',
  'FOLLOW_1_DIA',
  'RESPONDEU',
  'SQL',
  'MQL',
  'COMPRADO',
  'PROCESSO_ADMINISTRATIVO',
] as const

/** Estágio em que a venda é considerada fechada — gera Contrato. */
export const ESTAGIO_VENDA_FECHADA: Estagio = 'COMPRADO'

export const ESTAGIOS_FINAIS: readonly Estagio[] = ['COMPRADO', 'PERDIDO']

/** Metas de conversão padrão por etapa (seed inicial de MetaFunilEtapa). */
export const METAS_FUNIL_PADRAO: Record<string, { metaPct: number; tipoMeta: 'MINIMO' | 'MAXIMO_PERDA' }> = {
  NAO_RESPONDEU: { metaPct: 0.1, tipoMeta: 'MAXIMO_PERDA' },
  RESPONDEU: { metaPct: 0.9, tipoMeta: 'MINIMO' },
  SQL: { metaPct: 0.7, tipoMeta: 'MINIMO' },
  MQL: { metaPct: 0.2, tipoMeta: 'MINIMO' },
  COMPRADO: { metaPct: 0.2, tipoMeta: 'MINIMO' },
  PROCESSO_ADMINISTRATIVO: { metaPct: 1.0, tipoMeta: 'MINIMO' },
}

/** SLA padrão (dias) — quanto tempo um lead pode ficar parado numa etapa
 * antes de virar alerta pro gestor (ver Central de Insights). */
export const SLA_PADRAO_DIAS: Record<string, number> = {
  NOVO_LEAD: 1,
  NAO_RESPONDEU: 3,
  FOLLOW_1_DIA: 2,
  RESPONDEU: 2,
  SQL: 3,
  MQL: 5,
  COMPRADO: 3,
  PROCESSO_ADMINISTRATIVO: 5,
}

interface HistoricoEntrada {
  oportunidadeId: string
  estagioNovo: string
  criadoEm: Date
}

/** Tempo médio (em dias) que oportunidades passam em cada etapa antes de sair
 * dela — só conta transições completas (quem ainda está parado numa etapa
 * não entra na média, senão puxaria o número pra baixo artificialmente). */
export function tempoMedioPorEtapa(historico: HistoricoEntrada[]): Map<string, number> {
  const porOportunidade = new Map<string, HistoricoEntrada[]>()
  for (const h of historico) {
    if (!porOportunidade.has(h.oportunidadeId)) porOportunidade.set(h.oportunidadeId, [])
    porOportunidade.get(h.oportunidadeId)!.push(h)
  }

  const duracoesPorEtapa = new Map<string, number[]>()
  for (const entradas of porOportunidade.values()) {
    entradas.sort((a, b) => a.criadoEm.getTime() - b.criadoEm.getTime())
    for (let i = 0; i < entradas.length - 1; i++) {
      const dias = (entradas[i + 1].criadoEm.getTime() - entradas[i].criadoEm.getTime()) / (24 * 60 * 60 * 1000)
      const etapa = entradas[i].estagioNovo
      if (!duracoesPorEtapa.has(etapa)) duracoesPorEtapa.set(etapa, [])
      duracoesPorEtapa.get(etapa)!.push(dias)
    }
  }

  const media = new Map<string, number>()
  for (const [etapa, duracoes] of duracoesPorEtapa) {
    media.set(etapa, duracoes.reduce((a, b) => a + b, 0) / duracoes.length)
  }
  return media
}

/** Para cada oportunidade ainda ativa, quantos dias faz desde que ela entrou
 * na etapa em que está agora (baseado na entrada mais recente do histórico). */
export function diasNaEtapaAtualPorOportunidade(historico: HistoricoEntrada[]): Map<string, number> {
  const maisRecentePorOportunidade = new Map<string, Date>()
  for (const h of historico) {
    const atual = maisRecentePorOportunidade.get(h.oportunidadeId)
    if (!atual || h.criadoEm > atual) maisRecentePorOportunidade.set(h.oportunidadeId, h.criadoEm)
  }
  const agora = new Date()
  const resultado = new Map<string, number>()
  for (const [id, data] of maisRecentePorOportunidade) {
    resultado.set(id, (agora.getTime() - data.getTime()) / (24 * 60 * 60 * 1000))
  }
  return resultado
}

type PrismaClient = import('@prisma/client').PrismaClient

/** Busca a config de meta+SLA por etapa da empresa, semeando com os padrões
 * (`METAS_FUNIL_PADRAO`/`SLA_PADRAO_DIAS`) quando faltar alguma etapa. Único
 * lugar que resolve essa config — usado pela rota /funil e pelo Meu Painel. */
export async function obterMetasFunil(prisma: PrismaClient, empresaId: string) {
  const existentes = await prisma.metaFunilEtapa.findMany({ where: { empresaId } })
  const porEtapa = new Map(existentes.map(m => [m.etapa, m]))

  const todasEtapas = new Set([...Object.keys(METAS_FUNIL_PADRAO), ...Object.keys(SLA_PADRAO_DIAS)])
  const faltando = [...todasEtapas].filter(etapa => !porEtapa.has(etapa))
  if (faltando.length) {
    await prisma.$transaction(
      faltando.map(etapa => {
        const cfg = METAS_FUNIL_PADRAO[etapa]
        return prisma.metaFunilEtapa.upsert({
          where: { empresaId_etapa: { empresaId, etapa } },
          update: {},
          create: {
            empresaId,
            etapa,
            metaPct: cfg?.metaPct ?? 0,
            tipoMeta: cfg?.tipoMeta ?? 'MINIMO',
            tempoMaximoDias: SLA_PADRAO_DIAS[etapa] ?? null,
          },
        })
      })
    )
    return prisma.metaFunilEtapa.findMany({ where: { empresaId } })
  }
  return existentes
}

interface MetaEtapaCfg {
  metaPct: number
  tipoMeta: string
  tempoMaximoDias: number | null
}

/** Monta o array de conversão por etapa (quantidade, % real, meta, semáforo,
 * tempo médio) a partir de um histórico já filtrado — reaproveitado tanto
 * pelo Funil de Vendas da empresa quanto pelo funil individual do Meu Painel,
 * que passa só o histórico das oportunidades do próprio vendedor. */
export function montarConversaoFunil(historico: HistoricoEntrada[], metaPorEtapa: Map<string, MetaEtapaCfg>) {
  const totalLeads = new Set(historico.filter(h => h.estagioNovo === 'NOVO_LEAD').map(h => h.oportunidadeId)).size

  const alcancados = new Map<string, Set<string>>()
  for (const h of historico) {
    if (!alcancados.has(h.estagioNovo)) alcancados.set(h.estagioNovo, new Set())
    alcancados.get(h.estagioNovo)!.add(h.oportunidadeId)
  }

  const tempoMedio = tempoMedioPorEtapa(historico)

  const etapas = ETAPAS_FUNIL_ORDEM.map(estagio => {
    const quantidade = alcancados.get(estagio)?.size ?? 0
    const conversaoReal = totalLeads > 0 ? quantidade / totalLeads : 0
    const metaCfg = metaPorEtapa.get(estagio)
    const metaPct = metaCfg?.metaPct ?? METAS_FUNIL_PADRAO[estagio]?.metaPct ?? 0
    const tipoMeta = metaCfg?.tipoMeta ?? METAS_FUNIL_PADRAO[estagio]?.tipoMeta ?? 'MINIMO'
    const tempoMaximoDias = metaCfg?.tempoMaximoDias ?? SLA_PADRAO_DIAS[estagio] ?? null

    let status: 'verde' | 'amarelo' | 'vermelho' = 'verde'
    if (tipoMeta === 'MAXIMO_PERDA') {
      if (conversaoReal > metaPct * 1.15) status = 'vermelho'
      else if (conversaoReal > metaPct) status = 'amarelo'
    } else {
      if (conversaoReal < metaPct * 0.85) status = 'vermelho'
      else if (conversaoReal < metaPct) status = 'amarelo'
    }

    return {
      estagio,
      label: ESTAGIO_LABEL[estagio],
      quantidade,
      conversaoReal,
      meta: metaPct,
      tipoMeta,
      diferenca: conversaoReal - metaPct,
      status,
      tempoMedioDias: tempoMedio.has(estagio) ? Math.round(tempoMedio.get(estagio)! * 10) / 10 : null,
      tempoMaximoDias,
    }
  })

  return { totalLeads, etapas }
}
