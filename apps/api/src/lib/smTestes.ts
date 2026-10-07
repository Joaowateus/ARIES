// Testes A/B (seção 13.3) e biblioteca de ganchos (seção 3.4).
// - Um post conta na amostra quando a pauta do grupo foi publicada e a
//   mídia já tem métricas; a métrica sai do Instagram, nunca é digitada.
// - O resultado só é declarado com a amostra completa (metade por grupo).
// - Confiança: com 5+ posts por grupo e diferença de 20% ou mais, alta; com
//   20%+ e amostra menor, média; de 10% a 20%, baixa; abaixo de 10%, empate.
import { Prisma, SmTeste } from '@prisma/client'
import { prisma } from './prisma'

export const VARIAVEIS = ['HORARIO', 'GANCHO', 'FORMATO', 'CTA', 'OUTRO'] as const
export const METRICAS = ['ALCANCE', 'ENVIOS', 'SALVOS', 'PULO', 'RETENCAO'] as const
export type MetricaTeste = (typeof METRICAS)[number]

export const METRICA_INFO: Record<MetricaTeste, { rotulo: string; menorMelhor: boolean; unidade: string }> = {
  ALCANCE: { rotulo: 'Alcance', menorMelhor: false, unidade: 'contas' },
  ENVIOS: { rotulo: 'Envios por mil', menorMelhor: false, unidade: 'por mil' },
  SALVOS: { rotulo: 'Salvos por mil', menorMelhor: false, unidade: 'por mil' },
  PULO: { rotulo: 'Pulo nos 3 s', menorMelhor: true, unidade: '%' },
  RETENCAO: { rotulo: 'Retenção', menorMelhor: false, unidade: '%' },
}

type MidiaMetricas = { alcance: number; compartilhamentos: number; salvamentos: number; taxaPulo: number | null; tempoMedioAssistidoSeg: number | null; duracaoSeg: number | null; insightsAtualizadoEm: Date | null }

export function valorDaMetrica(m: MidiaMetricas, metrica: MetricaTeste): number | null {
  if (!m.insightsAtualizadoEm) return null
  switch (metrica) {
    case 'ALCANCE': return m.alcance
    case 'ENVIOS': return m.alcance ? (m.compartilhamentos / m.alcance) * 1000 : null
    case 'SALVOS': return m.alcance ? (m.salvamentos / m.alcance) * 1000 : null
    case 'PULO': return m.taxaPulo != null ? m.taxaPulo * 100 : null
    case 'RETENCAO': return m.duracaoSeg && m.tempoMedioAssistidoSeg != null ? Math.min(1, m.tempoMedioAssistidoSeg / m.duracaoSeg) * 100 : null
  }
}

export interface PostDoTeste { pautaId: string; titulo: string; grupo: 'A' | 'B'; status: string; publicadaEm: string | null; agendadoPara: string | null; valor: number | null; medido: boolean }
export interface GrupoProgresso { rotulo: string; posts: number; medidos: number; media: number | null }
export interface ResultadoTeste { mediaA: number | null; mediaB: number | null; nA: number; nB: number; diferenca: number | null; vencedor: 'A' | 'B' | 'EMPATE'; confianca: 'alta' | 'media' | 'baixa' | 'hipotese'; texto: string }

const media = (v: number[]) => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : null)
const arred = (v: number | null, c = 2) => (v == null ? null : Math.round(v * 10 ** c) / 10 ** c)
const num = (v: number, c = 1) => v.toLocaleString('pt-BR', { maximumFractionDigits: c })

export function porGrupo(t: Pick<SmTeste, 'amostraAlvo'>) { return Math.max(1, Math.ceil(t.amostraAlvo / 2)) }

export function decidir(t: Pick<SmTeste, 'metrica' | 'grupoA' | 'grupoB'>, a: number[], b: number[]): ResultadoTeste {
  const info = METRICA_INFO[t.metrica as MetricaTeste] ?? METRICA_INFO.ALCANCE
  const mA = media(a), mB = media(b)
  let diferenca: number | null = null
  let vencedor: ResultadoTeste['vencedor'] = 'EMPATE'
  if (mA != null && mB != null) {
    const melhorA = info.menorMelhor ? mA < mB : mA > mB
    const melhor = melhorA ? mA : mB, pior = melhorA ? mB : mA
    // Diferença relativa sobre o pior grupo (para pulo, quanto o pior pula a mais).
    diferenca = pior !== 0 ? Math.abs(melhor - pior) / Math.abs(pior) : null
    if (diferenca != null && diferenca >= 0.1) vencedor = melhorA ? 'A' : 'B'
  }
  const n = Math.min(a.length, b.length)
  const confianca: ResultadoTeste['confianca'] = vencedor === 'EMPATE' ? 'hipotese' : diferenca! >= 0.2 ? (n >= 5 ? 'alta' : 'media') : 'baixa'
  const nomeV = vencedor === 'A' ? t.grupoA : t.grupoB
  const texto = vencedor === 'EMPATE'
    ? `Sem diferença clara em ${info.rotulo.toLowerCase()} (menos de 10% entre os grupos).`
    : `${nomeV} ${info.menorMelhor ? 'teve' : 'foi'} ${num(diferenca! * 100, 0)}% ${info.menorMelhor ? 'menos pulo' : 'melhor'} em ${info.rotulo.toLowerCase()} (${num(Math.min(a.length, b.length), 0)}+ posts por grupo).`
  return { mediaA: arred(mA), mediaB: arred(mB), nA: a.length, nB: b.length, diferenca: arred(diferenca, 3), vencedor, confianca, texto }
}

/** Progresso de um teste; conclui sozinho quando a amostra fica completa. */
export async function avaliarTeste(t: SmTeste & { pautas: Array<{ id: string; titulo: string; testeGrupo: string | null; status: string; publicadaEm: Date | null; agendadoPara: Date | null; igMediaId: string | null }> }, contaId: string | null) {
  const ids = t.pautas.map(p => p.igMediaId).filter((x): x is string => !!x)
  const midias = contaId && ids.length
    ? await prisma.socialMediaMidia.findMany({ where: { contaId, instagramMediaId: { in: ids } }, select: { instagramMediaId: true, alcance: true, compartilhamentos: true, salvamentos: true, taxaPulo: true, tempoMedioAssistidoSeg: true, duracaoSeg: true, insightsAtualizadoEm: true } })
    : []
  const porId = new Map(midias.map(m => [m.instagramMediaId, m]))
  const posts: PostDoTeste[] = t.pautas
    .filter(p => p.testeGrupo === 'A' || p.testeGrupo === 'B')
    .map(p => {
      const m = p.igMediaId ? porId.get(p.igMediaId) : undefined
      const valor = m ? valorDaMetrica(m, t.metrica as MetricaTeste) : null
      return { pautaId: p.id, titulo: p.titulo, grupo: p.testeGrupo as 'A' | 'B', status: p.status, publicadaEm: p.publicadaEm?.toISOString() ?? null, agendadoPara: p.agendadoPara?.toISOString() ?? null, valor: arred(valor), medido: valor != null }
    })
  const valores = (g: 'A' | 'B') => posts.filter(p => p.grupo === g && p.medido).map(p => p.valor!)
  const alvoGrupo = porGrupo(t)
  const grupo = (g: 'A' | 'B'): GrupoProgresso => ({ rotulo: g === 'A' ? t.grupoA : t.grupoB, posts: posts.filter(p => p.grupo === g).length, medidos: valores(g).length, media: arred(media(valores(g))) })
  const amostraAtual = Math.min(valores('A').length, alvoGrupo) + Math.min(valores('B').length, alvoGrupo)
  const completo = valores('A').length >= alvoGrupo && valores('B').length >= alvoGrupo

  let teste = t
  if (t.status === 'ATIVO' && completo) {
    // Com a amostra completa, usa os primeiros posts medidos de cada grupo (o alvo), não mais.
    const r = decidir(t, valores('A').slice(0, alvoGrupo), valores('B').slice(0, alvoGrupo))
    teste = await prisma.smTeste.update({
      where: { id: t.id },
      data: { status: 'CONCLUIDO', concluidoEm: new Date(), resultado: r as unknown as Prisma.InputJsonValue, vencedor: r.vencedor, confianca: r.confianca },
      include: { pautas: true },
    }) as typeof t
  }
  return {
    id: teste.id, hipotese: teste.hipotese, descricao: teste.descricao, variavel: teste.variavel, metrica: teste.metrica,
    metricaRotulo: METRICA_INFO[teste.metrica as MetricaTeste]?.rotulo ?? teste.metrica,
    grupoA: teste.grupoA, grupoB: teste.grupoB, horaA: teste.horaA, horaB: teste.horaB,
    amostraAlvo: teste.amostraAlvo, amostraAtual, status: teste.status, criadoEm: teste.criadoEm.toISOString(), concluidoEm: teste.concluidoEm?.toISOString() ?? null,
    resultado: (teste.resultado as unknown as ResultadoTeste | null) ?? null,
    grupos: { A: grupo('A'), B: grupo('B') },
    posts,
  }
}

export type TesteAvaliado = Awaited<ReturnType<typeof avaliarTeste>>

export async function listarTestes(usuarioId: string) {
  const [conta, testes] = await Promise.all([
    prisma.socialMediaConta.findUnique({ where: { titular: `dono:${usuarioId}` }, select: { id: true } }),
    prisma.smTeste.findMany({
      where: { usuarioId, status: { not: 'CANCELADO' } },
      include: { pautas: { select: { id: true, titulo: true, testeGrupo: true, status: true, publicadaEm: true, agendadoPara: true, igMediaId: true }, orderBy: { criadoEm: 'asc' } } },
      orderBy: { criadoEm: 'desc' },
      take: 30,
    }),
  ])
  const avaliados: TesteAvaliado[] = []
  for (const t of testes) avaliados.push(await avaliarTeste(t, conta?.id ?? null))
  return {
    ativos: avaliados.filter(t => t.status === 'ATIVO'),
    concluidos: avaliados.filter(t => t.status === 'CONCLUIDO'),
  }
}

/** Para a tela 05: o teste ativo mais recente (ou o último concluído nos últimos 30 dias). */
export async function testeEmDestaque(usuarioId: string) {
  const { ativos, concluidos } = await listarTestes(usuarioId)
  if (ativos[0]) return ativos[0]
  const recente = concluidos.find(t => t.concluidoEm && Date.now() - Date.parse(t.concluidoEm) < 30 * 864e5)
  return recente ?? null
}

/** Horas em teste de horário ativo (marcam "Em teste" nas melhores janelas). */
export async function horasEmTeste(usuarioId: string): Promise<number[]> {
  const t = await prisma.smTeste.findMany({ where: { usuarioId, status: 'ATIVO', variavel: 'HORARIO' }, select: { horaA: true, horaB: true } })
  return t.flatMap(x => [x.horaA, x.horaB]).filter((h): h is number => h != null)
}

// ---------- Biblioteca de ganchos ----------

export function chaveDoGancho(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export async function listarGanchos(usuarioId: string) {
  const conta = await prisma.socialMediaConta.findUnique({ where: { titular: `dono:${usuarioId}` }, select: { id: true } })
  const [ganchos, publicadas] = await Promise.all([
    prisma.smGancho.findMany({ where: { usuarioId }, orderBy: { criadoEm: 'desc' } }),
    // Sugestões: ganchos de pautas publicadas que ainda não estão na biblioteca.
    prisma.smPauta.findMany({ where: { usuarioId, status: 'PUBLICADO', igMediaId: { not: null }, gancho: { not: null } }, select: { gancho: true, igMediaId: true, titulo: true }, orderBy: { publicadaEm: 'desc' }, take: 60 }),
  ])
  const ids = [...new Set([...ganchos.flatMap(g => g.exemplos), ...publicadas.map(p => p.igMediaId!)])]
  const midias = conta && ids.length
    ? await prisma.socialMediaMidia.findMany({ where: { contaId: conta.id, instagramMediaId: { in: ids } }, select: { instagramMediaId: true, taxaPulo: true, alcance: true, urlPermalink: true, legenda: true } })
    : []
  const porId = new Map(midias.map(m => [m.instagramMediaId, m]))
  const resumo = (exemplos: string[]) => {
    const ms = exemplos.map(id => porId.get(id)).filter((m): m is NonNullable<typeof m> => !!m)
    const pulos = ms.filter(m => m.taxaPulo != null).map(m => m.taxaPulo!)
    return { puloMedio: arred(media(pulos), 3), comPulo: pulos.length, alcanceMedio: ms.length ? Math.round(ms.reduce((s, m) => s + m.alcance, 0) / ms.length) : null }
  }
  const salvas = new Set(ganchos.map(g => g.chave))
  const lista = ganchos.map(g => ({
    id: g.id, texto: g.texto, exemplos: g.exemplos.length, criadoEm: g.criadoEm.toISOString(),
    links: g.exemplos.map(id => porId.get(id)?.urlPermalink).filter((u): u is string => !!u).slice(0, 3),
    ...resumo(g.exemplos),
  }))
    // Menor pulo médio primeiro; sem dados no fim.
    .sort((a, b) => (a.puloMedio ?? 9) - (b.puloMedio ?? 9) || b.exemplos - a.exemplos)
  const sugestoesMap = new Map<string, { texto: string; exemplos: string[] }>()
  for (const p of publicadas) {
    const chave = chaveDoGancho(p.gancho!)
    if (!chave || salvas.has(chave)) continue
    const s = sugestoesMap.get(chave) ?? { texto: p.gancho!.trim(), exemplos: [] }
    s.exemplos.push(p.igMediaId!)
    sugestoesMap.set(chave, s)
  }
  const sugestoes = [...sugestoesMap.values()].map(s => ({ texto: s.texto, midiaIgIds: s.exemplos, ...resumo(s.exemplos) }))
    .sort((a, b) => (a.puloMedio ?? 9) - (b.puloMedio ?? 9)).slice(0, 10)
  return { ganchos: lista, sugestoes }
}

/** Salva (ou junta ao existente) um gancho com os reels de exemplo. */
export async function salvarGancho(usuarioId: string, texto: string, midiaIgIds: string[], criadoPor: string) {
  const chave = chaveDoGancho(texto)
  const atual = await prisma.smGancho.findUnique({ where: { usuarioId_chave: { usuarioId, chave } } })
  if (atual) {
    const exemplos = [...new Set([...atual.exemplos, ...midiaIgIds])]
    return { gancho: await prisma.smGancho.update({ where: { id: atual.id }, data: { exemplos } }), novo: false }
  }
  return { gancho: await prisma.smGancho.create({ data: { usuarioId, texto: texto.trim(), chave, exemplos: [...new Set(midiaIgIds)], criadoPor } }), novo: true }
}
