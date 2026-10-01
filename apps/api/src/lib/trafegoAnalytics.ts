// Análise do tráfego pago num período: funil do anúncio até o lead
// cadastrado no CRM (mesma lógica do funil comercial — conversão da etapa
// anterior, perda, custo por etapa e metas), KPIs com comparação ao
// período anterior, evolução diária, campanhas/conjuntos/anúncios,
// simulações ("se bater a meta, quanto ganha") e diagnóstico automático.
import { prisma } from './prisma'
import { buscarAlcancePeriodo } from './metaAds'
import { hojeNoFuso, somarDias } from './trafegoSync'

// Depois do clique, o destino pode ser a página (visualização → lead do
// formulário/pixel) ou o WhatsApp (conversa iniciada) — contas com os dois
// tipos de campanha somam os dois caminhos em "chegaram ao destino" e
// "contatos", senão a divisão entre etapas mistura campanhas diferentes.
export const ETAPAS_TRAFEGO = ['impressoes', 'cliquesLink', 'destino', 'contatos', 'leadsCrm'] as const
export type EtapaTrafego = (typeof ETAPAS_TRAFEGO)[number]
export type ModoEtapa = 'auto' | 'sim' | 'nao'
export interface MetaEtapa { tipo: 'CONV_MIN' | 'CUSTO_MAX'; valor: number }
export interface ConfiguracaoTrafego {
  etapas?: Partial<Record<EtapaTrafego, ModoEtapa>>
  metas?: Partial<Record<EtapaTrafego, MetaEtapa | null>>
  // Leads no CRM: só os marcados como TRAFEGO (padrão) ou todos.
  crmSomenteTrafego?: boolean
}

// Referências de mercado usadas enquanto o dono não define as dele.
const METAS_PADRAO: Partial<Record<EtapaTrafego, MetaEtapa>> = {
  cliquesLink: { tipo: 'CONV_MIN', valor: 0.01 },
}
const META_CONNECT_RATE_PADRAO: MetaEtapa = { tipo: 'CONV_MIN', valor: 0.7 }

export interface Metricas {
  gasto: number; impressoes: number; alcance: number; cliques: number; cliquesLink: number
  lpv: number; conversas: number; leads: number
  videoViews: number; thruplays: number; videoP25: number; videoP50: number; videoP75: number; videoP100: number
  videoP95: number; videoPlays: number; videoTempoTotal: number
  cliquesSaida: number; engajamento: number; reacoes: number; comentarios: number; compartilhamentos: number; salvamentos: number
  conversasProf2: number; conversasProf3: number; conversasProf5: number; bloqueios: number
}
const CAMPOS: Array<keyof Metricas> = [
  'gasto', 'impressoes', 'alcance', 'cliques', 'cliquesLink', 'lpv', 'conversas', 'leads', 'videoViews', 'thruplays', 'videoP25', 'videoP50', 'videoP75', 'videoP100',
  'videoP95', 'videoPlays', 'videoTempoTotal', 'cliquesSaida', 'engajamento', 'reacoes', 'comentarios', 'compartilhamentos', 'salvamentos',
  'conversasProf2', 'conversasProf3', 'conversasProf5', 'bloqueios',
]
const zero = (): Metricas => Object.fromEntries(CAMPOS.map(c => [c, 0])) as unknown as Metricas
function somar(linhas: Array<Partial<Metricas>>): Metricas {
  const t = zero()
  for (const l of linhas) for (const c of CAMPOS) t[c] += Number(l[c] ?? 0)
  t.gasto = Math.round(t.gasto * 100) / 100
  return t
}

const div = (a: number, b: number) => (b > 0 ? a / b : null)
export function derivadas(m: Metricas, frequencia: number | null) {
  return {
    cpm: div(m.gasto * 1000, m.impressoes),
    ctr: div(m.cliquesLink, m.impressoes),
    ctrTodos: div(m.cliques, m.impressoes),
    cpc: div(m.gasto, m.cliquesLink),
    connectRateLpv: div(m.lpv, m.cliquesLink),
    connectRateConversa: div(m.conversas, m.cliquesLink),
    custoLpv: div(m.gasto, m.lpv),
    custoConversa: div(m.gasto, m.conversas),
    cpl: div(m.gasto, m.leads),
    // Hook: quantos pararam pra ver (3s) de quem viu o anúncio; Hold: quantos
    // assistiram até o fim (ThruPlay) de quem parou.
    hookRate: m.videoViews > 0 ? div(m.videoViews, m.impressoes) : null,
    holdRate: div(m.thruplays, m.videoViews),
    frequencia: frequencia ?? div(m.impressoes, m.alcance),
    ctrSaida: div(m.cliquesSaida, m.impressoes),
    taxaEngajamento: m.engajamento > 0 ? div(m.engajamento, m.impressoes) : null,
    tempoMedioVideo: m.videoPlays > 0 ? m.videoTempoTotal / m.videoPlays : null,
    // Conversa "engajada": a pessoa mandou 2+ mensagens (não ficou só na
    // mensagem pronta do anúncio).
    taxaConversaEngajada: m.conversas > 0 && m.conversasProf2 > 0 ? div(m.conversasProf2, m.conversas) : null,
    custoConversaEngajada: m.conversasProf2 > 0 ? div(m.gasto, m.conversasProf2) : null,
    taxaBloqueio: m.conversas > 0 ? div(m.bloqueios, m.conversas) : null,
    custoResultado: div(m.gasto, m.conversas + m.leads),
  }
}

// ---------- Leads do CRM por dia ----------
const OFFSET_BRASILIA_MS = 3 * 3_600_000
async function leadsCrmPorDia(usuarioId: string, inicio: string, fim: string, somenteTrafego: boolean): Promise<Map<string, number>> {
  const leads = await prisma.lead.findMany({
    where: {
      usuarioId,
      criadoEm: { gte: new Date(Date.parse(`${inicio}T00:00:00Z`) + OFFSET_BRASILIA_MS), lt: new Date(Date.parse(`${somarDias(fim, 1)}T00:00:00Z`) + OFFSET_BRASILIA_MS) },
      ...(somenteTrafego ? { tipoLead: 'TRAFEGO' } : {}),
    },
    select: { criadoEm: true },
  })
  const porDia = new Map<string, number>()
  for (const l of leads) {
    const dia = new Date(l.criadoEm.getTime() - OFFSET_BRASILIA_MS).toISOString().slice(0, 10)
    porDia.set(dia, (porDia.get(dia) ?? 0) + 1)
  }
  return porDia
}

// ---------- Alcance (não soma entre dias) ----------
async function alcancePeriodo(conta: { id: string; adAccountId: string; accessToken: string; fuso: string | null }, inicio: string, fim: string) {
  const chaves = { contaId: conta.id, inicio: new Date(`${inicio}T00:00:00Z`), fim: new Date(`${fim}T00:00:00Z`) }
  const guardados = await prisma.trafegoAlcance.findMany({ where: chaves })
  const hoje = hojeNoFuso(conta.fuso)
  // Período que já fechou há dias não muda mais; o que inclui hoje vale 2h.
  const validadeMs = fim < somarDias(hoje, -3) ? Infinity : 2 * 3_600_000
  const conta0 = guardados.find(g => g.chave === 'conta')
  if (conta0 && Date.now() - conta0.atualizadoEm.getTime() < validadeMs) {
    return { conta: conta0, campanhas: new Map(guardados.filter(g => g.chave !== 'conta').map(g => [g.chave, g])), exato: true }
  }
  try {
    const r = await buscarAlcancePeriodo(conta.adAccountId, conta.accessToken, inicio, fim)
    const itens = [{ chave: 'conta', ...r.conta }, ...r.campanhas.map(c => ({ chave: c.id, alcance: c.alcance, frequencia: c.frequencia }))]
    await prisma.$transaction(itens.map(i => prisma.trafegoAlcance.upsert({
      where: { contaId_inicio_fim_chave: { ...chaves, chave: i.chave } },
      create: { ...chaves, ...i },
      update: { alcance: i.alcance, frequencia: i.frequencia },
    })))
    return { conta: { alcance: r.conta.alcance, frequencia: r.conta.frequencia }, campanhas: new Map(r.campanhas.map(c => [c.id, c])), exato: true }
  } catch {
    // Sem a Meta agora: usa o que tiver guardado, mesmo antigo.
    if (conta0) return { conta: conta0, campanhas: new Map(guardados.filter(g => g.chave !== 'conta').map(g => [g.chave, g])), exato: true }
    return null
  }
}

// ---------- Funil ----------
export interface EtapaFunil {
  chave: EtapaTrafego; nome: string; detalhe: string | null; valor: number; valorAnterior: number
  convAnterior: number | null; rotuloConv: string | null; connectRate: boolean
  perda: number | null; perdaPct: number | null; conversaoTotal: number | null
  custo: number | null; rotuloCusto: string
  meta: MetaEtapa | null; metaPadrao: boolean; status: boolean | null
  modo: ModoEtapa
}

type TipoDestino = 'pagina' | 'whatsapp' | 'ambos'
function tipoDestino(m: Metricas, ant: Metricas): TipoDestino {
  const site = m.lpv + m.leads + ant.lpv + ant.leads > 0
  const wa = m.conversas + ant.conversas > 0
  return site && wa ? 'ambos' : wa ? 'whatsapp' : 'pagina'
}

function montarFunil(m: Metricas, anterior: Metricas, crm: number | null, crmAnterior: number | null, cfg: ConfiguracaoTrafego) {
  const tipo = tipoDestino(m, anterior)
  const valores: Record<EtapaTrafego, number | null> = {
    impressoes: m.impressoes, cliquesLink: m.cliquesLink, destino: m.lpv + m.conversas, contatos: m.leads + m.conversas, leadsCrm: crm,
  }
  const anteriores: Record<EtapaTrafego, number | null> = {
    impressoes: anterior.impressoes, cliquesLink: anterior.cliquesLink, destino: anterior.lpv + anterior.conversas,
    contatos: anterior.leads + anterior.conversas, leadsCrm: crmAnterior,
  }
  const nomes: Record<EtapaTrafego, string> = {
    impressoes: 'Impressões', cliquesLink: 'Cliques no link',
    destino: tipo === 'ambos' ? 'Chegaram ao destino' : tipo === 'whatsapp' ? 'Conversas no WhatsApp' : 'Visualizações da página',
    contatos: tipo === 'ambos' ? 'Contatos (Meta)' : 'Leads (Meta)',
    leadsCrm: 'Leads no CRM',
  }
  const detalhes: Record<EtapaTrafego, string | null> = {
    impressoes: null, cliquesLink: null,
    destino: tipo === 'ambos' ? `${m.lpv.toLocaleString('pt-BR')} na página + ${m.conversas.toLocaleString('pt-BR')} no WhatsApp` : null,
    contatos: tipo === 'ambos' ? `${m.conversas.toLocaleString('pt-BR')} conversas + ${m.leads.toLocaleString('pt-BR')} leads de formulário/site` : null,
    leadsCrm: null,
  }
  const custos: Record<EtapaTrafego, string> = {
    impressoes: 'CPM', cliquesLink: 'CPC',
    destino: tipo === 'ambos' ? 'Custo/chegada' : tipo === 'whatsapp' ? 'Custo/conversa' : 'Custo/visualização',
    contatos: tipo === 'ambos' ? 'Custo/contato' : 'CPL (Meta)', leadsCrm: 'Custo por lead (CRM)',
  }
  const ativas = ETAPAS_TRAFEGO.filter(k => {
    if (valores[k] == null) return false
    const modo = cfg.etapas?.[k] ?? 'auto'
    if (modo === 'nao') return false
    if (modo === 'sim' || k === 'impressoes' || k === 'cliquesLink' || k === 'leadsCrm') return true
    // Só WhatsApp: "contatos" seria igual a "conversas" — some no automático.
    if (k === 'contatos' && tipo === 'whatsapp') return false
    return (valores[k] ?? 0) > 0 || (anteriores[k] ?? 0) > 0
  })
  const topo = valores.impressoes ?? 0
  const etapas: EtapaFunil[] = ativas.map((k, i) => {
    const v = valores[k] ?? 0
    const ant = i > 0 ? valores[ativas[i - 1]] ?? 0 : null
    const convAnterior = ant == null ? null : ant > 0 ? v / ant : null
    // Connect rate: a etapa logo depois do clique (a página carregou / o
    // WhatsApp abriu de verdade).
    const connectRate = i > 0 && ativas[i - 1] === 'cliquesLink'
    const rotuloConv = i === 0 ? null
      : k === 'cliquesLink' ? 'CTR'
        : connectRate ? 'Connect rate'
          : k === 'leadsCrm' ? 'Taxa de cadastro' : k === 'contatos' ? 'Taxa de contato' : 'Conversão'
    const custo = v > 0 ? (k === 'impressoes' ? (m.gasto * 1000) / v : m.gasto / v) : null
    const metaCfg = cfg.metas?.[k]
    const metaPadrao = metaCfg === undefined ? (METAS_PADRAO[k] ?? (connectRate ? META_CONNECT_RATE_PADRAO : null)) : null
    const meta = metaCfg ?? metaPadrao ?? null
    let status: boolean | null = null
    if (meta?.tipo === 'CONV_MIN' && convAnterior != null) status = convAnterior >= meta.valor
    if (meta?.tipo === 'CUSTO_MAX' && custo != null) status = custo <= meta.valor
    return {
      chave: k, nome: nomes[k], detalhe: detalhes[k], valor: v, valorAnterior: anteriores[k] ?? 0,
      convAnterior, rotuloConv, connectRate,
      perda: ant == null ? null : Math.max(0, ant - v), perdaPct: ant == null || ant === 0 ? null : Math.max(0, 1 - v / ant),
      conversaoTotal: topo > 0 ? v / topo : null,
      custo, rotuloCusto: custos[k], meta, metaPadrao: !!metaPadrao && meta === metaPadrao, status,
      modo: cfg.etapas?.[k] ?? 'auto',
    }
  })
  return { etapas, tipo }
}

// "Se essa etapa bater a meta de conversão, com o mesmo investimento e as
// etapas seguintes convertendo igual, quantos leads a mais no fim?"
function simular(etapas: EtapaFunil[], gasto: number) {
  const fim = etapas.at(-1)
  if (!fim || fim.valor <= 0) return []
  return etapas.flatMap(e => {
    if (e.meta?.tipo !== 'CONV_MIN' || e.convAnterior == null || e.convAnterior <= 0 || e.convAnterior >= e.meta.valor) return []
    const fator = e.meta.valor / e.convAnterior
    const novoFim = Math.round(fim.valor * fator)
    return [{
      etapa: e.chave, rotulo: e.rotuloConv ?? e.nome, de: e.convAnterior, para: e.meta.valor,
      finalAtual: fim.valor, finalNovo: novoFim, etapaFinal: fim.nome,
      custoAtual: gasto / fim.valor, custoNovo: novoFim > 0 ? gasto / novoFim : null,
    }]
  }).sort((a, b) => b.finalNovo - a.finalNovo)
}

type Item = { nivel: 'critico' | 'atencao' | 'positivo' | 'info'; titulo: string; texto: string; secao?: string }
const pct = (v: number) => `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function diagnosticar(
  m: Metricas, ant: Metricas, d: ReturnType<typeof derivadas>, dAnt: ReturnType<typeof derivadas>,
  etapas: EtapaFunil[], tipo: TipoDestino, crm: number | null, custoTopoCrm: number, campanhas: Array<{ nome: string; gasto: number; custoResultado: number | null; resultado: string }>,
): Item[] {
  const itens: Item[] = []
  if (m.gasto === 0) return [{ nivel: 'info', titulo: 'Sem investimento no período', texto: 'Nenhum anúncio gastou nesse período. Escolha outro período ou confira se as campanhas estão ativas.' }]

  if (d.frequencia != null && d.frequencia >= 4.5) itens.push({ secao: 'tf-criativos', nivel: 'critico', titulo: `Frequência alta (${d.frequencia.toFixed(1)})`, texto: 'Cada pessoa viu os anúncios muitas vezes: o público saturou. Troque os criativos e/ou amplie o público — o CPM tende a subir e o CTR a cair.' })
  else if (d.frequencia != null && d.frequencia >= 3) itens.push({ secao: 'tf-criativos', nivel: 'atencao', titulo: `Frequência subindo (${d.frequencia.toFixed(1)})`, texto: 'O público já está vendo os anúncios repetidas vezes. Prepare criativos novos antes do resultado cair.' })

  if (d.ctr != null && d.ctr < 0.008) itens.push({ secao: 'tf-criativos', nivel: 'critico', titulo: `CTR baixo (${pct(d.ctr)})`, texto: 'Pouca gente clica depois de ver o anúncio. O problema está no criativo (gancho dos primeiros segundos), na oferta ou na chamada pra ação.' })
  else if (d.ctr != null && d.ctr < 0.01) itens.push({ secao: 'tf-criativos', nivel: 'atencao', titulo: `CTR abaixo de 1% (${pct(d.ctr)})`, texto: 'Teste novos ganchos e chamadas no criativo — é a alavanca mais barata do funil.' })

  const cr = etapas.find(e => e.connectRate)
  if (cr?.convAnterior != null) {
    const onde = tipo === 'pagina'
      ? 'a página demora pra abrir, está pesada no celular, ou os cliques são acidentais (posicionamentos como Audience Network)'
      : tipo === 'whatsapp'
        ? 'o WhatsApp não abre direto, a mensagem pronta afasta, ou os cliques são acidentais (posicionamentos como Audience Network)'
        : 'a página demora a abrir ou o WhatsApp não abre direto, ou há cliques acidentais (Audience Network) — compare o connect rate de cada campanha na tabela'
    if (cr.convAnterior < 0.6) itens.push({ secao: 'tf-publicos', nivel: 'critico', titulo: `Connect rate baixo (${pct(cr.convAnterior)})`, texto: `De cada 100 cliques, só ${Math.round(cr.convAnterior * 100)} chegam em "${cr.nome}". Provável causa: ${onde}. Você está pagando por cliques que não viram contato.` })
    else if (cr.convAnterior < 0.75) itens.push({ secao: 'tf-publicos', nivel: 'atencao', titulo: `Connect rate pode melhorar (${pct(cr.convAnterior)})`, texto: `Acima de 75% é o ideal. Vale conferir: ${onde}.` })
    else itens.push({ secao: 'tf-jornada', nivel: 'positivo', titulo: `Connect rate saudável (${pct(cr.convAnterior)})`, texto: 'Quem clica está chegando no destino — o gargalo, se houver, está antes (criativo) ou depois (atendimento).' })
  }

  if (d.hookRate != null && d.hookRate < 0.2) itens.push({ secao: 'tf-criativos', nivel: 'atencao', titulo: `Hook rate baixo (${pct(d.hookRate)})`, texto: 'Menos de 20% param pra ver os 3 primeiros segundos dos vídeos. Mude a abertura: movimento, rosto, texto grande, promessa logo no início.' })
  if (d.holdRate != null && d.holdRate < 0.2) itens.push({ secao: 'tf-criativos', nivel: 'atencao', titulo: `Hold rate baixo (${pct(d.holdRate)})`, texto: 'Quem para no vídeo não fica até o fim. Encurte o vídeo ou traga a oferta pra frente.' })

  if (dAnt.cpm != null && d.cpm != null && d.cpm > dAnt.cpm * 1.2) itens.push({ secao: 'tf-publicos', nivel: 'atencao', titulo: `CPM subiu ${pct(d.cpm / dAnt.cpm - 1)}`, texto: `O custo pra aparecer passou de ${brl(dAnt.cpm)} para ${brl(d.cpm)} por mil impressões. Pode ser leilão mais disputado, público pequeno ou criativo com baixa qualidade.` })

  const contatos = m.conversas + m.leads
  if (crm != null && contatos > 0) {
    const taxa = crm / contatos
    const nome = m.leads === 0 ? 'conversas' : m.conversas === 0 ? 'leads da Meta' : 'contatos da Meta'
    if (taxa < 0.5) itens.push({ secao: 'tf-jornada', nivel: 'critico', titulo: `Só ${pct(taxa)} dos ${nome} viram lead no CRM`, texto: `Foram ${contatos} ${nome} e ${crm} leads cadastrados no CRM. Ou o time não está cadastrando todos (marque o canal "Tráfego"), ou os contatos não respondem — veja o tempo de resposta do atendimento.` })
    else if (taxa > 1.2) itens.push({ secao: 'tf-jornada', nivel: 'info', titulo: `Mais leads no CRM (${crm}) do que contatos da Meta (${contatos})`, texto: 'Parte dos leads marcados como "Tráfego" pode ter vindo de outro lugar (ou de anúncio de dias anteriores). Vale conferir o canal no cadastro.' })
  }
  if (crm === 0 && (m.conversas > 0 || m.leads > 0)) itens.push({ secao: 'tf-jornada', nivel: 'atencao', titulo: 'Nenhum lead de tráfego no CRM', texto: 'A Meta registrou contatos, mas nenhum lead foi cadastrado com o canal "Tráfego" no período. Sem isso o custo real por lead fica em aberto.' })

  if (crm && crm > 0 && custoTopoCrm > 0) {
    const real = m.gasto / crm
    if (Math.abs(real / custoTopoCrm - 1) > 0.15) itens.push({ secao: 'tf-jornada', nivel: 'info', titulo: `Custo real por lead: ${brl(real)}`, texto: `No funil comercial está cadastrado ${brl(custoTopoCrm)}. Atualize lá pra que o custo de cada etapa da jornada de compra fique certo.` })
  }

  const comResultado = campanhas.filter(c => c.gasto > 0 && c.custoResultado != null).sort((a, b) => a.custoResultado! - b.custoResultado!)
  if (comResultado.length >= 2) {
    const melhor = comResultado[0], pior = comResultado.at(-1)!
    if (pior.custoResultado! > melhor.custoResultado! * 1.5) itens.push({ secao: 'tf-campanhas', nivel: 'positivo', titulo: `"${melhor.nome}" é a campanha mais eficiente`, texto: `${melhor.resultado} a ${brl(melhor.custoResultado!)}, contra ${brl(pior.custoResultado!)} em "${pior.nome}". Considere mover verba pra ela.` })
  }

  const ordem = { critico: 0, atencao: 1, info: 2, positivo: 3 }
  return itens.sort((a, b) => ordem[a.nivel] - ordem[b.nivel])
}

// ---------- Estrutura (status, orçamento, público, criativo) ----------
type Estrutura = { tipo: string; objetoId: string; nome: string; status: string | null; dados: unknown }
const ATIVO = new Set(['ACTIVE', 'IN_PROCESS', 'WITH_ISSUES', 'PENDING_REVIEW', 'PREAPPROVED', 'PENDING_BILLING_INFO'])

// Orçamento diário em uso agora: campanhas com orçamento na campanha (CBO)
// + conjuntos com orçamento próprio, contando só o que está ativo.
function orcamentoDiarioAtivo(estrutura: Estrutura[], filtro: { campanhaId?: string; adsetId?: string }): number | null {
  const camp = new Map(estrutura.filter(e => e.tipo === 'campanha').map(e => [e.objetoId, e]))
  let total = 0, achou = false
  for (const c of camp.values()) {
    const d = c.dados as { orcamentoDiario?: number | null }
    if (filtro.campanhaId && c.objetoId !== filtro.campanhaId) continue
    if (filtro.adsetId) continue
    if (ATIVO.has(c.status ?? '') && d.orcamentoDiario) { total += d.orcamentoDiario; achou = true }
  }
  for (const a of estrutura.filter(e => e.tipo === 'conjunto')) {
    const d = a.dados as { orcamentoDiario?: number | null; campanhaId?: string | null }
    if (filtro.adsetId && a.objetoId !== filtro.adsetId) continue
    if (filtro.campanhaId && d.campanhaId !== filtro.campanhaId) continue
    const c = d.campanhaId ? camp.get(d.campanhaId) : undefined
    const cboNaCampanha = !!(c?.dados as { orcamentoDiario?: number | null } | undefined)?.orcamentoDiario
    if (ATIVO.has(a.status ?? '') && d.orcamentoDiario && (!cboNaCampanha || filtro.adsetId)) { total += d.orcamentoDiario; achou = true }
  }
  return achou ? Math.round(total * 100) / 100 : null
}

// ---------- Auditoria (checklist) ----------
type StatusCheck = 'ok' | 'atencao' | 'critico' | 'sem_dado'
interface Check { chave: string; titulo: string; valor: string; referencia: string; status: StatusCheck; secao: string }
function faixa(v: number | null, bom: number, ruim: number, maiorMelhor = true): StatusCheck {
  if (v == null) return 'sem_dado'
  if (maiorMelhor) return v >= bom ? 'ok' : v >= ruim ? 'atencao' : 'critico'
  return v <= bom ? 'ok' : v <= ruim ? 'atencao' : 'critico'
}

// ---------- Análise completa ----------
type ContaAnalise = { id: string; usuarioId: string; adAccountId: string; accessToken: string; fuso: string | null; configuracao: unknown }
const NOME_DIA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

export async function analisarTrafego(conta: ContaAnalise, inicio: string, fim: string, filtro: { campanhaId?: string; adsetId?: string }) {
  const cfg = (conta.configuracao ?? {}) as ConfiguracaoTrafego
  const somenteTrafego = cfg.crmSomenteTrafego !== false
  const dias = Math.round((Date.parse(fim) - Date.parse(inicio)) / 86_400_000) + 1
  const antFim = somarDias(inicio, -1)
  const antInicio = somarDias(antFim, -(dias - 1))
  const filtroSql = { ...(filtro.campanhaId ? { campanhaId: filtro.campanhaId } : {}), ...(filtro.adsetId ? { adsetId: filtro.adsetId } : {}) }
  const d = (s: string) => new Date(`${s}T00:00:00Z`)
  const hoje = hojeNoFuso(conta.fuso)
  const inicioMes = `${hoje.slice(0, 8)}01`

  const [linhas, linhasAnt, crmDia, crmDiaAnt, param, alcance, alcanceAnt, estrutura, linhasMes, crmMes] = await Promise.all([
    prisma.trafegoInsightDiario.findMany({ where: { contaId: conta.id, data: { gte: d(inicio), lte: d(fim) }, ...filtroSql } }),
    prisma.trafegoInsightDiario.findMany({ where: { contaId: conta.id, data: { gte: d(antInicio), lte: d(antFim) }, ...filtroSql } }),
    leadsCrmPorDia(conta.usuarioId, inicio, fim, somenteTrafego),
    leadsCrmPorDia(conta.usuarioId, antInicio, antFim, somenteTrafego),
    prisma.parametroLiquidez.findUnique({ where: { usuarioId: conta.usuarioId }, select: { custoPorLeadTopo: true } }),
    alcancePeriodo(conta, inicio, fim),
    alcancePeriodo(conta, antInicio, antFim),
    prisma.trafegoEstrutura.findMany({ where: { contaId: conta.id }, select: { tipo: true, objetoId: true, nome: true, status: true, dados: true } }),
    // Ritmo do mês (independe do período escolhido): do dia 1 até hoje,
    // mais os 7 dias anteriores a hoje pra média recente.
    prisma.trafegoInsightDiario.groupBy({
      by: ['data'], where: { contaId: conta.id, data: { gte: d([inicioMes, somarDias(hoje, -7)].sort()[0]), lte: d(hoje) }, ...filtroSql },
      _sum: { gasto: true, conversas: true, leads: true },
    }),
    leadsCrmPorDia(conta.usuarioId, inicioMes, hoje, somenteTrafego),
  ])
  const estruturaDe = new Map(estrutura.map(e => [`${e.tipo}:${e.objetoId}`, e]))

  const total = somar(linhas)
  const totalAnt = somar(linhasAnt)
  // Leads do CRM não sabem de qual campanha vieram: com filtro de campanha
  // a etapa some (senão o custo por lead ficaria errado).
  const comFiltro = !!(filtroSql.campanhaId || filtroSql.adsetId)
  const crmTotal = comFiltro ? null : [...crmDia.values()].reduce((s, v) => s + v, 0)
  const crmTotalAnt = comFiltro ? null : [...crmDiaAnt.values()].reduce((s, v) => s + v, 0)

  const freq = (a: typeof alcance) => {
    if (!a) return null
    if (filtro.campanhaId && !filtro.adsetId) return a.campanhas.get(filtro.campanhaId) ?? null
    if (filtro.adsetId) return null
    return a.conta
  }
  const alcAtual = freq(alcance)
  const alcAnt = freq(alcanceAnt)
  total.alcance = alcAtual?.alcance ?? total.alcance
  totalAnt.alcance = alcAnt?.alcance ?? totalAnt.alcance
  const der = derivadas(total, alcAtual?.frequencia ?? null)
  const derAnt = derivadas(totalAnt, alcAnt?.frequencia ?? null)

  const { etapas, tipo } = montarFunil(total, totalAnt, crmTotal, crmTotalAnt, cfg)

  // Evolução diária
  const porDia = new Map<string, Metricas>()
  for (const l of linhas) {
    const k = l.data.toISOString().slice(0, 10)
    porDia.set(k, somar([porDia.get(k) ?? zero(), l]))
  }
  const diario = Array.from({ length: dias }, (_, i) => somarDias(inicio, i)).map(dia => {
    const m = porDia.get(dia) ?? zero()
    return {
      data: dia, gasto: m.gasto, impressoes: m.impressoes, cliques: m.cliques, cliquesLink: m.cliquesLink, cliquesSaida: m.cliquesSaida,
      lpv: m.lpv, conversas: m.conversas, leads: m.leads, conversasProf2: m.conversasProf2,
      videoViews: m.videoViews, thruplays: m.thruplays, engajamento: m.engajamento,
      leadsCrm: crmTotal == null ? null : crmDia.get(dia) ?? 0,
    }
  })

  // Dias da semana: soma de cada dia da semana no período (e a média por dia).
  const semana = Array.from({ length: 7 }, (_, i) => ({ dia: i, nome: NOME_DIA[i], ocorrencias: 0, gasto: 0, impressoes: 0, cliquesLink: 0, destino: 0, contatos: 0, leadsCrm: crmTotal == null ? null as number | null : 0 }))
  for (const x of diario) {
    const w = semana[new Date(`${x.data}T12:00:00Z`).getUTCDay()]
    w.ocorrencias++; w.gasto += x.gasto; w.impressoes += x.impressoes; w.cliquesLink += x.cliquesLink
    w.destino += x.lpv + x.conversas; w.contatos += x.conversas + x.leads
    if (w.leadsCrm != null) w.leadsCrm += x.leadsCrm ?? 0
  }

  // Tabelas por nível (com estrutura do Gerenciador e tendência do CTR)
  const meio = somarDias(inicio, Math.floor(dias / 2))
  function agrupar(chave: 'campanhaId' | 'adsetId' | 'adId') {
    const tipoEst = chave === 'campanhaId' ? 'campanha' : chave === 'adsetId' ? 'conjunto' : 'anuncio'
    const grupos = new Map<string, { id: string; nome: string; campanhaId: string; campanhaNome: string; adsetId: string; adsetNome: string; linhas: typeof linhas }>()
    for (const l of linhas) {
      const id = l[chave]
      const nome = chave === 'campanhaId' ? l.campanhaNome : chave === 'adsetId' ? l.adsetNome : l.adNome
      const g = grupos.get(id) ?? { id, nome, campanhaId: l.campanhaId, campanhaNome: l.campanhaNome, adsetId: l.adsetId, adsetNome: l.adsetNome, linhas: [] }
      g.linhas.push(l)
      grupos.set(id, g)
    }
    return [...grupos.values()].map(g => {
      const m = somar(g.linhas)
      const alc = chave === 'campanhaId' ? alcance?.campanhas.get(g.id) : undefined
      if (alc) m.alcance = alc.alcance
      const dv = derivadas(m, alc?.frequencia ?? null)
      // Resultado principal: conversa (WhatsApp) > lead > visualização > clique.
      const resultado = m.conversas > 0 ? 'conversas' : m.leads > 0 ? 'leads' : m.lpv > 0 ? 'lpv' : 'cliquesLink'
      const custoResultado = div(m.gasto, m[resultado])
      // Fadiga: CTR da 2ª metade do período contra a 1ª (só com volume).
      const m1 = somar(g.linhas.filter(l => l.data.toISOString().slice(0, 10) < meio))
      const m2 = somar(g.linhas.filter(l => l.data.toISOString().slice(0, 10) >= meio))
      const tendenciaCtr = m1.impressoes >= 1000 && m2.impressoes >= 1000 && m1.cliquesLink > 0 ? (m2.cliquesLink / m2.impressoes) / (m1.cliquesLink / m1.impressoes) - 1 : null
      const est = estruturaDe.get(`${tipoEst}:${g.id}`)
      return {
        id: g.id, nome: g.nome, campanhaId: g.campanhaId, campanhaNome: g.campanhaNome, adsetId: g.adsetId, adsetNome: g.adsetNome,
        objetivo: g.linhas[0]?.objetivo ?? null, metricas: m, derivadas: dv, resultado, custoResultado,
        alcanceExato: !!alc,
        diasAtivos: new Set(g.linhas.filter(l => l.gasto > 0).map(l => l.data.toISOString().slice(0, 10))).size,
        tendenciaCtr,
        status: est?.status ?? null,
        estrutura: (est?.dados ?? null) as Record<string, unknown> | null,
      }
    }).sort((a, b) => b.metricas.gasto - a.metricas.gasto)
  }
  const campanhas = agrupar('campanhaId')
  const conjuntos = agrupar('adsetId')
  const anuncios = agrupar('adId')
  const ROTULO_RESULTADO: Record<string, string> = { conversas: 'conversas', leads: 'leads', lpv: 'visualizações', cliquesLink: 'cliques' }

  // Ritmo do mês
  const gastoDia = new Map(linhasMes.map(r => [r.data.toISOString().slice(0, 10), r._sum.gasto ?? 0]))
  const contatosDia = new Map(linhasMes.map(r => [r.data.toISOString().slice(0, 10), (r._sum.conversas ?? 0) + (r._sum.leads ?? 0)]))
  const diasMes = Number(new Date(Date.UTC(Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7)), 0)).getUTCDate())
  const diaHoje = Number(hoje.slice(8, 10))
  let gastoMes = 0, contatosMes = 0
  for (let i = 1; i <= diaHoje; i++) {
    const k = `${hoje.slice(0, 8)}${String(i).padStart(2, '0')}`
    gastoMes += gastoDia.get(k) ?? 0
    contatosMes += contatosDia.get(k) ?? 0
  }
  // Média dos 7 dias fechados (sem hoje, que ainda está acontecendo).
  const ult7 = Array.from({ length: 7 }, (_, i) => gastoDia.get(somarDias(hoje, -(i + 1))) ?? 0)
  const mediaDia7 = ult7.reduce((a, b) => a + b, 0) / 7
  const leadsCrmMes = comFiltro ? null : [...crmMes.values()].reduce((a, b) => a + b, 0)
  const orcamentoAtivo = orcamentoDiarioAtivo(estrutura, filtro)
  // Projeção: o que já foi + o resto de hoje + os dias que faltam, na média recente.
  const gastoHoje = gastoDia.get(hoje) ?? 0
  const projecaoMes = gastoMes + Math.max(0, mediaDia7 - gastoHoje) + mediaDia7 * (diasMes - diaHoje)
  const ritmoMes = {
    mes: hoje.slice(0, 7), diaAtual: diaHoje, diasNoMes: diasMes,
    gasto: Math.round(gastoMes * 100) / 100, contatos: contatosMes, leadsCrm: leadsCrmMes,
    custoLeadCrm: leadsCrmMes ? gastoMes / leadsCrmMes : null,
    mediaDiaria7: Math.round(mediaDia7 * 100) / 100,
    projecao: Math.round(projecaoMes * 100) / 100,
    projecaoLeadsCrm: leadsCrmMes && gastoMes > 0 ? Math.round(leadsCrmMes * (projecaoMes / gastoMes)) : null,
    orcamentoDiarioAtivo: orcamentoAtivo,
  }

  // Diagnóstico ampliado
  const itens = diagnosticar(total, totalAnt, der, derAnt, etapas, tipo, crmTotal, param?.custoPorLeadTopo ?? 0,
    campanhas.map(c => ({ nome: c.nome, gasto: c.metricas.gasto, custoResultado: c.custoResultado, resultado: `${c.metricas[c.resultado as keyof Metricas]} ${ROTULO_RESULTADO[c.resultado]}` })))
  const extra: Item[] = []
  if (total.gasto > 0) {
    const custoMedio = der.custoResultado
    const semResultado = anuncios.filter(a => a.metricas.conversas + a.metricas.leads + a.metricas.lpv === 0 && a.metricas.gasto >= Math.max(total.gasto * 0.05, (custoMedio ?? 0) * 3))
    if (semResultado.length) {
      const soma = semResultado.reduce((s2, a) => s2 + a.metricas.gasto, 0)
      extra.push({ secao: 'tf-criativos', nivel: 'critico', titulo: `${semResultado.length} ${semResultado.length === 1 ? 'anúncio gastou' : 'anúncios gastaram'} ${brl(soma)} sem resultado`, texto: `${semResultado.slice(0, 3).map(a => `"${a.nome}"`).join(', ')}${semResultado.length > 3 ? '…' : ''} — nenhuma conversa, lead ou visualização. Pause ou troque o criativo.` })
    }
    const fadiga = anuncios.filter(a => a.tendenciaCtr != null && a.tendenciaCtr <= -0.3 && a.metricas.gasto >= total.gasto * 0.05)
    if (fadiga.length) extra.push({ secao: 'tf-criativos', nivel: 'atencao', titulo: `Fadiga de criativo em ${fadiga.length} ${fadiga.length === 1 ? 'anúncio' : 'anúncios'}`, texto: `${fadiga.slice(0, 3).map(a => `"${a.nome}" (CTR ${pct(a.tendenciaCtr!)})`).join(', ')} na 2ª metade do período. O público já viu demais: prepare uma variação.` })
    const rankRuim = anuncios.filter(a => a.metricas.gasto >= total.gasto * 0.05 && /^BELOW_AVERAGE/.test(String(a.estrutura?.rankQualidade ?? '')))
    if (rankRuim.length) extra.push({ secao: 'tf-criativos', nivel: 'atencao', titulo: `Ranking de qualidade abaixo da média em ${rankRuim.length} ${rankRuim.length === 1 ? 'anúncio' : 'anúncios'}`, texto: `${rankRuim.slice(0, 3).map(a => `"${a.nome}"`).join(', ')}. A Meta entrega menos e cobra mais caro por isso — revise criativo e promessa.` })
    const aprendizadoRuim = conjuntos.filter(c => c.estrutura?.aprendizado === 'FAIL' && c.metricas.gasto > 0 && ATIVO.has(c.status ?? ''))
    if (aprendizadoRuim.length) extra.push({ secao: 'tf-campanhas', nivel: 'atencao', titulo: `Aprendizado limitado em ${aprendizadoRuim.length} ${aprendizadoRuim.length === 1 ? 'conjunto' : 'conjuntos'}`, texto: `${aprendizadoRuim.slice(0, 3).map(c => `"${c.nome}"`).join(', ')} não juntam ~50 resultados por semana. Junte conjuntos parecidos, aumente o orçamento ou otimize pra um evento mais frequente.` })
    if (der.taxaConversaEngajada != null) {
      if (der.taxaConversaEngajada < 0.4) extra.push({ secao: 'tf-jornada', nivel: 'atencao', titulo: `Só ${pct(der.taxaConversaEngajada)} das conversas passam da 1ª mensagem`, texto: 'A maioria manda só a mensagem pronta do anúncio e para. Responda em segundos (resposta automática), revise a mensagem inicial e a promessa do anúncio.' })
      else extra.push({ secao: 'tf-jornada', nivel: 'positivo', titulo: `${pct(der.taxaConversaEngajada)} das conversas são engajadas`, texto: 'A pessoa manda 2 ou mais mensagens — sinal de interesse real, não clique por curiosidade.' })
    }
    if (der.taxaBloqueio != null && der.taxaBloqueio >= 0.03) extra.push({ secao: 'tf-jornada', nivel: 'atencao', titulo: `${pct(der.taxaBloqueio)} das conversas terminaram em bloqueio`, texto: 'Abordagem insistente ou público errado. Revise o roteiro do atendimento e quem está recebendo o anúncio.' })
    const comRes = campanhas.filter(c => c.custoResultado != null)
    const maior = campanhas[0]
    if (maior && comRes.length >= 2 && maior.metricas.gasto / total.gasto >= 0.5 && maior.custoResultado != null) {
      const outros = comRes.filter(c => c.id !== maior.id)
      const custoOutros = div(outros.reduce((s2, c) => s2 + c.metricas.gasto, 0), outros.reduce((s2, c) => s2 + c.metricas[c.resultado as keyof Metricas], 0))
      if (custoOutros && maior.custoResultado > custoOutros * 1.3) extra.push({ secao: 'tf-campanhas', nivel: 'atencao', titulo: `${pct(maior.metricas.gasto / total.gasto)} da verba numa campanha mais cara`, texto: `"${maior.nome}" leva a maior parte do investimento, mas custa ${brl(maior.custoResultado)} por resultado contra ${brl(custoOutros)} nas demais. Rebalanceie.` })
    }
    if (!comFiltro && ritmoMes.mediaDiaria7 > 0) extra.push({ secao: 'tf-dia', nivel: 'info', titulo: `No ritmo atual, o mês fecha em ${brl(ritmoMes.projecao)}`, texto: `Já foram ${brl(ritmoMes.gasto)} até o dia ${diaHoje}, com média de ${brl(ritmoMes.mediaDiaria7)}/dia nos últimos 7 dias${ritmoMes.projecaoLeadsCrm ? ` — cerca de ${ritmoMes.projecaoLeadsCrm} leads no CRM no mês` : ''}.` })
  }
  const ordem = { critico: 0, atencao: 1, info: 2, positivo: 3 }
  const diagnostico = [...itens, ...extra].sort((a, b) => ordem[a.nivel] - ordem[b.nivel])

  // Auditoria: checagens objetivas com referência de mercado (ou a meta do dono).
  const cr = etapas.find(e => e.connectRate)
  const cad = etapas.find(e => e.chave === 'leadsCrm')
  const metaCtr = etapas.find(e => e.chave === 'cliquesLink')?.meta
  const gastoSemRes = anuncios.filter(a => a.metricas.conversas + a.metricas.leads + a.metricas.lpv === 0).reduce((s2, a) => s2 + a.metricas.gasto, 0)
  const temVideo = total.videoViews > 0
  const auditoria: Check[] = [
    { chave: 'ctr', titulo: 'CTR do link', valor: der.ctr != null ? pct(der.ctr) : '—', referencia: `≥ ${pct(metaCtr?.tipo === 'CONV_MIN' ? metaCtr.valor : 0.01)}`, status: faixa(der.ctr, metaCtr?.tipo === 'CONV_MIN' ? metaCtr.valor : 0.01, 0.008), secao: 'tf-criativos' },
    { chave: 'connect', titulo: 'Connect rate', valor: cr?.convAnterior != null ? pct(cr.convAnterior) : '—', referencia: `≥ ${pct(cr?.meta?.tipo === 'CONV_MIN' ? cr.meta.valor : 0.7)}`, status: faixa(cr?.convAnterior ?? null, cr?.meta?.tipo === 'CONV_MIN' ? cr.meta.valor : 0.7, 0.6), secao: 'tf-publicos' },
    { chave: 'frequencia', titulo: 'Frequência', valor: der.frequencia != null ? der.frequencia.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '—', referencia: '< 3', status: faixa(der.frequencia, 3, 4.5, false), secao: 'tf-criativos' },
    ...(temVideo ? [
      { chave: 'hook', titulo: 'Hook rate (vídeos)', valor: der.hookRate != null ? pct(der.hookRate) : '—', referencia: '≥ 25%', status: faixa(der.hookRate, 0.25, 0.2), secao: 'tf-criativos' },
      { chave: 'hold', titulo: 'Hold rate (vídeos)', valor: der.holdRate != null ? pct(der.holdRate) : '—', referencia: '≥ 25%', status: faixa(der.holdRate, 0.25, 0.15), secao: 'tf-criativos' },
    ] : []),
    ...(total.conversas > 0 ? [{ chave: 'engajadas', titulo: 'Conversas engajadas (2+ mensagens)', valor: der.taxaConversaEngajada != null ? pct(der.taxaConversaEngajada) : '—', referencia: '≥ 50%', status: faixa(der.taxaConversaEngajada, 0.5, 0.35), secao: 'tf-jornada' }] : []),
    ...(cad ? [{ chave: 'cadastro', titulo: 'Contatos que viram lead no CRM', valor: cad.convAnterior != null ? pct(cad.convAnterior) : '—', referencia: '≥ 70%', status: faixa(cad.convAnterior, 0.7, 0.5), secao: 'tf-jornada' }] : []),
    { chave: 'semResultado', titulo: 'Investimento em anúncios sem resultado', valor: total.gasto > 0 ? pct(gastoSemRes / total.gasto) : '—', referencia: '< 5%', status: total.gasto > 0 ? faixa(gastoSemRes / total.gasto, 0.05, 0.15, false) : 'sem_dado', secao: 'tf-criativos' },
    { chave: 'cpm', titulo: 'CPM vs período anterior', valor: der.cpm != null && derAnt.cpm ? `${der.cpm >= derAnt.cpm ? '+' : '−'}${pct(Math.abs(der.cpm / derAnt.cpm - 1))}` : '—', referencia: 'até +15%', status: der.cpm != null && derAnt.cpm ? faixa(der.cpm / derAnt.cpm - 1, 0.15, 0.3, false) : 'sem_dado', secao: 'tf-publicos' },
  ]
  const avaliados = auditoria.filter(a => a.status !== 'sem_dado')
  const nota = avaliados.length ? Math.round(avaliados.reduce((s2, a) => s2 + (a.status === 'ok' ? 1 : a.status === 'atencao' ? 0.5 : 0), 0) / avaliados.length * 100) : null

  return {
    periodo: { inicio, fim, dias, anteriorInicio: antInicio, anteriorFim: antFim },
    filtro,
    totais: total, totaisAnterior: totalAnt,
    derivadas: der, derivadasAnterior: derAnt,
    alcanceExato: !!alcAtual,
    crm: { leads: crmTotal, leadsAnterior: crmTotalAnt, somenteTrafego, custoPorLeadTopo: param?.custoPorLeadTopo ?? 0, custoReal: crmTotal ? total.gasto / crmTotal : null },
    funil: etapas,
    simulacoes: simular(etapas, total.gasto),
    diario,
    semana,
    ritmoMes,
    campanhas, conjuntos, anuncios,
    tipoDestino: tipo,
    diagnostico,
    auditoria: { nota, itens: auditoria },
    temEstrutura: estrutura.length > 0,
  }
}
