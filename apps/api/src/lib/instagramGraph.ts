// Cliente fino pra API do Instagram (Login do Instagram / Business Login) —
// usa fetch nativo (Node 18+), sem dependência externa. Toda função aqui
// recebe o accessToken já resolvido (troca/renovação fica a cargo do
// chamador) e lança ErroGraphApi com mensagem legível quando a API recusa.
//
// A Meta muda o catálogo de métricas com frequência (ex.: `impressions` e
// `plays` saíram em abr/2025, substituídas por `views`). Por isso toda busca
// de insight passa por `buscarMetricasComFallback`: pede o grupo inteiro de
// uma vez e, se a API recusar por causa de UMA métrica, descobre qual é,
// lembra dela (pra não repetir a tentativa em todo post do mesmo sync) e
// segue com as outras — em vez de zerar tudo por causa de uma só.

// Sobrescrevível só pra rodar o sync local contra um servidor simulado.
const GRAPH_BASE = process.env.INSTAGRAM_GRAPH_BASE ?? 'https://graph.instagram.com'

export class ErroGraphApi extends Error {
  constructor(message: string, readonly codigo?: number) {
    super(message)
  }
}

// Código 190 = token inválido/expirado — o único erro que exige ação do
// dono (reconectar a conta); todo o resto a gente contorna.
export function erroDeTokenExpirado(e: unknown): boolean {
  return e instanceof ErroGraphApi && e.codigo === 190
}

function erroDeMetricaInvalida(e: unknown): boolean {
  return e instanceof ErroGraphApi && e.codigo === 100 && /metric|breakdown|timeframe/i.test(e.message)
}

async function lerResposta<T>(res: Response): Promise<T> {
  const body: unknown = await res.json()
  if (!res.ok) {
    const erro = (body as { error?: { message?: string; code?: number } })?.error
    throw new ErroGraphApi(erro?.message ?? 'Falha ao chamar a API do Instagram', erro?.code)
  }
  return body as T
}

async function chamarGraphApi<T>(caminho: string, params: Record<string, string>): Promise<T> {
  const query = new URLSearchParams(params).toString()
  return lerResposta<T>(await fetch(`${GRAPH_BASE}${caminho}?${query}`))
}

// Executa `fn` em lotes paralelos de `tamanho` — a API aguenta bem umas
// poucas chamadas simultâneas, e fazer centenas em série estouraria o
// tempo máximo da função serverless (30s).
export async function emLotes<T, R>(itens: T[], tamanho: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const resultados: R[] = []
  for (let i = 0; i < itens.length; i += tamanho) {
    resultados.push(...await Promise.all(itens.slice(i, i + tamanho).map(fn)))
  }
  return resultados
}

// Primeiro passo do login OAuth (Login do Instagram: o usuário autoriza com
// a própria conta do Instagram, sem passar pelo Facebook): troca o `code`
// devolvido no redirect por um token de curta duração (~1h). Precisa do
// MESMO `redirectUri` usado ao montar a URL de autorização. Diferente da
// Graph API do Facebook, esse endpoint espera um POST form-urlencoded.
export async function trocarCodigoPorTokenCurto(appId: string, appSecret: string, code: string, redirectUri: string): Promise<string> {
  const corpo = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code,
  })
  const res = await fetch('https://api.instagram.com/oauth/access_token', { method: 'POST', body: corpo })
  const body: unknown = await res.json()
  if (!res.ok) {
    const mensagem = (body as { error_message?: string })?.error_message
    throw new ErroGraphApi(mensagem ?? 'Falha ao trocar o código de autorização por um token')
  }
  return (body as { access_token: string }).access_token
}

export interface TokenLongoDuracao {
  accessToken: string
  expiraEm: Date
}

// Troca um token de curta duração (ou um já válido colado manualmente) por
// um de longa duração (~60 dias) — usado só na conexão inicial da conta.
export async function trocarPorTokenLongo(appSecret: string, tokenCurto: string): Promise<TokenLongoDuracao> {
  const body = await chamarGraphApi<{ access_token: string; expires_in: number }>('/access_token', {
    grant_type: 'ig_exchange_token',
    client_secret: appSecret,
    access_token: tokenCurto,
  })
  return { accessToken: body.access_token, expiraEm: new Date(Date.now() + body.expires_in * 1000) }
}

// Renova um token de longa duração ainda válido (precisa ter sido emitido
// há pelo menos 24h) — usado pela sincronização periódica. Não precisa do
// App Secret, só do próprio token.
export async function renovarTokenLongo(tokenLongo: string): Promise<TokenLongoDuracao> {
  const body = await chamarGraphApi<{ access_token: string; expires_in: number }>('/refresh_access_token', {
    grant_type: 'ig_refresh_token',
    access_token: tokenLongo,
  })
  return { accessToken: body.access_token, expiraEm: new Date(Date.now() + body.expires_in * 1000) }
}

export interface ContaInstagram {
  instagramUserId: string
  nomeUsuario: string
  nomeExibicao?: string
  fotoUrl?: string
  biografia?: string
  site?: string
  tipoConta?: string
  seguidores: number
  seguindo: number
  publicacoesTotal: number
}

// Com o Login do Instagram, a conta já vem direto no `/me` — sem precisar
// passar por uma Página do Facebook, como no fluxo antigo.
export async function buscarContaInstagram(accessToken: string): Promise<ContaInstagram> {
  const info = await chamarGraphApi<{
    user_id?: string; id: string; username: string; name?: string; profile_picture_url?: string
    biography?: string; website?: string; account_type?: string
    followers_count?: number; follows_count?: number; media_count?: number
  }>('/me', {
    fields: 'user_id,username,name,profile_picture_url,biography,website,account_type,followers_count,follows_count,media_count',
    access_token: accessToken,
  })

  return {
    // `user_id` é o ID profissional (o que os endpoints /{id}/media e
    // /{id}/insights esperam); `id` é o app-scoped — só cai nele se a API
    // não devolver o primeiro.
    instagramUserId: info.user_id ?? info.id,
    nomeUsuario: info.username,
    nomeExibicao: info.name,
    fotoUrl: info.profile_picture_url,
    biografia: info.biography,
    site: info.website,
    tipoConta: info.account_type,
    seguidores: info.followers_count ?? 0,
    seguindo: info.follows_count ?? 0,
    publicacoesTotal: info.media_count ?? 0,
  }
}

export interface MidiaInstagram {
  instagramMediaId: string
  tipo: string // IMAGE | VIDEO | CAROUSEL_ALBUM
  formato: string // FEED | REELS | STORY | AD
  legenda?: string
  urlMidia?: string
  thumbnailUrl?: string
  urlPermalink?: string
  publicadoEm: Date
  curtidas: number
  comentarios: number
}

type MidiaApi = {
  id: string; caption?: string; media_type: string; media_product_type?: string; media_url?: string
  thumbnail_url?: string; permalink?: string; timestamp: string; like_count?: number; comments_count?: number
}

const CAMPOS_MIDIA = 'id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count'

function mapearMidia(m: MidiaApi, formatoPadrao: string): MidiaInstagram {
  return {
    instagramMediaId: m.id,
    tipo: m.media_type,
    formato: m.media_product_type ?? formatoPadrao,
    legenda: m.caption,
    urlMidia: m.media_url,
    thumbnailUrl: m.thumbnail_url,
    urlPermalink: m.permalink,
    publicadoEm: new Date(m.timestamp),
    curtidas: m.like_count ?? 0,
    comentarios: m.comments_count ?? 0,
  }
}

// Percorre a paginação de /media (mais recente primeiro) até juntar `limite`
// posts — 25 por página, como a API sugere, era pouco pra enxergar
// tendência de qualquer período maior que duas semanas.
export async function buscarMidias(igUserId: string, accessToken: string, limite = 150): Promise<MidiaInstagram[]> {
  const midias: MidiaInstagram[] = []
  let proxima: string | null = `${GRAPH_BASE}/${igUserId}/media?${new URLSearchParams({ fields: CAMPOS_MIDIA, limit: '50', access_token: accessToken })}`
  while (proxima && midias.length < limite) {
    const pagina: { data: MidiaApi[]; paging?: { next?: string } } = await lerResposta(await fetch(proxima))
    midias.push(...pagina.data.map(m => mapearMidia(m, 'FEED')))
    proxima = pagina.paging?.next ?? null
  }
  return midias.slice(0, limite)
}

// Stories só ficam visíveis na API enquanto estão no ar (24h).
export async function buscarStoriesAtivos(igUserId: string, accessToken: string): Promise<MidiaInstagram[]> {
  const body = await chamarGraphApi<{ data: MidiaApi[] }>(`/${igUserId}/stories`, {
    fields: 'id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp',
    access_token: accessToken,
  })
  return body.data.map(m => mapearMidia(m, 'STORY'))
}

type ItemInsight = {
  name: string
  values?: Array<{ value: unknown; end_time?: string }>
  total_value?: { value?: number; breakdowns?: Array<{ results?: Array<{ dimension_values: string[]; value: number }> }> }
}

// Lembra, durante um sync, quais métricas a API recusou pra cada contexto
// (ex.: "REELS:profile_visits") — sem isso, uma métrica indisponível pra
// um formato custaria uma chamada perdida em cada post desse formato.
export type MetricasRecusadas = Set<string>

async function buscarMetricasComFallback(
  caminho: string,
  contexto: string,
  metricas: string[],
  params: Record<string, string>,
  recusadas: MetricasRecusadas,
): Promise<ItemInsight[]> {
  const validas = metricas.filter(m => !recusadas.has(`${contexto}:${m}`))
  if (validas.length === 0) return []
  try {
    const body = await chamarGraphApi<{ data: ItemInsight[] }>(caminho, { ...params, metric: validas.join(',') })
    return body.data
  } catch (e) {
    if (!erroDeMetricaInvalida(e)) throw e
    if (validas.length === 1) {
      recusadas.add(`${contexto}:${validas[0]}`)
      return []
    }
  }
  const itens: ItemInsight[] = []
  for (const metrica of validas) {
    try {
      const body = await chamarGraphApi<{ data: ItemInsight[] }>(caminho, { ...params, metric: metrica })
      itens.push(...body.data)
    } catch (e) {
      if (!erroDeMetricaInvalida(e)) throw e
      recusadas.add(`${contexto}:${metrica}`)
    }
  }
  return itens
}

function valorNumerico(item: ItemInsight | undefined): number {
  if (!item) return 0
  const bruto = item.total_value?.value ?? item.values?.[0]?.value
  return typeof bruto === 'number' ? bruto : 0
}

function porNome(itens: ItemInsight[]): Map<string, ItemInsight> {
  return new Map(itens.map(i => [i.name, i]))
}

export interface InsightsMidia {
  alcance: number
  visualizacoes: number
  salvamentos: number
  compartilhamentos: number
  interacoesTotais: number
  visitasPerfil: number
  seguidoresGerados: number
  respostas: number
  curtidas?: number
  comentarios?: number
  tempoMedioAssistidoSeg: number | null
  tempoTotalAssistidoSeg: number | null
  navegacaoStory: { avancos: number; retornos: number; saidas: number; proximoStory: number } | null
}

const METRICAS_POR_FORMATO: Record<string, string[]> = {
  FEED: ['reach', 'views', 'likes', 'comments', 'shares', 'saved', 'total_interactions', 'profile_visits', 'follows'],
  REELS: ['reach', 'views', 'likes', 'comments', 'shares', 'saved', 'total_interactions', 'ig_reels_avg_watch_time', 'ig_reels_video_view_total_time'],
  STORY: ['reach', 'views', 'shares', 'replies', 'total_interactions', 'follows', 'profile_visits'],
}

// Insight de um post/reels/story. Um post sem insight disponível (ex.:
// publicado antes da conta virar profissional) devolve zeros — só erro de
// token sobe pro chamador, porque aí nenhum outro post vai funcionar.
export async function buscarInsightsMidia(mediaId: string, formato: string, accessToken: string, recusadas: MetricasRecusadas): Promise<InsightsMidia> {
  const chaveFormato = formato in METRICAS_POR_FORMATO ? formato : 'FEED'
  const resultado: InsightsMidia = {
    alcance: 0, visualizacoes: 0, salvamentos: 0, compartilhamentos: 0, interacoesTotais: 0,
    visitasPerfil: 0, seguidoresGerados: 0, respostas: 0,
    tempoMedioAssistidoSeg: null, tempoTotalAssistidoSeg: null, navegacaoStory: null,
  }
  let itens: Map<string, ItemInsight>
  try {
    itens = porNome(await buscarMetricasComFallback(`/${mediaId}/insights`, chaveFormato, METRICAS_POR_FORMATO[chaveFormato], { access_token: accessToken }, recusadas))
  } catch (e) {
    if (erroDeTokenExpirado(e)) throw e
    return resultado
  }

  resultado.alcance = valorNumerico(itens.get('reach'))
  resultado.visualizacoes = valorNumerico(itens.get('views'))
  resultado.salvamentos = valorNumerico(itens.get('saved'))
  resultado.compartilhamentos = valorNumerico(itens.get('shares'))
  resultado.interacoesTotais = valorNumerico(itens.get('total_interactions'))
  resultado.visitasPerfil = valorNumerico(itens.get('profile_visits'))
  resultado.seguidoresGerados = valorNumerico(itens.get('follows'))
  resultado.respostas = valorNumerico(itens.get('replies'))
  if (itens.has('likes')) resultado.curtidas = valorNumerico(itens.get('likes'))
  if (itens.has('comments')) resultado.comentarios = valorNumerico(itens.get('comments'))
  // A API devolve os tempos de reels em milissegundos.
  if (itens.has('ig_reels_avg_watch_time')) resultado.tempoMedioAssistidoSeg = valorNumerico(itens.get('ig_reels_avg_watch_time')) / 1000
  if (itens.has('ig_reels_video_view_total_time')) resultado.tempoTotalAssistidoSeg = valorNumerico(itens.get('ig_reels_video_view_total_time')) / 1000

  if (chaveFormato === 'STORY') {
    try {
      const nav = porNome(await buscarMetricasComFallback(`/${mediaId}/insights`, 'STORY_NAV', ['navigation'], {
        breakdown: 'story_navigation_action_type', access_token: accessToken,
      }, recusadas)).get('navigation')
      const resultados = nav?.total_value?.breakdowns?.[0]?.results ?? []
      const acao = (nome: string) => resultados.find(r => r.dimension_values[0] === nome)?.value ?? 0
      if (nav) resultado.navegacaoStory = { avancos: acao('tap_forward'), retornos: acao('tap_back'), saidas: acao('tap_exit'), proximoStory: acao('swipe_forward') }
    } catch (e) {
      if (erroDeTokenExpirado(e)) throw e
    }
  }
  return resultado
}

export interface MetricasContaDia {
  data: Date // meia-noite UTC do dia
  alcance: number
  visualizacoes: number
  contasEngajadas: number
  interacoes: number
  curtidas: number
  comentarios: number
  compartilhamentos: number
  salvamentos: number
  respostas: number
  visitasPerfil: number
  toquesLinks: number
  cliquesSite: number
  seguidoresGanhos: number | null
  seguidoresPerdidos: number | null
}

const METRICAS_CONTA_DIA = [
  'reach', 'views', 'accounts_engaged', 'total_interactions', 'likes', 'comments', 'shares', 'saves', 'replies',
  'profile_links_taps', 'profile_views', 'website_clicks',
]

const DIA_MS = 24 * 60 * 60 * 1000

// Métricas de conta de UM dia. A API só entrega a maioria delas agregada
// (metric_type=total_value) no intervalo pedido — então, pra ter a série
// diária, é uma chamada por dia. `follows_and_unfollows` vai numa chamada
// separada porque exige breakdown, que as outras métricas não aceitam.
export async function buscarMetricasContaDia(igUserId: string, accessToken: string, dia: Date, recusadas: MetricasRecusadas): Promise<MetricasContaDia> {
  const params = {
    period: 'day',
    metric_type: 'total_value',
    since: String(Math.floor(dia.getTime() / 1000)),
    until: String(Math.floor((dia.getTime() + DIA_MS) / 1000)),
    access_token: accessToken,
  }
  const [itensGerais, itensSeguidores] = await Promise.all([
    buscarMetricasComFallback(`/${igUserId}/insights`, 'CONTA', METRICAS_CONTA_DIA, params, recusadas),
    buscarMetricasComFallback(`/${igUserId}/insights`, 'CONTA_SEG', ['follows_and_unfollows'], { ...params, breakdown: 'follow_type' }, recusadas)
      .catch(e => { if (erroDeTokenExpirado(e)) throw e; return [] as ItemInsight[] }),
  ])
  const itens = porNome(itensGerais)
  const breakdown = porNome(itensSeguidores).get('follows_and_unfollows')?.total_value?.breakdowns?.[0]?.results
  const tipoSeguidor = (nome: string) => breakdown?.find(r => r.dimension_values[0] === nome)?.value ?? 0

  return {
    data: dia,
    alcance: valorNumerico(itens.get('reach')),
    visualizacoes: valorNumerico(itens.get('views')),
    contasEngajadas: valorNumerico(itens.get('accounts_engaged')),
    interacoes: valorNumerico(itens.get('total_interactions')),
    curtidas: valorNumerico(itens.get('likes')),
    comentarios: valorNumerico(itens.get('comments')),
    compartilhamentos: valorNumerico(itens.get('shares')),
    salvamentos: valorNumerico(itens.get('saves')),
    respostas: valorNumerico(itens.get('replies')),
    visitasPerfil: valorNumerico(itens.get('profile_views')),
    toquesLinks: valorNumerico(itens.get('profile_links_taps')),
    cliquesSite: valorNumerico(itens.get('website_clicks')),
    seguidoresGanhos: breakdown ? tipoSeguidor('FOLLOWER') : null,
    seguidoresPerdidos: breakdown ? tipoSeguidor('NON_FOLLOWER') : null,
  }
}

// Novos seguidores por dia dos últimos 30 dias (série temporal numa
// chamada só) — usado quando `follows_and_unfollows` não está disponível.
// A API só entrega essa métrica pra contas com 100+ seguidores.
export async function buscarNovosSeguidoresPorDia(igUserId: string, accessToken: string, desde: Date, ate: Date): Promise<Map<number, number>> {
  const mapa = new Map<number, number>()
  try {
    const body = await chamarGraphApi<{ data: ItemInsight[] }>(`/${igUserId}/insights`, {
      metric: 'follower_count',
      period: 'day',
      since: String(Math.floor(desde.getTime() / 1000)),
      until: String(Math.floor(ate.getTime() / 1000)),
      access_token: accessToken,
    })
    for (const v of body.data[0]?.values ?? []) {
      if (!v.end_time || typeof v.value !== 'number') continue
      // end_time marca o FIM do dia medido — o dia em si é o anterior.
      const fim = new Date(v.end_time)
      const dia = Date.UTC(fim.getUTCFullYear(), fim.getUTCMonth(), fim.getUTCDate()) - DIA_MS
      mapa.set(dia, v.value)
    }
  } catch (e) {
    if (erroDeTokenExpirado(e)) throw e
  }
  return mapa
}

export interface FatiaDemografia { chave: string; valor: number }
export interface DemografiaPublico { idade: FatiaDemografia[]; genero: FatiaDemografia[]; cidade: FatiaDemografia[]; pais: FatiaDemografia[] }
export interface Demografia { seguidores: DemografiaPublico | null; engajados: DemografiaPublico | null }

const BREAKDOWNS_DEMOGRAFIA: Array<[keyof DemografiaPublico, string]> = [['idade', 'age'], ['genero', 'gender'], ['cidade', 'city'], ['pais', 'country']]

async function buscarDemografiaPublico(igUserId: string, accessToken: string, metrica: string, recusadas: MetricasRecusadas): Promise<DemografiaPublico | null> {
  const publico: DemografiaPublico = { idade: [], genero: [], cidade: [], pais: [] }
  let algumDado = false
  await Promise.all(BREAKDOWNS_DEMOGRAFIA.map(async ([campo, breakdown]) => {
    // `timeframe` é obrigatório pra engaged_audience_demographics e
    // opcional (dependendo da versão da API) pra follower_demographics —
    // tenta sem, e com `this_month` se a API exigir.
    const variantes: Array<Record<string, string>> = [{}, { timeframe: 'this_month' }]
    for (const extra of variantes) {
      try {
        const itens = await buscarMetricasComFallback(`/${igUserId}/insights`, `DEMO_${metrica}_${breakdown}_${Object.keys(extra).length}`, [metrica], {
          period: 'lifetime', metric_type: 'total_value', breakdown, access_token: accessToken, ...extra,
        }, recusadas)
        // Lista vazia = a API recusou essa variante do pedido — tenta a próxima.
        if (itens.length === 0) continue
        const resultados = itens[0]?.total_value?.breakdowns?.[0]?.results ?? []
        publico[campo] = resultados
          .map(r => ({ chave: r.dimension_values[0], valor: r.value }))
          .sort((a, b) => b.valor - a.valor)
        if (resultados.length > 0) algumDado = true
        return
      } catch (e) {
        if (erroDeTokenExpirado(e)) throw e
      }
    }
  }))
  return algumDado ? publico : null
}

// Retrato atual da audiência. A API só devolve demografia pra contas com
// 100+ seguidores e esconde fatias muito pequenas — por isso tudo aqui é
// opcional e a tela trata "sem dado" como estado normal.
export async function buscarDemografia(igUserId: string, accessToken: string, recusadas: MetricasRecusadas): Promise<Demografia> {
  const [seguidores, engajados] = await Promise.all([
    buscarDemografiaPublico(igUserId, accessToken, 'follower_demographics', recusadas),
    buscarDemografiaPublico(igUserId, accessToken, 'engaged_audience_demographics', recusadas),
  ])
  return { seguidores, engajados }
}

export interface DistribuicaoAlcance {
  periodoDias: number
  alcanceTotal: number
  porTipoSeguidor: FatiaDemografia[] // FOLLOWER | NON_FOLLOWER
  porFormato: FatiaDemografia[] // POST | REEL | STORY | CAROUSEL_CONTAINER | AD ...
}

// De onde vem o alcance dos últimos `dias` dias: quanto é de quem já segue
// (fidelização) e quanto é de quem ainda não segue (descoberta — o que de
// fato faz o perfil crescer), e qual formato puxou esse alcance. Alcance é
// "contas únicas" — só dá pra somar certo pedindo o intervalo inteiro de
// uma vez, por isso é uma chamada própria e não a soma dos dias.
export async function buscarDistribuicaoAlcance(igUserId: string, accessToken: string, dias: number, recusadas: MetricasRecusadas): Promise<DistribuicaoAlcance | null> {
  const agora = Date.now()
  const params = {
    period: 'day',
    metric_type: 'total_value',
    since: String(Math.floor((agora - dias * DIA_MS) / 1000)),
    until: String(Math.floor(agora / 1000)),
    access_token: accessToken,
  }
  const fatias = async (breakdown: string): Promise<{ total: number; fatias: FatiaDemografia[] }> => {
    try {
      const item = (await buscarMetricasComFallback(`/${igUserId}/insights`, `ALCANCE_${breakdown}`, ['reach'], { ...params, breakdown }, recusadas))[0]
      return {
        total: item?.total_value?.value ?? 0,
        fatias: (item?.total_value?.breakdowns?.[0]?.results ?? [])
          .map(r => ({ chave: r.dimension_values[0], valor: r.value }))
          .sort((a, b) => b.valor - a.valor),
      }
    } catch (e) {
      if (erroDeTokenExpirado(e)) throw e
      return { total: 0, fatias: [] }
    }
  }
  const [porSeguidor, porFormato] = await Promise.all([fatias('follow_type'), fatias('media_product_type')])
  if (porSeguidor.fatias.length === 0 && porFormato.fatias.length === 0) return null
  return {
    periodoDias: dias,
    alcanceTotal: Math.max(porSeguidor.total, porFormato.total),
    porTipoSeguidor: porSeguidor.fatias,
    porFormato: porFormato.fatias,
  }
}

// Alcance único (contas distintas) num intervalo — o número que o Instagram
// mostra como "contas alcançadas" no período, que NÃO é a soma do alcance
// diário (a mesma pessoa conta uma vez só). A API só calcula pra janelas de
// até 30 dias; acima disso devolve null e a tela explica o motivo.
export const MAX_DIAS_ALCANCE_UNICO = 30
export async function buscarAlcanceUnicoPeriodo(igUserId: string, accessToken: string, desde: Date, ate: Date): Promise<number | null> {
  if (ate.getTime() - desde.getTime() > MAX_DIAS_ALCANCE_UNICO * DIA_MS) return null
  const body = await chamarGraphApi<{ data: ItemInsight[] }>(`/${igUserId}/insights`, {
    metric: 'reach',
    period: 'day',
    metric_type: 'total_value',
    since: String(Math.floor(desde.getTime() / 1000)),
    until: String(Math.floor(ate.getTime() / 1000)),
    access_token: accessToken,
  })
  const valor = body.data[0]?.total_value?.value
  return typeof valor === 'number' ? valor : null
}

// Média de seguidores online por hora (0..23) nos últimos dias que a API
// devolver (até 30). Null quando a métrica não está disponível.
export async function buscarSeguidoresOnlinePorHora(igUserId: string, accessToken: string): Promise<number[] | null> {
  try {
    const agora = Date.now()
    const body = await chamarGraphApi<{ data: ItemInsight[] }>(`/${igUserId}/insights`, {
      metric: 'online_followers',
      period: 'lifetime',
      since: String(Math.floor((agora - 29 * DIA_MS) / 1000)),
      until: String(Math.floor(agora / 1000)),
      access_token: accessToken,
    })
    const dias = (body.data[0]?.values ?? [])
      .map(v => v.value)
      .filter((v): v is Record<string, number> => typeof v === 'object' && v !== null && Object.keys(v).length > 0)
    if (dias.length === 0) return null
    return Array.from({ length: 24 }, (_, hora) =>
      Math.round(dias.reduce((s, d) => s + (d[String(hora)] ?? 0), 0) / dias.length))
  } catch (e) {
    if (erroDeTokenExpirado(e)) throw e
    return null
  }
}
