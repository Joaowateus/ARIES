// Motor de cálculo da Central de Inteligência (Assistente Comercial).
// Funções puras, determinísticas e testadas (tests/intelMotor.test.ts): a
// IA nunca calcula — recebe estes resultados prontos.
// Regras gerais (seção 9.15 do projeto):
// - divisão por zero devolve null (nunca Infinity, NaN ou 0 inventado);
// - dado ausente é null, não zero;
// - cada valor diz se é REALIZADO, META, PROJECAO ou ESTIMATIVA.

export type Natureza = 'REALIZADO' | 'META' | 'PROJECAO' | 'ESTIMATIVA'
export const ETAPAS = ['LEAD', 'ABORDADO', 'NEGOCIACAO', 'PROPOSTA', 'FECHADO'] as const
export type Etapa = (typeof ETAPAS)[number]
export const NOME_ETAPA: Record<Etapa, string> = { LEAD: 'Leads', ABORDADO: 'Abordados', NEGOCIACAO: 'Negociação', PROPOSTA: 'Proposta', FECHADO: 'Fechamento' }
/** As 4 passagens do funil (de → para). */
export const PASSAGENS = [['LEAD', 'ABORDADO'], ['ABORDADO', 'NEGOCIACAO'], ['NEGOCIACAO', 'PROPOSTA'], ['PROPOSTA', 'FECHADO']] as const
export type Passagem = (typeof PASSAGENS)[number]
export const chavePassagem = (p: readonly [Etapa, Etapa]) => `${p[0]}_${p[1]}`

export type Conversoes = [number, number, number, number] // frações 0..1 de cada passagem

const ok = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v)

/** a ÷ b, ou null quando não dá para dividir. */
export function razao(a: number | null | undefined, b: number | null | undefined): number | null {
  if (!ok(a) || !ok(b) || b === 0) return null
  const r = a / b
  return Number.isFinite(r) ? r : null
}
export const pct = (a: number | null | undefined, b: number | null | undefined) => { const r = razao(a, b); return r == null ? null : r * 100 }
export const arred = (v: number | null, casas = 2) => (v == null ? null : Math.round(v * 10 ** casas) / 10 ** casas)

// 9.1 Meta de vendas = Meta de faturamento ÷ Ticket médio (arredondada para cima: é volume mínimo).
export function metaVendas(metaFaturamento: number, ticket: number): number | null {
  const r = razao(metaFaturamento, ticket)
  return r == null ? null : Math.ceil(r - 1e-9)
}

// 9.2 Conversão da etapa = avançaram ÷ elegíveis na etapa anterior.
export const conversaoEtapa = (avancaram: number | null, elegiveis: number | null) => razao(avancaram, elegiveis)

// 9.3 Conversão total = vendas da coorte ÷ leads da mesma coorte. Com conversões
// por etapa, é o produto delas.
export function conversaoTotal(conversoes: Array<number | null>): number | null {
  if (conversoes.some(c => !ok(c))) return null
  return (conversoes as number[]).reduce((a, b) => a * b, 1)
}

// 9.4 Leads necessários = Meta de vendas ÷ Conversão total (para cima).
export function leadsNecessarios(vendas: number | null, convTotal: number | null): number | null {
  const r = razao(vendas, convTotal)
  return r == null ? null : Math.ceil(r - 1e-9)
}

// 9.5 CPL = investimento ÷ leads.
export const cpl = (investimento: number | null, leads: number | null) => razao(investimento, leads)

// 9.6 CPL máximo compatível = orçamento disponível ÷ leads necessários.
export const cplMaximo = (orcamento: number | null, leadsNec: number | null) => razao(orcamento, leadsNec)

// 9.7 Custo de marketing por venda = investimento atribuído ÷ vendas atribuídas.
export const custoPorVenda = (investimento: number | null, vendas: number | null) => razao(investimento, vendas)

// 9.8 Custo acumulado por etapa = investimento ÷ clientes que alcançaram a etapa.
export function custoAcumuladoPorEtapa(investimento: number | null, contagens: Record<Etapa, number | null>): Record<Etapa, number | null> {
  return Object.fromEntries(ETAPAS.map(e => [e, razao(investimento, contagens[e])])) as Record<Etapa, number | null>
}

// 9.9 Perda entre etapas.
export function perda(elegiveis: number | null, avancaram: number | null): { absoluta: number | null; taxa: number | null } {
  if (!ok(elegiveis) || !ok(avancaram)) return { absoluta: null, taxa: null }
  const absoluta = Math.max(0, elegiveis - avancaram)
  return { absoluta, taxa: razao(absoluta, elegiveis) }
}

// 9.10 Faturamento bruto projetado = vendas projetadas × ticket.
export const faturamentoProjetado = (vendas: number | null, ticket: number | null) => (ok(vendas) && ok(ticket) ? vendas * ticket : null)

// 9.11 Atingimento = realizado ÷ meta.
export const atingimento = (realizado: number | null, meta: number | null) => razao(realizado, meta)

// 9.13 ROAS = receita atribuída ÷ investimento atribuído (mesmo escopo).
export const roas = (receita: number | null, investimento: number | null) => razao(receita, investimento)

// 9.14 Margem de contribuição = receita líquida − custos variáveis atribuíveis.
export const margemContribuicao = (receitaLiquida: number | null, custosVariaveis: number | null) => (ok(receitaLiquida) && ok(custosVariaveis) ? receitaLiquida - custosVariaveis : null)

// ---------- Calendário ----------

/** Dias úteis de um mês (AAAA-MM), pelos dias da semana configurados. */
export function diasUteisDoMes(mes: string, diasSemana: number[]): string[] {
  const [a, m] = mes.split('-').map(Number)
  const out: string[] = []
  for (let d = 1; d <= 31; d++) {
    const dt = new Date(Date.UTC(a, m - 1, d))
    if (dt.getUTCMonth() !== m - 1) break
    if (diasSemana.includes(dt.getUTCDay())) out.push(dt.toISOString().slice(0, 10))
  }
  return out
}

/**
 * Dias úteis decorridos (até hoje, inclusive) e restantes (depois de hoje).
 * Hoje conta como decorrido: o realizado de hoje já está nos números.
 */
export function calendario(mes: string, hoje: string, diasSemana: number[]) {
  const uteis = diasUteisDoMes(mes, diasSemana)
  const decorridos = uteis.filter(d => d <= hoje).length
  return { total: uteis.length, decorridos, restantes: uteis.length - decorridos }
}

// 9.12 Ritmo necessário = o que falta ÷ dias úteis restantes.
export function ritmoNecessario(meta: number | null, realizado: number | null, diasRestantes: number): { falta: number | null; porDia: number | null } {
  if (!ok(meta) || !ok(realizado)) return { falta: null, porDia: null }
  const falta = Math.max(0, meta - realizado)
  return { falta, porDia: falta === 0 ? 0 : razao(falta, diasRestantes) }
}

// ---------- Projeção do mês ----------

export interface Projecao {
  suficiente: boolean
  motivo: string | null
  ritmoMes: number | null // vendas por dia útil no mês
  ritmoRecente: number | null // vendas por dia útil nos últimos 14 dias
  conservador: number | null
  base: number | null
  otimista: number | null
  formula: string
}

/**
 * Cenários do fechamento do mês (vendas):
 * base = realizado + restantes × ritmo do mês;
 * conservador / otimista = o menor / o maior entre o ritmo do mês e o dos
 * últimos 14 dias. Com menos de 3 dias úteis ou nenhuma venda, não projeta.
 */
export function projetarMes(realizado: number, cal: { decorridos: number; restantes: number }, recente: { vendas: number; diasUteis: number }): Projecao {
  const formula = 'base = realizado + dias úteis restantes × (vendas do mês ÷ dias úteis decorridos); conservador e otimista usam o menor e o maior ritmo entre o do mês e o dos últimos 14 dias'
  if (cal.decorridos < 3) return { suficiente: false, motivo: 'Menos de 3 dias úteis no mês: ainda cedo para projetar.', ritmoMes: null, ritmoRecente: null, conservador: null, base: null, otimista: null, formula }
  if (realizado === 0 && recente.vendas === 0) return { suficiente: false, motivo: 'Nenhuma venda no mês nem nos últimos 14 dias: sem ritmo para projetar.', ritmoMes: 0, ritmoRecente: 0, conservador: null, base: null, otimista: null, formula }
  const ritmoMes = realizado / cal.decorridos
  const ritmoRecente = razao(recente.vendas, recente.diasUteis)
  const r = [ritmoMes, ritmoRecente ?? ritmoMes]
  const proj = (ritmo: number) => arred(realizado + cal.restantes * ritmo, 1)
  return { suficiente: true, motivo: null, ritmoMes: arred(ritmoMes, 3), ritmoRecente: arred(ritmoRecente, 3), conservador: proj(Math.min(...r)), base: proj(ritmoMes), otimista: proj(Math.max(...r)), formula }
}

// ---------- Cenários de planejamento ----------

export interface Cenario {
  nome: string
  conversoes: Array<number | null>
  conversaoTotal: number | null
  leadsNecessarios: number | null
  volumes: Record<Etapa, number | null>
  vendasEsperadas: number | null
  investimento: number
  cplMaximo: number | null
  custoPorVenda: number | null
  faturamentoProjetado: number | null
}

/** Volume por etapa partindo dos leads necessários; vendas esperadas = leads × conversão total. */
export function cenario(nome: string, conversoes: Array<number | null>, metaVendasN: number | null, investimento: number, ticket: number): Cenario {
  const ct = conversaoTotal(conversoes)
  const ln = leadsNecessarios(metaVendasN, ct)
  const volumes = {} as Record<Etapa, number | null>
  let atual: number | null = ln
  ETAPAS.forEach((e, i) => {
    if (i > 0) atual = atual != null && ok(conversoes[i - 1]) ? Math.round(atual * (conversoes[i - 1] as number) * 10) / 10 : null
    volumes[e] = atual
  })
  const vendasEsperadas = ln != null && ct != null ? arred(ln * ct, 1) : null
  return {
    nome, conversoes, conversaoTotal: ct, leadsNecessarios: ln, volumes, vendasEsperadas, investimento,
    cplMaximo: cplMaximo(investimento, ln), custoPorVenda: custoPorVenda(investimento, vendasEsperadas),
    faturamentoProjetado: faturamentoProjetado(vendasEsperadas, ticket),
  }
}

// ---------- Impacto de um gargalo ----------

/**
 * Vendas a mais no período se a passagem i chegasse à meta, mantidas as
 * conversões observadas depois dela: elegíveis × (meta − atual) × Π(seguintes).
 * É estimativa (rotulada assim), não promessa.
 */
export function impactoDaPassagem(i: number, elegiveis: number | null, atuais: Array<number | null>, metas: number[]): number | null {
  const atual = atuais[i]
  if (!ok(elegiveis) || !ok(atual) || metas[i] <= atual) return ok(atual) && metas[i] <= atual ? 0 : null
  let fator = 1
  for (let k = i + 1; k < atuais.length; k++) { const c = atuais[k]; if (!ok(c)) return null; fator *= c }
  return elegiveis * (metas[i] - atual) * fator
}

// ---------- Severidade (critérios configuráveis) ----------

export interface Criterios {
  amostraMinima: number // elegíveis mínimos para tratar desvio de conversão como fato
  desvioAltoPP: number // pontos percentuais abaixo da meta para ALTO
  desvioModeradoPP: number
  atingimentoCriticoPct: number // projeção base abaixo deste % da meta de vendas = CRÍTICO
  ritmoInvestimentoAltoPct: number // gasto acima deste % do proporcional do orçamento
  cplToleranciaPct: number // CPL acima do máximo compatível + tolerância
  impactoCriticoPctMeta: number // gargalo que recupera este % da meta de vendas = CRÍTICO
}
export const CRITERIOS_PADRAO: Criterios = { amostraMinima: 30, desvioAltoPP: 10, desvioModeradoPP: 5, atingimentoCriticoPct: 80, ritmoInvestimentoAltoPct: 120, cplToleranciaPct: 10, impactoCriticoPctMeta: 20 }
export function criteriosDe(salvos: unknown): Criterios {
  const c = { ...CRITERIOS_PADRAO }
  if (salvos && typeof salvos === 'object') for (const [k, v] of Object.entries(salvos as Record<string, unknown>)) if (k in c && typeof v === 'number' && Number.isFinite(v) && v >= 0) (c as Record<string, number>)[k] = v
  return c
}

export type Severidade = 'CRITICO' | 'ALTO' | 'MODERADO' | 'MONITORAMENTO'
export const ORDEM_SEVERIDADE: Record<Severidade, number> = { CRITICO: 0, ALTO: 1, MODERADO: 2, MONITORAMENTO: 3 }

/** Desvio de conversão (em p.p.) → severidade; amostra pequena vira monitoramento. */
export function severidadeDeConversao(atualPct: number, metaPct: number, elegiveis: number, impactoVendas: number | null, metaVendasN: number | null, c: Criterios): Severidade | null {
  const desvio = metaPct - atualPct
  if (desvio <= 0) return null
  if (elegiveis < c.amostraMinima) return 'MONITORAMENTO'
  if (impactoVendas != null && metaVendasN && impactoVendas >= (metaVendasN * c.impactoCriticoPctMeta) / 100) return 'CRITICO'
  if (desvio >= c.desvioAltoPP) return 'ALTO'
  if (desvio >= c.desvioModeradoPP) return 'MODERADO'
  return 'MONITORAMENTO'
}
