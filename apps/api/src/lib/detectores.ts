// PDF 03 · 4.2 Detectores da área comercial. Regras e estatística no código
// (sem IA) sobre as métricas do dicionário (PDF 02), sempre:
// - com volume mínimo de casos no período (padrão 10, configurável);
// - sem dados suspeitos e sem cliente bloqueado (Escopo.semSuspeitos);
// - comparando a janela (últimos 14 dias fechados) com o mesmo intervalo anterior;
// - no nível 1: só criam a Recomendação, nunca executam nada.
// A REC é criada por lib/recomendacoes (roteamento, contexto, memória).
import { situacaoDaMeta, textoMetaEmRisco } from './metaCoerente'
import { fmtValor } from './formato'
import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { ETAPAS, NOME_ETAPA, type Etapa } from './etapasJornada'
import { calcular, faixaDe, hojeBrt, mesCorrente, padraoDaLoja, periodoAnterior, type Escopo, type Periodo } from './metricas'
import { limitesEmMs } from './jornadaPremissas'
import { DETECTORES_ONDA4, detectarOnda4 } from './detectoresOnda4'

export type Area = 'ATENDIMENTO' | 'FUNIL' | 'ATIVIDADES' | 'CREDITO' | 'ANUNCIOS' | 'RESULTADO' | 'REATIVACAO' | 'MARKETING' | 'GESTAO' | 'PESSOAS'
export type AlvoTipo = 'PESSOA' | 'EQUIPE' | 'ETAPA' | 'CREDITO' | 'BANCO' | 'ANUNCIOS' | 'RESULTADO'
  | 'CAMPANHA' | 'ROTEIRO' | 'ANUNCIO' | 'CONTEUDO' | 'POST' | 'VENDA' | 'PAGAMENTO' | 'LANCAMENTO' | 'PILAR' | 'OCORRENCIA' | 'BOA_PRATICA' | 'DICA_EQUIPE'
export type Forca = 'COMPROVADA' | 'PADRAO' | 'HIPOTESE'

export interface DefDetector {
  chave: string; nome: string; area: Area; dispara: string; acao: string; metricas: string[]
  roteamento: string; frequencia: 'DIARIA' | 'HORARIA'
  // PDF 05: área da onda 4 (sem: área comercial do PDF 03) e volume mínimo inicial próprio.
  grupo?: 'REATIVACAO' | 'MARKETING' | 'GESTAO' | 'PESSOAS'; volumePadrao?: number
}
export const DETECTORES: DefDetector[] = [
  { chave: 'resposta_lenta', nome: 'Resposta lenta', area: 'ATENDIMENTO', dispara: 'O tempo de primeira resposta de uma pessoa ou da equipe piora contra o mesmo intervalo anterior', acao: 'Redistribuir a fila ou cobrar quem está atrasando', metricas: ['tempo_primeira_resposta'], roteamento: 'Pessoa: ela mesma (supervisor acompanha) · Equipe: supervisor (dono acompanha)', frequencia: 'DIARIA' },
  { chave: 'funil_parado', nome: 'Funil parado', area: 'FUNIL', dispara: 'A proporção de leads acima do tempo máximo da sua etapa cresce', acao: 'Mover os parados para a Reativação ou criar mutirão de follow', metricas: ['leads_parados'], roteamento: 'Supervisor (dono acompanha)', frequencia: 'DIARIA' },
  { chave: 'etapa_travando', nome: 'Etapa travando', area: 'FUNIL', dispara: 'A conversão de uma das 10 etapas cai contra o mesmo intervalo anterior', acao: 'Revisar as conversas dessa etapa e treinar o ponto fraco', metricas: ['conversao_por_etapa'], roteamento: 'Supervisor (dono acompanha)', frequencia: 'DIARIA' },
  { chave: 'atividades_acumuladas', nome: 'Atividades acumuladas', area: 'ATIVIDADES', dispara: 'Uma pessoa acumula atividades atrasadas acima do seu padrão', acao: 'Redistribuir ou repriorizar as atividades', metricas: ['atividades_atrasadas'], roteamento: 'A própria pessoa (supervisor acompanha)', frequencia: 'DIARIA' },
  { chave: 'credito_emperrado', nome: 'Crédito emperrado', area: 'CREDITO', dispara: 'Fichas sem resposta há mais tempo que o normal, ou aprovação caindo num banco', acao: 'Cobrar o banco ou mudar a ordem de envio das fichas', metricas: ['tempo_resposta_banco', 'aprovacao_credito'], roteamento: 'Fichas paradas: o SDR da oportunidade (supervisor acompanha) · Banco aprovando menos: supervisor', frequencia: 'DIARIA' },
  { chave: 'anuncio_encarecendo', nome: 'Anúncio encarecendo', area: 'ANUNCIOS', dispara: 'O custo por lead sobe enquanto o ROAS cai', acao: 'Revisar criativos e verba com o gestor de tráfego', metricas: ['custo_por_lead', 'roas'], roteamento: 'Gestor de tráfego (hoje o dono)', frequencia: 'DIARIA' },
  { chave: 'meta_em_risco', nome: 'Meta em risco', area: 'RESULTADO', dispara: 'A previsão de fechamento do mês fica abaixo da meta', acao: 'Mostrar quantas vendas por dia faltam e onde agir no funil', metricas: ['previsao_fechamento', 'conversao_por_etapa'], roteamento: 'Dono e supervisor', frequencia: 'HORARIA' },
]
DETECTORES.push(...DETECTORES_ONDA4)
export const LIMITE_PADRAO = 0.2 // 20% de variação contra o mesmo intervalo anterior

export interface ConfigDetector { chave: string; ativo: boolean; nivelAutonomia: number; volumeMinimo: number; limite: number }
export async function configDetectores(usuarioId: string): Promise<Record<string, ConfigDetector>> {
  const [linhas, p] = await Promise.all([
    prisma.detector.findMany({ where: { usuarioId } }),
    prisma.parametroLiquidez.findUnique({ where: { usuarioId }, select: { volumeMinimoDetectores: true } }),
  ])
  const volPadrao = p?.volumeMinimoDetectores ?? 10
  return Object.fromEntries(DETECTORES.map(d => {
    const l = linhas.find(x => x.chave === d.chave)
    return [d.chave, { chave: d.chave, ativo: l?.ativo ?? true, nivelAutonomia: l?.nivelAutonomia ?? 1, volumeMinimo: l?.volumeMinimo ?? d.volumePadrao ?? volPadrao, limite: l?.limite ?? LIMITE_PADRAO }]
  }))
}

// --- Achado: o que o detector encontrou (vira REC em lib/recomendacoes) ---

export interface MetricaEvidencia {
  chave: string; nome: string; valor: number | null; anterior: number | null
  periodo: Periodo; periodoAnterior: Periodo | null; amostra: number; padrao?: number | null; faixa?: string | null
  unidade: string; detalhe?: unknown
}
export interface Achado {
  detector: string; area: Area; tipo: 'PROBLEMA' | 'FUNCIONANDO'
  titulo: string; acaoSugerida: string; orientacao?: string
  alvoTipo: AlvoTipo; alvoId: string | null; alvoNome?: string | null
  evidencia: { metricas: MetricaEvidencia[]; casos: number; volumeMinimo: number; resumo: string; registros?: { tabela: string; ids: string[] } }
  forca: Forca
  impacto: { unidade: 'LEADS' | 'VENDAS' | 'FATURAMENTO'; valor: number; texto: string } | null
  contextoExtra?: string
  // PDF 05: área da onda 4 e o roteamento da tabela da área (quem recebe e quem acompanha).
  grupo?: 'REATIVACAO' | 'MARKETING' | 'GESTAO' | 'PESSOAS'
  destino?: { destinatarioId: string | null; acompanha: string[] }
}

const DIA = 86_400_000
const r1 = (n: number) => Math.round(n * 10) / 10
const r2 = (n: number) => Math.round(n * 100) / 100
const pctTxt = (n: number) => `${Math.round(n * 100)}%`

/** Janela dos detectores: os últimos 14 dias fechados (até ontem) e o mesmo intervalo anterior. */
export function janela(agora = new Date()): { atual: Periodo; anterior: Periodo; anterior2: Periodo } {
  const ontem = new Date(new Date(`${hojeBrt(agora)}T00:00:00Z`).getTime() - DIA).toISOString().slice(0, 10)
  const ini = new Date(new Date(`${ontem}T00:00:00Z`).getTime() - 13 * DIA).toISOString().slice(0, 10)
  const atual = { inicio: ini, fim: ontem }
  const anterior = periodoAnterior(atual)
  return { atual, anterior, anterior2: periodoAnterior(anterior) }
}

/**
 * Força da evidência (decisão aprovada):
 * comprovada = 30+ casos e a piora (ou melhora) aparece também no período anterior;
 * padrão observado = volume mínimo atingido e fora da faixa (crítico) ou persistente;
 * hipótese = o resto (sempre mostrada como hipótese).
 */
export function forcaDe(casos: number, volumeMinimo: number, persistente: boolean, critico: boolean): Forca {
  if (casos >= 30 && persistente) return 'COMPROVADA'
  if (casos >= volumeMinimo && (critico || persistente)) return 'PADRAO'
  return 'HIPOTESE'
}

const SEM_BLOQUEADO_SQL = (col: Prisma.Sql) => Prisma.sql`NOT EXISTS (SELECT 1 FROM pro_labore_leads lb JOIN pro_labore_clientes cb ON cb.id = lb."clienteId" WHERE lb.id = ${col} AND cb.bloqueado)`
const SEM_SUSPEITO_SQL = (col: Prisma.Sql, tabela = 'pro_labore_leads') => Prisma.sql`NOT EXISTS (SELECT 1 FROM pro_labore_confiabilidade cf WHERE cf."registroTabela" = ${tabela} AND cf."registroId" = ${col} AND cf.classificacao = 'SUSPEITO')`

async function pessoasDaEquipe(usuarioId: string) {
  return prisma.vendedor.findMany({ where: { usuarioId, ativo: true }, select: { id: true, nome: true, papel: true } })
}
const primeiroNome = (n: string) => n.split(' ')[0].charAt(0) + n.split(' ')[0].slice(1).toLowerCase()

// ----------------------------------------------------------------------------
// 1. Resposta lenta (pessoa e equipe)
async function respostaLenta(usuarioId: string, cfg: ConfigDetector, agora: Date): Promise<Achado[]> {
  const j = janela(agora)
  const out: Achado[] = []
  const ler = async (vendedorId: string | null) => {
    const e: Escopo = { usuarioId, papel: 'DONO', vendedorId, semSuspeitos: true }
    const [a, b, c] = await Promise.all([calcular('tempo_primeira_resposta', e, j.atual, agora), calcular('tempo_primeira_resposta', e, j.anterior, agora), calcular('tempo_primeira_resposta', e, j.anterior2, agora)])
    return { e, a, b, c }
  }
  const equipe = await ler(null)
  const mediaEquipe = equipe.a.valor
  const avaliar = async (alvoTipo: AlvoTipo, alvoId: string | null, nome: string | null, l: Awaited<ReturnType<typeof ler>>) => {
    const casos = l.a.amostra ?? 0
    if (casos < cfg.volumeMinimo || l.a.valor == null || l.b.valor == null || l.b.valor <= 0) return
    const piorou = l.a.valor > l.b.valor * (1 + cfg.limite), melhorou = l.a.valor < l.b.valor * (1 - cfg.limite)
    if (!piorou && !melhorou) return
    const padrao = await padraoDaLoja('tempo_primeira_resposta', l.e, agora).catch(() => null)
    const faixa = faixaDe(l.a.valor, padrao, 'MENOR')
    const persistente = l.c.valor != null && (piorou ? l.b.valor > l.c.valor : l.b.valor < l.c.valor)
    const ev: MetricaEvidencia = { chave: 'tempo_primeira_resposta', nome: 'Tempo de primeira resposta', valor: l.a.valor, anterior: l.b.valor, periodo: j.atual, periodoAnterior: j.anterior, amostra: casos, padrao, faixa, unidade: 'MIN' }
    const quem = alvoTipo === 'PESSOA' ? `de ${nome}` : 'da equipe'
    const media = alvoTipo === 'PESSOA' && mediaEquipe != null ? ` A média da equipe no mesmo período foi ${r1(mediaEquipe)} min.` : ''
    out.push({
      detector: 'resposta_lenta', area: 'ATENDIMENTO', tipo: piorou ? 'PROBLEMA' : 'FUNCIONANDO',
      titulo: piorou ? `Primeira resposta ${quem} ficou mais lenta` : `Primeira resposta ${quem} ficou mais rápida`,
      acaoSugerida: piorou ? (alvoTipo === 'PESSOA' ? 'Reservar janelas fixas para responder os novos contatos e pedir ajuda ao supervisor para redistribuir a fila se estiver cheia' : 'Redistribuir a fila de conversas ou cobrar quem está atrasando') : 'Manter o que mudou: registrar o que a pessoa ou a equipe passou a fazer',
      orientacao: alvoTipo === 'PESSOA' ? (piorou
        ? `Nos últimos 14 dias, sua primeira resposta levou ${r1(l.a.valor)} min (mediana de ${casos} conversas), contra ${r1(l.b.valor)} min no período anterior.${media} Responder rápido aumenta a chance de o cliente seguir na conversa: que tal separar janelas fixas no dia só para os novos contatos?`
        : `Boa! Sua primeira resposta caiu para ${r1(l.a.valor)} min (mediana de ${casos} conversas), contra ${r1(l.b.valor)} min antes.${media} Vale manter a rotina que trouxe isso.`) : undefined,
      alvoTipo, alvoId, alvoNome: nome,
      evidencia: { metricas: [ev], casos, volumeMinimo: cfg.volumeMinimo, resumo: `${r1(l.b.valor)} → ${r1(l.a.valor)} min (${piorou ? '+' : '−'}${pctTxt(Math.abs(l.a.valor / l.b.valor - 1))})` },
      forca: forcaDe(casos, cfg.volumeMinimo, persistente, faixa === 'CRITICO'),
      impacto: { unidade: 'LEADS', valor: casos, texto: `${casos} contatos ${piorou ? 'esperaram mais' : 'foram atendidos mais rápido'} (estimativa)` },
    })
  }
  await avaliar('EQUIPE', null, null, equipe)
  for (const p of await pessoasDaEquipe(usuarioId)) await avaliar('PESSOA', p.id, primeiroNome(p.nome), await ler(p.id))
  return out
}

// ----------------------------------------------------------------------------
// 2. Funil parado: proporção de leads abertos acima do tempo máximo, no fim da janela e no fim da anterior
async function paradosEm(usuarioId: string, limites: Record<string, number | null>, instante: Date) {
  const rs = await prisma.$queryRaw<Array<{ leadId: string; etapa: string; desde: Date }>>`
    SELECT h."leadId", h."estagioNovo" etapa, h."criadoEm" desde
    FROM pro_labore_lead_estagio_historico h JOIN pro_labore_leads l ON l.id = h."leadId"
    WHERE l."usuarioId" = ${usuarioId} AND h."criadoEm" <= ${instante} AND (h."saiuEm" IS NULL OR h."saiuEm" > ${instante})
      AND h."estagioNovo" IN (${Prisma.join(ETAPAS.filter(e => e !== 'VENDA'))})
      AND (l."perdidoEm" IS NULL OR l."perdidoEm" > ${instante}) AND (l."fechadoEm" IS NULL OR l."fechadoEm" > ${instante})
      AND ${SEM_BLOQUEADO_SQL(Prisma.sql`l.id`)} AND ${SEM_SUSPEITO_SQL(Prisma.sql`l.id`)}`
  const vistos = new Set<string>()
  const abertos = rs.filter(r => (vistos.has(r.leadId) ? false : (vistos.add(r.leadId), true)))
  const parados = abertos.filter(r => { const lim = limites[r.etapa]; return lim != null && instante.getTime() - r.desde.getTime() > lim })
  return { abertos: abertos.length, parados }
}
async function funilParado(usuarioId: string, cfg: ConfigDetector, agora: Date): Promise<Achado[]> {
  const j = janela(agora)
  const limites = await limitesEmMs(usuarioId)
  const fim = (p: Periodo) => new Date(new Date(`${p.fim}T03:00:00Z`).getTime() + DIA)
  const [a, b, c] = await Promise.all([paradosEm(usuarioId, limites, fim(j.atual)), paradosEm(usuarioId, limites, fim(j.anterior)), paradosEm(usuarioId, limites, fim(j.anterior2))])
  const pa = a.abertos ? a.parados.length / a.abertos : 0, pb = b.abertos ? b.parados.length / b.abertos : 0, pc = c.abertos ? c.parados.length / c.abertos : 0
  const casos = a.parados.length
  if (casos < cfg.volumeMinimo || pb <= 0) return []
  const piorou = pa > pb * (1 + cfg.limite), melhorou = pa < pb * (1 - cfg.limite)
  if (!piorou && !melhorou) return []
  const porEtapa = Object.fromEntries(ETAPAS.filter(e => e !== 'VENDA').map(e => [e, a.parados.filter(x => x.etapa === e).length]).filter(([, n]) => (n as number) > 0))
  const pior = Object.entries(porEtapa).sort((x, y) => (y[1] as number) - (x[1] as number))[0]
  const ev: MetricaEvidencia = { chave: 'leads_parados', nome: 'Leads parados', valor: casos, anterior: b.parados.length, periodo: j.atual, periodoAnterior: j.anterior, amostra: a.abertos, unidade: 'QTD', detalhe: { proporcao: r2(pa * 100), proporcaoAnterior: r2(pb * 100), porEtapa } }
  return [{
    detector: 'funil_parado', area: 'FUNIL', tipo: piorou ? 'PROBLEMA' : 'FUNCIONANDO',
    titulo: piorou ? `Mais leads parados no funil (${r1(pa * 100)}% dos abertos)` : `Menos leads parados no funil (${r1(pa * 100)}% dos abertos)`,
    acaoSugerida: piorou ? `Mover os parados há mais tempo para a Reativação ou fazer um mutirão de follow${pior ? `, começando por ${NOME_ETAPA[pior[0] as Etapa]} (${pior[1]})` : ''}` : 'Manter o ritmo de follow que reduziu os parados',
    alvoTipo: 'EQUIPE', alvoId: null,
    evidencia: { metricas: [ev], casos, volumeMinimo: cfg.volumeMinimo, resumo: `${r1(pb * 100)}% → ${r1(pa * 100)}% dos leads abertos acima do tempo máximo da etapa`, registros: { tabela: 'pro_labore_leads', ids: a.parados.map(x => x.leadId) } },
    forca: forcaDe(casos, cfg.volumeMinimo, piorou ? pb > pc : pb < pc, false),
    impacto: { unidade: 'LEADS', valor: casos, texto: `${casos} oportunidades paradas além do tempo da etapa (estimativa)` },
  }]
}

// ----------------------------------------------------------------------------
// 3. Etapa travando: conversão de cada etapa contra o mesmo intervalo anterior
async function etapaTravando(usuarioId: string, cfg: ConfigDetector, agora: Date): Promise<Achado[]> {
  const j = janela(agora)
  const e: Escopo = { usuarioId, papel: 'DONO', semSuspeitos: true }
  const [a, b, c] = await Promise.all([calcular('conversao_por_etapa', e, j.atual, agora), calcular('conversao_por_etapa', e, j.anterior, agora), calcular('conversao_por_etapa', e, j.anterior2, agora)])
  type L = { etapa: string; chegaram: number; seguiram: number; conversao: number | null }
  const da = a.detalhe as L[], db = b.detalhe as L[], dc = c.detalhe as L[]
  // Taxa de venda e ticket para estimar o impacto em faturamento.
  const p90 = { inicio: new Date(new Date(`${j.atual.fim}T00:00:00Z`).getTime() - 89 * DIA).toISOString().slice(0, 10), fim: j.atual.fim }
  const [leads90, vendas90, ticket] = await Promise.all([calcular('leads_novos', e, p90, agora), calcular('vendas', e, p90, agora), calcular('ticket_medio', e, p90, agora)])
  const taxaVenda = leads90.valor ? (vendas90.valor ?? 0) / leads90.valor : 0
  const out: Achado[] = []
  for (const x of da) {
    const y = db.find(k => k.etapa === x.etapa), z = dc.find(k => k.etapa === x.etapa)
    if (!y || x.conversao == null || y.conversao == null || x.chegaram < cfg.volumeMinimo || y.chegaram < cfg.volumeMinimo || y.conversao <= 0) continue
    const piorou = x.conversao < y.conversao * (1 - cfg.limite), melhorou = x.conversao > y.conversao * (1 + cfg.limite)
    if (!piorou && !melhorou) continue
    const persistente = z?.conversao != null && (piorou ? y.conversao < z.conversao : y.conversao > z.conversao)
    const perdidos = Math.max(0, Math.round(x.chegaram * (y.conversao - x.conversao) / 100))
    const nome = NOME_ETAPA[x.etapa as Etapa]
    const ev: MetricaEvidencia = { chave: 'conversao_por_etapa', nome: `Conversão da etapa ${nome}`, valor: x.conversao, anterior: y.conversao, periodo: j.atual, periodoAnterior: j.anterior, amostra: x.chegaram, unidade: 'PCT', detalhe: { etapa: x.etapa, chegaram: x.chegaram, seguiram: x.seguiram, chegaramAntes: y.chegaram, seguiramAntes: y.seguiram } }
    out.push({
      detector: 'etapa_travando', area: 'FUNIL', tipo: piorou ? 'PROBLEMA' : 'FUNCIONANDO',
      titulo: piorou ? `Etapa ${nome} travando: conversão caiu` : `Etapa ${nome} convertendo mais`,
      acaoSugerida: piorou ? `Revisar as conversas da etapa ${nome} dos últimos 14 dias e treinar o ponto fraco com a equipe` : `Registrar o que mudou na etapa ${nome} e levar para as outras etapas`,
      alvoTipo: 'ETAPA', alvoId: x.etapa, alvoNome: nome,
      evidencia: { metricas: [ev], casos: x.chegaram, volumeMinimo: cfg.volumeMinimo, resumo: `${y.conversao}% → ${x.conversao}% (${x.seguiram} de ${x.chegaram} seguiram)` },
      forca: forcaDe(x.chegaram, cfg.volumeMinimo, persistente, false),
      impacto: piorou
        ? { unidade: 'FATURAMENTO', valor: r2(perdidos * taxaVenda * (ticket.valor ?? 0)), texto: `${perdidos} leads a menos avançaram; a ${pctTxt(taxaVenda)} de venda e o ticket médio, isso é uma estimativa de faturamento em risco` }
        : { unidade: 'LEADS', valor: Math.max(0, Math.round(x.chegaram * (x.conversao - y.conversao) / 100)), texto: 'leads a mais avançaram (estimativa)' },
    })
  }
  return out
}

// ----------------------------------------------------------------------------
// 4. Atividades acumuladas: atrasadas agora contra o padrão da pessoa (mediana diária dos últimos 30 dias)
async function atividadesAcumuladas(usuarioId: string, cfg: ConfigDetector, agora: Date): Promise<Achado[]> {
  const out: Achado[] = []
  const filtroLead = Prisma.sql`(a."leadId" IS NULL OR (${SEM_BLOQUEADO_SQL(Prisma.sql`a."leadId"`)} AND ${SEM_SUSPEITO_SQL(Prisma.sql`a."leadId"`)}))`
  const pessoas = await pessoasDaEquipe(usuarioId)
  const atrasadasEm = async (pessoa: string, d: Date) => {
    const [r] = await prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT count(*) n FROM pro_labore_atividades a
      WHERE a."usuarioId" = ${usuarioId} AND a."responsavelId" = ${pessoa} AND a.prazo < ${d} AND a."criadoEm" <= ${d}
        AND (a.status = 'PENDENTE' OR (a.status = 'EXECUTADA' AND a."executadaEm" > ${d}) OR (a.status = 'CANCELADA' AND a."atualizadoEm" > ${d}))
        AND ${filtroLead}`
    return Number(r.n)
  }
  const atuais = await prisma.$queryRaw<Array<{ pessoa: string; n: bigint; ids: string[] }>>`
    SELECT a."responsavelId" pessoa, count(*) n, array_agg(a.id) ids FROM pro_labore_atividades a
    WHERE a."usuarioId" = ${usuarioId} AND a.status = 'PENDENTE' AND a.prazo < ${agora} AND a."responsavelId" IS NOT NULL AND ${filtroLead}
    GROUP BY 1`
  const media = pessoas.length ? atuais.filter(x => pessoas.some(p => p.id === x.pessoa)).reduce((s, x) => s + Number(x.n), 0) / pessoas.length : 0
  for (const p of pessoas) {
    const atual = atuais.find(x => x.pessoa === p.id)
    const n = atual ? Number(atual.n) : 0
    if (n < cfg.volumeMinimo) continue
    const dias: number[] = []
    for (let k = 1; k <= 30; k++) dias.push(await atrasadasEm(p.id, new Date(agora.getTime() - k * DIA)))
    const s = [...dias].sort((x, y) => x - y), padrao = (s[14] + s[15]) / 2
    if (n <= padrao * (1 + cfg.limite) && !(padrao === 0 && n >= cfg.volumeMinimo)) continue
    const persistente = dias.slice(0, 7).every(x => x > padrao)
    const nome = primeiroNome(p.nome)
    const ev: MetricaEvidencia = { chave: 'atividades_atrasadas', nome: 'Atividades atrasadas', valor: n, anterior: padrao, periodo: { inicio: hojeBrt(agora), fim: hojeBrt(agora) }, periodoAnterior: null, amostra: n, padrao, unidade: 'QTD', detalhe: { padraoDaPessoa: padrao, ultimos7Dias: dias.slice(0, 7).reverse() } }
    out.push({
      detector: 'atividades_acumuladas', area: 'ATIVIDADES', tipo: 'PROBLEMA',
      titulo: `Atividades acumuladas: ${nome}`,
      acaoSugerida: 'Repriorizar as atividades atrasadas (as de cliente quente primeiro) ou pedir ao supervisor para redistribuir parte delas',
      orientacao: `Você tem ${n} atividades atrasadas; o seu normal nos últimos 30 dias é ${r1(padrao)}. A média da equipe agora é ${r1(media)}. Comece pelas de clientes mais adiantados no funil e, se a fila estiver grande demais, peça ao supervisor para redistribuir parte dela.`,
      alvoTipo: 'PESSOA', alvoId: p.id, alvoNome: nome,
      evidencia: { metricas: [ev], casos: n, volumeMinimo: cfg.volumeMinimo, resumo: `${n} atrasadas agora · padrão da pessoa ${r1(padrao)}`, registros: { tabela: 'pro_labore_atividades', ids: atual?.ids ?? [] } },
      forca: forcaDe(n, cfg.volumeMinimo, persistente, n > padrao * 1.2),
      impacto: { unidade: 'LEADS', valor: n, texto: `${n} atividades esperando (estimativa)` },
    })
  }
  return out
}

// ----------------------------------------------------------------------------
// 5. Crédito emperrado: fichas paradas (por SDR) e banco aprovando menos (para o supervisor)
async function creditoEmperrado(usuarioId: string, cfg: ConfigDetector, agora: Date): Promise<Achado[]> {
  const j = janela(agora)
  const out: Achado[] = []
  const e: Escopo = { usuarioId, papel: 'DONO', semSuspeitos: true }
  const p90 = { inicio: new Date(new Date(`${j.atual.fim}T00:00:00Z`).getTime() - 89 * DIA).toISOString().slice(0, 10), fim: j.atual.fim }
  const tempos = await calcular('tempo_resposta_banco', e, p90, agora)
  const porBanco = (tempos.detalhe ?? {}) as Record<string, number | null>
  const normalGeral = tempos.valor ?? 24 * 60
  const paradas = await prisma.$queryRaw<Array<{ id: string; banco: string; enviadaEm: Date; leadId: string | null; sdr: string | null; cliente: string | null }>>`
    SELECT an.id, an.banco, an."enviadaEm", l.id "leadId", coalesce(l."responsavelQualificacaoId", l."vendedorId") sdr, l."nomeCliente" cliente
    FROM pro_labore_assistente_analises_credito an JOIN pro_labore_assistente_fichas_credito fc ON fc.id = an."fichaId" LEFT JOIN pro_labore_leads l ON l.id = fc."leadId"
    WHERE an."usuarioId" = ${usuarioId} AND an."enviadaEm" IS NOT NULL AND an."respondidoEm" IS NULL AND an.status NOT IN ('APROVADA','RECUSADA')
      AND (l.id IS NULL OR (${SEM_BLOQUEADO_SQL(Prisma.sql`l.id`)} AND ${SEM_SUSPEITO_SQL(Prisma.sql`l.id`)}))`
  // Parada = sem resposta há mais que o dobro do normal do banco (mínimo 24 h).
  const atrasadas = paradas.filter(x => agora.getTime() - x.enviadaEm.getTime() > Math.max(24 * 60, 2 * (porBanco[x.banco] ?? normalGeral)) * 60_000)
  if (atrasadas.length >= cfg.volumeMinimo) {
    const porSdr = new Map<string, typeof atrasadas>()
    for (const x of atrasadas) porSdr.set(x.sdr ?? usuarioId, [...(porSdr.get(x.sdr ?? usuarioId) ?? []), x])
    const pessoas = await pessoasDaEquipe(usuarioId)
    for (const [sdr, fichas] of porSdr) {
      const nome = pessoas.find(p => p.id === sdr)?.nome
      const bancos = [...new Set(fichas.map(f => f.banco))]
      out.push({
        detector: 'credito_emperrado', area: 'CREDITO', tipo: 'PROBLEMA',
        titulo: `${fichas.length} ficha(s) de crédito sem resposta além do normal${nome ? ` · ${primeiroNome(nome)}` : ''}`,
        acaoSugerida: `Cobrar ${bancos.join(', ')} pelas fichas paradas ou mudar a ordem de envio para um banco que responde mais rápido`,
        orientacao: `Há ${fichas.length} ficha(s) suas esperando resposta do banco há mais que o dobro do tempo normal (${bancos.join(', ')}). Vale cobrar o banco hoje e avisar o cliente de que a análise está em andamento.`,
        alvoTipo: 'CREDITO', alvoId: sdr, alvoNome: nome ? primeiroNome(nome) : null,
        evidencia: {
          metricas: [{ chave: 'tempo_resposta_banco', nome: 'Tempo de resposta por banco (normal, 90 dias)', valor: tempos.valor, anterior: null, periodo: p90, periodoAnterior: null, amostra: tempos.amostra ?? 0, unidade: 'MIN', detalhe: porBanco }],
          casos: atrasadas.length, volumeMinimo: cfg.volumeMinimo,
          resumo: `${fichas.length} desta pessoa (${atrasadas.length} no total) sem resposta: ${fichas.slice(0, 5).map(f => `${f.cliente ?? 'ficha'} · ${f.banco} há ${Math.round((agora.getTime() - f.enviadaEm.getTime()) / 3_600_000)} h`).join('; ')}`,
          registros: { tabela: 'pro_labore_leads', ids: fichas.map(f => f.leadId).filter((x): x is string => !!x) },
        },
        forca: forcaDe(atrasadas.length, cfg.volumeMinimo, false, true),
        impacto: { unidade: 'VENDAS', valor: fichas.length, texto: `${fichas.length} negociações esperando o banco (estimativa)` },
      })
    }
  }
  // Aprovação por banco: janela contra o mesmo intervalo anterior.
  const aprov = async (p: Periodo) => prisma.$queryRaw<Array<{ banco: string; n: bigint; a: bigint }>>`
    SELECT an.banco, count(*) n, count(*) FILTER (WHERE an.status = 'APROVADA') a
    FROM pro_labore_assistente_analises_credito an JOIN pro_labore_assistente_fichas_credito fc ON fc.id = an."fichaId" LEFT JOIN pro_labore_leads l ON l.id = fc."leadId"
    WHERE an."usuarioId" = ${usuarioId} AND an.status IN ('APROVADA','RECUSADA') AND an."respondidoEm" >= ${new Date(`${p.inicio}T03:00:00Z`)} AND an."respondidoEm" < ${new Date(new Date(`${p.fim}T03:00:00Z`).getTime() + DIA)}
      AND (l.id IS NULL OR (${SEM_BLOQUEADO_SQL(Prisma.sql`l.id`)} AND ${SEM_SUSPEITO_SQL(Prisma.sql`l.id`)}))
    GROUP BY 1`
  const [ba, bb] = await Promise.all([aprov(j.atual), aprov(j.anterior)])
  for (const x of ba) {
    const y = bb.find(k => k.banco === x.banco)
    const n = Number(x.n), na = y ? Number(y.n) : 0
    if (!y || n < cfg.volumeMinimo || na < cfg.volumeMinimo) continue
    const ta = Number(x.a) / n, tb = Number(y.a) / na
    if (tb <= 0) continue
    const caiu = ta < tb * (1 - cfg.limite), subiu = ta > tb * (1 + cfg.limite)
    if (!caiu && !subiu) continue
    out.push({
      detector: 'credito_emperrado', area: 'CREDITO', tipo: caiu ? 'PROBLEMA' : 'FUNCIONANDO',
      titulo: caiu ? `${x.banco} aprovando menos fichas` : `${x.banco} aprovando mais fichas`,
      acaoSugerida: caiu ? `Rever a ordem de envio das fichas: mandar primeiro para os bancos que estão aprovando mais que ${x.banco}` : `Considerar ${x.banco} mais cedo na ordem de envio`,
      alvoTipo: 'BANCO', alvoId: x.banco, alvoNome: x.banco,
      evidencia: { metricas: [{ chave: 'aprovacao_credito', nome: `Aprovação no ${x.banco}`, valor: r2(ta * 100), anterior: r2(tb * 100), periodo: j.atual, periodoAnterior: j.anterior, amostra: n, unidade: 'PCT' }], casos: n, volumeMinimo: cfg.volumeMinimo, resumo: `${pctTxt(tb)} → ${pctTxt(ta)} (${Number(x.a)} de ${n} aprovadas)` },
      forca: forcaDe(n, cfg.volumeMinimo, false, Math.abs(ta - tb) / tb > 0.3),
      impacto: { unidade: 'VENDAS', valor: Math.round(Math.abs(ta - tb) * n), texto: `${Math.round(Math.abs(ta - tb) * n)} aprovações a ${caiu ? 'menos' : 'mais'} no período (estimativa)` },
    })
  }
  return out
}

// ----------------------------------------------------------------------------
// 6. Anúncio encarecendo: custo por lead sobe enquanto o ROAS cai
async function anuncioEncarecendo(usuarioId: string, cfg: ConfigDetector, agora: Date): Promise<Achado[]> {
  const j = janela(agora)
  const e: Escopo = { usuarioId, papel: 'DONO', semSuspeitos: true }
  const [ca, cb, ra, rb, cc] = await Promise.all([
    calcular('custo_por_lead', e, j.atual, agora), calcular('custo_por_lead', e, j.anterior, agora),
    calcular('roas', e, j.atual, agora), calcular('roas', e, j.anterior, agora), calcular('custo_por_lead', e, j.anterior2, agora),
  ])
  const casos = ca.amostra ?? 0
  if (casos < cfg.volumeMinimo || ca.valor == null || cb.valor == null || ra.valor == null || rb.valor == null || cb.valor <= 0) return []
  const piorou = ca.valor > cb.valor * (1 + cfg.limite) && ra.valor < rb.valor
  const melhorou = ca.valor < cb.valor * (1 - cfg.limite) && ra.valor > rb.valor
  if (!piorou && !melhorou) return []
  const evs: MetricaEvidencia[] = [
    { chave: 'custo_por_lead', nome: 'Custo por lead', valor: ca.valor, anterior: cb.valor, periodo: j.atual, periodoAnterior: j.anterior, amostra: casos, unidade: 'BRL', detalhe: ca.detalhe },
    { chave: 'roas', nome: 'ROAS', valor: ra.valor, anterior: rb.valor, periodo: j.atual, periodoAnterior: j.anterior, amostra: casos, unidade: 'X', detalhe: ra.detalhe },
  ]
  const gasto = (ca.detalhe as { gasto?: number } | undefined)?.gasto ?? 0
  return [{
    detector: 'anuncio_encarecendo', area: 'ANUNCIOS', tipo: piorou ? 'PROBLEMA' : 'FUNCIONANDO',
    titulo: piorou ? 'Anúncios mais caros e rendendo menos' : 'Anúncios mais baratos e rendendo mais',
    acaoSugerida: piorou ? 'Revisar criativos e a distribuição da verba com o gestor de tráfego (pausar o que encareceu, reforçar o que traz lead que compra)' : 'Manter os criativos e a verba que baratearam o lead',
    alvoTipo: 'ANUNCIOS', alvoId: null,
    evidencia: { metricas: evs, casos, volumeMinimo: cfg.volumeMinimo, resumo: `custo por lead ${fmtValor(cb.valor, 'BRL')} → ${fmtValor(ca.valor, 'BRL')} · ROAS ${fmtValor(rb.valor, 'X')} → ${fmtValor(ra.valor, 'X')}` },
    forca: forcaDe(casos, cfg.volumeMinimo, cc.valor != null && (piorou ? cb.valor > cc.valor : cb.valor < cc.valor), false),
    impacto: { unidade: 'LEADS', valor: piorou ? Math.max(0, Math.round(gasto / cb.valor - casos)) : Math.max(0, Math.round(casos - gasto / cb.valor)), texto: piorou ? 'leads a menos com o mesmo gasto, se o custo voltasse ao anterior (estimativa)' : 'leads a mais com o mesmo gasto (estimativa)' },
  }]
}

// ----------------------------------------------------------------------------
// 7. Meta em risco: previsão de fechamento do mês abaixo da meta
async function metaEmRisco(usuarioId: string, cfg: ConfigDetector, agora: Date): Promise<Achado[]> {
  // PDF 06 · correção 4: a mesma situação da meta que o Hoje e o Daily mostram (mesma previsão, mesmo escopo, mesma meta).
  const e: Escopo = { usuarioId, papel: 'DONO' }
  const mes = mesCorrente(agora)
  const s = await situacaoDaMeta(usuarioId, agora)
  if (s.meta == null || s.meta <= 0) return []
  const [leads, conv] = await Promise.all([calcular('leads_novos', e, mes, agora), calcular('conversao_por_etapa', e, mes, agora)])
  const casos = leads.valor ?? 0
  // Começo do mês: com menos de 5 dias, a projeção ainda não diz nada (não dispara).
  if (casos < cfg.volumeMinimo || s.previsao == null || s.cobre || s.diasPassados < 5) return []
  type L = { etapa: string; chegaram: number; conversao: number | null }
  const pior = (conv.detalhe as L[]).filter(x => x.conversao != null && x.chegaram >= cfg.volumeMinimo).sort((x, y) => (x.conversao ?? 0) - (y.conversao ?? 0))[0]
  const piorTxt = pior ? { nome: NOME_ETAPA[pior.etapa as Etapa], conversao: pior.conversao ?? 0 } : null
  return [{
    detector: 'meta_em_risco', area: 'RESULTADO', tipo: 'PROBLEMA',
    titulo: 'Meta do mês em risco',
    acaoSugerida: textoMetaEmRisco(s, piorTxt),
    alvoTipo: 'RESULTADO', alvoId: mes.inicio.slice(0, 7),
    evidencia: {
      metricas: [{ chave: 'previsao_fechamento', nome: 'Previsão de fechamento do mês', valor: s.previsao, anterior: r2(s.meta), periodo: mes, periodoAnterior: null, amostra: casos, unidade: 'BRL', detalhe: { realizado: s.realizado, diasRestantes: s.diasRestantes, diasUteis: s.diasUteis, meta: r2(s.meta), faltamVendas: s.faltamVendas, ritmo: s.ritmo, piorEtapa: pior?.etapa ?? null } }],
      casos, volumeMinimo: cfg.volumeMinimo, resumo: `previsão ${fmtValor(s.previsao, 'BRL')} contra a meta ${fmtValor(s.meta, 'BRL')} (${s.pct ?? '—'}%)`,
      piorEtapaTexto: piorTxt,
    } as Achado['evidencia'],
    forca: s.diasRestantes <= 10 ? 'PADRAO' : 'HIPOTESE',
    impacto: { unidade: 'FATURAMENTO', valor: r2(s.meta - s.previsao), texto: 'diferença entre a meta e a previsão (estimativa)' },
    contextoExtra: mes.inicio.slice(0, 7),
  }]
}

const RODAR: Record<string, (u: string, c: ConfigDetector, a: Date) => Promise<Achado[]>> = {
  resposta_lenta: respostaLenta, funil_parado: funilParado, etapa_travando: etapaTravando, atividades_acumuladas: atividadesAcumuladas,
  credito_emperrado: creditoEmperrado, anuncio_encarecendo: anuncioEncarecendo, meta_em_risco: metaEmRisco,
}

/** Roda os detectores ativos da conta e devolve os achados (ainda sem virar REC). */
export async function detectar(usuarioId: string, agora = new Date(), quais?: string[], forcarAreas?: Array<'REATIVACAO' | 'MARKETING' | 'GESTAO' | 'PESSOAS'>): Promise<Achado[]> {
  const cfg = await configDetectores(usuarioId)
  const out: Achado[] = []
  for (const d of DETECTORES) {
    if (d.grupo) continue
    if (quais && !quais.includes(d.chave)) continue
    const c = cfg[d.chave]
    if (!c.ativo) continue
    try { out.push(...await RODAR[d.chave](usuarioId, c, agora)) } catch (e) { console.error(`[detector] ${d.chave}`, e) }
  }
  // PDF 05: os detectores das áreas da onda 4 (só as áreas ligadas pelo dono).
  out.push(...await detectarOnda4(usuarioId, cfg, agora, quais, forcarAreas))
  return out
}
