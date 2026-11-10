// Ajuste 1 · Painel do Hoje do dono (e do supervisor, sem as cifras do dono).
// Tudo vem do dicionário de métricas (P2); filtros de período (com a comparação
// padrão), vendedor, SDR, origem e forma de pagamento valem para o Painel
// inteiro. As exclusões aprovadas (à vista fora de MQL/SQL; venda sem visita
// fora de Agendamento/Visita) já vêm aplicadas pela ficha, com a contagem para o aviso.
import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { calcular, hojeBrt, ler, metaDoMes, type Escopo, type FiltrosEscopo, type Periodo } from './metricas'
import { ETAPAS, NOME_ETAPA, NOME_MOTIVO, faseDa, type Etapa } from './etapasJornada'
import { premissas, type TempoMaximo } from './jornadaPremissas'

export class ErroPainel extends Error { constructor(public status: number, msg: string) { super(msg) } }
export interface MetaEtapa { conversaoMin: number | null; perdaMax: number | null; custoMax: number | null }
export interface FiltrosPainel extends FiltrosEscopo { vendedorId?: string | null }
type Status = 'BOM' | 'ATENCAO' | 'CRITICO' | null

const DIA = 86_400_000
const isoDia = (d: Date) => d.toISOString().slice(0, 10)
const maisDias = (s: string, n: number) => isoDia(new Date(new Date(`${s}T00:00:00.000Z`).getTime() + n * DIA))
const EM_DIAS: Record<string, number> = { MINUTOS: 1 / 1440, HORAS: 1 / 24, DIAS: 1 }
const diasDoTempo = (t: TempoMaximo | undefined) => (t?.valor != null ? t.valor * (EM_DIAS[t.unidade] ?? 1) : null)
/** Mesma regra das faixas do dicionário: bom no alvo ou melhor; atenção até 20% pior; crítico além disso. */
function contra(valor: number | null | undefined, alvo: number | null | undefined, melhor: 'MAIOR' | 'MENOR'): Status {
  if (valor == null || alvo == null) return null
  if (melhor === 'MAIOR') return valor >= alvo ? 'BOM' : valor >= alvo * 0.8 ? 'ATENCAO' : 'CRITICO'
  if (alvo === 0) return valor <= 0 ? 'BOM' : 'CRITICO'
  return valor <= alvo ? 'BOM' : valor <= alvo * 1.2 ? 'ATENCAO' : 'CRITICO'
}
const PIOR: Record<string, number> = { BOM: 0, ATENCAO: 1, CRITICO: 2 }
const pior = (xs: Status[]): Status => xs.filter(Boolean).sort((a, b) => PIOR[b!] - PIOR[a!])[0] ?? null

export async function metasDasEtapas(usuarioId: string) {
  const [p, prem] = await Promise.all([prisma.parametroLiquidez.findUnique({ where: { usuarioId }, select: { metasEtapas: true } }), premissas(usuarioId)])
  const salvas = (p?.metasEtapas ?? {}) as Partial<Record<Etapa, MetaEtapa>>
  return Object.fromEntries(ETAPAS.map(e => [e, { conversaoMin: salvas[e]?.conversaoMin ?? null, perdaMax: salvas[e]?.perdaMax ?? null, custoMax: salvas[e]?.custoMax ?? null, tempoMax: prem.temposMaximos[e] }])) as Record<Etapa, MetaEtapa & { tempoMax: TempoMaximo }>
}
/** Metas por etapa: só o dono; cada mudança fica no histórico de parâmetros com a justificativa (P3). */
export async function salvarMetaEtapa(usuarioId: string, etapa: Etapa, m: MetaEtapa, justificativa: string, autorId: string) {
  if (!ETAPAS.includes(etapa)) throw new ErroPainel(400, 'Etapa desconhecida')
  const p = await prisma.parametroLiquidez.findUnique({ where: { usuarioId }, select: { metasEtapas: true } })
  const todas = { ...((p?.metasEtapas ?? {}) as unknown as Record<string, MetaEtapa>) }
  const antes = todas[etapa] ?? { conversaoMin: null, perdaMax: null, custoMax: null }
  const limpo = { conversaoMin: m.conversaoMin, perdaMax: m.perdaMax, custoMax: m.custoMax }
  todas[etapa] = limpo
  await prisma.parametroLiquidez.upsert({ where: { usuarioId }, create: { usuarioId, metasEtapas: todas as unknown as Prisma.InputJsonValue }, update: { metasEtapas: todas as unknown as Prisma.InputJsonValue } })
  await prisma.parametroHistorico.create({ data: { usuarioId, nome: `metaEtapa.${etapa}`, valorAnterior: antes as unknown as Prisma.InputJsonValue, valorNovo: limpo as unknown as Prisma.InputJsonValue, origem: 'MANUAL', justificativa, autorId } })
  return limpo
}

type Leitor = { usuarioId: string; papel: 'DONO' | 'SUPERVISOR' }

export async function opcoesDoPainel(usuarioId: string) {
  const [vs, origens, formas] = await Promise.all([
    prisma.vendedor.findMany({ where: { usuarioId, ativo: true, funcao: null }, select: { id: true, nome: true, papel: true, vende: true }, orderBy: { nome: 'asc' } }),
    prisma.$queryRaw<Array<{ o: string }>>`SELECT DISTINCT coalesce("origemTipo", 'DESCONHECIDA') o FROM pro_labore_leads WHERE "usuarioId" = ${usuarioId} ORDER BY 1`,
    prisma.$queryRaw<Array<{ f: string }>>`SELECT DISTINCT "formaPagamento" f FROM pro_labore_leads WHERE "usuarioId" = ${usuarioId} AND "formaPagamento" IS NOT NULL ORDER BY 1`,
  ])
  return { vendedores: vs.filter(v => v.vende).map(v => ({ id: v.id, nome: v.nome })), sdrs: vs.filter(v => v.papel === 'SDR').map(v => ({ id: v.id, nome: v.nome })), origens: origens.map(x => x.o), formasPagamento: formas.map(x => x.f) }
}

// O Painel carrega em duas partes (cada chamada cabe nos 30 s da Vercel): TOPO = Agora, Jornada e Indicadores;
// SERIES = Faturamento, Pró-labore e comissões, Equipe e Anúncios. O teste do Ajuste 1 pede só a seção que confere.
export type ParteSecao = 'agora' | 'jornada' | 'indicadores' | 'series'
export const PARTES: Record<'TUDO' | 'TOPO' | 'SERIES', ParteSecao[]> = { TUDO: ['agora', 'jornada', 'indicadores', 'series'], TOPO: ['agora', 'jornada', 'indicadores'], SERIES: ['series'] }

export async function painel(quem: Leitor, p: Periodo, f: FiltrosPainel, agora = new Date(), partes: ParteSecao[] = PARTES.TUDO) {
  const dono = quem.papel === 'DONO'
  const quer = new Set(partes)
  const e: Escopo = { usuarioId: quem.usuarioId, papel: 'DONO', vendedorId: f.vendedorId ?? null, filtros: { sdrId: f.sdrId ?? null, origem: f.origem ?? null, formaPagamento: f.formaPagamento ?? null } }
  const loja: Escopo = { usuarioId: quem.usuarioId, papel: 'DONO' }
  const L = (chave: string, esc: Escopo = e, per: Periodo = p) => ler(chave, esc, per, agora).catch(() => null)
  const C = (chave: string, esc: Escopo = e, per: Periodo = p) => calcular(chave, esc, per, agora).catch(() => null)
  const resumo = (l: Awaited<ReturnType<typeof L>>) => (l ? { chave: l.chave, nome: l.nome, unidade: l.unidade, melhor: l.melhor, valor: l.valor, anterior: l.anterior, variacao: l.variacao, projecao: l.projecao, status: l.faixa } : null)

  // 1) Agora
  const [fat, conv, cpv, meta] = !quer.has('agora') ? [null, null, null, null] : await Promise.all([L('faturamento'), L('conversao_lead_venda'), dono ? L('custo_por_venda') : Promise.resolve(null), metaDoMes({ usuarioId: quem.usuarioId, vendedorId: f.vendedorId ?? null })])
  const agoraSec = !quer.has('agora') ? null : {
    faturamento: { ...resumo(fat), meta, statusMeta: contra(fat?.projecao ?? fat?.valor, meta, 'MAIOR') },
    conversao: resumo(conv),
    custoPorVenda: dono ? resumo(cpv) : null,
  }

  // 2) Jornada de compra (10 etapas, agrupadas por fase)
  const ini90 = maisDias(hojeBrt(agora), -90)
  const temJ = quer.has('jornada')
  const nada = Promise.resolve(null)
  const [convE, perdaE, tempoE, custoE, valoresE, metas, hist] = !temJ ? [null, null, null, null, null, await metasDasEtapas(quem.usuarioId), null] : await Promise.all([
    C('conversao_por_etapa'), C('perda_por_etapa'), C('tempo_na_etapa'), dono ? C('custo_por_etapa') : Promise.resolve(null), dono ? C('valores_por_etapa') : Promise.resolve(null),
    metasDasEtapas(quem.usuarioId), C('conversao_por_etapa', e, { inicio: ini90, fim: hojeBrt(agora) }),
  ])
  const vendasNoPeriodo = temJ ? await C('vendas') : null
  type DetConv = Array<{ etapa: string; chegaram: number; seguiram: number; conversao: number | null; excluidos: number }>
  const dConv = (convE?.detalhe ?? []) as DetConv
  const dHist = (hist?.detalhe ?? []) as DetConv
  const dPerda = (perdaE?.detalhe ?? []) as Array<{ etapa: string; perdidos: number; pct: number | null; motivos: Array<{ motivo: string; n: number }> }>
  const dTempo = (tempoE?.detalhe ?? {}) as Record<string, number | null>
  const dCusto = ((custoE?.detalhe as { etapas?: Array<{ etapa: string; leads: number; custo: number | null }> } | undefined)?.etapas) ?? []
  const dVal = ((valoresE?.detalhe as { etapas?: Array<Record<string, number | string>> } | undefined)?.etapas) ?? []
  const recsEtapa = !temJ ? [] : await prisma.recomendacao.findMany({ where: { usuarioId: quem.usuarioId, alvoTipo: 'ETAPA', status: { in: ['NOVA', 'ACEITA', 'EM_EXECUCAO'] } }, select: { id: true, codigo: true, titulo: true, alvoId: true } })
  const etapas = ETAPAS.map(et => {
    const c = dConv.find(x => x.etapa === et), h = dHist.find(x => x.etapa === et), pd = dPerda.find(x => x.etapa === et)
    const m = metas[et]
    const volume = et === 'VENDA' ? (vendasNoPeriodo?.valor ?? 0) : c?.chegaram ?? 0
    const conversao = et === 'VENDA' ? null : c?.conversao ?? null
    const tempo = et === 'VENDA' ? null : dTempo[et] ?? null
    const tempoMaxDias = diasDoTempo(m.tempoMax)
    const custo = dono ? dCusto.find(x => x.etapa === et)?.custo ?? null : null
    // Situação: pelas metas da etapa; sem meta, pela conversão contra o histórico de 90 dias da própria etapa.
    const sConv = m.conversaoMin != null ? contra(conversao, m.conversaoMin, 'MAIOR') : contra(conversao, h?.conversao ?? null, 'MAIOR')
    const sPerda = contra(pd?.pct ?? null, m.perdaMax, 'MENOR')
    const sTempo = contra(tempo, tempoMaxDias, 'MENOR')
    const sCusto = dono ? contra(custo, m.custoMax, 'MENOR') : null
    const situacao = et === 'VENDA' ? null : pior([sConv, sPerda, sTempo, sCusto])
    // Distância da meta, para escolher o gargalo (a etapa mais fora da meta).
    const desvio = Math.max(
      m.conversaoMin != null && conversao != null && m.conversaoMin > 0 ? (m.conversaoMin - conversao) / m.conversaoMin : h?.conversao && conversao != null ? (h.conversao - conversao) / h.conversao : 0,
      m.perdaMax != null && pd?.pct != null && m.perdaMax > 0 ? (pd.pct - m.perdaMax) / m.perdaMax : 0,
      tempoMaxDias && tempo != null ? (tempo - tempoMaxDias) / tempoMaxDias : 0,
      dono && m.custoMax && custo != null ? (custo - m.custoMax) / m.custoMax : 0,
    )
    const v = dVal.find(x => x.etapa === et)
    return {
      etapa: et, nome: NOME_ETAPA[et], fase: faseDa(et), volume, conversao, conversaoHistorico: h?.conversao ?? null, excluidos: c?.excluidos ?? 0,
      perda: { pct: pd?.pct ?? null, n: pd?.perdidos ?? 0, motivos: (pd?.motivos ?? []).map(x => ({ ...x, nome: NOME_MOTIVO[x.motivo] ?? x.motivo })) },
      tempoMediano: tempo, custo,
      valores: dono && v ? { oportunidade: v.oportunidade as number, proLaborePrevisto: v.proLaborePrevisto as number, comissaoPrevista: v.comissaoPrevista as number, comissaoPerdida: v.comissaoPerdida as number } : null,
      metas: { conversaoMin: m.conversaoMin, perdaMax: m.perdaMax, custoMax: dono ? m.custoMax : null, tempoMax: m.tempoMax, tempoMaxDias },
      status: { conversao: sConv, perda: sPerda, tempo: sTempo, custo: sCusto }, situacao, desvio: situacao === 'CRITICO' || situacao === 'ATENCAO' ? desvio : 0,
      rec: recsEtapa.find(r => r.alvoId === et) ?? null,
      crm: `/pro-labore/leads?etapa=${et}`,
    }
  })
  const candidatos = etapas.filter(x => x.desvio > 0).sort((a, b) => b.desvio - a.desvio)
  const gargalo = candidatos[0]?.etapa ?? null
  const fases = !temJ ? [] : (['PRE_VENDA', 'VENDA', 'FECHAMENTO'] as const).map(fa => {
    const es = etapas.filter(x => x.fase === fa)
    const prox = etapas[ETAPAS.indexOf(es[es.length - 1].etapa) + 1]
    return { fase: fa, nome: fa === 'PRE_VENDA' ? 'Pré-venda' : fa === 'VENDA' ? 'Venda' : 'Fechamento', entraram: es[0].volume, seguiram: prox ? prox.volume : null, conversao: prox && es[0].volume ? Math.round((prox.volume / es[0].volume) * 1000) / 10 : null, perdidos: es.reduce((t, x) => t + x.perda.n, 0), custo: dono ? (fa === 'FECHAMENTO' ? es[0].custo : es[0].custo) : null }
  })
  const excluidos = { aVista: dConv.filter(x => x.etapa === 'MQL' || x.etapa === 'SQL').reduce((t, x) => Math.max(t, x.excluidos), 0), semVisita: dConv.filter(x => x.etapa === 'AGENDAMENTO' || x.etapa === 'VISITA').reduce((t, x) => Math.max(t, x.excluidos), 0) }

  // 3) Indicadores do mês (do período), cada um com a variação pela comparação padrão.
  const chaves = ['faturamento', ...(dono ? ['pro_labore'] : []), 'ticket_medio', ...(dono ? ['comissoes_pagas', 'gasto_anuncio'] : []), 'roas', ...(dono ? ['custo_por_lead'] : []), 'conversao_lead_venda']
  const indicadores = !quer.has('indicadores') ? [] : (await Promise.all(chaves.map(k => L(k, k === 'roas' || k === 'gasto_anuncio' || k === 'custo_por_lead' ? { ...e, vendedorId: null } : e)))).map(resumo).filter(Boolean)

  let faturamentoSec = null, proLaboreSec = null, equipeSec = null, anunciosSec = null
  if (quer.has('series')) {
    // 4) Faturamento do ano; 5) Pró-labore e comissões; 7) Anúncios — séries mensais do dicionário.
    const ano = Number(hojeBrt(agora).slice(0, 4)), mesAtual = Number(hojeBrt(agora).slice(5, 7))
    const meses = Array.from({ length: mesAtual }, (_, i) => {
      const ini = `${ano}-${String(i + 1).padStart(2, '0')}-01`
      const ult = new Date(Date.UTC(ano, i + 1, 0)).getUTCDate()
      return { mes: i + 1, periodo: { inicio: ini, fim: i + 1 === mesAtual ? hojeBrt(agora) : `${ano}-${String(i + 1).padStart(2, '0')}-${ult}` } }
    })
    const serie = (chave: string, esc: Escopo = e) => Promise.all(meses.map(async m => ({ mes: m.mes, valor: (await C(chave, esc, m.periodo))?.valor ?? null })))
    const [receita, proLaboreMes, comissoesMes, roasMes, cplMes, paramAno] = await Promise.all([
      serie('faturamento'), dono ? serie('pro_labore') : Promise.resolve(null), dono ? serie('comissoes_pagas') : Promise.resolve(null),
      serie('roas', { ...e, vendedorId: null }), dono ? serie('custo_por_lead', { ...e, vendedorId: null }) : Promise.resolve(null),
      prisma.parametroLiquidez.findUnique({ where: { usuarioId: quem.usuarioId }, select: { metaFaturamentoAnual: true } }),
    ])
    const acumulado = receita.reduce((t, x) => t + (x.valor ?? 0), 0)
    faturamentoSec = { receitaMensal: receita, acumulado, metaAnual: paramAno?.metaFaturamentoAnual ?? null, statusMeta: contra(acumulado, paramAno?.metaFaturamentoAnual ? (paramAno.metaFaturamentoAnual * (Number(hojeBrt(agora).slice(5, 7)) - 1 + Number(hojeBrt(agora).slice(8, 10)) / 30)) / 12 : null, 'MAIOR') }

    if (dono) {
      const h = hojeBrt(agora)
      const janelas = [{ nome: 'Hoje', periodo: { inicio: h, fim: h } }, { nome: '7 dias', periodo: { inicio: maisDias(h, -6), fim: h } }, { nome: 'Período escolhido', periodo: p }]
      const detalhado = await Promise.all(janelas.map(async j => ({ nome: j.nome, periodo: j.periodo, receita: (await C('faturamento', e, j.periodo))?.valor ?? null, proLabore: (await C('pro_labore', e, j.periodo))?.valor ?? null })))
      proLaboreSec = { proLaboreMensal: proLaboreMes, comissoesMensais: comissoesMes, jaPagoAosVendedores: (comissoesMes ?? []).reduce((t, x) => t + (x.valor ?? 0), 0), detalhado }
    }

    // 6) Equipe: ranking de vendedores por faturamento; de SDRs por leads passados ao vendedor.
    const ops = await opcoesDoPainel(quem.usuarioId)
    const rankingVend = (await Promise.all(ops.vendedores.map(async v => ({ id: v.id, nome: v.nome, valor: (await C('faturamento', { ...loja, vendedorId: v.id, filtros: e.filtros }))?.valor ?? 0, vendas: (await C('vendas', { ...loja, vendedorId: v.id, filtros: e.filtros }))?.valor ?? 0 })))).sort((a, b) => b.valor - a.valor)
    const rankingSdr = (await Promise.all(ops.sdrs.map(async v => ({ id: v.id, nome: v.nome, valor: (await C('leads_passados', { ...loja, vendedorId: v.id }))?.valor ?? 0 })))).sort((a, b) => b.valor - a.valor)
    equipeSec = { vendedores: rankingVend, sdrs: rankingSdr }
    anunciosSec = { roasMensal: roasMes, custoPorLeadMensal: cplMes }
  }

  return {
    periodo: p, filtros: f, papel: quem.papel, geradoEm: agora,
    agora: agoraSec,
    jornada: temJ ? { etapas, fases, gargalo, excluidos } : null,
    indicadores,
    faturamento: faturamentoSec,
    proLabore: proLaboreSec,
    equipe: equipeSec,
    anuncios: anunciosSec,
    avisos: [
      ...(excluidos.aVista ? [`${excluidos.aVista} lead(s) à vista fora de MQL e SQL.`] : []),
      ...(excluidos.semVisita ? [`${excluidos.semVisita} venda(s) sem visita fora de Agendamento e Visita.`] : []),
      ...(f.vendedorId || f.sdrId || f.origem || f.formaPagamento ? ['O gasto com anúncios não se divide por pessoa, origem ou forma de pagamento: ROAS e custos usam o gasto total.'] : []),
    ],
  }
}
