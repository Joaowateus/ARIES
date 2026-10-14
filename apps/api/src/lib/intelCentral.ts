// Central de Inteligência (Assistente Comercial): junta as fontes de cada
// aba e aplica o motor de cálculo (intelMotor.ts). Cada aba continua dona
// dos seus dados; aqui só se lê. Cada número sai com a origem, o período e
// a natureza (realizado, meta, projeção, estimativa).
//
// Fontes:
// - Jornada de compra (Dashboard): lib/jornada.ts — a mesma regra do /painel.
// - Tráfego: insights diários da Meta (pro_labore_trafego_insights).
// - Gasto manual (Indicadores): GastoAnuncioMensal (usado no ROAS/CAC do Dashboard).
// - Social Media: analisarContaSocialMedia (a mesma análise da aba) e as pautas.
// - Vendas, Financeiro (lançamentos), Equipe (Copiloto), Estoque (Social Media).
import { prisma } from './prisma'
import { diaBrasilia } from './socialMediaSync'
import { somar, derivadas } from './trafegoAnalytics'
import { analisarContaSocialMedia } from './socialMediaResumo'
import { coletarFatos, EQUIPE } from './copilotoFatos'
import { dataAlcancouEtapa, funilDaCoorte, funilDoMesDashboard, funilPorDataDeAvanco, maiorEstagio, type EstagioFunil } from './jornada'
import {
  ETAPAS, NOME_ETAPA, PASSAGENS, arred, atingimento, calendario, cenario, conversaoEtapa, conversaoTotal, cpl, cplMaximo, criteriosDe,
  custoAcumuladoPorEtapa, custoPorVenda, faturamentoProjetado, impactoDaPassagem, leadsNecessarios, metaVendas, perda, projetarMes, razao,
  ritmoNecessario, roas, type Cenario, type Criterios, type Etapa,
} from './intelMotor'

const H = 3600e3
const DIA = 24 * H
const OFFSET = 3 * H
const ch = (d: Date) => d.toISOString().slice(0, 10)
/** Início do dia (Brasília) da chave AAAA-MM-DD. */
const inicioDia = (s: string) => new Date(Date.parse(`${s}T00:00:00Z`) + OFFSET)
const somaDias = (s: string, n: number) => ch(new Date(Date.parse(`${s}T00:00:00Z`) + n * DIA))

export interface Acesso { verInvestimento: boolean; verFinanceiro: boolean; verProLabore: boolean }
export type StatusInd = 'OK' | 'ATENCAO' | 'CRITICO' | 'SEM_DADOS' | 'INFO'
export interface Indicador { chave: string; nome: string; valor: number | null; unidade: 'BRL' | 'PCT' | 'NUM' | 'DIAS' | 'HORAS' | 'X'; meta?: number | null; status?: StatusInd; natureza: 'REALIZADO' | 'META' | 'PROJECAO' | 'ESTIMATIVA'; fonte: string; formula?: string; nota?: string }

// ---------- Premissas ----------

export async function planejamentoDe(usuarioId: string) {
  // Premissas iniciais do planejamento: as do schema e 4 vendedores.
  return prisma.intelPlanejamento.upsert({ where: { usuarioId }, create: { usuarioId, vendedoresPlanejados: 4 }, update: {} })
}

export function diasSemana(p: { diasUteisSemana: string }): number[] {
  const d = p.diasUteisSemana.split(',').map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= 6)
  return d.length ? d : [1, 2, 3, 4, 5, 6]
}

type Plan = Awaited<ReturnType<typeof planejamentoDe>>
export function metasConversao(p: Plan): [number, number, number, number] {
  return [p.metaLeadAbordado, p.metaAbordadoNegociacao, p.metaNegociacaoProposta, p.metaPropostaFechamento]
}

// ---------- Montagem ----------

export async function montarCentral(usuarioId: string, periodo: { inicio: string; fim: string }, acesso: Acesso, agora = new Date()) {
  const plan = await planejamentoDe(usuarioId)
  const criterios: Criterios = criteriosDe(plan.criterios)
  const hoje = ch(diaBrasilia(agora))
  const fim = periodo.fim > hoje ? hoje : periodo.fim
  const inicio = periodo.inicio > fim ? fim : periodo.inicio
  const mes = fim.slice(0, 7)
  const [ano, mesN] = mes.split('-').map(Number)
  const inicioMesUTC = new Date(Date.UTC(ano, mesN - 1, 1))
  const fimMesUTC = new Date(Date.UTC(ano, mesN, 1))
  const inicioMesBR = inicioDia(`${mes}-01`)
  const pInicio = inicioDia(inicio)
  const pFim = inicioDia(somaDias(fim, 1)) // exclusivo
  const diasSem = diasSemana(plan)
  // Mês passado: todos os dias úteis já decorreram.
  const cal = calendario(mes, hoje.slice(0, 7) === mes ? hoje : ch(new Date(Date.UTC(ano, mesN, 0))), diasSem)
  const metasConv = metasConversao(plan)
  const metaVendasN = metaVendas(plan.metaFaturamentoMensal, plan.ticketMedio)

  const vendedoresAtivos = await prisma.vendedor.count({ where: { usuarioId, ativo: true, vende: true } })
  const desde = new Date(Math.min(pInicio.getTime(), inicioMesBR.getTime()) - 95 * DIA)

  const [leads, vendasMes, vendas14, vendasMesAnt, funilManual, gastoManual, contaTrafego, contaSocial, lancamentos, estoque, metasOficiais, ultimoLead] = await Promise.all([
    prisma.lead.findMany({
      where: { usuarioId, OR: [{ criadoEm: { gte: desde } }, { atualizadoEm: { gte: desde } }] },
      select: { id: true, estagio: true, tipoLead: true, origem: true, vendedorId: true, vendaId: true, criadoEm: true, atualizadoEm: true, historico: { select: { estagioNovo: true, criadoEm: true }, orderBy: { criadoEm: 'asc' } } },
    }),
    prisma.venda.findMany({ where: { usuarioId, data: { gte: inicioMesUTC, lt: fimMesUTC } }, select: { id: true, data: true, valorVenda: true, valorComissao: true, valorProLabore: true, origem: true, criadoEm: true, lead: { select: { tipoLead: true, origem: true, criadoEm: true } } } }),
    prisma.venda.count({ where: { usuarioId, data: { gte: new Date(Date.parse(`${hoje}T00:00:00Z`) - 13 * DIA), lte: new Date(Date.parse(`${hoje}T00:00:00Z`)) } } }),
    prisma.venda.findMany({ where: { usuarioId, data: { gte: new Date(Date.UTC(ano, mesN - 2, 1)), lt: new Date(Date.UTC(ano, mesN - 2, Math.min(Number(fim.slice(8, 10)), 28) + 1)) } }, select: { valorVenda: true } }),
    prisma.funilMensal.findFirst({ where: { usuarioId, mesReferencia: inicioMesUTC } }),
    prisma.gastoAnuncioMensal.findFirst({ where: { usuarioId, mesReferencia: inicioMesUTC } }),
    prisma.trafegoConta.findUnique({ where: { usuarioId }, select: { id: true, nome: true, ultimaSincronizacaoEm: true, ultimoErroSync: true, configuracao: true } }),
    prisma.socialMediaConta.findUnique({ where: { titular: `dono:${usuarioId}` } }),
    acesso.verFinanceiro ? prisma.lancamentoFinanceiro.findMany({ where: { usuarioId, canceladoEm: null, pagoEm: { gte: inicioMesBR, lt: pFim } }, select: { categoria: true, valorTotal: true } }) : Promise.resolve([]),
    prisma.smMotoEstoque.findMany({ where: { usuarioId, situacao: { not: 'VENDIDA' }, saidaEm: null }, select: { modelo: true, ano: true, entradaEm: true, situacao: true } }),
    prisma.metaFunilProLabore.findMany({ where: { usuarioId } }),
    prisma.lead.findFirst({ where: { usuarioId }, orderBy: { atualizadoEm: 'desc' }, select: { atualizadoEm: true } }),
  ])

  // ---------- Funil ----------
  // 1) Oficial do Dashboard (mês, mesma função do /painel).
  const leadsDoMesUTC = leads.filter(l => l.criadoEm >= inicioMesUTC && l.criadoEm < fimMesUTC)
  const oficial = funilDoMesDashboard(leadsDoMesUTC, vendasMes.length, funilManual)
  const contOficial: Record<Etapa, number> = { LEAD: oficial.leads, ABORDADO: oficial.abordados, NEGOCIACAO: oficial.negociacao, PROPOSTA: oficial.proposta, FECHADO: oficial.fechamento }
  // 2) Por data de avanço, no período escolhido.
  const porAvanco = funilPorDataDeAvanco(leads, d => d >= pInicio && d < pFim)
  const contAvanco = Object.fromEntries(ETAPAS.map(e => [e, porAvanco[e].length])) as Record<Etapa, number>
  // 3) Coorte do período (leads criados nele, até onde chegaram).
  const coortePeriodo = leads.filter(l => l.criadoEm >= pInicio && l.criadoEm < pFim)
  const contCoorte = funilDaCoorte(coortePeriodo)
  // Coorte de referência para "conversões atuais": leads de 90 a 7 dias atrás (maduros).
  const refIni = new Date(Date.parse(`${hoje}T00:00:00Z`) + OFFSET - 90 * DIA)
  const refFim = new Date(Date.parse(`${hoje}T00:00:00Z`) + OFFSET - 7 * DIA)
  const coorteRef = leads.filter(l => l.criadoEm >= refIni && l.criadoEm < refFim)
  const contRef = funilDaCoorte(coorteRef)

  const conversoesDe = (c: Record<Etapa, number>) => PASSAGENS.map(([de, para]) => conversaoEtapa(c[para], c[de]))
  const convOficial = conversoesDe(contOficial)
  const convCoorte = conversoesDe(contCoorte)
  const convRef = conversoesDe(contRef)

  // Tempo médio (dias) entre etapas, na coorte de referência.
  const tempos = PASSAGENS.map(([de, para]) => {
    const xs: number[] = []
    for (const l of coorteRef) {
      const a = dataAlcancouEtapa(l, de as EstagioFunil), b = dataAlcancouEtapa(l, para as EstagioFunil)
      if (a && b && b >= a) xs.push((b.getTime() - a.getTime()) / DIA)
    }
    return xs.length ? arred(xs.reduce((s, x) => s + x, 0) / xs.length, 1) : null
  })

  // Impacto e gargalo (estimativa) sobre a coorte de referência.
  const impactos = PASSAGENS.map(([de], i) => impactoDaPassagem(i, contRef[de as Etapa], convRef, metasConv))
  let gargalo: { passagem: string; indice: number; vendasPerdidas: number; faturamento: number | null } | null = null
  impactos.forEach((v, i) => {
    if (v != null && v > 0 && (!gargalo || v > gargalo.vendasPerdidas)) gargalo = { passagem: `${NOME_ETAPA[PASSAGENS[i][0]]} → ${NOME_ETAPA[PASSAGENS[i][1]]}`, indice: i, vendasPerdidas: arred(v, 1) ?? 0, faturamento: faturamentoProjetado(v, plan.ticketMedio) }
  })

  // ---------- Investimento ----------
  let gastoApiMes: number | null = null, gastoApiPeriodo: number | null = null
  let trafegoPeriodo: ReturnType<typeof somar> | null = null
  const linhasPorCampanha = new Map<string, { nome: string; linhas: Array<Record<string, unknown>> }>()
  if (contaTrafego) {
    const [mesLinhas, perLinhas] = await Promise.all([
      prisma.trafegoInsightDiario.findMany({ where: { contaId: contaTrafego.id, data: { gte: new Date(`${mes}-01T00:00:00Z`), lte: new Date(`${hoje}T00:00:00Z`) } }, select: { gasto: true } }),
      prisma.trafegoInsightDiario.findMany({ where: { contaId: contaTrafego.id, data: { gte: new Date(`${inicio}T00:00:00Z`), lte: new Date(`${fim}T00:00:00Z`) } } }),
    ])
    if (mesLinhas.length) gastoApiMes = arred(mesLinhas.reduce((s, l) => s + l.gasto, 0))
    if (perLinhas.length) {
      trafegoPeriodo = somar(perLinhas as never)
      gastoApiPeriodo = trafegoPeriodo.gasto
      for (const l of perLinhas) {
        const c = linhasPorCampanha.get(l.campanhaId) ?? { nome: l.campanhaNome, linhas: [] }
        c.linhas.push(l as never)
        linhasPorCampanha.set(l.campanhaId, c)
      }
    }
  }
  const investimentoMes = gastoApiMes ?? gastoManual?.valor ?? null
  const fonteInvestimento = gastoApiMes != null ? 'Tráfego (Meta, sincronizado)' : gastoManual ? 'Indicadores (gasto mensal digitado)' : null
  const periodoEhMesInteiro = inicio === `${mes}-01` && fim === hoje
  const investimentoPeriodo = gastoApiPeriodo ?? (periodoEhMesInteiro ? gastoManual?.valor ?? null : null)

  // ---------- Vendas e metas ----------
  const faturamentoMes = vendasMes.reduce((s, v) => s + v.valorVenda, 0)
  const vendasN = vendasMes.length
  const recenteUteis = Array.from({ length: 14 }, (_, k) => somaDias(hoje, -k)).filter(d => diasSem.includes(new Date(`${d}T00:00:00Z`).getUTCDay())).length
  const projecao = projetarMes(vendasN, cal, { vendas: vendas14, diasUteis: recenteUteis })
  const faturamentoMesAnt = vendasMesAnt.reduce((s, v) => s + v.valorVenda, 0)
  const leadsMesBR = leads.filter(l => l.criadoEm >= inicioMesBR && l.criadoEm < pFim).length
  const ctRef = conversaoTotal(convRef)
  const ctMetas = conversaoTotal(metasConv)
  const leadsNecRef = leadsNecessarios(metaVendasN, ctRef)
  const leadsNecMetas = leadsNecessarios(metaVendasN, ctMetas)
  const orcDisponivel = investimentoMes != null ? Math.max(0, plan.orcamentoMarketing - investimentoMes) : plan.orcamentoMarketing
  const vendasFaltam = metaVendasN != null ? Math.max(0, metaVendasN - vendasN) : null
  const leadsFaltamRef = vendasFaltam != null && ctRef ? Math.max(0, Math.ceil(vendasFaltam / ctRef - 1e-9)) : null
  // Pipeline: propostas em aberto × conversão de proposta para fechamento (coorte de referência).
  const propostasAbertas = leads.filter(l => l.estagio === 'PROPOSTA').length
  const pipeline = convRef[3] != null ? arred(propostasAbertas * (convRef[3] as number), 1) : null

  const personalizado = (plan.cenarioPersonalizado ?? null) as { conversoes?: number[]; ticket?: number; orcamento?: number } | null
  const cenarios: Cenario[] = [
    cenario('Conversões atuais (coorte de 90 a 7 dias)', convRef, metaVendasN, plan.orcamentoMarketing, plan.ticketMedio),
    cenario('Metas gerenciais', metasConv, metaVendasN, plan.orcamentoMarketing, plan.ticketMedio),
    // O personalizado só entra quando foi configurado nas Premissas.
    ...(personalizado?.conversoes?.length === 4 ? [cenario('Personalizado', personalizado.conversoes, metaVendasN, personalizado.orcamento ?? plan.orcamentoMarketing, personalizado.ticket ?? plan.ticketMedio)] : []),
  ]

  // ---------- Tráfego e atribuição ----------
  const leadsTrafegoPeriodo = coortePeriodo.filter(l => l.tipoLead === 'TRAFEGO')
  const leadsTrafegoRef = coorteRef.filter(l => l.tipoLead === 'TRAFEGO')
  const leadsOrgRef = coorteRef.filter(l => l.tipoLead !== 'TRAFEGO')
  const qualidade = (ls: typeof coorteRef) => ({ leads: ls.length, negociacao: ls.filter(l => maiorEstagio(l) >= 2).length, taxaNegociacao: razao(ls.filter(l => maiorEstagio(l) >= 2).length, ls.length) })
  const vendasTrafegoMes = vendasMes.filter(v => v.lead?.tipoLead === 'TRAFEGO')
  const fatTrafegoMes = vendasTrafegoMes.reduce((s, v) => s + v.valorVenda, 0)
  const der = trafegoPeriodo ? derivadas(trafegoPeriodo, null) : null
  const diasMesTotal = new Date(Date.UTC(ano, mesN, 0)).getUTCDate()
  const diaMes = hoje.slice(0, 7) === mes ? Number(hoje.slice(8, 10)) : diasMesTotal
  const orcProporcional = plan.orcamentoMarketing * (diaMes / diasMesTotal)
  const campanhas = [...linhasPorCampanha.entries()].map(([id, c]) => {
    const m = somar(c.linhas as never)
    const d = derivadas(m, null)
    return { id, nome: c.nome, gasto: m.gasto, impressoes: m.impressoes, cliquesLink: m.cliquesLink, conversas: m.conversas, leads: m.leads, ctr: d.ctr, cpc: d.cpc, custoResultado: d.custoResultado }
  }).sort((a, b) => b.gasto - a.gasto)

  // ---------- Social Media ----------
  let social: Record<string, unknown> | null = null
  if (contaSocial) {
    try {
      const a = await analisarContaSocialMedia({ usuarioId, conta: contaSocial, vendedorTitular: null, inicio, fim, origem: 'ORGANICO' })
      if (a.conectado) {
        const [planejadas, publicadas, cliques, leadsOrg, vendasOrg] = await Promise.all([
          prisma.smPauta.count({ where: { usuarioId, agendadoPara: { gte: pInicio, lt: pFim } } }),
          prisma.smPauta.count({ where: { usuarioId, status: 'PUBLICADO', publicadaEm: { gte: pInicio, lt: pFim } } }),
          prisma.smLinkClique.count({ where: { em: { gte: pInicio, lt: pFim }, link: { usuarioId } } }),
          prisma.lead.count({ where: { usuarioId, origem: 'INSTAGRAM_ORGANICO', criadoEm: { gte: pInicio, lt: pFim } } }),
          prisma.venda.findMany({ where: { usuarioId, origem: 'INSTAGRAM_ORGANICO', data: { gte: new Date(`${inicio}T00:00:00Z`), lte: new Date(`${fim}T00:00:00Z`) } }, select: { valorVenda: true } }),
        ])
        const k = a.kpis
        const seg = k.seguidores
        social = {
          conectado: true, conta: a.conta.nomeUsuario, ultimaSincronizacaoEm: a.conta.ultimaSincronizacaoEm, qualidade: a.qualidade.status,
          producao: { planejadas, publicadasPelaProducao: publicadas, publicacoesNoFeed: k.publicacoes.atual, metaPublicacoes: k.publicacoes.meta, diasComPost: k.diasComPost.atual, maiorIntervalo: k.diasComPost.maiorIntervalo },
          distribuicao: { alcanceMedioDia: k.alcanceMedioDia.atual, alcanceMedioDiaAnterior: k.alcanceMedioDia.anterior, visualizacoes: k.visualizacoes.atual, visualizacoesAnterior: k.visualizacoes.anterior, shareNaoSeguidores: a.distribuicaoAlcance?.shareDescoberta ?? null },
          atencao: { reels: a.reels.quantidade, tempoMedioAssistidoSeg: a.reels.quantidade ? arred(a.reels.tempoMedioAssistidoSeg, 1) : null },
          interesse: { interacoes: k.interacoes.atual, interacoesAnterior: k.interacoes.anterior, taxaEngajamento: k.taxaEngajamento.atual, visitasPerfil: k.visitasPerfil.atual, visitasPerfilAnterior: k.visitasPerfil.anterior, toquesLinks: k.toquesLinks.atual, cliquesLinksRastreados: cliques },
          conversao: {
            novosSeguidores: seg.ganhos, crescimentoLiquido: seg.ganhos - seg.perdidos, taxaVisitaSeguidor: razao(seg.ganhos, k.visitasPerfil.atual),
            leadsOrganicos: leadsOrg, vendasAtribuidas: vendasOrg.length, faturamentoAtribuido: vendasOrg.reduce((s, v) => s + v.valorVenda, 0),
          },
        }
      }
    } catch (e) { social = { conectado: true, erro: e instanceof Error ? e.message : 'Falha ao ler o Social Media' } }
  }

  // ---------- Equipe (Copiloto) ----------
  const equipe = await coletarFatos(usuarioId, EQUIPE, agora).catch(() => null)

  // ---------- Financeiro ----------
  const porCategoria: Record<string, number> = {}
  for (const l of lancamentos) porCategoria[l.categoria] = (porCategoria[l.categoria] ?? 0) + l.valorTotal
  const comissoesMes = vendasMes.reduce((s, v) => s + (v.valorComissao ?? 0), 0)
  const proLaboreMes = vendasMes.reduce((s, v) => s + v.valorProLabore, 0)
  const margemTotal = plan.margemContribuicaoVenda != null ? plan.margemContribuicaoVenda * vendasN : null

  // ---------- Estoque ----------
  const diasEstoque = estoque.map(m => Math.floor((agora.getTime() - m.entradaEm.getTime()) / DIA))
  const estoqueRes = {
    disponiveis: estoque.filter(m => m.situacao === 'DISPONIVEL').length, reservadas: estoque.filter(m => m.situacao === 'RESERVADA').length,
    diasMedio: diasEstoque.length ? Math.round(diasEstoque.reduce((s, x) => s + x, 0) / diasEstoque.length) : null,
    maisAntigas: estoque.map((m, i) => ({ modelo: [m.modelo, m.ano].filter(Boolean).join(' '), dias: diasEstoque[i] })).sort((a, b) => b.dias - a.dias).slice(0, 5),
  }

  // ---------- Fontes e fechamentos ----------
  const fechamentos = await prisma.intelRelatorio.findMany({ where: { usuarioId, status: 'VALIDO' }, orderBy: { confirmadoEm: 'desc' }, take: 60, select: { modulo: true, dia: true, versao: true, confirmadoEm: true, geradoPorNome: true } })
  const ultimoFech = (m: string) => fechamentos.find(f => f.modulo === m) ?? null
  const atrasado = (d: Date | null | undefined) => !d || agora.getTime() - d.getTime() > 26 * H
  const fontes = [
    { modulo: 'JORNADA', nome: 'Jornada de compra (CRM)', status: 'OK', ultimaAtualizacao: ultimoLead?.atualizadoEm ?? null, detalhe: 'Leitura direta do CRM, em tempo real.', fechamento: ultimoFech('JORNADA') },
    { modulo: 'TRAFEGO', nome: 'Tráfego (Meta Ads)', status: !contaTrafego ? 'SEM_CONEXAO' : contaTrafego.ultimoErroSync ? 'ERRO' : atrasado(contaTrafego.ultimaSincronizacaoEm) ? 'ATRASADO' : 'OK', ultimaAtualizacao: contaTrafego?.ultimaSincronizacaoEm ?? null, detalhe: !contaTrafego ? 'Conta de anúncios não conectada: o investimento vem do gasto digitado nos Indicadores, quando houver.' : contaTrafego.ultimoErroSync ?? 'Sincronização automática da Meta.', fechamento: ultimoFech('TRAFEGO') },
    { modulo: 'SOCIAL_MEDIA', nome: 'Social Media (Instagram)', status: !contaSocial ? 'SEM_CONEXAO' : contaSocial.ultimoErroSync ? 'ERRO' : atrasado(contaSocial.ultimaSincronizacaoEm) ? 'ATRASADO' : 'OK', ultimaAtualizacao: contaSocial?.ultimaSincronizacaoEm ?? null, detalhe: !contaSocial ? 'Instagram da empresa não conectado.' : contaSocial.ultimoErroSync ?? 'Sincronização automática do Instagram.', fechamento: ultimoFech('SOCIAL_MEDIA') },
    { modulo: 'VENDAS', nome: 'Vendas', status: 'OK', ultimaAtualizacao: vendasMes.reduce<Date | null>((m, v) => (!m || v.criadoEm > m ? v.criadoEm : m), null), detalhe: 'Vendas registradas, em tempo real.', fechamento: ultimoFech('VENDAS') },
    ...(acesso.verFinanceiro ? [{ modulo: 'FINANCEIRO', nome: 'Financeiro', status: 'OK', ultimaAtualizacao: null as Date | null, detalhe: 'Lançamentos pagos, em tempo real.', fechamento: ultimoFech('FINANCEIRO') }] : []),
    ...(acesso.verInvestimento ? [{ modulo: 'GASTO_MANUAL', nome: 'Gasto com anúncios (Indicadores)', status: gastoManual ? 'MANUAL' : 'SEM_DADOS', ultimaAtualizacao: gastoManual?.atualizadoEm ?? null, detalhe: gastoManual ? 'Valor mensal digitado à mão (usado no ROAS e CAC do Dashboard).' : 'Nenhum gasto digitado para este mês.', fechamento: null }] : []),
  ]

  // ---------- Inconsistências ----------
  const inconsistencias: Array<{ titulo: string; detalhe: string; validar: string }> = []
  if (acesso.verInvestimento && gastoApiMes != null && gastoManual && Math.abs(gastoApiMes - gastoManual.valor) > Math.max(50, gastoManual.valor * 0.1)) {
    inconsistencias.push({ titulo: 'Investimento diferente entre Tráfego e Indicadores', detalhe: `O Tráfego (Meta) soma ${brl(gastoApiMes)} no mês; o gasto digitado nos Indicadores é ${brl(gastoManual.valor)}. O ROAS e o CAC do Dashboard usam o valor digitado.`, validar: 'Indicadores → gasto com anúncios do mês' })
  }
  const vendasSemLead = vendasMes.filter(v => !v.lead).length
  if (vendasSemLead > 0) inconsistencias.push({ titulo: `${vendasSemLead} ${vendasSemLead === 1 ? 'venda sem lead vinculado' : 'vendas sem lead vinculado'} no mês`, detalhe: 'Sem o lead, a venda não entra na conversão da coorte nem na atribuição por canal.', validar: 'Vendas → vincular ao lead do CRM' })
  const fechadosSemVenda = leads.filter(l => l.estagio === 'FECHADO' && !l.vendaId && l.atualizadoEm >= inicioMesBR).length
  if (fechadosSemVenda > 0) inconsistencias.push({ titulo: `${fechadosSemVenda} ${fechadosSemVenda === 1 ? 'lead fechado sem venda registrada' : 'leads fechados sem venda registrada'}`, detalhe: 'O lead está como fechado no CRM, mas a venda não foi lançada: o faturamento e o "Fechamento" da Jornada ficam abaixo do real.', validar: 'CRM → converter o lead em venda' })
  const vendasDaCoorteMes = leadsDoMesUTC.filter(l => l.estagio === 'FECHADO').length
  if (oficial.fonte === 'LEADS' && vendasDaCoorteMes !== oficial.fechamento) {
    inconsistencias.push({ titulo: 'O "Fechamento" da Jornada mistura coortes', detalhe: `No Dashboard, o Fechamento do mês (${oficial.fechamento}) conta todas as vendas do mês; só ${vendasDaCoorteMes} vieram de leads criados no próprio mês. Por isso a Central usa a coorte para conversões e projeções.`, validar: 'Nada a corrigir: é a regra do Dashboard. Leia as duas visões.' })
  }

  // Série diária do mês: vendas (data da venda), leads (criação, Brasília) e investimento (Tráfego).
  const gastoPorDia = new Map<string, number>()
  if (contaTrafego) {
    const g = await prisma.trafegoInsightDiario.groupBy({ by: ['data'], where: { contaId: contaTrafego.id, data: { gte: new Date(`${mes}-01T00:00:00Z`), lte: new Date(`${hoje}T00:00:00Z`) } }, _sum: { gasto: true } })
    for (const x of g) gastoPorDia.set(ch(x.data), x._sum.gasto ?? 0)
  }
  const ultimoDiaSerie = hoje.slice(0, 7) === mes ? Number(hoje.slice(8, 10)) : new Date(Date.UTC(ano, mesN, 0)).getUTCDate()
  const serieMes = Array.from({ length: ultimoDiaSerie }, (_, i) => {
    const diaS = `${mes}-${String(i + 1).padStart(2, '0')}`
    const ini = inicioDia(diaS), fimD = inicioDia(somaDias(diaS, 1))
    return {
      dia: diaS,
      vendas: vendasMes.filter(v => ch(v.data) === diaS).length,
      leads: leads.filter(l => l.criadoEm >= ini && l.criadoEm < fimD).length,
      gasto: acesso.verInvestimento ? (contaTrafego ? arred(gastoPorDia.get(diaS) ?? 0) : null) : null,
    }
  })

  const ticketReal = razao(faturamentoMes, vendasN)
  const custoVendaMes = custoPorVenda(investimentoMes, vendasN)
  const tetoCustoVenda = custoPorVenda(plan.orcamentoMarketing, metaVendasN)
  const cplMaxMetas = cplMaximo(plan.orcamentoMarketing, leadsNecMetas)
  const cplMaxRef = cplMaximo(plan.orcamentoMarketing, leadsNecRef)

  return {
    geradoEm: agora.toISOString(),
    periodo: { inicio, fim, mes, hoje, mesInteiro: periodoEhMesInteiro },
    acesso,
    premissas: {
      metaFaturamentoMensal: plan.metaFaturamentoMensal, ticketMedio: plan.ticketMedio, orcamentoMarketing: plan.orcamentoMarketing, metaVendas: metaVendasN,
      tetoCustoMarketingVenda: tetoCustoVenda, vendedores: { planejados: plan.vendedoresPlanejados, cadastrados: vendedoresAtivos },
      metasConversao: metasConv, margemContribuicaoVenda: plan.margemContribuicaoVenda, diasUteisSemana: diasSem, criterios, personalizado,
      atualizadoEm: plan.atualizadoEm, atualizadoPor: plan.atualizadoPor,
    },
    resumo: {
      faturamento: { meta: plan.metaFaturamentoMensal, realizado: faturamentoMes, atingimento: atingimento(faturamentoMes, plan.metaFaturamentoMensal), falta: Math.max(0, plan.metaFaturamentoMensal - faturamentoMes), mesAnteriorMesmoPonto: faturamentoMesAnt, projecaoBase: faturamentoProjetado(projecao.base, ticketReal ?? plan.ticketMedio) },
      vendas: { meta: metaVendasN, realizado: vendasN, previstasBase: projecao.base, falta: vendasFaltam, ticketReal },
      investimento: acesso.verInvestimento ? { orcamento: plan.orcamentoMarketing, realizado: investimentoMes, disponivel: orcDisponivel, proporcional: arred(orcProporcional), fonte: fonteInvestimento } : null,
      leadsMes: leadsMesBR,
      cplMes: acesso.verInvestimento ? cpl(investimentoMes, leadsMesBR) : null,
      custoMarketingPorVenda: acesso.verInvestimento ? custoVendaMes : null,
      conversaoTotalRef: ctRef,
      atingimentoPrevisto: atingimento(projecao.base, metaVendasN),
    },
    metas: {
      calendario: cal,
      ritmoVendas: ritmoNecessario(metaVendasN, vendasN, cal.restantes),
      ritmoFaturamento: ritmoNecessario(plan.metaFaturamentoMensal, faturamentoMes, cal.restantes),
      leadsNecessarios: { comConversaoAtual: leadsNecRef, comMetas: leadsNecMetas, faltamComConversaoAtual: leadsFaltamRef, geradosNoMes: leadsMesBR },
      cplMaximo: acesso.verInvestimento ? { comConversaoAtual: cplMaxRef, comMetas: cplMaxMetas } : null,
      custoMaximoPorVenda: acesso.verInvestimento ? tetoCustoVenda : null,
      projecao, pipeline: { propostasAbertas, vendasEsperadas: pipeline, formula: 'propostas em aberto × conversão de proposta para fechamento da coorte de referência' },
    },
    cenarios: acesso.verInvestimento ? cenarios : cenarios.map(c => ({ ...c, investimento: 0, cplMaximo: null, custoPorVenda: null })),
    funil: {
      oficial: { contagens: contOficial, fonte: oficial.fonte, conversoes: convOficial, acumulada: ETAPAS.map(e => razao(contOficial[e], contOficial.LEAD)), metasOficiais: metasOficiais.map(m => ({ etapa: m.etapa, tipoMeta: m.tipoMeta, metaPct: m.metaPct, metaCusto: acesso.verInvestimento ? m.metaCusto : null })) },
      porAvanco: { contagens: contAvanco },
      coorte: { contagens: contCoorte, conversoes: convCoorte },
      referencia: {
        contagens: contRef, conversoes: convRef, conversaoTotal: ctRef, tempoMedioDias: tempos,
        perdas: PASSAGENS.map(([de, para]) => perda(contRef[de as Etapa], contRef[para as Etapa])),
        impactoVendas: impactos.map(v => arred(v, 1)), periodo: { inicio: ch(new Date(refIni.getTime() - OFFSET)), fim: ch(new Date(refFim.getTime() - OFFSET - DIA)) },
      },
      metasConversao: metasConv,
      custoAcumulado: acesso.verInvestimento ? custoAcumuladoPorEtapa(investimentoMes, contOficial) : null,
      gargalo,
    },
    trafego: acesso.verInvestimento ? {
      conectado: !!contaTrafego, conta: contaTrafego?.nome ?? null,
      plataforma: trafegoPeriodo ? { gasto: trafegoPeriodo.gasto, impressoes: trafegoPeriodo.impressoes, alcanceSomado: trafegoPeriodo.alcance, cliques: trafegoPeriodo.cliques, cliquesLink: trafegoPeriodo.cliquesLink, conversas: trafegoPeriodo.conversas, leads: trafegoPeriodo.leads, ctr: der?.ctr ?? null, cpc: der?.cpc ?? null, cpm: der?.cpm ?? null, custoResultado: der?.custoResultado ?? null } : null,
      crm: { leadsTrafego: leadsTrafegoPeriodo.length, cplCrm: cpl(investimentoPeriodo, leadsTrafegoPeriodo.length), leadsTodos: coortePeriodo.length, custoPorLeadTodos: cpl(investimentoPeriodo, coortePeriodo.length) },
      qualidade: { trafego: qualidade(leadsTrafegoRef), outros: qualidade(leadsOrgRef) },
      atribuicao: { regra: 'Venda de lead marcado como Tráfego no CRM (não há identificador de campanha no lead).', vendas: vendasTrafegoMes.length, faturamento: fatTrafegoMes, custoPorVenda: custoPorVenda(investimentoMes, vendasTrafegoMes.length), roas: roas(fatTrafegoMes, investimentoMes) },
      ritmo: { gastoMes: investimentoMes, orcamentoProporcional: arred(orcProporcional), pct: razao(investimentoMes, orcProporcional), projecaoMes: investimentoMes != null && diaMes > 0 ? arred((investimentoMes / diaMes) * diasMesTotal) : null },
      campanhas: campanhas.slice(0, 10),
    } : null,
    social,
    equipe: equipe ? {
      linhas: equipe.equipe ?? [], tempoAbordagemHoras: equipe.tempoAbordagemHoras, parados: equipe.parados.total, semAbordar: equipe.parados.semAbordar,
      whatsapp: { esperando: equipe.whatsapp.esperandoAgora, semResposta: equipe.whatsapp.semResposta, tempoAssumirMinutos: equipe.whatsapp.tempoAssumirMinutos }, agendaPct: equipe.agenda.percentual,
    } : null,
    financeiro: acesso.verFinanceiro ? {
      faturamentoBruto: faturamentoMes, comissoes: comissoesMes, proLabore: acesso.verProLabore ? proLaboreMes : null, investimentoMarketing: investimentoMes,
      despesasLancadas: porCategoria, totalLancado: Object.values(porCategoria).reduce((s, x) => s + x, 0),
      margemContribuicao: margemTotal, margemConfigurada: plan.margemContribuicaoVenda != null,
      roasGeral: roas(faturamentoMes, investimentoMes),
      avisos: ['Faturamento não é lucro: o resultado depende da margem de cada moto, impostos, comissões, preparação e custos fixos.', ...(plan.margemContribuicaoVenda == null ? ['A margem de contribuição por venda ainda não foi definida nas premissas: sem ela, o sistema não calcula margem nem lucro.'] : [])],
    } : null,
    estoque: estoqueRes,
    fontes, inconsistencias,
    vendedoresAtivos,
    serieMes,
  }
}

export type DadosCentral = Awaited<ReturnType<typeof montarCentral>>
export const brl = (v: number | null | undefined) => (v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: v >= 100 ? 0 : 2 }))
