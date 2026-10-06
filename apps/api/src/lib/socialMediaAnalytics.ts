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
// Regras de cadência (seção 5 da especificação do Social Media): no máximo
// 2 dias seguidos sem post no feed e no máximo 2 posts por dia (acima disso
// é "rajada", que divide o alcance entre os posts do mesmo dia).
export const MAX_DIAS_SEM_POST = 2
export const MAX_POSTS_POR_DIA = 2
// Amostra mínima pra afirmar uma comparação (seção 13.2): 5+ posts por
// grupo é fato; 3 ou 4 vira hipótese de confiança baixa; 1 ou 2, nada.
const AMOSTRA_FATO = 5
const AMOSTRA_HIPOTESE = 3
// Acima de 20% dos dias sem sincronizar, insights de alta/queda somem.
const LIMITE_LACUNAS = 0.2

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
  // Meta de DIAS com post por semana (não de quantidade de posts — ver
  // seção 17.3 da especificação). Limitada a 7.
  metaPostagensSemanais: number
  leadsOrganicos: Array<{ criadoEm: Date; estagio: string; valorNegociacao: number }> // só do período
  // Alcance único do período inteiro, como o Instagram calcula (contas
  // distintas). Null quando a API não fornece (ex.: período > 30 dias).
  alcanceUnico?: { valor: number | null; motivo: string | null }
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

export type Confianca = 'alta' | 'media' | 'baixa' | 'hipotese'

export interface Recomendacao {
  id: string
  tipo: 'destaque' | 'oportunidade' | 'alerta' | 'info'
  titulo: string
  detalhe: string
  // Quanto dá pra confiar (seção 13.2). Comparações com 3 ou 4 posts por
  // grupo saem como "hipotese" e sugerem validar com um teste.
  confianca: Confianca
  amostra: number | null
}

// Confiança de uma comparação entre grupos, pelo menor grupo comparado.
function confiancaDaAmostra(menorGrupo: number): Confianca | null {
  if (menorGrupo >= AMOSTRA_FATO * 2) return 'alta'
  if (menorGrupo >= AMOSTRA_FATO) return 'media'
  if (menorGrupo >= AMOSTRA_HIPOTESE) return 'hipotese'
  return null
}

// Nunca mostra "0,0%" pra um valor que não é zero (seção 17.6): aumenta as
// casas até o número aparecer, e abaixo de 0,01% mostra "< 0,01%".
export function pct(v: number, casas = 0): string {
  const x = v * 100
  let c = casas
  while (x !== 0 && c < 2 && Math.abs(x) < 0.5 * 10 ** -c) c++
  if (x !== 0 && Math.abs(x) < 0.005) return `< 0,01%`
  return `${x.toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c })}%`
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

  // Qualidade dos dados (seção 17.2): dia sem snapshot sincronizado é
  // lacuna. Dias futuros (período que termina depois de hoje) não contam.
  const snapshotPorDia = new Map(snapshots.map(sn => [sn.data.getTime(), sn]))
  const diasAteHoje = diasAtual.filter(d => d.getTime() <= hoje.getTime())
  const diasSemDados = diasAteHoje.filter(d => !snapshotPorDia.get(d.getTime())?.sincronizado).map(chaveDia)
  const fracaoFaltante = diasAteHoje.length ? diasSemDados.length / diasAteHoje.length : 0
  const qualidade = {
    diasPeriodo: diasAteHoje.length,
    diasSincronizados: diasAteHoje.length - diasSemDados.length,
    diasSemDados,
    fracaoFaltante,
    storiesCapturados: storiesAtual.length,
    status: (diasSemDados.length === 0 ? 'completo' : fracaoFaltante > LIMITE_LACUNAS ? 'grave' : 'lacunas') as 'completo' | 'lacunas' | 'grave',
  }

  // Consistência (seções 8 e 17.3): a meta é de DIAS com post, e o maior
  // intervalo sem post sai do mesmo cálculo — assim "meta cumprida" e "N
  // dias sem publicar" nunca aparecem juntos.
  const postsPorDiaAtual = contarPorDia(postsAtual)
  const diasComPost = diasAtual.filter(d => (postsPorDiaAtual.get(chaveDia(d)) ?? 0) > 0).length
  let maiorIntervalo = 0
  let intervaloCorrente = 0
  for (const d of diasAteHoje) {
    intervaloCorrente = (postsPorDiaAtual.get(chaveDia(d)) ?? 0) > 0 ? 0 : intervaloCorrente + 1
    maiorIntervalo = Math.max(maiorIntervalo, intervaloCorrente)
  }
  // Dias desde o último post do feed até hoje (olhando antes do período).
  const ultimoPost = feed.reduce<Date | null>((acc, m) => (!acc || m.publicadoEm > acc ? m.publicadoEm : acc), null)
  const diasSemPostAteHoje = ultimoPost ? Math.max(0, Math.round((hoje.getTime() - diaBrasilia(ultimoPost).getTime()) / DIA_MS)) : null
  const picoDia = [...postsPorDiaAtual.entries()].sort((a, b) => b[1] - a[1])[0] ?? null
  const metaDiasSemana = Math.min(7, Math.max(1, metaPostagensSemanais))
  const consistencia = {
    dias: diasAtual.map(d => ({ data: chaveDia(d), posts: postsPorDiaAtual.get(chaveDia(d)) ?? 0, futuro: d.getTime() > hoje.getTime() })),
    diasComPost,
    diasNoPeriodo: diasAteHoje.length,
    metaDiasSemana,
    metaDiasPeriodo: Math.max(1, Math.round(metaDiasSemana * (diasPeriodo / 7))),
    maiorIntervalo,
    diasSemPostAteHoje,
    maxDiasSemPost: MAX_DIAS_SEM_POST,
    maxPostsPorDia: MAX_POSTS_POR_DIA,
    pico: picoDia ? { data: picoDia[0], posts: picoDia[1] } : null,
    rajadas: [...postsPorDiaAtual.values()].filter(n => n > MAX_POSTS_POR_DIA).length,
  }
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
    diasComPost: {
      atual: diasComPost,
      anterior: diasAnterior.filter(d => (contarPorDia(postsAnterior).get(chaveDia(d)) ?? 0) > 0).length,
      meta: consistencia.metaDiasPeriodo,
      metaSemanal: metaDiasSemana,
      maiorIntervalo,
    },
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

  // Unifica com o card "Interações" (seção 17.5): a composição usa a mesma
  // fonte do card e mostra a diferença como "outras" (reposts e interações
  // que a Meta soma no total mas não detalha), em vez de dois totais
  // diferentes na mesma tela.
  const somaComponentes = composicaoInteracoes.curtidas + composicaoInteracoes.comentarios + composicaoInteracoes.compartilhamentos + composicaoInteracoes.salvamentos + composicaoInteracoes.respostas
  const totalCard = composicaoConta ? kpis.interacoes.atual ?? somaComponentes : somaComponentes
  const composicao = {
    ...composicaoInteracoes,
    total: totalCard,
    outras: Math.max(0, totalCard - somaComponentes),
    excedente: Math.max(0, somaComponentes - totalCard),
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
  // Funil do Instagram até a venda (seções 8 e 17.4): alcance ÚNICO do
  // período (não a soma diária) → visitas ao perfil → conversas → leads →
  // vendas, cada taxa sobre a etapa anterior que tem número. Conversas
  // iniciadas chegam com o Atendimento (direct + WhatsApp por link
  // rastreado); até lá a etapa aparece sem número, com o motivo.
  const funil = {
    alcanceUnico: entrada.alcanceUnico?.valor ?? null,
    alcanceUnicoMotivo: entrada.alcanceUnico?.motivo ?? null,
    visitasPerfil: kpis.visitasPerfil.atual,
    conversasIniciadas: null as number | null,
    conversasMotivo: 'Disponível quando o Atendimento do Instagram e os links rastreados estiverem ligados.',
    leads: leadsOrganicos.length,
    vendas: leadsGanhos.length,
  }

  const recomendacoes = gerarRecomendacoes({
    postsAtual, porFormato, porDiaSemana, legendas, hashtags, kpis, shareDescoberta,
    seguidoresOnline: conta.seguidoresOnline as number[] | null, storiesResumo, diasPeriodo,
    consistencia, qualidade,
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
    composicaoInteracoes: composicao,
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
    funil,
    consistencia,
    qualidade,
    recomendacoes,
  }
}

// Recomendações por regras simples e explicáveis, com as regras de
// qualidade da seção 13.2 da especificação do Social Media:
// - comparação entre grupos exige 5+ posts por grupo pra virar afirmação;
//   com 3 ou 4 sai como hipótese (confiança baixa) e sugere validar com um
//   teste; com 1 ou 2 não sai nada;
// - tendências de alta/queda avisam quando há dias sem dados e somem
//   quando mais de 20% dos dias do período estão sem sincronizar;
// - a meta de frequência é de dias com post, calculada junto com o maior
//   intervalo — nunca "meta cumprida" ao lado de "N dias sem publicar".
function gerarRecomendacoes(d: {
  postsAtual: PostAnalise[]
  porFormato: Array<{ formato: FormatoPost } & AgregadoPosts>
  porDiaSemana: Array<{ dia: number } & AgregadoPosts>
  legendas: Array<{ faixa: string; taxaSalvamento: number } & AgregadoPosts>
  hashtags: Array<{ tag: string } & AgregadoPosts>
  kpis: {
    taxaEngajamento: { atual: number | null; anterior: number | null }
    alcanceMedioDia: { atual: number | null; anterior: number | null }
    seguidores: { ganhos: number; perdidos: number; variacao: number | null; taxaCrescimento: number | null }
  }
  shareDescoberta: number | null
  seguidoresOnline: number[] | null
  storiesResumo: { quantidade: number; saidas: number; visualizacoesTotais: number }
  diasPeriodo: number
  consistencia: { diasComPost: number; metaDiasPeriodo: number; metaDiasSemana: number; maiorIntervalo: number; diasSemPostAteHoje: number | null; rajadas: number; pico: { data: string; posts: number } | null; diasNoPeriodo: number }
  qualidade: { diasSemDados: string[]; fracaoFaltante: number }
}): Recomendacao[] {
  const r: Recomendacao[] = []
  const comInsight = d.postsAtual.filter(p => !p.semInsights)
  const mediaGeralAlcance = media(comInsight, p => p.alcance)
  const lacunas = d.qualidade.diasSemDados.length
  const tendenciaSuprimida = d.qualidade.fracaoFaltante > LIMITE_LACUNAS
  const avisoLacunas = lacunas > 0 ? ` Pode estar afetado por ${lacunas} ${lacunas === 1 ? 'dia' : 'dias'} sem dados.` : ''

  // Comparação entre grupos: devolve a confiança (ou null = não afirma nada).
  const comparar = (...grupos: number[]) => confiancaDaAmostra(Math.min(...grupos))
  const sufixoHipotese = (c: Confianca, n: number) => (c === 'hipotese' ? ` Hipótese com ${n} posts no menor grupo: vale validar com um teste antes de mudar o calendário.` : '')

  // Formato que mais alcança
  const formatosValidos = d.porFormato.filter(f => f.quantidade >= AMOSTRA_HIPOTESE && f.alcanceMedio > 0).sort((a, b) => b.alcanceMedio - a.alcanceMedio)
  if (formatosValidos.length >= 2) {
    const melhor = formatosValidos[0]
    const pior = formatosValidos[formatosValidos.length - 1]
    const conf = comparar(melhor.quantidade, pior.quantidade)
    const fator = melhor.alcanceMedio / pior.alcanceMedio
    if (conf && fator >= 1.2) {
      const menor = Math.min(melhor.quantidade, pior.quantidade)
      r.push({
        id: 'formato-alcance', tipo: 'oportunidade', confianca: conf, amostra: menor,
        titulo: `${ROTULO_FORMATO[melhor.formato]} alcançaram ${vezes(fator)} mais que ${ROTULO_FORMATO[pior.formato].toLowerCase()}`,
        detalhe: `Alcance médio de ${num(melhor.alcanceMedio)} contas por ${ROTULO_FORMATO_SINGULAR[melhor.formato]} (${melhor.quantidade} posts) contra ${num(pior.alcanceMedio)} (${pior.quantidade} posts).${conf === 'hipotese' ? sufixoHipotese(conf, menor) : ' Dê mais peso a esse formato no calendário.'}`,
      })
    }
  }

  // Formato que gera mais valor percebido (salvamento + compartilhamento)
  const valorPercebido = d.porFormato
    .filter(f => f.quantidade >= AMOSTRA_HIPOTESE && f.alcanceMedio > 0)
    .map(f => ({ f, taxa: (f.salvamentosMedios + f.compartilhamentosMedios) / f.alcanceMedio }))
    .sort((a, b) => b.taxa - a.taxa)
  if (valorPercebido.length >= 2 && valorPercebido[0].taxa > 0 && valorPercebido[0].taxa >= valorPercebido[1].taxa * 1.3) {
    const { f, taxa } = valorPercebido[0]
    const conf = comparar(f.quantidade, valorPercebido[1].f.quantidade)
    if (conf) {
      const menor = Math.min(f.quantidade, valorPercebido[1].f.quantidade)
      r.push({
        id: 'formato-valor', tipo: 'destaque', confianca: conf, amostra: menor,
        titulo: `${ROTULO_FORMATO[f.formato]} são o que o público mais salva e compartilha`,
        detalhe: `${pct(taxa, 1)} de quem é alcançado salva ou compartilha: sinal de conteúdo que as pessoas consideram útil.${sufixoHipotese(conf, menor)}`,
      })
    }
  }

  // Melhor dia da semana
  const dias = d.porDiaSemana.filter(x => x.quantidade >= AMOSTRA_HIPOTESE && x.alcanceMedio > 0).sort((a, b) => b.alcanceMedio - a.alcanceMedio)
  if (dias.length >= 2 && mediaGeralAlcance > 0 && dias[0].alcanceMedio >= mediaGeralAlcance * 1.2) {
    const conf = confiancaDaAmostra(dias[0].quantidade)
    if (conf) {
      r.push({
        id: 'melhor-dia', tipo: 'oportunidade', confianca: conf, amostra: dias[0].quantidade,
        titulo: `${NOME_DIA[dias[0].dia][0].toUpperCase()}${NOME_DIA[dias[0].dia].slice(1)} foi o dia de maior alcance`,
        detalhe: `Posts nesse dia alcançaram em média ${num(dias[0].alcanceMedio)} contas, ${pct(dias[0].alcanceMedio / mediaGeralAlcance - 1)} acima da média do período (${dias[0].quantidade} posts).${sufixoHipotese(conf, dias[0].quantidade)}`,
      })
    }
  }

  // Melhor faixa de horário (blocos de 3h somando todos os dias)
  const faixas = Array.from({ length: 8 }, (_, bloco) => {
    const posts = comInsight.filter(p => Math.floor(p.hora / 3) === bloco)
    return { bloco, quantidade: posts.length, alcanceMedio: media(posts, p => p.alcance) }
  }).filter(f => f.quantidade >= AMOSTRA_HIPOTESE).sort((a, b) => b.alcanceMedio - a.alcanceMedio)
  if (faixas.length >= 2 && mediaGeralAlcance > 0 && faixas[0].alcanceMedio >= mediaGeralAlcance * 1.15) {
    const f = faixas[0]
    const conf = confiancaDaAmostra(f.quantidade)
    if (conf) {
      r.push({
        id: 'melhor-horario', tipo: 'oportunidade', confianca: conf, amostra: f.quantidade,
        titulo: `Posts entre ${f.bloco * 3}h e ${f.bloco * 3 + 3}h alcançaram mais`,
        detalhe: `Média de ${num(f.alcanceMedio)} contas, ${pct(f.alcanceMedio / mediaGeralAlcance - 1)} acima da média (${f.quantidade} posts, horário de Brasília).${sufixoHipotese(conf, f.quantidade)}`,
      })
    }
  }

  // Cadência: dias com post, maior intervalo e rajadas, numa leitura só.
  const c = d.consistencia
  if (c.diasNoPeriodo > 0) {
    if (c.maiorIntervalo > MAX_DIAS_SEM_POST) {
      const atual = c.diasSemPostAteHoje != null && c.diasSemPostAteHoje > MAX_DIAS_SEM_POST
      r.push({
        id: 'cadencia', tipo: 'alerta', confianca: 'alta', amostra: null,
        titulo: atual ? `Retomada de cadência: ${c.diasSemPostAteHoje} dias sem post no feed` : `O feed ficou ${c.maiorIntervalo} dias seguidos sem post`,
        detalhe: `Foram ${c.diasComPost} de ${c.metaDiasPeriodo} dias com post previstos na meta (${c.metaDiasSemana} por semana). O combinado é no máximo ${MAX_DIAS_SEM_POST} dias seguidos sem post: um post simples de reserva evita o buraco.`,
      })
    } else if (c.diasComPost >= c.metaDiasPeriodo) {
      r.push({
        id: 'cadencia', tipo: 'destaque', confianca: 'alta', amostra: null,
        titulo: `Meta de dias com post cumprida: ${c.diasComPost} de ${c.metaDiasPeriodo}`,
        detalhe: `Nenhum intervalo maior que ${MAX_DIAS_SEM_POST} dias sem post. Agora o ganho está em melhorar o desempenho médio por post.`,
      })
    } else {
      r.push({
        id: 'cadencia', tipo: 'alerta', confianca: 'alta', amostra: null,
        titulo: `Dias com post abaixo da meta: ${c.diasComPost} de ${c.metaDiasPeriodo}`,
        detalhe: `A meta é de ${c.metaDiasSemana} dias com post por semana. Espalhar os posts em mais dias rende mais do que concentrar.`,
      })
    }
    if (c.rajadas > 0 && c.pico) {
      r.push({
        id: 'rajada', tipo: 'alerta', confianca: 'alta', amostra: null,
        titulo: `${c.rajadas} ${c.rajadas === 1 ? 'dia teve' : 'dias tiveram'} mais de ${MAX_POSTS_POR_DIA} posts`,
        detalhe: `O pico foi ${c.pico.posts} posts em ${c.pico.data.slice(8, 10)}/${c.pico.data.slice(5, 7)}. Posts no mesmo dia disputam o alcance entre si: melhor distribuir pelos dias livres.`,
      })
    }
  }

  // Tendências: suprimidas com mais de 20% de lacunas, avisadas com menos.
  if (!tendenciaSuprimida) {
    const er = d.kpis.taxaEngajamento
    const erAtual = er.atual ?? 0
    const varEr = er.atual != null ? variacaoPct(er.atual, er.anterior) : null
    if (varEr != null && comInsight.length >= AMOSTRA_FATO) {
      if (varEr <= -0.15) {
        r.push({ id: 'tendencia-engajamento', tipo: 'alerta', confianca: 'media', amostra: comInsight.length, titulo: `Engajamento caiu ${pct(-varEr)} em relação ao período anterior`, detalhe: `A taxa foi de ${pct(er.anterior ?? 0, 1)} para ${pct(erAtual, 1)}. Compare no radar os posts de maior e menor impacto para achar o que mudou.${avisoLacunas}` })
      } else if (varEr >= 0.15) {
        r.push({ id: 'tendencia-engajamento', tipo: 'destaque', confianca: 'media', amostra: comInsight.length, titulo: `Engajamento subiu ${pct(varEr)} em relação ao período anterior`, detalhe: `A taxa foi de ${pct(er.anterior ?? 0, 1)} para ${pct(erAtual, 1)}: vale repetir os temas e formatos dos posts de maior impacto.${avisoLacunas}` })
      }
    }
    const alc = d.kpis.alcanceMedioDia
    const varAlc = alc.atual != null ? variacaoPct(alc.atual, alc.anterior) : null
    if (varAlc != null && varAlc <= -0.2) {
      r.push({ id: 'tendencia-alcance', tipo: 'alerta', confianca: 'media', amostra: null, titulo: `Alcance diário caiu ${pct(-varAlc)}`, detalhe: `Média de ${num(alc.atual ?? 0)} contas por dia contra ${num(alc.anterior ?? 0)} no período anterior.${avisoLacunas}` })
    } else if (varAlc != null && varAlc >= 0.2) {
      r.push({ id: 'tendencia-alcance', tipo: 'destaque', confianca: 'media', amostra: null, titulo: `Alcance diário cresceu ${pct(varAlc)}`, detalhe: `Média de ${num(alc.atual ?? 0)} contas por dia contra ${num(alc.anterior ?? 0)} no período anterior.${avisoLacunas}` })
    }
    const seg = d.kpis.seguidores
    if (seg.perdidos > 0 && seg.perdidos > seg.ganhos) {
      r.push({ id: 'seguidores-saldo', tipo: 'alerta', confianca: 'media', amostra: null, titulo: `Mais seguidores perdidos (${num(seg.perdidos)}) do que ganhos (${num(seg.ganhos)})`, detalhe: `Vale cruzar os dias de mais saídas (gráfico de crescimento) com o que foi publicado neles.${avisoLacunas}` })
    } else if (seg.taxaCrescimento != null && seg.taxaCrescimento >= 0.02 && (seg.variacao ?? 0) > 0) {
      r.push({ id: 'seguidores-saldo', tipo: 'destaque', confianca: 'media', amostra: null, titulo: `Perfil cresceu ${pct(seg.taxaCrescimento, 1)} no período`, detalhe: `Saldo de ${num(seg.variacao ?? 0)} seguidores (${num(seg.ganhos)} ganhos, ${num(seg.perdidos)} perdidos).${avisoLacunas}` })
    }
  } else {
    r.push({
      id: 'lacunas', tipo: 'alerta', confianca: 'alta', amostra: null,
      titulo: `${lacunas} dias do período estão sem dados sincronizados`,
      detalhe: 'Com mais de 20% dos dias sem dados, as comparações de alta e queda ficam escondidas até a sincronização ser refeita.',
    })
  }

  // Nível de engajamento (não é comparação entre grupos: basta amostra 5+)
  const erNivel = d.kpis.taxaEngajamento.atual ?? 0
  if (comInsight.length >= AMOSTRA_FATO && erNivel > 0) {
    if (erNivel < 0.02) {
      r.push({ id: 'nivel-engajamento', tipo: 'alerta', confianca: 'media', amostra: comInsight.length, titulo: `Taxa de engajamento baixa: ${pct(erNivel, 1)}`, detalhe: 'Menos de 2 em cada 100 contas alcançadas interagem. Vale testar chamadas para ação mais diretas (salvar, comentar, enviar) e ganchos logo no início.' })
    } else if (erNivel >= 0.06) {
      r.push({ id: 'nivel-engajamento', tipo: 'destaque', confianca: 'media', amostra: comInsight.length, titulo: `Taxa de engajamento forte: ${pct(erNivel, 1)}`, detalhe: 'Mais de 6 em cada 100 contas alcançadas interagem com o conteúdo.' })
    }
  }

  // Descoberta (alcance em não seguidores)
  if (d.shareDescoberta != null) {
    if (d.shareDescoberta < 0.25) {
      r.push({ id: 'descoberta', tipo: 'oportunidade', confianca: 'media', amostra: null, titulo: `Só ${pct(d.shareDescoberta)} do alcance vem de quem não segue a conta`, detalhe: 'O conteúdo está circulando principalmente na base atual. Para chegar em gente nova, vale testar mais reels, collabs e temas que as pessoas buscam.' })
    } else if (d.shareDescoberta >= 0.5) {
      r.push({ id: 'descoberta', tipo: 'destaque', confianca: 'media', amostra: null, titulo: `${pct(d.shareDescoberta)} do alcance vem de novas pessoas`, detalhe: 'O conteúdo está sendo descoberto além da base de seguidores: bom momento para reforçar o convite a seguir o perfil.' })
    }
  }

  // Legenda
  const legendasValidas = d.legendas.filter(l => l.quantidade >= AMOSTRA_HIPOTESE && l.taxaEngajamento > 0).sort((a, b) => b.taxaEngajamento - a.taxaEngajamento)
  if (legendasValidas.length >= 2 && legendasValidas[0].taxaEngajamento >= legendasValidas[legendasValidas.length - 1].taxaEngajamento * 1.25) {
    const melhor = legendasValidas[0]
    const pior = legendasValidas[legendasValidas.length - 1]
    const conf = comparar(melhor.quantidade, pior.quantidade)
    if (conf) {
      const menor = Math.min(melhor.quantidade, pior.quantidade)
      r.push({ id: 'legenda', tipo: 'oportunidade', confianca: conf, amostra: menor, titulo: `Legendas "${melhor.faixa.toLowerCase()}" engajaram mais`, detalhe: `Taxa de engajamento de ${pct(melhor.taxaEngajamento, 1)} nesses posts (${melhor.quantidade} analisados) contra ${pct(pior.taxaEngajamento, 1)} em "${pior.faixa.toLowerCase()}".${sufixoHipotese(conf, menor)}` })
    }
  }

  // Hashtag que acompanha os posts de maior alcance
  const tags = d.hashtags.filter(h => h.quantidade >= AMOSTRA_HIPOTESE && h.alcanceMedio > 0).sort((a, b) => b.alcanceMedio - a.alcanceMedio)
  if (tags.length >= 1 && mediaGeralAlcance > 0 && tags[0].alcanceMedio >= mediaGeralAlcance * 1.3) {
    const conf = confiancaDaAmostra(tags[0].quantidade)
    if (conf) {
      r.push({ id: 'hashtag', tipo: 'info', confianca: conf, amostra: tags[0].quantidade, titulo: `#${tags[0].tag} acompanha posts de maior alcance`, detalhe: `Alcance médio de ${num(tags[0].alcanceMedio)} contas nos ${tags[0].quantidade} posts que usaram essa hashtag. O tema pode ser o que puxa, não só a tag.${sufixoHipotese(conf, tags[0].quantidade)}` })
    }
  }

  // Seguidores online
  if (d.seguidoresOnline && d.seguidoresOnline.some(v => v > 0)) {
    const pico = d.seguidoresOnline.indexOf(Math.max(...d.seguidoresOnline))
    r.push({ id: 'online', tipo: 'info', confianca: 'media', amostra: null, titulo: `Pico de seguidores online por volta das ${pico}h`, detalhe: 'Segundo o próprio Instagram. Vale testar publicar um pouco antes do pico e comparar no mapa de calor.' })
  }

  // Stories
  const sto = d.storiesResumo
  if (sto.quantidade >= AMOSTRA_FATO && sto.visualizacoesTotais > 0) {
    const taxaSaida = sto.saidas / sto.visualizacoesTotais
    if (taxaSaida >= 0.2) {
      r.push({ id: 'stories-saida', tipo: 'alerta', confianca: 'media', amostra: sto.quantidade, titulo: `${pct(taxaSaida)} das visualizações de stories terminam em saída`, detalhe: 'Vale testar sequências mais curtas e abrir com o assunto mais forte logo no primeiro story.' })
    }
  }

  const ordem: Record<Recomendacao['tipo'], number> = { alerta: 0, oportunidade: 1, destaque: 2, info: 3 }
  return r.sort((a, b) => ordem[a.tipo] - ordem[b.tipo])
}
