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
  'spend', 'impressions', 'reach', 'clicks', 'inline_link_clicks', 'outbound_clicks', 'actions',
  'video_play_actions', 'video_avg_time_watched_actions',
  'video_thruplay_watched_actions', 'video_p25_watched_actions', 'video_p50_watched_actions',
  'video_p75_watched_actions', 'video_p95_watched_actions', 'video_p100_watched_actions',
].join(',')

export interface InsightAnuncioDia {
  data: string // YYYY-MM-DD (fuso da conta de anúncios)
  adId: string; adNome: string; adsetId: string; adsetNome: string; campanhaId: string; campanhaNome: string; objetivo: string | null
  gasto: number; impressoes: number; alcance: number; cliques: number; cliquesLink: number
  lpv: number; conversas: number; leads: number
  videoViews: number; thruplays: number; videoP25: number; videoP50: number; videoP75: number; videoP100: number
  videoP95: number; videoPlays: number; videoTempoTotal: number
  cliquesSaida: number; engajamento: number; reacoes: number; comentarios: number; compartilhamentos: number; salvamentos: number
  conversasProf2: number; conversasProf3: number; conversasProf5: number; bloqueios: number
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

// Ações de uma linha de insights (anúncio/dia ou segmento de público).
export function metricasDeAcoes(l: Record<string, unknown>) {
  const acoes = l.actions as Acao[] | undefined
  const soma = (campo: string) => acao(l[campo] as Acao[] | undefined, 'video_view')
  const plays = acao(l.video_play_actions as Acao[] | undefined, 'video_view')
  return {
    lpv: acao(acoes, 'landing_page_view', 'omni_landing_page_view'),
    // Conversas pelo WhatsApp/Messenger/Direct iniciadas a partir do anúncio.
    conversas: acao(acoes, 'onsite_conversion.messaging_conversation_started_7d'),
    leads: leadsDe(acoes),
    videoViews: acao(acoes, 'video_view'),
    thruplays: soma('video_thruplay_watched_actions'),
    videoP25: soma('video_p25_watched_actions'), videoP50: soma('video_p50_watched_actions'),
    videoP75: soma('video_p75_watched_actions'), videoP95: soma('video_p95_watched_actions'), videoP100: soma('video_p100_watched_actions'),
    videoPlays: plays,
    videoTempoTotal: soma('video_avg_time_watched_actions') * plays,
    cliquesSaida: acao(l.outbound_clicks as Acao[] | undefined, 'outbound_click'),
    engajamento: acao(acoes, 'post_engagement'),
    reacoes: acao(acoes, 'post_reaction'),
    comentarios: acao(acoes, 'comment'),
    compartilhamentos: acao(acoes, 'post'),
    salvamentos: acao(acoes, 'onsite_conversion.post_save'),
    conversasProf2: acao(acoes, 'onsite_conversion.messaging_user_depth_2_message_send'),
    conversasProf3: acao(acoes, 'onsite_conversion.messaging_user_depth_3_message_send'),
    conversasProf5: acao(acoes, 'onsite_conversion.messaging_user_depth_5_message_send'),
    bloqueios: acao(acoes, 'onsite_conversion.messaging_block'),
  }
}

export function converterLinha(l: Record<string, unknown>): InsightAnuncioDia {
  return {
    data: String(l.date_start),
    adId: String(l.ad_id), adNome: String(l.ad_name ?? l.ad_id),
    adsetId: String(l.adset_id ?? ''), adsetNome: String(l.adset_name ?? ''),
    campanhaId: String(l.campaign_id ?? ''), campanhaNome: String(l.campaign_name ?? ''),
    objetivo: (l.objective as string | undefined) ?? null,
    gasto: num(l.spend as string), impressoes: num(l.impressions as string), alcance: num(l.reach as string),
    cliques: num(l.clicks as string), cliquesLink: num(l.inline_link_clicks as string),
    ...metricasDeAcoes(l),
  }
}

// Insights diários, por anúncio, de um intervalo (datas no fuso da conta).
// Pagina até o fim ou até o prazo; devolve também se terminou.
export async function buscarInsightsDiarios(
  adAccountId: string, token: string, desde: string, ate: string, prazoEm: number,
): Promise<{ linhas: InsightAnuncioDia[]; completo: boolean; acoes: Record<string, number> }> {
  const linhas: InsightAnuncioDia[] = []
  // Total de cada tipo de ação que a Meta mandou — mostra na tela o que a
  // conta realmente tem (ex.: se vem profundidade de conversa ou não).
  const acoes: Record<string, number> = {}
  let url: string | null = null
  let primeira = true
  while (primeira || url) {
    if (Date.now() > prazoEm) return { linhas, completo: false, acoes }
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
    for (const l of body.data) for (const a of (l.actions as Acao[] | undefined) ?? []) acoes[a.action_type] = (acoes[a.action_type] ?? 0) + num(a.value)
    url = body.paging?.next ?? null
  }
  return { linhas, completo: true, acoes }
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

// ---------- Paginação genérica ----------
async function paginar<T>(caminho: string, params: Record<string, string>, token: string, prazoEm: number, maximo = 2000): Promise<{ itens: T[]; completo: boolean }> {
  const itens: T[] = []
  let url: string | null = null
  let primeira = true
  while (primeira || url) {
    if (Date.now() > prazoEm || itens.length >= maximo) return { itens, completo: false }
    const body: { data: T[]; paging?: { next?: string } } = primeira ? await chamar(caminho, params, token) : await chamar(url!, {}, token)
    primeira = false
    itens.push(...body.data)
    url = body.paging?.next ?? null
  }
  return { itens, completo: true }
}

// ---------- Estrutura: campanhas, conjuntos e anúncios ----------
export type TipoEstrutura = 'campanha' | 'conjunto' | 'anuncio'
export interface ObjetoEstrutura { tipo: TipoEstrutura; id: string; nome: string; status: string | null; dados: Record<string, unknown> }

// Orçamento vem em centavos (unidade mínima da moeda).
const orcamento = (v: unknown) => (v != null && v !== '' && Number(v) > 0 ? Number(v) / 100 : null)

type Nomeado = { name?: string }
// Resumo legível do direcionamento do conjunto (quem pode ver o anúncio).
export function resumoPublico(t: Record<string, unknown> | undefined) {
  if (!t) return null
  const nomes = (l: unknown) => (Array.isArray(l) ? (l as Nomeado[]).map(x => x?.name).filter((x): x is string => !!x) : [])
  const geo = (t.geo_locations ?? {}) as { countries?: string[]; regions?: Nomeado[]; cities?: Array<Nomeado & { radius?: number; distance_unit?: string }>; custom_locations?: Array<{ name?: string; address_string?: string; radius?: number; distance_unit?: string }> }
  const locais = [
    ...(geo.countries ?? []),
    ...nomes(geo.regions),
    ...(geo.cities ?? []).map(c => `${c.name}${c.radius ? ` (+${c.radius} ${c.distance_unit === 'mile' ? 'mi' : 'km'})` : ''}`),
    ...(geo.custom_locations ?? []).map(c => `${c.name ?? c.address_string ?? 'Ponto no mapa'}${c.radius ? ` (+${c.radius} ${c.distance_unit === 'mile' ? 'mi' : 'km'})` : ''}`),
  ]
  const flex = Array.isArray(t.flexible_spec) ? (t.flexible_spec as Array<Record<string, unknown>>) : []
  const interesses = flex.flatMap(f => [...nomes(f.interests), ...nomes(f.behaviors), ...nomes(f.life_events), ...nomes(f.work_positions)])
  const generos = Array.isArray(t.genders) && t.genders.length === 1 ? (t.genders[0] === 1 ? 'Homens' : 'Mulheres') : 'Todos'
  const auto = (t.targeting_automation ?? {}) as { advantage_audience?: number }
  const plataformas = Array.isArray(t.publisher_platforms) ? (t.publisher_platforms as string[]) : []
  return {
    idade: `${t.age_min ?? 18}–${t.age_max === 65 || !t.age_max ? '65+' : t.age_max}`,
    generos,
    locais: locais.slice(0, 30),
    interesses: interesses.slice(0, 40),
    publicosPersonalizados: nomes(t.custom_audiences),
    excluidos: nomes(t.excluded_custom_audiences),
    posicionamentos: plataformas.length ? plataformas : null, // null = automáticos (Advantage+)
    advantage: auto.advantage_audience === 1,
  }
}

const CAMPOS_CAMPANHA = 'id,name,status,effective_status,objective,daily_budget,lifetime_budget,budget_remaining,bid_strategy,start_time,stop_time'
const CAMPOS_CONJUNTO = 'id,name,campaign_id,status,effective_status,daily_budget,lifetime_budget,optimization_goal,billing_event,bid_strategy,bid_amount,destination_type,targeting,start_time,end_time'
const CAMPOS_ANUNCIO = 'id,name,adset_id,campaign_id,status,effective_status,preview_shareable_link,creative{id,thumbnail_url,image_url,title,body,call_to_action_type,object_type,video_id}'

export async function buscarEstrutura(adAccountId: string, token: string, prazoEm: number): Promise<{ objetos: ObjetoEstrutura[]; completo: boolean }> {
  type Bruto = Record<string, unknown> & { id: string; name?: string; effective_status?: string; status?: string }
  // A fase de aprendizado nem sempre está disponível pra conta: tenta com
  // ela e, se a Meta recusar o campo, busca sem.
  const conjuntos = paginar<Bruto>(`/${adAccountId}/adsets`, { fields: `${CAMPOS_CONJUNTO},learning_stage_info`, limit: '200' }, token, prazoEm)
    .catch(e => (e instanceof ErroMetaAds && e.codigo === 100 ? paginar<Bruto>(`/${adAccountId}/adsets`, { fields: CAMPOS_CONJUNTO, limit: '200' }, token, prazoEm) : Promise.reject(e)))
  const [camp, conj, anun, rank] = await Promise.all([
    paginar<Bruto>(`/${adAccountId}/campaigns`, { fields: CAMPOS_CAMPANHA, limit: '200' }, token, prazoEm),
    conjuntos,
    paginar<Bruto>(`/${adAccountId}/ads`, { fields: CAMPOS_ANUNCIO, limit: '200' }, token, prazoEm),
    // Ranking de qualidade/engajamento/conversão dos últimos 7 dias (a Meta
    // só calcula com 500+ impressões).
    paginar<Bruto & { ad_id: string }>(`/${adAccountId}/insights`, { level: 'ad', fields: 'ad_id,quality_ranking,engagement_rate_ranking,conversion_rate_ranking', date_preset: 'last_7d', limit: '500' }, token, prazoEm)
      .catch(() => ({ itens: [] as Array<Bruto & { ad_id: string }>, completo: false })),
  ])
  const rankingDe = new Map(rank.itens.map(r => [r.ad_id, r]))
  const ranking = (v: unknown) => (typeof v === 'string' && v !== 'UNKNOWN' ? v : null)
  const objetos: ObjetoEstrutura[] = [
    ...camp.itens.map(c => ({
      tipo: 'campanha' as const, id: c.id, nome: c.name ?? c.id, status: c.effective_status ?? c.status ?? null,
      dados: {
        objetivo: c.objective ?? null, orcamentoDiario: orcamento(c.daily_budget), orcamentoTotal: orcamento(c.lifetime_budget),
        orcamentoRestante: orcamento(c.budget_remaining), lance: c.bid_strategy ?? null, inicio: c.start_time ?? null, fim: c.stop_time ?? null,
      },
    })),
    ...conj.itens.map(c => {
      const ap = c.learning_stage_info as { status?: string; conversions?: number } | undefined
      return {
        tipo: 'conjunto' as const, id: c.id, nome: c.name ?? c.id, status: c.effective_status ?? c.status ?? null,
        dados: {
          campanhaId: c.campaign_id ?? null, orcamentoDiario: orcamento(c.daily_budget), orcamentoTotal: orcamento(c.lifetime_budget),
          otimizacao: c.optimization_goal ?? null, cobranca: c.billing_event ?? null, lance: c.bid_strategy ?? null,
          destino: c.destination_type ?? null, inicio: c.start_time ?? null, fim: c.end_time ?? null,
          aprendizado: ap?.status ?? null, conversoesAprendizado: ap?.conversions ?? null,
          publico: resumoPublico(c.targeting as Record<string, unknown> | undefined),
        },
      }
    }),
    ...anun.itens.map(a => {
      const cr = (a.creative ?? {}) as Record<string, string | undefined>
      const r = rankingDe.get(a.id)
      return {
        tipo: 'anuncio' as const, id: a.id, nome: a.name ?? a.id, status: a.effective_status ?? a.status ?? null,
        dados: {
          adsetId: a.adset_id ?? null, campanhaId: a.campaign_id ?? null,
          previa: a.preview_shareable_link ?? null,
          imagem: cr.image_url ?? cr.thumbnail_url ?? null, miniatura: cr.thumbnail_url ?? cr.image_url ?? null,
          titulo: cr.title ?? null, texto: cr.body ?? null, chamada: cr.call_to_action_type ?? null,
          formato: cr.video_id ? 'video' : cr.object_type ?? null,
          rankQualidade: ranking(r?.quality_ranking), rankEngajamento: ranking(r?.engagement_rate_ranking), rankConversao: ranking(r?.conversion_rate_ranking),
        },
      }
    }),
  ]
  return { objetos, completo: camp.completo && conj.completo && anun.completo }
}

// ---------- Públicos (quebras) ----------
export const QUEBRAS_PUBLICO = {
  idadeGenero: 'age,gender',
  regiao: 'region',
  posicionamento: 'publisher_platform,platform_position',
  dispositivo: 'impression_device',
  hora: 'hourly_stats_aggregated_by_advertiser_time_zone',
} as const
export type TipoPublico = keyof typeof QUEBRAS_PUBLICO

export interface LinhaPublico {
  campanhaId: string; adsetId: string; chave: string
  gasto: number; impressoes: number; alcance: number; cliquesLink: number
  lpv: number; conversas: number; leads: number; videoViews: number; conversasProf2: number
}

// Um período inteiro (sem dividir por dia), no nível de conjunto, quebrado
// pelo tipo de público pedido.
export async function buscarPublico(adAccountId: string, token: string, tipo: TipoPublico, desde: string, ate: string, prazoEm: number): Promise<LinhaPublico[]> {
  const quebras = QUEBRAS_PUBLICO[tipo]
  const campos = ['campaign_id', 'adset_id', 'spend', 'impressions', 'inline_link_clicks', 'actions', ...(tipo === 'hora' ? [] : ['reach'])]
  const r = await paginar<Record<string, unknown>>(`/${adAccountId}/insights`, {
    level: 'adset', fields: campos.join(','), breakdowns: quebras, limit: '500',
    time_range: JSON.stringify({ since: desde, until: ate }), use_unified_attribution_setting: 'true',
  }, token, prazoEm, 20000)
  if (!r.completo) throw new ErroMetaAds('A Meta demorou demais pra responder os públicos. Tente de novo em instantes.')
  return r.itens.map(l => {
    const a = metricasDeAcoes(l)
    const chave = quebras.split(',').map(q => String(l[q] ?? 'desconhecido')).join('|')
    return {
      campanhaId: String(l.campaign_id ?? ''), adsetId: String(l.adset_id ?? ''), chave,
      gasto: num(l.spend as string), impressoes: num(l.impressions as string), alcance: num(l.reach as string), cliquesLink: num(l.inline_link_clicks as string),
      lpv: a.lpv, conversas: a.conversas, leads: a.leads, videoViews: a.videoViews, conversasProf2: a.conversasProf2,
    }
  })
}
