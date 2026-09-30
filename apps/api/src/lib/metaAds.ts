// Cliente da Marketing API da Meta (Gerenciador de Anúncios): contas de
// anúncio acessíveis pelo token, insights diários por anúncio e alcance de
// um período. Tudo "de leitura" (permissão ads_read).
const GRAPH_BASE = process.env.META_GRAPH_BASE ?? 'https://graph.facebook.com'
const VERSAO = process.env.META_GRAPH_VERSION ?? 'v23.0'

export class ErroMetaAds extends Error {
  constructor(message: string, readonly codigo?: number, readonly subcodigo?: number) {
    super(message)
  }
}

// 190 = token inválido/expirado/sem permissão de acesso.
export function erroDeToken(e: unknown): boolean {
  return e instanceof ErroMetaAds && (e.codigo === 190 || e.codigo === 102)
}

// 17/613/80004 = limite de chamadas da conta de anúncios.
export function erroDeLimite(e: unknown): boolean {
  return e instanceof ErroMetaAds && [4, 17, 32, 613, 80000, 80004].includes(e.codigo ?? 0)
}

function traduzir(msg: string, codigo?: number): string {
  if (codigo === 190) return 'O token do Gerenciador de Anúncios expirou ou foi revogado. Gere um novo e conecte de novo.'
  if (codigo === 200 || codigo === 10) return 'O token não tem permissão pra ler essa conta de anúncios (precisa de ads_read e acesso à conta).'
  if (erroDeLimite(new ErroMetaAds(msg, codigo))) return 'A Meta limitou as chamadas por agora. A próxima sincronização tenta de novo.'
  return `A Meta recusou: ${msg}`
}

async function chamar<T>(caminho: string, params: Record<string, string>, token: string): Promise<T> {
  const url = caminho.startsWith('http') ? caminho : `${GRAPH_BASE}/${VERSAO}${caminho}?${new URLSearchParams({ ...params, access_token: token })}`
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) })
  const body = await res.json().catch(() => null) as { error?: { message?: string; code?: number; error_subcode?: number } } | null
  if (!res.ok || body?.error) {
    const e = body?.error
    throw new ErroMetaAds(traduzir(e?.message ?? `HTTP ${res.status}`, e?.code), e?.code, e?.error_subcode)
  }
  return body as T
}

// ---------- Contas de anúncio ----------

export interface ContaDeAnuncio { id: string; nome: string; moeda: string; fuso: string | null; ativa: boolean }

export async function listarContasDeAnuncio(token: string): Promise<ContaDeAnuncio[]> {
  const contas: ContaDeAnuncio[] = []
  let proxima: string | null = null
  let primeira = true
  while (primeira || proxima) {
    const body: { data: Array<{ id: string; name?: string; currency?: string; timezone_name?: string; account_status?: number }>; paging?: { next?: string } } =
      primeira
        ? await chamar('/me/adaccounts', { fields: 'id,name,currency,timezone_name,account_status', limit: '100' }, token)
        : await chamar(proxima!, {}, token)
    primeira = false
    for (const c of body.data) {
      contas.push({ id: c.id, nome: c.name ?? c.id, moeda: c.currency ?? 'BRL', fuso: c.timezone_name ?? null, ativa: c.account_status === 1 })
    }
    proxima = body.paging?.next ?? null
    if (contas.length > 500) break
  }
  return contas
}

// ---------- Insights ----------

type Acao = { action_type: string; value: string }

const CAMPOS_INSIGHT = [
  'date_start', 'ad_id', 'ad_name', 'adset_id', 'adset_name', 'campaign_id', 'campaign_name', 'objective',
  'spend', 'impressions', 'reach', 'clicks', 'inline_link_clicks', 'actions',
  'video_thruplay_watched_actions', 'video_p25_watched_actions', 'video_p50_watched_actions',
  'video_p75_watched_actions', 'video_p100_watched_actions',
].join(',')

export interface InsightAnuncioDia {
  data: string // YYYY-MM-DD (fuso da conta de anúncios)
  adId: string; adNome: string; adsetId: string; adsetNome: string; campanhaId: string; campanhaNome: string; objetivo: string | null
  gasto: number; impressoes: number; alcance: number; cliques: number; cliquesLink: number
  lpv: number; conversas: number; leads: number
  videoViews: number; thruplays: number; videoP25: number; videoP50: number; videoP75: number; videoP100: number
}

const num = (v: string | undefined) => (v ? Number(v) || 0 : 0)
function acao(lista: Acao[] | undefined, ...tipos: string[]): number {
  if (!lista) return 0
  for (const t of tipos) {
    const a = lista.find(x => x.action_type === t)
    if (a) return num(a.value)
  }
  return 0
}

// Leads: "lead" já é o total que o Gerenciador mostra (formulário + pixel).
// Sem ele, soma as duas origens.
function leadsDe(acoes: Acao[] | undefined): number {
  const total = acao(acoes, 'lead')
  if (total) return total
  return acao(acoes, 'onsite_conversion.lead_grouped', 'leadgen_grouped') + acao(acoes, 'offsite_conversion.fb_pixel_lead')
}

export function converterLinha(l: Record<string, unknown>): InsightAnuncioDia {
  const acoes = l.actions as Acao[] | undefined
  const soma = (campo: string) => acao(l[campo] as Acao[] | undefined, 'video_view')
  return {
    data: String(l.date_start),
    adId: String(l.ad_id), adNome: String(l.ad_name ?? l.ad_id),
    adsetId: String(l.adset_id ?? ''), adsetNome: String(l.adset_name ?? ''),
    campanhaId: String(l.campaign_id ?? ''), campanhaNome: String(l.campaign_name ?? ''),
    objetivo: (l.objective as string | undefined) ?? null,
    gasto: num(l.spend as string), impressoes: num(l.impressions as string), alcance: num(l.reach as string),
    cliques: num(l.clicks as string), cliquesLink: num(l.inline_link_clicks as string),
    lpv: acao(acoes, 'landing_page_view', 'omni_landing_page_view'),
    // Conversas pelo WhatsApp/Messenger/Direct iniciadas a partir do anúncio.
    conversas: acao(acoes, 'onsite_conversion.messaging_conversation_started_7d'),
    leads: leadsDe(acoes),
    videoViews: acao(acoes, 'video_view'),
    thruplays: soma('video_thruplay_watched_actions'),
    videoP25: soma('video_p25_watched_actions'), videoP50: soma('video_p50_watched_actions'),
    videoP75: soma('video_p75_watched_actions'), videoP100: soma('video_p100_watched_actions'),
  }
}

// Insights diários, por anúncio, de um intervalo (datas no fuso da conta).
// Pagina até o fim ou até o prazo; devolve também se terminou.
export async function buscarInsightsDiarios(
  adAccountId: string, token: string, desde: string, ate: string, prazoEm: number,
): Promise<{ linhas: InsightAnuncioDia[]; completo: boolean }> {
  const linhas: InsightAnuncioDia[] = []
  let url: string | null = null
  let primeira = true
  while (primeira || url) {
    if (Date.now() > prazoEm) return { linhas, completo: false }
    const body: { data: Array<Record<string, unknown>>; paging?: { next?: string } } = primeira
      ? await chamar(`/${adAccountId}/insights`, {
        level: 'ad', fields: CAMPOS_INSIGHT, time_increment: '1', limit: '500',
        time_range: JSON.stringify({ since: desde, until: ate }),
        // Mesmo critério de atribuição configurado no Gerenciador — os números
        // batem com o que aparece lá.
        use_unified_attribution_setting: 'true',
      }, token)
      : await chamar(url!, {}, token)
    primeira = false
    linhas.push(...body.data.map(converterLinha))
    url = body.paging?.next ?? null
  }
  return { linhas, completo: true }
}

// Alcance e frequência do período: da conta e de cada campanha.
export async function buscarAlcancePeriodo(adAccountId: string, token: string, desde: string, ate: string) {
  const time_range = JSON.stringify({ since: desde, until: ate })
  const [conta, campanhas] = await Promise.all([
    chamar<{ data: Array<{ reach?: string; frequency?: string }> }>(`/${adAccountId}/insights`, { level: 'account', fields: 'reach,frequency', time_range }, token),
    chamar<{ data: Array<{ campaign_id?: string; reach?: string; frequency?: string }> }>(`/${adAccountId}/insights`, { level: 'campaign', fields: 'campaign_id,reach,frequency', time_range, limit: '500' }, token),
  ])
  const c = conta.data[0]
  return {
    conta: { alcance: num(c?.reach), frequencia: Number(c?.frequency ?? 0) || 0 },
    campanhas: campanhas.data.filter(x => x.campaign_id).map(x => ({ id: x.campaign_id!, alcance: num(x.reach), frequencia: Number(x.frequency ?? 0) || 0 })),
  }
}
