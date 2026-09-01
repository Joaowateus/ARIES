/**
 * Cliente HTTP fino pra Graph API do Meta (Marketing API) — só as chamadas
 * que a integração de tráfego pago precisa: trocar o `code` do OAuth por
 * token, trocar por token de longa duração, listar contas de anúncio e
 * puxar Insights por campanha/dia. Sem SDK — é só fetch + Graph API v{n}.
 *
 * Nada aqui toca o banco; a orquestração (ler/gravar IntegracaoAnuncio e
 * MetricaTrafegoPago) fica em routes/integracoesAnuncio.ts.
 */

const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION ?? 'v21.0'
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`

export interface MetaAdsConfig {
  appId: string
  appSecret: string
  redirectUri: string
}

/** Lê as credenciais do App Meta a partir do ambiente. Retorna null (em vez
 * de lançar) quando falta alguma — quem chama decide como avisar o usuário,
 * sem derrubar a rota. */
export function configuracaoMetaAds(): MetaAdsConfig | null {
  const appId = process.env.META_APP_ID
  const appSecret = process.env.META_APP_SECRET
  const redirectUri = process.env.META_REDIRECT_URI
  if (!appId || !appSecret || !redirectUri) return null
  return { appId, appSecret, redirectUri }
}

export function montarUrlAutorizacao(cfg: MetaAdsConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: cfg.appId,
    redirect_uri: cfg.redirectUri,
    state,
    scope: 'ads_read,business_management',
    response_type: 'code',
  })
  return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params.toString()}`
}

interface TokenResponse {
  access_token: string
  token_type?: string
  expires_in?: number
}

interface GraphErrorBody {
  error?: { message?: string }
}

async function chamarGraphApi<T>(url: string): Promise<T> {
  const res = await fetch(url)
  const body = (await res.json()) as T & GraphErrorBody
  if (!res.ok) {
    throw new Error(body?.error?.message ?? `Erro ${res.status} na Graph API`)
  }
  return body
}

export async function trocarCodigoPorToken(cfg: MetaAdsConfig, code: string): Promise<TokenResponse> {
  const params = new URLSearchParams({
    client_id: cfg.appId,
    client_secret: cfg.appSecret,
    redirect_uri: cfg.redirectUri,
    code,
  })
  return chamarGraphApi<TokenResponse>(`${GRAPH_BASE}/oauth/access_token?${params.toString()}`)
}

/** O token trocado pelo `code` dura só ~1-2h — pra sincronizar sem pedir
 * login de novo a cada sessão, troca de novo por um de longa duração
 * (~60 dias). */
export async function trocarPorTokenLongaDuracao(cfg: MetaAdsConfig, tokenCurto: string): Promise<TokenResponse> {
  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: cfg.appId,
    client_secret: cfg.appSecret,
    fb_exchange_token: tokenCurto,
  })
  return chamarGraphApi<TokenResponse>(`${GRAPH_BASE}/oauth/access_token?${params.toString()}`)
}

export interface ContaAnuncioMeta {
  id: string // formato "act_123456789", já pronto pra usar em /{id}/insights
  account_id: string
  name: string
}

export async function buscarContasAnuncio(accessToken: string): Promise<ContaAnuncioMeta[]> {
  const params = new URLSearchParams({ fields: 'account_id,name', access_token: accessToken })
  const resposta = await chamarGraphApi<{ data: ContaAnuncioMeta[] }>(`${GRAPH_BASE}/me/adaccounts?${params.toString()}`)
  return resposta.data
}

interface AcaoInsight {
  action_type: string
  value: string
}

interface LinhaInsightMeta {
  campaign_name: string
  date_start: string
  impressions?: string
  clicks?: string
  spend?: string
  actions?: AcaoInsight[]
}

export async function buscarInsightsPorCampanha(
  accessToken: string,
  contaAnuncioId: string,
  periodo: { inicio: string; fim: string }
): Promise<LinhaInsightMeta[]> {
  const params = new URLSearchParams({
    level: 'campaign',
    time_increment: '1',
    time_range: JSON.stringify({ since: periodo.inicio, until: periodo.fim }),
    fields: 'campaign_name,impressions,clicks,spend,actions',
    access_token: accessToken,
  })
  const resposta = await chamarGraphApi<{ data: LinhaInsightMeta[] }>(`${GRAPH_BASE}/${contaAnuncioId}/insights?${params.toString()}`)
  return resposta.data
}

// action_type que a Meta usa pra reportar "lead" varia com o objetivo da
// campanha (Instant Form, Conversions API, pixel de site) — pega o primeiro
// que aparecer, nesta ordem de prioridade, em vez de somar todos: em
// campanha de conversão o pixel e o "onsite_conversion" às vezes descrevem
// o mesmo evento de formas diferentes, e somar duplicaria a contagem.
const ACTION_TYPES_LEAD = ['lead', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead']
const ACTION_TYPES_LP_VIEW = ['landing_page_view']

function valorDaPrimeiraAcao(actions: AcaoInsight[] | undefined, tipos: string[]): number {
  if (!actions) return 0
  for (const tipo of tipos) {
    const encontrada = actions.find(a => a.action_type === tipo)
    if (encontrada) return Math.round(Number(encontrada.value) || 0)
  }
  return 0
}

export interface LinhaTrafegoDia {
  campanha: string
  data: string // YYYY-MM-DD, mesmo formato que MetricaTrafegoPago.data espera
  impressoes: number
  cliques: number
  visitasLp: number
  leadsCapturados: number
  valorInvestido: number
}

/** Achata o formato bruto do Insights (impressions/clicks como string,
 * "leads" escondido dentro de `actions`) pro mesmo shape que
 * MetricaTrafegoPago usa — o resto do sync (routes/integracoesAnuncio.ts)
 * só faz upsert linha a linha. */
export function converterInsightsParaLinhas(insights: LinhaInsightMeta[]): LinhaTrafegoDia[] {
  return insights.map(i => ({
    campanha: i.campaign_name,
    data: i.date_start,
    impressoes: Math.round(Number(i.impressions) || 0),
    cliques: Math.round(Number(i.clicks) || 0),
    visitasLp: valorDaPrimeiraAcao(i.actions, ACTION_TYPES_LP_VIEW),
    leadsCapturados: valorDaPrimeiraAcao(i.actions, ACTION_TYPES_LEAD),
    valorInvestido: Number(i.spend) || 0,
  }))
}
