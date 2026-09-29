import type { SocialMediaConta, SocialMediaMidia, SocialMediaSnapshotDiario } from '@prisma/client'
import { diaBrasilia } from './socialMediaSync'

// Análise da conta do Instagram num período — tudo aqui é cálculo puro em
// cima do que o sync gravou (nenhuma chamada à API do Instagram), então a
// tela pode trocar de período à vontade sem custo de cota da Meta.
//
// Convenções:
// - Dias são do calendário de Brasília (ver diaBrasilia), no formato
//   'YYYY-MM-DD'. Dia da semana: 0 = domingo ... 6 = sábado.
// - Taxa de engajamento = interações / alcance (por alcance, não por
//   seguidores — mede quanto quem VIU o conteúdo reagiu a ele).
// - "Alcance" diário é de contas únicas: somar dias conta a mesma pessoa
//   mais de uma vez, por isso o KPI de conta é a MÉDIA diária, não a soma.

const DIA_MS = 24 * 60 * 60 * 1000
const OFFSET_BRASILIA_MS = 3 * 60 * 60 * 1000
const DIAS_REFERENCIA_IMPACTO = 90

export type FormatoPost = 'REELS' | 'CARROSSEL' | 'FOTO'
export type FaixaImpacto = 'BAIXO' | 'MEDIO' | 'ALTO' | 'EXCEPCIONAL'
const FORMATOS: FormatoPost[] = ['REELS', 'CARROSSEL', 'FOTO']
const ROTULO_FORMATO: Record<FormatoPost, string> = { REELS: 'Reels', CARROSSEL: 'Carrosséis', FOTO: 'Fotos' }
const ROTULO_FORMATO_SINGULAR: Record<FormatoPost, string> = { REELS: 'reel', CARROSSEL: 'carrossel', FOTO: 'foto' }
const NOME_DIA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']

export interface PeriodoAnalise { inicio: Date; fim: Date } // chaves de dia (meia-noite UTC = data de Brasília)

export interface EntradaAnalise {
  conta: SocialMediaConta
  periodo: PeriodoAnalise
  midias: SocialMediaMidia[] // do início do período anterior (ou da janela de referência) até o fim do período
  snapshots: SocialMediaSnapshotDiario[] // do início do período anterior até o fim do período
  metaPostagensSemanais: number
  leadsOrganicos: Array<{ criadoEm: Date; estagio: string; valorNegociacao: number }> // só do período
}

function chaveDia(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function soma<T>(itens: T[], f: (t: T) => number): number {
  return itens.reduce((s, t) => s + f(t), 0)
}

function media<T>(itens: T[], f: (t: T) => number): number {
  return itens.length > 0 ? soma(itens, f) / itens.length : 0
}

function razao(a: number, b: number): number {
  return b > 0 ? a / b : 0
}

function mediana(valores: number[]): number {
  if (valores.length === 0) return 0
  const ord = [...valores].sort((a, b) => a - b)
  const meio = Math.floor(ord.length / 2)
  return ord.length % 2 ? ord[meio] : (ord[meio - 1] + ord[meio]) / 2
}

function variacaoPct(atual: number, anterior: number | null): number | null {
  if (anterior == null || anterior === 0) return null
  return (atual - anterior) / anterior
}

function formatoDoPost(m: SocialMediaMidia): FormatoPost | 'STORY' {
  if (m.formato === 'STORY') return 'STORY'
  if (m.formato === 'REELS' || m.tipo === 'VIDEO') return 'REELS'
  if (m.tipo === 'CAROUSEL_ALBUM') return 'CARROSSEL'
  return 'FOTO'
}

function interacoesDo(m: SocialMediaMidia): number {
  return m.interacoesTotais > 0 ? m.interacoesTotais : m.curtidas + m.comentarios + m.salvamentos + m.compartilhamentos
}

function faixaDoImpacto(indice: number): FaixaImpacto {
  if (indice >= 2.5) return 'EXCEPCIONAL'
  if (indice >= 1.3) return 'ALTO'
  if (indice >= 0.7) return 'MEDIO'
  return 'BAIXO'
}

const REGEX_HASHTAG = /#([\p{L}\p{N}_]+)/gu

function hashtagsDe(legenda: string | null): string[] {
  if (!legenda) return []
  return [...new Set([...legenda.matchAll(REGEX_HASHTAG)].map(m => m[1].toLowerCase()))]
}

export interface PostAnalise {
  id: string
  formato: FormatoPost
  legenda: string | null
  thumbnail: string | null
  permalink: string | null
  publicadoEm: string
  dia: string
  diaSemana: number
  hora: number
  alcance: number
  visualizacoes: number
  curtidas: number
  comentarios: number
  compartilhamentos: number
  salvamentos: number
  interacoes: number
  visitasPerfil: number
  seguidoresGerados: number
  tempoMedioAssistidoSeg: number | null
  taxaEngajamento: number
  taxaSalvamento: number
  taxaCompartilhamento: number
  indiceImpacto: number | null
  faixaImpacto: FaixaImpacto | null
  hashtags: string[]
  tamanhoLegenda: number
  semInsights: boolean
}

function montarPost(m: SocialMediaMidia, medianaReferencia: number): PostAnalise {
  const formato = formatoDoPost(m) as FormatoPost
  const interacoes = interacoesDo(m)
  const indice = medianaReferencia > 0 && m.insightsAtualizadoEm ? m.alcance / medianaReferencia : null
  const legenda = m.legenda ?? null
  return {
    id: m.id,
    formato,
    legenda: legenda && legenda.length > 400 ? `${legenda.slice(0, 400)}…` : legenda,
    // Vídeo/reels só tem imagem na thumbnail; foto e carrossel, na própria mídia.
    thumbnail: m.thumbnailUrl ?? m.urlMidia ?? null,
    permalink: m.urlPermalink,
    publicadoEm: m.publicadoEm.toISOString(),
    dia: chaveDia(diaBrasilia(m.publicadoEm)),
    diaSemana: diaBrasilia(m.publicadoEm).getUTCDay(),
    hora: new Date(m.publicadoEm.getTime() - OFFSET_BRASILIA_MS).getUTCHours(),
    alcance: m.alcance,
    visualizacoes: m.visualizacoes,
    curtidas: m.curtidas,
    comentarios: m.comentarios,
    compartilhamentos: m.compartilhamentos,
    salvamentos: m.salvamentos,
    interacoes,
    visitasPerfil: m.visitasPerfil,
    seguidoresGerados: m.seguidoresGerados,
    tempoMedioAssistidoSeg: m.tempoMedioAssistidoSeg,
    taxaEngajamento: razao(interacoes, m.alcance),
    taxaSalvamento: razao(m.salvamentos, m.alcance),
    taxaCompartilhamento: razao(m.compartilhamentos, m.alcance),
    indiceImpacto: indice,
    faixaImpacto: indice != null ? faixaDoImpacto(indice) : null,
    hashtags: hashtagsDe(m.legenda),
    tamanhoLegenda: m.legenda?.length ?? 0,
    semInsights: m.insightsAtualizadoEm == null,
  }
}

interface AgregadoPosts {
  quantidade: number
  alcanceMedio: number
  visualizacoesMedias: number
  interacoesMedias: number
  taxaEngajamento: number
  salvamentosMedios: number
  compartilhamentosMedios: number
  seguidoresGerados: number
}

function agregar(posts: PostAnalise[]): AgregadoPosts {
  const comInsight = posts.filter(p => !p.semInsights)
  return {
    quantidade: posts.length,
    alcanceMedio: media(comInsight, p => p.alcance),
    visualizacoesMedias: media(comInsight, p => p.visualizacoes),
    interacoesMedias: media(comInsight, p => p.interacoes),
    taxaEngajamento: razao(soma(comInsight, p => p.interacoes), soma(comInsight, p => p.alcance)),
    salvamentosMedios: media(comInsight, p => p.salvamentos),
    compartilhamentosMedios: media(comInsight, p => p.compartilhamentos),
    seguidoresGerados: soma(comInsight, p => p.seguidoresGerados),
  }
}

export interface PontoSerie {
  data: string
  temDados: boolean
  alcance: number
  visualizacoes: number
  interacoes: number
  contasEngajadas: number
  visitasPerfil: number
  toquesLinks: number
  seguidoresGanhos: number
  seguidoresPerdidos: number
  saldoSeguidores: number
  seguidores: number | null
  seguidoresEstimado: boolean
  publicacoes: number
}

function montarSerie(dias: Date[], snapshots: SocialMediaSnapshotDiario[], postsPorDia: Map<string, number>): PontoSerie[] {
  const porDia = new Map(snapshots.map(s => [s.data.getTime(), s]))
  return dias.map(dia => {
    const s = porDia.get(dia.getTime())
    const temDados = !!s && (s.alcanceContaDia > 0 || s.visualizacoesDia > 0 || s.interacoesDia > 0 || s.seguidores != null)
    return {
      data: chaveDia(dia),
      temDados,
      alcance: s?.alcanceContaDia ?? 0,
      visualizacoes: s?.visualizacoesDia ?? 0,
      interacoes: s?.interacoesDia ?? 0,
      contasEngajadas: s?.contasEngajadasDia ?? 0,
      visitasPerfil: s?.visitasPerfilDia ?? 0,
      toquesLinks: (s?.toquesLinksDia ?? 0) + (s?.cliquesSiteDia ?? 0),
      seguidoresGanhos: s?.seguidoresGanhosDia ?? 0,
      seguidoresPerdidos: s?.seguidoresPerdidosDia ?? 0,
      saldoSeguidores: s?.novosSeguidoresDia ?? 0,
      seguidores: s?.seguidores ?? null,
      seguidoresEstimado: false,
      publicacoes: postsPorDia.get(chaveDia(dia)) ?? 0,
    }
  })
}

// O total de seguidores só é gravado nos dias em que o sync rodou; nos
// outros, reconstrói de trás pra frente a partir do total real mais
// próximo e do saldo diário (ganhos - perdidos) — marcado como estimado.
function preencherTotalSeguidores(serie: PontoSerie[], seguidoresAtuais: number, fimEhHoje: boolean): void {
  let referencia: number | null = fimEhHoje ? seguidoresAtuais : null
  for (let i = serie.length - 1; i >= 0; i--) {
    const ponto = serie[i]
    if (ponto.seguidores != null) {
      referencia = ponto.seguidores
    } else if (referencia != null) {
      ponto.seguidores = referencia
      ponto.seguidoresEstimado = true
    }
    if (referencia != null) referencia -= ponto.saldoSeguidores
  }
}

export interface Recomendacao {
  id: string
  tipo: 'destaque' | 'oportunidade' | 'alerta' | 'info'
  titulo: string
  detalhe: string
}

function pct(v: number, casas = 0): string {
  return `${(v * 100).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`
}

function num(v: number): string {
  return Math.round(v).toLocaleString('pt-BR')
}

function vezes(v: number): string {
  return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}×`
}

export function montarAnaliseSocialMedia(entrada: EntradaAnalise) {
  const { conta, periodo, midias, snapshots, metaPostagensSemanais, leadsOrganicos } = entrada
  const diasPeriodo = Math.round((periodo.fim.getTime() - periodo.inicio.getTime()) / DIA_MS) + 1
  const anteriorFim = new Date(periodo.inicio.getTime() - DIA_MS)
  const anteriorInicio = new Date(anteriorFim.getTime() - (diasPeriodo - 1) * DIA_MS)
  const hoje = diaBrasilia(new Date())

  const dentro = (dia: Date, inicio: Date, fim: Date) => dia.getTime() >= inicio.getTime() && dia.getTime() <= fim.getTime()

  const feed = midias.filter(m => m.formato !== 'STORY')
  const stories = midias.filter(m => m.formato === 'STORY')

  // Referência do "índice de impacto": mediana de alcance dos posts dos 90
  // dias até o fim do período (mediana, não média, pra um viral não
  // distorcer a régua de todo o resto).
  const inicioReferencia = new Date(periodo.fim.getTime() - (DIAS_REFERENCIA_IMPACTO - 1) * DIA_MS)
  const referencia = feed.filter(m => m.insightsAtualizadoEm && dentro(diaBrasilia(m.publicadoEm), inicioReferencia, periodo.fim))
  const medianaReferencia = mediana(referencia.map(m => m.alcance))

  const postsAtual = feed
    .filter(m => dentro(diaBrasilia(m.publicadoEm), periodo.inicio, periodo.fim))
    .map(m => montarPost(m, medianaReferencia))
    .sort((a, b) => b.publicadoEm.localeCompare(a.publicadoEm))
  const postsAnterior = feed
    .filter(m => dentro(diaBrasilia(m.publicadoEm), anteriorInicio, anteriorFim))
    .map(m => montarPost(m, medianaReferencia))
  const storiesAtual = stories.filter(m => dentro(diaBrasilia(m.publicadoEm), periodo.inicio, periodo.fim))

  const diasAtual = Array.from({ length: diasPeriodo }, (_, i) => new Date(periodo.inicio.getTime() + i * DIA_MS))
  const diasAnterior = Array.from({ length: diasPeriodo }, (_, i) => new Date(anteriorInicio.getTime() + i * DIA_MS))
  const contarPorDia = (posts: PostAnalise[]) => {
    const mapa = new Map<string, number>()
    for (const p of posts) mapa.set(p.dia, (mapa.get(p.dia) ?? 0) + 1)
    return mapa
  }
  const serie = montarSerie(diasAtual, snapshots, contarPorDia(postsAtual))
  const serieAnterior = montarSerie(diasAnterior, snapshots, contarPorDia(postsAnterior))
  preencherTotalSeguidores(serie, conta.seguidores, periodo.fim.getTime() >= hoje.getTime())

  const comDados = serie.filter(p => p.temDados)
  const comDadosAnterior = serieAnterior.filter(p => p.temDados)
  const kpiConta = (f: (p: PontoSerie) => number, modo: 'soma' | 'media') => {
    const calc = (pontos: PontoSerie[]) => (modo === 'soma' ? soma(pontos, f) : media(pontos, f))
    return {
      atual: comDados.length > 0 ? calc(comDados) : null,
      anterior: comDadosAnterior.length > 0 ? calc(comDadosAnterior) : null,
    }
  }

  // Métrica de conta que veio zerada o período inteiro numa conta com
  // alcance relevante não é "zero visitas" — é a Meta não entregando a
  // métrica (ex.: profile_views saiu em algumas versões da API). Nesses
  // casos o KPI usa a soma vinda dos próprios posts e avisa a fonte.
  const metricaContaIndisponivel = (f: (p: PontoSerie) => number) =>
    comDados.length > 0 && soma(comDados, f) === 0 && soma(comDados, p => p.alcance) > 500
  const visitasViaPosts = metricaContaIndisponivel(p => p.visitasPerfil)
  const toquesIndisponiveis = metricaContaIndisponivel(p => p.toquesLinks)

  const agregadoAtual = agregar(postsAtual)
  const agregadoAnterior = agregar(postsAnterior)
  const temInsightAtual = postsAtual.some(p => !p.semInsights)
  const temInsightAnterior = postsAnterior.some(p => !p.semInsights)
  const semanas = diasPeriodo / 7
  const metaPeriodo = Math.max(1, Math.round(metaPostagensSemanais * semanas))

  const ganhos = soma(serie, p => p.seguidoresGanhos)
  const perdidos = soma(serie, p => p.seguidoresPerdidos)
  const primeiroTotal = serie.find(p => p.seguidores != null)?.seguidores ?? null
  const ultimoTotal = [...serie].reverse().find(p => p.seguidores != null)?.seguidores ?? null
  // Variação = total no fim do período - total na véspera do primeiro dia
  // (= total do primeiro dia - saldo desse dia). Sem total nenhum, cai pro
  // saldo diário acumulado.
  const primeiroComTotal = serie.find(p => p.seguidores != null)
  const variacaoSeguidores = primeiroTotal != null && ultimoTotal != null && primeiroComTotal
    ? ultimoTotal - (primeiroTotal - primeiroComTotal.saldoSeguidores)
    : comDados.length > 0 ? ganhos - perdidos : null

  const kpis = {
    seguidores: {
      atual: conta.seguidores,
      variacao: variacaoSeguidores,
      ganhos,
      perdidos,
      ganhosAnterior: comDadosAnterior.length > 0 ? soma(serieAnterior, p => p.seguidoresGanhos) : null,
      perdidosAnterior: comDadosAnterior.length > 0 ? soma(serieAnterior, p => p.seguidoresPerdidos) : null,
      taxaCrescimento: variacaoSeguidores != null ? razao(variacaoSeguidores, conta.seguidores - variacaoSeguidores) : null,
    },
    alcanceMedioDia: kpiConta(p => p.alcance, 'media'),
    visualizacoes: kpiConta(p => p.visualizacoes, 'soma'),
    interacoes: kpiConta(p => p.interacoes, 'soma'),
    contasEngajadasMediaDia: kpiConta(p => p.contasEngajadas, 'media'),
    visitasPerfil: visitasViaPosts
      ? { atual: temInsightAtual ? soma(postsAtual, p => p.visitasPerfil) : null, anterior: temInsightAnterior ? soma(postsAnterior, p => p.visitasPerfil) : null, fonte: 'posts' as const }
      : { ...kpiConta(p => p.visitasPerfil, 'soma'), fonte: 'conta' as const },
    toquesLinks: toquesIndisponiveis ? { atual: null, anterior: null } : kpiConta(p => p.toquesLinks, 'soma'),
    // Sem post com métrica no período não é "0% de engajamento" — é sem dado.
    taxaEngajamento: { atual: temInsightAtual ? agregadoAtual.taxaEngajamento : null, anterior: temInsightAnterior ? agregadoAnterior.taxaEngajamento : null },
    alcanceMedioPost: { atual: temInsightAtual ? agregadoAtual.alcanceMedio : null, anterior: temInsightAnterior ? agregadoAnterior.alcanceMedio : null },
    publicacoes: { atual: postsAtual.length, anterior: postsAnterior.length, meta: metaPeriodo, metaSemanal: metaPostagensSemanais },
    stories: { atual: storiesAtual.length },
  }

  // Composição das interações: métricas diárias da conta quando existem
  // (incluem stories e posts antigos que continuam recebendo interação);
  // senão, a soma dos posts publicados no período.
  const composicaoConta = comDados.length > 0 && soma(comDados, p => p.interacoes) > 0
  const snapshotsPeriodo = snapshots.filter(s => dentro(s.data, periodo.inicio, periodo.fim))
  const composicaoInteracoes = composicaoConta
    ? {
        fonte: 'conta' as const,
        curtidas: soma(snapshotsPeriodo, s => s.curtidasDia),
        comentarios: soma(snapshotsPeriodo, s => s.comentariosDia),
        compartilhamentos: soma(snapshotsPeriodo, s => s.compartilhamentosDia),
        salvamentos: soma(snapshotsPeriodo, s => s.salvamentosDia),
        respostas: soma(snapshotsPeriodo, s => s.respostasDia),
      }
    : {
        fonte: 'posts' as const,
        curtidas: soma(postsAtual, p => p.curtidas),
        comentarios: soma(postsAtual, p => p.comentarios),
        compartilhamentos: soma(postsAtual, p => p.compartilhamentos),
        salvamentos: soma(postsAtual, p => p.salvamentos),
        respostas: soma(storiesAtual, s => s.respostas),
      }

  const porFormato = FORMATOS.map(formato => ({ formato, ...agregar(postsAtual.filter(p => p.formato === formato)) }))

  const porDiaSemana = Array.from({ length: 7 }, (_, dia) => ({ dia, ...agregar(postsAtual.filter(p => p.diaSemana === dia)) }))
  const porHora = Array.from({ length: 24 }, (_, hora) => ({ hora, ...agregar(postsAtual.filter(p => p.hora === hora)) }))
  // Mapa de calor em blocos de 3h (0-3h, 3-6h, ... 21-24h): hora a hora
  // fica esparso demais pra enxergar padrão com o volume típico de posts.
  const heatmap = Array.from({ length: 7 }, (_, dia) => Array.from({ length: 8 }, (_, bloco) => {
    const posts = postsAtual.filter(p => p.diaSemana === dia && Math.floor(p.hora / 3) === bloco)
    const ag = agregar(posts)
    return { dia, bloco, quantidade: ag.quantidade, alcanceMedio: ag.alcanceMedio, taxaEngajamento: ag.taxaEngajamento }
  })).flat()

  const hashtagMapa = new Map<string, PostAnalise[]>()
  for (const p of postsAtual) for (const h of p.hashtags) hashtagMapa.set(h, [...(hashtagMapa.get(h) ?? []), p])
  const hashtags = [...hashtagMapa.entries()]
    .map(([tag, posts]) => ({ tag, ...agregar(posts) }))
    .sort((a, b) => b.quantidade - a.quantidade || b.alcanceMedio - a.alcanceMedio)
    .slice(0, 20)
  const semHashtag = agregar(postsAtual.filter(p => p.hashtags.length === 0))
  const comHashtag = agregar(postsAtual.filter(p => p.hashtags.length > 0))

  const faixasLegenda: Array<{ faixa: string; min: number; max: number }> = [
    { faixa: 'Sem legenda', min: 0, max: 0 },
    { faixa: 'Curta (até 80)', min: 1, max: 80 },
    { faixa: 'Média (81–300)', min: 81, max: 300 },
    { faixa: 'Longa (300+)', min: 301, max: Infinity },
  ]
  const legendas = faixasLegenda.map(f => {
    const posts = postsAtual.filter(p => p.tamanhoLegenda >= f.min && p.tamanhoLegenda <= f.max)
    return { faixa: f.faixa, ...agregar(posts), taxaSalvamento: razao(soma(posts, p => p.salvamentos), soma(posts, p => p.alcance)) }
  })

  const reelsAtual = postsAtual.filter(p => p.formato === 'REELS' && !p.semInsights)
  const reels = {
    ...agregar(postsAtual.filter(p => p.formato === 'REELS')),
    tempoMedioAssistidoSeg: media(reelsAtual.filter(r => r.tempoMedioAssistidoSeg != null), r => r.tempoMedioAssistidoSeg ?? 0),
    taxaCompartilhamento: razao(soma(reelsAtual, r => r.compartilhamentos), soma(reelsAtual, r => r.alcance)),
  }

  const navegacao = storiesAtual.map(s => s.navegacaoStory as { avancos: number; retornos: number; saidas: number; proximoStory: number } | null)
  const storiesResumo = {
    quantidade: storiesAtual.length,
    alcanceMedio: media(storiesAtual, s => s.alcance),
    visualizacoesMedias: media(storiesAtual, s => s.visualizacoes),
    respostas: soma(storiesAtual, s => s.respostas),
    compartilhamentos: soma(storiesAtual, s => s.compartilhamentos),
    visitasPerfil: soma(storiesAtual, s => s.visitasPerfil),
    seguidoresGerados: soma(storiesAtual, s => s.seguidoresGerados),
    avancos: soma(navegacao, n => n?.avancos ?? 0),
    retornos: soma(navegacao, n => n?.retornos ?? 0),
    saidas: soma(navegacao, n => n?.saidas ?? 0),
    proximoStory: soma(navegacao, n => n?.proximoStory ?? 0),
    visualizacoesTotais: soma(storiesAtual, s => s.visualizacoes),
  }

  const distribuicao = conta.distribuicaoAlcance as null | {
    periodoDias: number; alcanceTotal: number; atualizadoEm?: string
    porTipoSeguidor: Array<{ chave: string; valor: number }>
    porFormato: Array<{ chave: string; valor: number }>
  }
  const alcanceNaoSeguidores = distribuicao?.porTipoSeguidor.find(f => f.chave === 'NON_FOLLOWER')?.valor ?? 0
  const alcanceSeguidores = distribuicao?.porTipoSeguidor.find(f => f.chave === 'FOLLOWER')?.valor ?? 0
  const shareDescoberta = alcanceNaoSeguidores + alcanceSeguidores > 0 ? alcanceNaoSeguidores / (alcanceNaoSeguidores + alcanceSeguidores) : null

  const leadsGanhos = leadsOrganicos.filter(l => l.estagio === 'FECHADO')
  const visitasPerfilPeriodo = kpis.visitasPerfil.atual ?? 0
  const relacaoVendas = {
    leadsGerados: leadsOrganicos.length,
    leadsGanhos: leadsGanhos.length,
    valorNegociadoTotal: soma(leadsGanhos, l => l.valorNegociacao),
  }
  const jornada = {
    alcance: kpis.alcanceMedioDia.atual != null ? Math.round(soma(serie, p => p.alcance)) : soma(postsAtual, p => p.alcance),
    visitasPerfil: visitasPerfilPeriodo,
    novosSeguidores: ganhos,
    leadsGerados: leadsOrganicos.length,
  }

  const recomendacoes = gerarRecomendacoes({
    postsAtual, porFormato, porDiaSemana, legendas, hashtags, kpis, shareDescoberta,
    seguidoresOnline: conta.seguidoresOnline as number[] | null, storiesResumo, serie, diasPeriodo,
  })

  return {
    conectado: true as const,
    conta: {
      nomeUsuario: conta.nomeUsuario,
      nomeExibicao: conta.nomeExibicao,
      fotoUrl: conta.fotoUrl,
      biografia: conta.biografia,
      site: conta.site,
      tipoConta: conta.tipoConta,
      seguidores: conta.seguidores,
      seguindo: conta.seguindo,
      publicacoesTotal: conta.publicacoesTotal,
      ultimaSincronizacaoEm: conta.ultimaSincronizacaoEm,
      ultimoErroSync: conta.ultimoErroSync,
    },
    periodo: {
      inicio: chaveDia(periodo.inicio),
      fim: chaveDia(periodo.fim),
      dias: diasPeriodo,
      anteriorInicio: chaveDia(anteriorInicio),
      anteriorFim: chaveDia(anteriorFim),
      diasComDadosConta: comDados.length,
    },
    kpis,
    serie,
    serieAnterior,
    composicaoInteracoes,
    porFormato,
    porDiaSemana,
    porHora,
    heatmap,
    radar: { medianaReferencia, diasReferencia: DIAS_REFERENCIA_IMPACTO },
    publicacoes: postsAtual,
    postsSemInsights: postsAtual.filter(p => p.semInsights).length,
    hashtags,
    hashtagsComparativo: { com: comHashtag, sem: semHashtag },
    legendas,
    reels,
    stories: storiesResumo,
    demografia: conta.demografia,
    distribuicaoAlcance: distribuicao ? { ...distribuicao, shareDescoberta } : null,
    seguidoresOnline: conta.seguidoresOnline as number[] | null,
    relacaoVendas,
    jornada,
    recomendacoes,
  }
}

// Recomendações por regras simples e explicáveis — cada uma só aparece com
// amostra mínima (ex.: 2+ posts por grupo comparado), pra nunca afirmar
// "quinta é seu melhor dia" com base num post só.
function gerarRecomendacoes(d: {
  postsAtual: PostAnalise[]
  porFormato: Array<{ formato: FormatoPost } & AgregadoPosts>
  porDiaSemana: Array<{ dia: number } & AgregadoPosts>
  legendas: Array<{ faixa: string; taxaSalvamento: number } & AgregadoPosts>
  hashtags: Array<{ tag: string } & AgregadoPosts>
  kpis: {
    publicacoes: { atual: number; meta: number }
    taxaEngajamento: { atual: number | null; anterior: number | null }
    alcanceMedioDia: { atual: number | null; anterior: number | null }
    seguidores: { ganhos: number; perdidos: number; variacao: number | null; taxaCrescimento: number | null }
  }
  shareDescoberta: number | null
  seguidoresOnline: number[] | null
  storiesResumo: { quantidade: number; saidas: number; visualizacoesTotais: number }
  serie: PontoSerie[]
  diasPeriodo: number
}): Recomendacao[] {
  const r: Recomendacao[] = []
  const comInsight = d.postsAtual.filter(p => !p.semInsights)
  const mediaGeralAlcance = media(comInsight, p => p.alcance)

  // Formato que mais alcança
  const formatosValidos = d.porFormato.filter(f => f.quantidade >= 2 && f.alcanceMedio > 0).sort((a, b) => b.alcanceMedio - a.alcanceMedio)
  if (formatosValidos.length >= 2) {
    const [melhor, segundo] = formatosValidos
    const pior = formatosValidos[formatosValidos.length - 1]
    const fator = melhor.alcanceMedio / pior.alcanceMedio
    if (melhor.alcanceMedio >= segundo.alcanceMedio * 1.2) {
      r.push({
        id: 'formato-alcance', tipo: 'oportunidade',
        titulo: `${ROTULO_FORMATO[melhor.formato]} alcançam ${vezes(fator)} mais que ${ROTULO_FORMATO[pior.formato].toLowerCase()}`,
        detalhe: `Alcance médio de ${num(melhor.alcanceMedio)} contas por ${ROTULO_FORMATO_SINGULAR[melhor.formato]} contra ${num(pior.alcanceMedio)} — dê mais peso a esse formato no calendário.`,
      })
    }
  }

  // Formato que gera mais valor percebido (salvamento + compartilhamento)
  const valorPercebido = d.porFormato
    .filter(f => f.quantidade >= 2 && f.alcanceMedio > 0)
    .map(f => ({ f, taxa: (f.salvamentosMedios + f.compartilhamentosMedios) / f.alcanceMedio }))
    .sort((a, b) => b.taxa - a.taxa)
  if (valorPercebido.length >= 2 && valorPercebido[0].taxa > 0 && valorPercebido[0].taxa >= valorPercebido[1].taxa * 1.3) {
    const { f, taxa } = valorPercebido[0]
    r.push({
      id: 'formato-valor', tipo: 'destaque',
      titulo: `${ROTULO_FORMATO[f.formato]} são o que o público mais salva e compartilha`,
      detalhe: `${pct(taxa, 1)} de quem é alcançado salva ou compartilha — sinal de conteúdo que as pessoas consideram útil.`,
    })
  }

  // Melhor dia da semana
  const dias = d.porDiaSemana.filter(x => x.quantidade >= 2 && x.alcanceMedio > 0).sort((a, b) => b.alcanceMedio - a.alcanceMedio)
  if (dias.length >= 3 && mediaGeralAlcance > 0 && dias[0].alcanceMedio >= mediaGeralAlcance * 1.2) {
    r.push({
      id: 'melhor-dia', tipo: 'oportunidade',
      titulo: `${NOME_DIA[dias[0].dia][0].toUpperCase()}${NOME_DIA[dias[0].dia].slice(1)} é o seu dia de maior alcance`,
      detalhe: `Posts nesse dia alcançaram em média ${num(dias[0].alcanceMedio)} contas, ${pct(dias[0].alcanceMedio / mediaGeralAlcance - 1)} acima da média do período (${dias[0].quantidade} posts analisados).`,
    })
  }

  // Melhor faixa de horário — agrega as faixas de 3h de todos os dias
  // (cada célula dia x faixa do mapa de calor costuma ter 0-1 post, pouco
  // pra concluir alguma coisa).
  const faixas = Array.from({ length: 8 }, (_, bloco) => {
    const posts = comInsight.filter(p => Math.floor(p.hora / 3) === bloco)
    return { bloco, quantidade: posts.length, alcanceMedio: media(posts, p => p.alcance) }
  }).filter(f => f.quantidade >= 3).sort((a, b) => b.alcanceMedio - a.alcanceMedio)
  if (faixas.length >= 2 && mediaGeralAlcance > 0 && faixas[0].alcanceMedio >= mediaGeralAlcance * 1.15) {
    const f = faixas[0]
    r.push({
      id: 'melhor-horario', tipo: 'oportunidade',
      titulo: `Publique entre ${f.bloco * 3}h e ${f.bloco * 3 + 3}h`,
      detalhe: `Posts nessa faixa alcançaram em média ${num(f.alcanceMedio)} contas, ${pct(f.alcanceMedio / mediaGeralAlcance - 1)} acima da média (${f.quantidade} posts analisados, horário de Brasília).`,
    })
  }

  // Frequência x meta
  const { atual: publicados, meta } = d.kpis.publicacoes
  if (publicados < meta) {
    r.push({
      id: 'frequencia', tipo: 'alerta',
      titulo: `Frequência abaixo da meta: ${publicados} de ${meta} publicações`,
      detalhe: `Faltaram ${meta - publicados} posts pra meta do período (${pct(publicados / meta)} cumprido). Um calendário semanal fixo ajuda a manter o ritmo.`,
    })
  } else if (publicados > 0) {
    r.push({
      id: 'frequencia', tipo: 'destaque',
      titulo: `Meta de frequência cumprida: ${publicados} de ${meta} publicações`,
      detalhe: 'Constância garantida no período — agora o ganho está em melhorar o desempenho médio por post.',
    })
  }

  // Maior intervalo sem publicar
  const diasComPost = d.serie.map(p => p.publicacoes > 0)
  let maiorGap = 0
  let gapAtual = 0
  for (const temPost of diasComPost) {
    gapAtual = temPost ? 0 : gapAtual + 1
    maiorGap = Math.max(maiorGap, gapAtual)
  }
  if (d.diasPeriodo >= 14 && maiorGap >= 7) {
    r.push({
      id: 'intervalo', tipo: 'alerta',
      titulo: `Você ficou ${maiorGap} dias seguidos sem publicar no feed`,
      detalhe: 'Vale conferir no gráfico de evolução diária se o alcance caiu nesse intervalo — e manter um conteúdo simples de reserva pra não deixar buracos.',
    })
  }

  // Tendência de engajamento
  const er = d.kpis.taxaEngajamento
  const erAtual = er.atual ?? 0
  const varEr = er.atual != null ? variacaoPct(er.atual, er.anterior) : null
  if (varEr != null && comInsight.length >= 3) {
    if (varEr <= -0.15) {
      r.push({ id: 'tendencia-engajamento', tipo: 'alerta', titulo: `Engajamento caiu ${pct(-varEr)} em relação ao período anterior`, detalhe: `A taxa foi de ${pct(er.anterior ?? 0, 1)} pra ${pct(erAtual, 1)}. Compare no radar os posts de maior e menor impacto pra achar o que mudou (tema, formato, gancho).` })
    } else if (varEr >= 0.15) {
      r.push({ id: 'tendencia-engajamento', tipo: 'destaque', titulo: `Engajamento subiu ${pct(varEr)} em relação ao período anterior`, detalhe: `A taxa foi de ${pct(er.anterior ?? 0, 1)} pra ${pct(erAtual, 1)} — vale repetir os temas e formatos dos posts de maior impacto.` })
    }
  }
  if (comInsight.length >= 3 && erAtual > 0) {
    if (erAtual < 0.02) {
      r.push({ id: 'nivel-engajamento', tipo: 'alerta', titulo: `Taxa de engajamento baixa: ${pct(erAtual, 1)}`, detalhe: 'Menos de 2 em cada 100 contas alcançadas interagem com o conteúdo. Vale testar chamadas pra ação mais diretas (salvar, comentar, compartilhar) e ganchos logo no início.' })
    } else if (erAtual >= 0.06) {
      r.push({ id: 'nivel-engajamento', tipo: 'destaque', titulo: `Taxa de engajamento forte: ${pct(erAtual, 1)}`, detalhe: 'Mais de 6 em cada 100 contas alcançadas interagem com o conteúdo — quem vê, reage.' })
    }
  }

  // Tendência de alcance
  const alc = d.kpis.alcanceMedioDia
  const varAlc = alc.atual != null ? variacaoPct(alc.atual, alc.anterior) : null
  if (varAlc != null && varAlc <= -0.2) {
    r.push({ id: 'tendencia-alcance', tipo: 'alerta', titulo: `Alcance diário caiu ${pct(-varAlc)}`, detalhe: `Média de ${num(alc.atual ?? 0)} contas/dia contra ${num(alc.anterior ?? 0)} no período anterior.` })
  } else if (varAlc != null && varAlc >= 0.2) {
    r.push({ id: 'tendencia-alcance', tipo: 'destaque', titulo: `Alcance diário cresceu ${pct(varAlc)}`, detalhe: `Média de ${num(alc.atual ?? 0)} contas/dia contra ${num(alc.anterior ?? 0)} no período anterior.` })
  }

  // Seguidores
  const seg = d.kpis.seguidores
  if (seg.perdidos > 0 && seg.perdidos > seg.ganhos) {
    r.push({ id: 'seguidores-saldo', tipo: 'alerta', titulo: `Mais seguidores perdidos (${num(seg.perdidos)}) do que ganhos (${num(seg.ganhos)})`, detalhe: 'Vale cruzar os dias de mais saídas (gráfico de crescimento) com o que foi publicado neles — tema fora do perfil ou sequência de posts promocionais são suspeitos comuns.' })
  } else if (seg.taxaCrescimento != null && seg.taxaCrescimento >= 0.02 && (seg.variacao ?? 0) > 0) {
    r.push({ id: 'seguidores-saldo', tipo: 'destaque', titulo: `Perfil cresceu ${pct(seg.taxaCrescimento, 1)} no período`, detalhe: `Saldo de ${num(seg.variacao ?? 0)} seguidores (${num(seg.ganhos)} ganhos, ${num(seg.perdidos)} perdidos).` })
  }

  // Descoberta (alcance em não seguidores)
  if (d.shareDescoberta != null) {
    if (d.shareDescoberta < 0.25) {
      r.push({ id: 'descoberta', tipo: 'oportunidade', titulo: `Só ${pct(d.shareDescoberta)} do alcance vem de quem não te segue`, detalhe: 'O conteúdo está circulando principalmente na base atual. Pra chegar em gente nova, vale testar mais Reels, collabs e temas que as pessoas buscam.' })
    } else if (d.shareDescoberta >= 0.5) {
      r.push({ id: 'descoberta', tipo: 'destaque', titulo: `${pct(d.shareDescoberta)} do alcance vem de novas pessoas`, detalhe: 'Seu conteúdo está sendo descoberto além da base de seguidores — bom momento pra reforçar o convite a seguir o perfil.' })
    }
  }

  // Legenda
  const legendasValidas = d.legendas.filter(l => l.quantidade >= 3 && l.taxaEngajamento > 0).sort((a, b) => b.taxaEngajamento - a.taxaEngajamento)
  if (legendasValidas.length >= 2 && legendasValidas[0].taxaEngajamento >= legendasValidas[legendasValidas.length - 1].taxaEngajamento * 1.25) {
    const melhor = legendasValidas[0]
    r.push({ id: 'legenda', tipo: 'oportunidade', titulo: `Legendas "${melhor.faixa.toLowerCase()}" engajam mais`, detalhe: `Taxa de engajamento de ${pct(melhor.taxaEngajamento, 1)} nesses posts (${melhor.quantidade} analisados).` })
  }

  // Hashtag que mais puxa alcance
  const tags = d.hashtags.filter(h => h.quantidade >= 2 && h.alcanceMedio > 0).sort((a, b) => b.alcanceMedio - a.alcanceMedio)
  if (tags.length >= 2 && mediaGeralAlcance > 0 && tags[0].alcanceMedio >= mediaGeralAlcance * 1.3) {
    r.push({ id: 'hashtag', tipo: 'info', titulo: `#${tags[0].tag} acompanha seus posts de maior alcance`, detalhe: `Alcance médio de ${num(tags[0].alcanceMedio)} contas nos ${tags[0].quantidade} posts que usaram essa hashtag — o tema pode ser o que puxa, não só a tag.` })
  }

  // Seguidores online
  if (d.seguidoresOnline && d.seguidoresOnline.some(v => v > 0)) {
    const pico = d.seguidoresOnline.indexOf(Math.max(...d.seguidoresOnline))
    r.push({ id: 'online', tipo: 'info', titulo: `Pico de seguidores online por volta das ${pico}h`, detalhe: 'Segundo o próprio Instagram (no fuso configurado na conta). Vale testar publicar um pouco antes do pico e comparar no mapa de calor.' })
  }

  // Stories
  const sto = d.storiesResumo
  if (sto.quantidade >= 3 && sto.visualizacoesTotais > 0) {
    const taxaSaida = sto.saidas / sto.visualizacoesTotais
    if (taxaSaida >= 0.2) {
      r.push({ id: 'stories-saida', tipo: 'alerta', titulo: `${pct(taxaSaida)} das visualizações de stories terminam em saída`, detalhe: 'Vale testar sequências mais curtas e abrir com o assunto mais forte logo no primeiro story.' })
    }
  }

  const ordem: Record<Recomendacao['tipo'], number> = { alerta: 0, oportunidade: 1, destaque: 2, info: 3 }
  return r.sort((a, b) => ordem[a.tipo] - ordem[b.tipo])
}
