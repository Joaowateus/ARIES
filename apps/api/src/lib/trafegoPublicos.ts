// Públicos do tráfego num período: quem viu, clicou e virou contato, por
// idade/gênero, região, plataforma/posicionamento, dispositivo e horário.
// A Meta só entrega essas quebras somadas no período (não por dia), então
// cada período pedido é buscado uma vez e guardado (TrafegoPublicoCache);
// o filtro de campanha/conjunto é aplicado aqui, sobre as linhas por conjunto.
import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { buscarPublico, erroDeToken, QUEBRAS_PUBLICO, type LinhaPublico, type TipoPublico } from './metaAds'
import { hojeNoFuso, somarDias } from './trafegoSync'

export const TIPOS_PUBLICO = Object.keys(QUEBRAS_PUBLICO) as TipoPublico[]
const PRAZO_MS = 22_000

type ContaPublico = { id: string; adAccountId: string; accessToken: string; fuso: string | null }

// ---------- Rótulos ----------
const GENERO: Record<string, string> = { female: 'Mulheres', male: 'Homens', unknown: 'Não informado' }
const PLATAFORMA: Record<string, string> = {
  facebook: 'Facebook', instagram: 'Instagram', messenger: 'Messenger', audience_network: 'Audience Network', whatsapp: 'WhatsApp', threads: 'Threads',
}
const POSICAO: Record<string, string> = {
  feed: 'Feed', story: 'Stories', reels: 'Reels', facebook_reels: 'Reels', facebook_stories: 'Stories', instagram_stories: 'Stories', instagram_reels: 'Reels',
  facebook_reels_overlay: 'Anúncio sobre Reels', instagram_explore: 'Explorar', instagram_explore_grid_home: 'Explorar (início)', instagram_profile_feed: 'Feed do perfil',
  profile_feed: 'Feed do perfil', instagram_search: 'Resultados da pesquisa', search: 'Resultados da pesquisa', video_feeds: 'Feed de vídeos', marketplace: 'Marketplace',
  right_hand_column: 'Coluna da direita', instream_video: 'Vídeo in-stream', facebook_notification: 'Notificações', an_classic: 'Nativo, banner e intersticial',
  rewarded_video: 'Vídeo com recompensa', messenger_inbox: 'Caixa de entrada', messenger_stories: 'Stories', status: 'Status', biz_disco_feed: 'Feed de descoberta',
  threads_feed: 'Feed', unknown: 'Outros',
}
const DISPOSITIVO: Record<string, string> = {
  iphone: 'iPhone', ipad: 'iPad', ipod: 'iPod', android_smartphone: 'Celular Android', android_tablet: 'Tablet Android', desktop: 'Computador', other: 'Outros',
}
const titulo = (s: string) => s.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())

function rotular(tipo: TipoPublico, chave: string): { rotulo: string; grupo?: string; extra?: string } {
  const [a, b] = chave.split('|')
  if (tipo === 'idadeGenero') return { rotulo: `${GENERO[b] ?? titulo(b)} ${a}`, grupo: a === 'Unknown' ? 'Não informada' : a, extra: GENERO[b] ?? titulo(b) }
  if (tipo === 'regiao') return { rotulo: a === 'Unknown' || a === 'desconhecido' ? 'Não identificada' : a.replace(/\s*\((state|province|region)\)$/i, '') }
  if (tipo === 'posicionamento') {
    const plat = PLATAFORMA[a] ?? titulo(a)
    return { rotulo: `${plat} · ${POSICAO[b] ?? titulo(b)}`, grupo: plat }
  }
  if (tipo === 'dispositivo') return { rotulo: DISPOSITIVO[a] ?? titulo(a) }
  const hora = Number(a.slice(0, 2))
  return { rotulo: `${String(hora).padStart(2, '0')}h`, grupo: String(hora) }
}

// ---------- Cache ----------
async function linhasDoTipo(conta: ContaPublico, tipo: TipoPublico, inicio: string, fim: string, forcar: boolean, prazoEm: number) {
  const chaves = { contaId: conta.id, inicio: new Date(`${inicio}T00:00:00Z`), fim: new Date(`${fim}T00:00:00Z`), tipo }
  const guardado = await prisma.trafegoPublicoCache.findUnique({ where: { contaId_inicio_fim_tipo: chaves } })
  // Período fechado há dias não muda mais; o que inclui os últimos dias vale 2h.
  const validadeMs = fim < somarDias(hojeNoFuso(conta.fuso), -3) ? Infinity : 2 * 3_600_000
  if (guardado && !forcar && Date.now() - guardado.atualizadoEm.getTime() < validadeMs) {
    return { linhas: guardado.linhas as unknown as LinhaPublico[], atualizadoEm: guardado.atualizadoEm, erro: null }
  }
  try {
    const linhas = await buscarPublico(conta.adAccountId, conta.accessToken, tipo, inicio, fim, prazoEm)
    const r = await prisma.trafegoPublicoCache.upsert({
      where: { contaId_inicio_fim_tipo: chaves },
      create: { ...chaves, linhas: linhas as unknown as Prisma.InputJsonValue },
      update: { linhas: linhas as unknown as Prisma.InputJsonValue },
    })
    return { linhas, atualizadoEm: r.atualizadoEm, erro: null }
  } catch (e) {
    if (erroDeToken(e)) throw e
    const msg = e instanceof Error ? e.message : 'Falha ao buscar na Meta'
    // Sem a Meta agora: usa o que tiver guardado, mesmo antigo.
    if (guardado) return { linhas: guardado.linhas as unknown as LinhaPublico[], atualizadoEm: guardado.atualizadoEm, erro: null }
    return { linhas: [] as LinhaPublico[], atualizadoEm: null, erro: msg }
  }
}

// ---------- Análise ----------
type Resultado = 'contatos' | 'lpv' | 'cliquesLink'
const div = (a: number, b: number) => (b > 0 ? a / b : null)

export interface SegmentoPublico {
  chave: string; rotulo: string; grupo: string | null; extra: string | null
  gasto: number; impressoes: number; cliquesLink: number; destino: number; resultados: number; conversasProf2: number
  cpm: number | null; ctr: number | null; cpc: number | null; connectRate: number | null; custoResultado: number | null
  partGasto: number; partResultados: number
  // custo por resultado do segmento ÷ custo médio (1 = na média; <1 = mais barato)
  indiceCusto: number | null
}
export interface AchadoPublico { nivel: 'critico' | 'atencao' | 'positivo' | 'info'; tipo: TipoPublico; titulo: string; texto: string }

const pctTxt = (v: number) => `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%`
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const SINGULAR: Record<string, string> = { conversas: 'conversa', leads: 'lead', contatos: 'contato', 'visualizações': 'visualização', cliques: 'clique' }
const NOME_TIPO: Record<TipoPublico, string> = { idadeGenero: 'Público', regiao: 'Região', posicionamento: 'Posicionamento', dispositivo: 'Dispositivo', hora: 'Horário' }

function segmentar(tipo: TipoPublico, linhas: LinhaPublico[], resultado: Resultado): SegmentoPublico[] {
  const grupos = new Map<string, LinhaPublico>()
  for (const l of linhas) {
    const g = grupos.get(l.chave)
    if (!g) { grupos.set(l.chave, { ...l }); continue }
    for (const k of ['gasto', 'impressoes', 'alcance', 'cliquesLink', 'lpv', 'conversas', 'leads', 'videoViews', 'conversasProf2'] as const) g[k] += l[k]
  }
  const valorRes = (l: LinhaPublico) => (resultado === 'contatos' ? l.conversas + l.leads : l[resultado])
  const lista = [...grupos.values()]
  const totGasto = lista.reduce((s, l) => s + l.gasto, 0)
  const totRes = lista.reduce((s, l) => s + valorRes(l), 0)
  const custoMedio = div(totGasto, totRes)
  let segs: SegmentoPublico[] = lista.map(l => {
    const r = rotular(tipo, l.chave)
    const res = valorRes(l)
    const custo = div(l.gasto, res)
    return {
      chave: l.chave, rotulo: r.rotulo, grupo: r.grupo ?? null, extra: r.extra ?? null,
      gasto: Math.round(l.gasto * 100) / 100, impressoes: l.impressoes, cliquesLink: l.cliquesLink, destino: l.lpv + l.conversas, resultados: res, conversasProf2: l.conversasProf2,
      cpm: div(l.gasto * 1000, l.impressoes), ctr: div(l.cliquesLink, l.impressoes), cpc: div(l.gasto, l.cliquesLink),
      connectRate: div(l.lpv + l.conversas, l.cliquesLink), custoResultado: custo,
      partGasto: totGasto > 0 ? l.gasto / totGasto : 0, partResultados: totRes > 0 ? res / totRes : 0,
      indiceCusto: custo != null && custoMedio ? custo / custoMedio : null,
    }
  })
  if (tipo === 'hora') {
    // As 24 horas sempre, na ordem (hora sem entrega aparece zerada).
    const porHora = new Map(segs.map(s => [Number(s.grupo), s]))
    segs = Array.from({ length: 24 }, (_, h) => porHora.get(h) ?? {
      chave: String(h), rotulo: `${String(h).padStart(2, '0')}h`, grupo: String(h), extra: null,
      gasto: 0, impressoes: 0, cliquesLink: 0, destino: 0, resultados: 0, conversasProf2: 0,
      cpm: null, ctr: null, cpc: null, connectRate: null, custoResultado: null, partGasto: 0, partResultados: 0, indiceCusto: null,
    })
  } else segs.sort((a, b) => b.gasto - a.gasto)
  return segs
}

function achar(tipo: TipoPublico, segs: SegmentoPublico[], nomeRes: string): AchadoPublico[] {
  const itens: AchadoPublico[] = []
  const relevantes = segs.filter(s => s.partGasto >= 0.05)
  const totalGasto = segs.reduce((s, x) => s + x.gasto, 0)
  if (totalGasto <= 0) return []
  const nome = NOME_TIPO[tipo]

  for (const s of relevantes) {
    if (s.resultados === 0) itens.push({ nivel: 'critico', tipo, titulo: `${s.rotulo}: ${brl(s.gasto)} sem nenhum resultado`, texto: `${nome} com ${pctTxt(s.partGasto)} do investimento e zero ${nomeRes}. Avalie excluir ou reduzir a entrega aqui.` })
  }

  let jaFalouAn = false
  if (tipo === 'posicionamento') {
    const an = segs.filter(s => s.grupo === 'Audience Network')
    const gastoAn = an.reduce((s, x) => s + x.gasto, 0)
    const crGeral = div(segs.reduce((s, x) => s + x.destino, 0), segs.reduce((s, x) => s + x.cliquesLink, 0))
    const crAn = div(an.reduce((s, x) => s + x.destino, 0), an.reduce((s, x) => s + x.cliquesLink, 0))
    if (gastoAn / totalGasto >= 0.03 && crAn != null && crGeral != null && crAn < crGeral * 0.6) {
      jaFalouAn = true
      itens.push({ nivel: 'critico', tipo, titulo: `Audience Network com connect rate de ${pctTxt(crAn)}`, texto: `Contra ${pctTxt(crGeral)} no resto. São cliques acidentais em apps/jogos — ${brl(gastoAn)} gastos ali. Tire esse posicionamento dos conjuntos.` })
    }
  }

  // Segmento mais caro e mais barato (com peso no investimento). Horário tem
  // o achado próprio (melhor janela); a Audience Network, quando já foi
  // apontada acima, não se repete.
  const comCusto = tipo === 'hora' ? [] : relevantes.filter(s => s.indiceCusto != null && s.resultados > 0 && !(jaFalouAn && s.grupo === 'Audience Network'))
  if (comCusto.length >= 2) {
    const caro = comCusto.reduce((a, b) => (b.indiceCusto! > a.indiceCusto! ? b : a))
    const barato = comCusto.reduce((a, b) => (b.indiceCusto! < a.indiceCusto! ? b : a))
    if (caro.indiceCusto! >= 1.4) {
      const quanto = caro.indiceCusto! >= 2 ? `${caro.indiceCusto!.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}x a média` : `${pctTxt(caro.indiceCusto! - 1)} a mais`
      itens.push({ nivel: 'atencao', tipo, titulo: `${caro.rotulo} custa ${quanto} por resultado`, texto: `Leva ${pctTxt(caro.partGasto)} do investimento e traz ${pctTxt(caro.partResultados)} dos ${nomeRes} (${brl(caro.custoResultado!)} cada). Reduza a verba aqui ou teste outro criativo pra esse público.` })
    }
    if (barato.indiceCusto! <= 0.75) itens.push({ nivel: 'positivo', tipo, titulo: `${barato.rotulo}: resultado ${pctTxt(1 - barato.indiceCusto!)} mais barato`, texto: `${brl(barato.custoResultado!)} por ${SINGULAR[nomeRes] ?? nomeRes}, com ${pctTxt(barato.partGasto)} do investimento. Vale um conjunto dedicado ou mais verba pra esse público.` })
  }

  if (tipo === 'hora') {
    // Melhor janela de 3h: mais resultado por real investido.
    let melhor: { h: number; res: number; gasto: number } | null = null
    for (let h = 0; h < 24; h++) {
      const janela = [0, 1, 2].map(i => segs[(h + i) % 24])
      const res = janela.reduce((s, x) => s + x.resultados, 0), gasto = janela.reduce((s, x) => s + x.gasto, 0)
      if (res > 0 && gasto > 0 && (!melhor || res / gasto > melhor.res / melhor.gasto)) melhor = { h, res, gasto }
    }
    const totalRes = segs.reduce((s, x) => s + x.resultados, 0)
    if (melhor && totalRes > 0) {
      const partRes = melhor.res / totalRes, partGasto = melhor.gasto / totalGasto
      if (partRes > partGasto * 1.2) itens.push({ nivel: 'info', tipo, titulo: `Melhor horário: ${String(melhor.h).padStart(2, '0')}h–${String((melhor.h + 3) % 24).padStart(2, '0')}h`, texto: `${pctTxt(partRes)} dos ${nomeRes} com ${pctTxt(partGasto)} do investimento. Garanta atendimento rápido nessa faixa — e, com orçamento vitalício, dá pra programar a veiculação.` })
    }
  }
  return itens
}

export async function analisarPublicos(conta: ContaPublico, inicio: string, fim: string, filtro: { campanhaId?: string; adsetId?: string }, forcar = false) {
  const prazoEm = Date.now() + PRAZO_MS
  const brutos = await Promise.all(TIPOS_PUBLICO.map(t => linhasDoTipo(conta, t, inicio, fim, forcar, prazoEm)))
  const filtrar = (l: LinhaPublico) => (!filtro.campanhaId || l.campanhaId === filtro.campanhaId) && (!filtro.adsetId || l.adsetId === filtro.adsetId)
  const porTipo = new Map(TIPOS_PUBLICO.map((t, i) => [t, brutos[i].linhas.filter(filtrar)]))

  // Resultado comparável entre segmentos: contatos (conversas + leads) quando
  // há; senão visualizações da página; senão cliques. Decide pelo dispositivo
  // (quebra mais simples, com todas as linhas).
  const base = porTipo.get('dispositivo')!.length ? porTipo.get('dispositivo')! : porTipo.get('idadeGenero')!
  const soma = (k: 'conversas' | 'leads' | 'lpv') => base.reduce((s, l) => s + l[k], 0)
  const resultado: Resultado = soma('conversas') + soma('leads') > 0 ? 'contatos' : soma('lpv') > 0 ? 'lpv' : 'cliquesLink'
  const nomeRes = resultado === 'contatos'
    ? (soma('leads') === 0 ? 'conversas' : soma('conversas') === 0 ? 'leads' : 'contatos')
    : resultado === 'lpv' ? 'visualizações' : 'cliques'

  const quebras = Object.fromEntries(TIPOS_PUBLICO.map((t, i) => {
    const segmentos = segmentar(t, porTipo.get(t)!, resultado)
    return [t, { segmentos, achados: achar(t, segmentos, nomeRes), atualizadoEm: brutos[i].atualizadoEm, erro: brutos[i].erro }]
  })) as Record<TipoPublico, { segmentos: SegmentoPublico[]; achados: AchadoPublico[]; atualizadoEm: Date | null; erro: string | null }>

  const ordem = { critico: 0, atencao: 1, positivo: 2, info: 3 }
  return {
    periodo: { inicio, fim },
    resultado, nomeResultado: nomeRes,
    quebras,
    achados: TIPOS_PUBLICO.flatMap(t => quebras[t].achados).sort((a, b) => ordem[a.nivel] - ordem[b.nivel]),
  }
}
