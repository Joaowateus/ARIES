// Motor de regras do "Plano de Crescimento": recebe métricas já calculadas
// (funil, vendas, ROAS, redes sociais) e devolve um diagnóstico por pilar da
// operação, num modelo de "portões" (gates) — cada pilar tem 3 critérios
// ordenados, e o estágio atual é o mais avançado cujos portões anteriores
// (todos) já foram atingidos. Isso deixa o motor determinístico e fácil de
// auditar: dá pra ver exatamente qual critério está faltando pra avançar.
//
// Os limiares usados nos critérios (`MetasCrescimento`) não são fixos aqui
// de propósito — vêm de `ParametroLiquidez`, editáveis em Configurações,
// porque o que é "ROAS saudável" ou "boa conversão" varia demais de
// operação pra operação pra ficar hardcoded.
//
// É proposital manter isso separado da rota que busca os dados (ver
// `/pro-labore/plano-crescimento` em `routes/proLabore.ts`): essa função só
// enxerga números, nunca o Prisma — é o ponto de extensão caso um motor
// mais sofisticado (ex. gerado por IA a partir dos mesmos números) venha a
// substituir ou complementar essas regras no futuro.

export const ESTAGIOS = ['INICIAR', 'MANTER', 'ESCALONAR', 'ESCALAR'] as const
export type Estagio = (typeof ESTAGIOS)[number]

export const ESTAGIO_LABEL: Record<Estagio, string> = {
  INICIAR: 'Iniciar',
  MANTER: 'Manter',
  ESCALONAR: 'Escalonar',
  ESCALAR: 'Escalar',
}

export interface MetricasNegocio {
  periodoDias: number

  // Aquisição — redes sociais / topo de funil
  socialConectado: boolean
  publicacoesPeriodo: number
  metaPostagensPeriodo: number
  taxaEngajamento: number // fração 0..1 (engajamento / alcance)
  novosSeguidoresPeriodo: number
  leadsOrganicosPeriodo: number

  // Conversão — funil e vendas
  leadsAtual: number
  conversaoLeadVenda: number // percentual 0..100
  ticketMedioAtual: number
  ticketMedioAnterior: number
  quantidadeVendasAtual: number
  quantidadeVendasAnterior: number

  // Execução — equipe
  quantidadeVendedoresAtivos: number
  quantidadeVendedoresComVenda: number
  concentracaoMaiorVendedorPct: number // percentual 0..100 da receita da equipe

  // Financeiro — resultado
  roas: number
  receitaAtual: number
  receitaAnterior: number
}

// Limiares configuráveis (ParametroLiquidez.plano*) — ver comentário do
// arquivo. Todos os percentuais aqui são 0..100, igual ao resto de
// ParametroLiquidez (ex: agendaLimiarBomPct).
export interface MetasCrescimento {
  roasMinimo: number
  roasSaudavel: number
  conversaoMinimaPct: number
  conversaoConsolidadaPct: number
  engajamentoMinimoPct: number
  leadsOrganicosMinimo: number
  concentracaoMaximaLiderPct: number
}

export type Formato = 'moeda' | 'percentual' | 'numero'

export interface MetricaPilar { label: string; valor: number; formato: Formato }
export interface Gate { descricao: string; atingido: boolean }

export interface Pilar {
  chave: 'aquisicao' | 'conversao' | 'execucao' | 'financeiro'
  nome: string
  estagio: Estagio
  resumo: string
  metricas: MetricaPilar[]
  gates: Gate[]
  acoes: string[]
  ritmo: string
}

export interface PlanoCrescimento {
  estagioGeral: Estagio
  resumoGeral: string
  gargalo: Pilar['chave']
  pilares: Pilar[]
}

// O estágio de um pilar é o índice do último portão atingido em sequência —
// um portão não atingido trava todos os seguintes, mesmo que numericamente
// já dariam pra passar (força progressão em ordem, não "média").
function calcularEstagio(gates: Gate[]): Estagio {
  let indice = 0
  for (const gate of gates) {
    if (!gate.atingido) break
    indice++
  }
  return ESTAGIOS[indice]
}

function pilarAquisicao(m: MetricasNegocio, metas: MetasCrescimento): Pilar {
  const gates: Gate[] = [
    { descricao: 'Conta conectada e postando com consistência', atingido: m.socialConectado && m.metaPostagensPeriodo > 0 && m.publicacoesPeriodo >= m.metaPostagensPeriodo },
    { descricao: `Engajamento saudável (≥ ${metas.engajamentoMinimoPct}% do alcance)`, atingido: m.taxaEngajamento >= metas.engajamentoMinimoPct / 100 },
    { descricao: `Gerando leads de forma orgânica (≥ ${metas.leadsOrganicosMinimo} no período)`, atingido: m.leadsOrganicosPeriodo >= metas.leadsOrganicosMinimo },
  ]
  const estagio = calcularEstagio(gates)

  const acoesPorEstagio: Record<Estagio, string[]> = {
    INICIAR: m.socialConectado
      ? [
          `Publicar com ritmo constante até bater a meta semanal (hoje: ${m.publicacoesPeriodo} de ${m.metaPostagensPeriodo} no período).`,
          'Priorizar formatos que já existem no catálogo (fotos/vídeos das motos) antes de variar demais.',
          'Revisar a meta de postagens semanais em Configurações se ela não for realista pra rotina da loja.',
        ]
      : [
          'Conectar a conta do Instagram na aba Social Media — sem isso não dá pra medir nada de aquisição.',
          'Definir uma meta semanal de postagens realista pra começar a criar ritmo.',
        ],
    MANTER: [
      'Testar 2-3 variações de conteúdo (depoimento, bastidor, oferta) pra achar o que engaja mais antes de aumentar volume.',
      'Responder comentários/DMs rápido — engajamento também é sobre interação, não só alcance.',
    ],
    ESCALONAR: [
      'Aumentar a frequência de publicação e reforçar os formatos que mais geraram lead orgânico.',
      'Começar a testar impulsionamento pago nos posts com melhor desempenho orgânico.',
    ],
    ESCALAR: [
      'Aumentar o investimento em anúncio nos formatos validados — o orgânico já provou que converte.',
      'Diversificar canal (ex. outra rede) usando o que já funciona aqui como referência.',
    ],
  }

  return {
    chave: 'aquisicao',
    nome: 'Aquisição',
    estagio,
    resumo: m.socialConectado
      ? `${m.novosSeguidoresPeriodo} novos seguidores e ${m.leadsOrganicosPeriodo} leads orgânicos no período.`
      : 'Redes sociais ainda não conectadas — sem dado de aquisição orgânica.',
    metricas: [
      { label: 'Publicações no período', valor: m.publicacoesPeriodo, formato: 'numero' },
      { label: 'Taxa de engajamento', valor: m.taxaEngajamento, formato: 'percentual' },
      { label: 'Novos seguidores', valor: m.novosSeguidoresPeriodo, formato: 'numero' },
      { label: 'Leads orgânicos', valor: m.leadsOrganicosPeriodo, formato: 'numero' },
    ],
    gates,
    acoes: acoesPorEstagio[estagio],
    ritmo: 'Revisar semanalmente',
  }
}

function pilarConversao(m: MetricasNegocio, metas: MetasCrescimento): Pilar {
  const ticketEstavelOuCrescendo = m.ticketMedioAnterior === 0 || m.ticketMedioAtual >= m.ticketMedioAnterior
  const vendasEstaveisOuCrescendo = m.quantidadeVendasAnterior === 0 || m.quantidadeVendasAtual >= m.quantidadeVendasAnterior

  const gates: Gate[] = [
    { descricao: `Funil convertendo lead em venda (≥ ${metas.conversaoMinimaPct}%)`, atingido: m.conversaoLeadVenda >= metas.conversaoMinimaPct },
    { descricao: 'Ticket médio estável ou em alta', atingido: ticketEstavelOuCrescendo },
    { descricao: `Conversão consolidada (≥ ${metas.conversaoConsolidadaPct}%) e volume de vendas em alta`, atingido: m.conversaoLeadVenda >= metas.conversaoConsolidadaPct && vendasEstaveisOuCrescendo },
  ]
  const estagio = calcularEstagio(gates)

  const acoesPorEstagio: Record<Estagio, string[]> = {
    INICIAR: [
      'Mapear onde o lead mais trava no CRM (etapa com maior queda no funil) e focar ali antes de qualquer outra coisa.',
      'Garantir que todo lead tenha um próximo passo agendado — lead parado é o maior vazamento de funil.',
    ],
    MANTER: [
      'Padronizar o script de abordagem/negociação com a equipe pra reduzir variação entre vendedores.',
      'Acompanhar ticket médio mês a mês — qualquer queda merece atenção antes de crescer volume.',
    ],
    ESCALONAR: [
      'Testar ajustes de oferta/condição de pagamento nas etapas com mais perda (ver Jornada de compra no Dashboard).',
      'Aumentar o volume de leads recebidos sabendo que o funil já converte de forma consistente.',
    ],
    ESCALAR: [
      'Funil provado — é hora de investir mais em topo (aquisição) sabendo que o meio converte bem.',
      'Considerar metas de venda mais agressivas por vendedor, com o funil atual como base.',
    ],
  }

  return {
    chave: 'conversao',
    nome: 'Conversão',
    estagio,
    resumo: `${m.conversaoLeadVenda.toFixed(1)}% dos leads viram venda; ticket médio de ${m.ticketMedioAtual > 0 ? 'R$ ' + m.ticketMedioAtual.toFixed(0) : 'sem vendas no mês'}.`,
    metricas: [
      { label: 'Leads no mês', valor: m.leadsAtual, formato: 'numero' },
      { label: 'Conversão lead → venda', valor: m.conversaoLeadVenda / 100, formato: 'percentual' },
      { label: 'Ticket médio', valor: m.ticketMedioAtual, formato: 'moeda' },
      { label: 'Vendas no mês', valor: m.quantidadeVendasAtual, formato: 'numero' },
    ],
    gates,
    acoes: acoesPorEstagio[estagio],
    ritmo: 'Revisar semanalmente',
  }
}

function pilarExecucao(m: MetricasNegocio, metas: MetasCrescimento): Pilar {
  const gates: Gate[] = [
    { descricao: 'Equipe vendendo (pelo menos 1 vendedor ativo com venda no mês)', atingido: m.quantidadeVendedoresComVenda >= 1 },
    { descricao: 'Mais de um vendedor contribuindo pro resultado', atingido: m.quantidadeVendedoresComVenda >= 2 },
    { descricao: `Resultado não concentrado num só vendedor (líder ≤ ${metas.concentracaoMaximaLiderPct}% da receita)`, atingido: m.quantidadeVendedoresComVenda >= 2 && m.concentracaoMaiorVendedorPct <= metas.concentracaoMaximaLiderPct },
  ]
  const estagio = calcularEstagio(gates)

  const acoesPorEstagio: Record<Estagio, string[]> = {
    INICIAR: [
      'Cadastrar e ativar pelo menos um vendedor em Vendedores, com meta e teto de comissão definidos.',
      'Acompanhar de perto as primeiras vendas de cada vendedor novo pra calibrar o processo.',
    ],
    MANTER: [
      'Trazer um segundo vendedor pra reduzir a dependência de uma única pessoa vendendo.',
      'Usar o ranking do Dashboard pra identificar quem precisa de mais apoio.',
    ],
    ESCALONAR: [
      `Hoje o vendedor líder responde por ${m.concentracaoMaiorVendedorPct.toFixed(0)}% da receita — vale nivelar a equipe antes de crescer mais.`,
      'Replicar o que o vendedor de melhor desempenho está fazendo de diferente com os demais.',
    ],
    ESCALAR: [
      'Equipe equilibrada — é seguro considerar contratar mais um vendedor pra multiplicar capacidade.',
      'Formalizar metas individuais mais altas, já que o time absorve bem o volume atual.',
    ],
  }

  return {
    chave: 'execucao',
    nome: 'Execução',
    estagio,
    resumo: m.quantidadeVendedoresComVenda >= 1
      ? `${m.quantidadeVendedoresComVenda} de ${m.quantidadeVendedoresAtivos} vendedores ativos venderam no mês.`
      : 'Nenhum vendedor com venda registrada no mês.',
    metricas: [
      { label: 'Vendedores ativos', valor: m.quantidadeVendedoresAtivos, formato: 'numero' },
      { label: 'Vendedores com venda no mês', valor: m.quantidadeVendedoresComVenda, formato: 'numero' },
      { label: 'Concentração no líder', valor: m.concentracaoMaiorVendedorPct / 100, formato: 'percentual' },
    ],
    gates,
    acoes: acoesPorEstagio[estagio],
    ritmo: 'Revisar quinzenalmente',
  }
}

function pilarFinanceiro(m: MetricasNegocio, metas: MetasCrescimento): Pilar {
  const receitaCrescendo = m.receitaAnterior === 0 || m.receitaAtual >= m.receitaAnterior

  const gates: Gate[] = [
    { descricao: `Anúncio pelo menos se pagando (ROAS ≥ ${metas.roasMinimo})`, atingido: m.roas === 0 || m.roas >= metas.roasMinimo },
    { descricao: `ROAS saudável (≥ ${metas.roasSaudavel})`, atingido: m.roas >= metas.roasSaudavel },
    { descricao: 'Receita em alta com ROAS saudável', atingido: m.roas >= metas.roasSaudavel && receitaCrescendo },
  ]
  const estagio = calcularEstagio(gates)

  const acoesPorEstagio: Record<Estagio, string[]> = {
    INICIAR: m.roas === 0
      ? ['Lançar o gasto com anúncios em Indicadores pra começar a medir ROAS e CAC.']
      : [
          `ROAS atual de ${m.roas.toFixed(1)}x está abaixo do investido — revisar segmentação/criativo do anúncio antes de aumentar verba.`,
          'Focar em reduzir CAC ajustando o público antes de qualquer escala.',
        ],
    MANTER: [
      'ROAS cobre o investimento mas ainda não é confortável — testar pequenos ajustes de verba/criativo.',
      'Acompanhar CAC junto com ROAS pra não mascarar custo alto com volume.',
    ],
    ESCALONAR: [
      `ROAS de ${m.roas.toFixed(1)}x já é saudável — considerar aumentar verba de anúncio de forma gradual.`,
      'Garantir que o financeiro (fluxo de caixa) aguenta o aumento de investimento antes de acelerar.',
    ],
    ESCALAR: [
      'Resultado sólido e em crescimento — bom momento pra reinvestir parte do lucro em mais aquisição.',
      'Formalizar uma meta de faturamento mais ambiciosa com base no ritmo atual.',
    ],
  }

  return {
    chave: 'financeiro',
    nome: 'Financeiro',
    estagio,
    resumo: m.roas > 0
      ? `ROAS de ${m.roas.toFixed(1)}x; receita ${receitaCrescendo ? 'estável ou em alta' : 'em queda'} vs. mês anterior.`
      : 'Sem gasto com anúncio lançado no mês — ROAS não calculado.',
    metricas: [
      { label: 'Receita do mês', valor: m.receitaAtual, formato: 'moeda' },
      { label: 'ROAS', valor: m.roas, formato: 'numero' },
    ],
    gates,
    acoes: acoesPorEstagio[estagio],
    ritmo: 'Revisar mensalmente',
  }
}

const ORDEM_ESTAGIO: Record<Estagio, number> = { INICIAR: 0, MANTER: 1, ESCALONAR: 2, ESCALAR: 3 }

export function gerarPlanoDeCrescimento(m: MetricasNegocio, metas: MetasCrescimento): PlanoCrescimento {
  const pilares = [pilarAquisicao(m, metas), pilarConversao(m, metas), pilarExecucao(m, metas), pilarFinanceiro(m, metas)]

  // O estágio geral do negócio é o do pilar mais atrasado — não adianta
  // aquisição em "Escalar" se o funil ainda não converte (Iniciar):
  // investir mais em topo de funil só aumentaria o desperdício.
  const gargaloPilar = pilares.reduce((pior, atual) => (ORDEM_ESTAGIO[atual.estagio] < ORDEM_ESTAGIO[pior.estagio] ? atual : pior))

  return {
    estagioGeral: gargaloPilar.estagio,
    resumoGeral: `Seu gargalo agora é ${gargaloPilar.nome.toLowerCase()} — os outros pilares só vão render mais quando esse destravar.`,
    gargalo: gargaloPilar.chave,
    pilares,
  }
}
