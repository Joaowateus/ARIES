// Cliente fino pra API do Instagram (Login do Instagram / Business Login) —
// usa fetch nativo (Node 18+), sem dependência externa. Toda função aqui
// recebe o accessToken já resolvido (troca/renovação fica a cargo do
// chamador) e lança Error com mensagem legível quando a API retorna erro.

const GRAPH_BASE = 'https://graph.instagram.com'

async function chamarGraphApi<T>(caminho: string, params: Record<string, string>): Promise<T> {
  const query = new URLSearchParams(params).toString()
  const res = await fetch(`${GRAPH_BASE}${caminho}?${query}`)
  const body: unknown = await res.json()
  if (!res.ok) {
    const mensagem = (body as { error?: { message?: string } })?.error?.message
    throw new Error(mensagem ?? 'Falha ao chamar a API do Instagram')
  }
  return body as T
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
    throw new Error(mensagem ?? 'Falha ao trocar o código de autorização por um token')
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
  seguidores: number
  seguindo: number
  publicacoesTotal: number
}

// Com o Login do Instagram, a conta já vem direto no `/me` — sem precisar
// passar por uma Página do Facebook, como no fluxo antigo.
export async function buscarContaInstagram(accessToken: string): Promise<ContaInstagram> {
  const info = await chamarGraphApi<{
    id: string; username: string; name?: string; profile_picture_url?: string
    followers_count?: number; follows_count?: number; media_count?: number
  }>('/me', {
    fields: 'id,username,name,profile_picture_url,followers_count,follows_count,media_count',
    access_token: accessToken,
  })

  return {
    instagramUserId: info.id,
    nomeUsuario: info.username,
    nomeExibicao: info.name,
    fotoUrl: info.profile_picture_url,
    seguidores: info.followers_count ?? 0,
    seguindo: info.follows_count ?? 0,
    publicacoesTotal: info.media_count ?? 0,
  }
}

export interface MidiaInstagram {
  instagramMediaId: string
  tipo: string
  legenda?: string
  urlMidia?: string
  urlPermalink?: string
  publicadoEm: Date
  curtidas: number
  comentarios: number
}

export async function buscarMidiasRecentes(igUserId: string, accessToken: string, limite = 25): Promise<MidiaInstagram[]> {
  const body = await chamarGraphApi<{
    data: Array<{
      id: string; caption?: string; media_type: string; media_url?: string
      permalink?: string; timestamp: string; like_count?: number; comments_count?: number
    }>
  }>(`/${igUserId}/media`, {
    fields: 'id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count',
    limit: String(limite),
    access_token: accessToken,
  })

  return body.data.map(m => ({
    instagramMediaId: m.id,
    tipo: m.media_type,
    legenda: m.caption,
    urlMidia: m.media_url,
    urlPermalink: m.permalink,
    publicadoEm: new Date(m.timestamp),
    curtidas: m.like_count ?? 0,
    comentarios: m.comments_count ?? 0,
  }))
}

export interface InsightsMidia {
  alcance: number
  impressoes: number
  salvamentos: number
  compartilhamentos: number
}

// Métricas de insight variam por tipo de mídia (REELS tem "plays" em vez de
// "impressions", por exemplo) — pede tudo que existir e ignora
// silenciosamente o que a API recusar pra não derrubar o sync inteiro por
// causa de uma mídia com métrica indisponível.
export async function buscarInsightsMidia(mediaId: string, accessToken: string): Promise<InsightsMidia> {
  const metricasPossiveis = ['reach', 'impressions', 'saved', 'shares']
  const resultado: InsightsMidia = { alcance: 0, impressoes: 0, salvamentos: 0, compartilhamentos: 0 }
  try {
    const body = await chamarGraphApi<{ data: Array<{ name: string; values: Array<{ value: number }> }> }>(`/${mediaId}/insights`, {
      metric: metricasPossiveis.join(','),
      access_token: accessToken,
    })
    for (const item of body.data) {
      const valor = item.values[0]?.value ?? 0
      if (item.name === 'reach') resultado.alcance = valor
      if (item.name === 'impressions') resultado.impressoes = valor
      if (item.name === 'saved') resultado.salvamentos = valor
      if (item.name === 'shares') resultado.compartilhamentos = valor
    }
  } catch {
    // mídia sem insight disponível (ex: publicada há mais de 24-48h em
    // algumas categorias, ou tipo não suportado) — mantém zeros
  }
  return resultado
}

export interface InsightsContaDiarios {
  alcance: number
  impressoes: number
  visitasPerfil: number
}

export async function buscarInsightsContaHoje(igUserId: string, accessToken: string): Promise<InsightsContaDiarios> {
  const resultado: InsightsContaDiarios = { alcance: 0, impressoes: 0, visitasPerfil: 0 }
  try {
    const body = await chamarGraphApi<{ data: Array<{ name: string; values: Array<{ value: number }> }> }>(`/${igUserId}/insights`, {
      metric: 'reach,impressions,profile_views',
      period: 'day',
      access_token: accessToken,
    })
    for (const item of body.data) {
      const valor = item.values[item.values.length - 1]?.value ?? 0
      if (item.name === 'reach') resultado.alcance = valor
      if (item.name === 'impressions') resultado.impressoes = valor
      if (item.name === 'profile_views') resultado.visitasPerfil = valor
    }
  } catch {
    // conta recém-conectada ou sem volume suficiente pra ter insight diário
  }
  return resultado
}
