// PDF 02 · 4.2 Dicionário de métricas. Cada métrica tem uma ficha única
// (nome, definição, fórmula, fonte, janela, comparação, faixas, responsável,
// quem vê, versão) e um cálculo único aqui; telas, relatórios e respostas do
// ARIES leem deste módulo.
//
// Regras gerais da ficha:
// - todo tempo é medido pela mediana;
// - cliente à vista fica fora de MQL e SQL; venda sem visita, fora das métricas de visita;
// - comparação padrão: o mesmo intervalo do período anterior (1 a 6 de
//   novembro contra 1 a 6 de outubro), com projeção de fechamento no
//   período em andamento — o mês corrente nunca é comparado com o mês
//   anterior inteiro;
// - faixas pelo padrão da loja (mediana dos últimos 90 dias, em janelas
//   semanais): bom = no padrão ou melhor; atenção = até 20% pior; crítico =
//   mais de 20% pior;
// - os dias são de Brasília (UTC−3).
import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { ETAPAS, type Etapa } from './etapasJornada'
import { conversaoPorEtapa } from './jornadaMetricas'
import { gastoPorDia } from './gastoAnuncios'
import { limitesEmMs } from './jornadaPremissas'

export type Unidade = 'QTD' | 'PCT' | 'BRL' | 'MIN' | 'DIAS' | 'X'
export type Melhor = 'MAIOR' | 'MENOR' | 'NEUTRO'
export type Papel = 'DONO' | 'SUPERVISOR' | 'SDR' | 'VENDEDOR' | 'SOCIAL_MEDIA'
export interface Ficha {
  chave: string
  lote: 1 | 2
  nome: string
  definicao: string
  formula: string
  fonte: string
  janela: string
  comparacao: string
  unidade: Unidade
  melhor: Melhor
  // Somável no tempo (contagem ou soma): projeta o fechamento e ajusta o padrão à duração do período.
  aditiva: boolean
  // Retrato de agora (não depende do período): sem comparação; faixa pelo histórico de retratos diários.
  retrato?: boolean
  responsavel: string
  quemVe: Papel[]
  // Faixas manuais aprovadas pelo dono (sem isso: pelo padrão da loja).
  faixas?: { bom: number; critico: number } | null
}

const TODOS: Papel[] = ['DONO', 'SUPERVISOR', 'SDR', 'VENDEDOR']
const GESTAO: Papel[] = ['DONO', 'SUPERVISOR']
const SO_DONO: Papel[] = ['DONO']
const COMP = 'Mesmo intervalo do período anterior, com projeção de fechamento'
const JAN = 'Dia, semana, mês ou período escolhido'
// O PDF não define o responsável de cada métrica: valores iniciais, ajustáveis pelo dono (nova versão da ficha).
const RESP_COM = 'Supervisor comercial', RESP_DONO = 'Dono', RESP_SDR = 'SDR', RESP_VEND = 'Vendedor'

const f = (chave: string, lote: 1 | 2, nome: string, definicao: string, formula: string, fonte: string, unidade: Unidade, melhor: Melhor, aditiva: boolean, responsavel: string, quemVe: Papel[], extra: Partial<Ficha> = {}): Ficha =>
  ({ chave, lote, nome, definicao, formula, fonte, janela: JAN, comparacao: COMP, unidade, melhor, aditiva, responsavel, quemVe, ...extra })

export const FICHAS_PADRAO: Ficha[] = [
  // Primeiro lote — métricas comerciais
  f('leads_novos', 1, 'Leads novos', 'Oportunidades criadas no período', 'Contagem de oportunidades com data de criação no período', 'CRM', 'QTD', 'MAIOR', true, RESP_COM, TODOS),
  f('tempo_primeira_resposta', 1, 'Tempo de primeira resposta', 'Quanto a loja demora para responder o cliente pela primeira vez', 'Mediana do tempo entre a 1ª mensagem do cliente e a 1ª resposta de uma pessoa da loja (respostas no período)', 'WhatsApp', 'MIN', 'MENOR', false, RESP_SDR, TODOS),
  f('taxa_abordagem', 1, 'Taxa de abordagem', 'Quantos leads novos foram abordados', 'Leads abordados ÷ leads novos (leads criados no período que chegaram a Abordado ou além)', 'CRM', 'PCT', 'MAIOR', false, RESP_SDR, TODOS),
  f('conversao_por_etapa', 1, 'Conversão por etapa', 'Quantos leads passam de cada etapa para a seguinte', 'Leads que chegaram à etapa seguinte ÷ leads que chegaram à etapa, contados pela data em que chegaram (10 etapas); à vista fora de MQL e SQL, venda sem visita fora de Agendamento e Visita', 'CRM', 'PCT', 'MAIOR', false, RESP_COM, TODOS),
  f('conversao_lead_venda', 1, 'Conversão lead → venda', 'Quantas vendas saem dos leads novos', 'Vendas ÷ leads novos do período', 'CRM e Vendas', 'PCT', 'MAIOR', false, RESP_COM, TODOS),
  f('vendas', 1, 'Vendas', 'Vendas confirmadas pelo dono', 'Contagem das vendas confirmadas com data no período', 'Vendas', 'QTD', 'MAIOR', true, RESP_COM, TODOS),
  f('faturamento', 1, 'Faturamento', 'Valor vendido', 'Soma do valor das vendas confirmadas no período', 'Vendas', 'BRL', 'MAIOR', true, RESP_DONO, TODOS),
  f('ticket_medio', 1, 'Ticket médio', 'Valor médio de cada venda', 'Faturamento ÷ vendas', 'Vendas', 'BRL', 'MAIOR', false, RESP_DONO, TODOS),
  f('leads_parados', 1, 'Leads parados', 'Oportunidades paradas além do tempo máximo da etapa', 'Oportunidades abertas há mais tempo que o tempo máximo da sua etapa (retrato de agora)', 'CRM e Atividades', 'QTD', 'MENOR', false, RESP_COM, TODOS, { retrato: true, janela: 'Agora' }),
  f('atividades_atrasadas', 1, 'Atividades atrasadas', 'Atividades vencidas e não feitas', 'ATVs vencidas e não executadas (retrato de agora)', 'Atividades', 'QTD', 'MENOR', false, RESP_COM, TODOS, { retrato: true, janela: 'Agora' }),
  f('aprovacao_credito', 1, 'Aprovação de crédito', 'Quantas fichas os bancos aprovam', 'Fichas aprovadas ÷ fichas com resposta dos bancos no período (ficha aprovada = ao menos um banco aprovou)', 'Crédito', 'PCT', 'MAIOR', false, RESP_COM, TODOS),
  f('custo_por_lead', 1, 'Custo por lead', 'Quanto custa cada lead de tráfego pago', 'Gasto com anúncios ÷ leads novos de tráfego pago (gasto real do Tráfego quando conectado; senão o digitado, proporcional aos dias)', 'Meta e CRM', 'BRL', 'MENOR', false, RESP_DONO, SO_DONO),
  f('roas', 1, 'ROAS', 'Retorno do gasto com anúncios', 'Faturamento ÷ gasto com anúncios', 'Vendas e Meta', 'X', 'MAIOR', false, RESP_DONO, SO_DONO),
  f('pro_labore', 1, 'Pró-labore e comissão', 'O que o dono sacou das vendas', 'Soma do sacado em cada venda, dentro dos tetos', 'Vendas', 'BRL', 'MAIOR', true, RESP_DONO, SO_DONO),
  f('previsao_fechamento', 1, 'Previsão de fechamento do mês', 'Quanto o mês deve faturar', 'Realizado até hoje + projeção: média entre o ritmo do mês (realizado ÷ dias passados × dias restantes) e o funil aberto (oportunidades de Negociação a Visita × conversão delas em venda nos últimos 90 dias × ticket médio)', 'Calculada', 'BRL', 'MAIOR', false, RESP_DONO, GESTAO, { janela: 'Mês corrente' }),
  // Segundo lote — métricas da jornada
  f('tempo_na_etapa', 2, 'Tempo na etapa', 'Quanto tempo o lead fica em cada etapa', 'Mediana do tempo entre a entrada e a saída de cada etapa (saídas no período)', 'CRM', 'DIAS', 'MENOR', false, RESP_COM, TODOS),
  f('taxa_resposta', 2, 'Taxa de resposta', 'Quantos abordados respondem', 'Abordados que responderam ÷ abordados (abordados no período; respondeu = mensagem do cliente depois da abordagem)', 'CRM e WhatsApp', 'PCT', 'MAIOR', false, RESP_SDR, TODOS),
  f('tentativas_ate_resposta', 2, 'Tentativas até a resposta', 'Quantas tentativas até o cliente responder', 'Mediana das tentativas (mensagens da loja, follows e ligações feitas) antes da primeira resposta do cliente', 'Atividades', 'QTD', 'MENOR', false, RESP_SDR, TODOS),
  f('levantamentos_completos', 2, 'Levantamentos completos', 'Quantos levantamentos terminam', 'Leads que chegaram a MQL ou à Negociação (à vista) ÷ leads que entraram no Levantamento', 'CRM', 'PCT', 'MAIOR', false, RESP_SDR, TODOS),
  f('perfil_pagamento', 2, 'Perfil de pagamento', 'Como os clientes pretendem pagar', 'Proporção de à vista e financiados, e proporção sem CNH, entre os levantamentos completos', 'CRM', 'PCT', 'NEUTRO', false, RESP_COM, TODOS),
  f('simulacao_vira_ficha', 2, 'Simulação que vira ficha', 'Quantos MQL mandam a ficha de crédito', 'Fichas enviadas ÷ leads em MQL', 'Crédito', 'PCT', 'MAIOR', false, RESP_SDR, TODOS),
  f('tempo_resposta_banco', 2, 'Tempo de resposta por banco', 'Quanto cada banco demora para responder', 'Mediana do tempo entre o envio da ficha e a resposta, por banco', 'Crédito', 'MIN', 'MENOR', false, RESP_COM, TODOS),
  f('tempo_ate_vendedor', 2, 'Tempo até o vendedor', 'Quanto o vendedor demora para falar com o lead aprovado', 'Mediana do tempo entre a aprovação (SQL) e o primeiro contato do vendedor (passagem ao vendedor)', 'Atividades', 'MIN', 'MENOR', false, RESP_VEND, TODOS),
  f('taxa_devolucao', 2, 'Taxa de devolução', 'Quantos leads o vendedor devolve ao SDR', 'Leads devolvidos pelo vendedor ÷ leads passados pelo SDR', 'CRM', 'PCT', 'MENOR', false, RESP_COM, TODOS),
  f('objecoes_frequentes', 2, 'Objeções mais frequentes', 'O que mais trava a compra', 'Contagem de cada tipo de objeção detectada nas conversas (base de conhecimento do Assistente)', 'WhatsApp', 'QTD', 'NEUTRO', false, RESP_COM, TODOS, { retrato: true, janela: 'Acumulado' }),
  f('negociacoes_com_troca', 2, 'Negociações com troca', 'Quantas negociações têm moto na troca', 'Negociações com moto de troca ÷ negociações (chegaram à Negociação no período)', 'CRM', 'PCT', 'NEUTRO', false, RESP_VEND, TODOS),
  f('propostas_enviadas', 2, 'Propostas enviadas', 'Propostas registradas', 'Propostas registradas no período', 'CRM', 'QTD', 'MAIOR', true, RESP_VEND, TODOS),
  f('valor_medio_propostas', 2, 'Valor médio das propostas', 'Valor médio de cada proposta', 'Soma do valor das propostas ÷ propostas (segue a permissão de quem vê valores)', 'CRM', 'BRL', 'NEUTRO', false, RESP_VEND, GESTAO),
  f('tempo_resposta_proposta', 2, 'Tempo de resposta à proposta', 'Quanto o cliente demora para responder a proposta', 'Mediana do tempo entre o envio da proposta e a resposta do cliente', 'WhatsApp', 'MIN', 'MENOR', false, RESP_VEND, TODOS),
  f('visitas_agendadas', 2, 'Visitas agendadas', 'Visitas marcadas', 'Visitas com data marcada no período', 'Atividades', 'QTD', 'MAIOR', true, RESP_VEND, TODOS),
  f('taxa_comparecimento', 2, 'Taxa de comparecimento', 'Quantos clientes vêm à visita', 'Visitas com check-in ÷ visitas com data já passada', 'Atividades', 'PCT', 'MAIOR', false, RESP_VEND, TODOS),
  f('faltas_remarcacoes', 2, 'Faltas e remarcações', 'Visitas que não aconteceram como marcado', 'Visitas sem check-in e visitas remarcadas no período', 'Atividades', 'QTD', 'MENOR', true, RESP_VEND, TODOS),
  f('conversao_visita', 2, 'Conversão de visita', 'Quantas visitas viram venda', 'Vendas ÷ visitas confirmadas (com check-in) no período; venda sem visita fica fora', 'CRM e Vendas', 'PCT', 'MAIOR', false, RESP_VEND, TODOS),
  f('tempo_total_jornada', 2, 'Tempo total da jornada', 'Do primeiro contato à venda', 'Mediana do tempo entre a criação do lead e a venda confirmada', 'CRM e Vendas', 'DIAS', 'MENOR', false, RESP_COM, TODOS),
  f('faturamento_por_origem', 2, 'Faturamento por origem', 'De onde vem o faturamento', 'Faturamento separado em novos clientes, recuperados pela Central (reativados) e retorno espontâneo', 'Vendas', 'BRL', 'NEUTRO', true, RESP_DONO, SO_DONO),
]
export const CHAVES = FICHAS_PADRAO.map(x => x.chave)

// --- Fichas com versão (a versão 1 é a do PDF 02; cada mudança é aprovada pelo dono) ---

export async function fichas(usuarioId: string): Promise<Array<Ficha & { versao: number; aprovadoPor: string | null; aprovadoEm: Date | null }>> {
  const versoes = await prisma.metricaVersao.findMany({ where: { usuarioId }, orderBy: { versao: 'desc' } })
  return FICHAS_PADRAO.map(p => {
    const v = versoes.find(x => x.chave === p.chave)
    return v ? { ...p, ...(v.ficha as Partial<Ficha>), chave: p.chave, versao: v.versao, aprovadoPor: v.aprovadoPor, aprovadoEm: v.aprovadoEm } : { ...p, versao: 1, aprovadoPor: 'PDF 02 (aprovado)', aprovadoEm: null }
  })
}
export async function historicoDaFicha(usuarioId: string, chave: string) {
  return prisma.metricaVersao.findMany({ where: { usuarioId, chave }, orderBy: { versao: 'desc' } })
}
/** Nova versão da ficha (só o dono; vale na hora porque o dono é quem aprova). */
export async function novaVersao(usuarioId: string, chave: string, mudanca: Partial<Pick<Ficha, 'nome' | 'definicao' | 'responsavel' | 'quemVe' | 'faixas'>>, justificativa: string, autorId: string) {
  const atual = (await fichas(usuarioId)).find(x => x.chave === chave)
  if (!atual) throw new Error('Métrica não encontrada')
  const { versao, aprovadoPor: _a, aprovadoEm: _b, ...base } = atual
  return prisma.metricaVersao.create({
    data: { usuarioId, chave, versao: versao + 1, ficha: { ...base, ...mudanca } as unknown as Prisma.InputJsonValue, justificativa, autorId, aprovadoPor: autorId, aprovadoEm: new Date() },
  })
}

// --- Períodos (dias de Brasília) ---

export interface Periodo { inicio: string; fim: string } // AAAA-MM-DD, inclusive
const DIA_MS = 86_400_000
const dataDia = (s: string) => new Date(`${s}T00:00:00.000Z`)
const iso = (d: Date) => d.toISOString().slice(0, 10)
const maisDias = (s: string, n: number) => iso(new Date(dataDia(s).getTime() + n * DIA_MS))
export const hojeBrt = (agora = new Date()) => iso(new Date(agora.getTime() - 3 * 3_600_000))
/** Instantes (UTC) do começo do primeiro dia e do fim do último dia em Brasília. */
const instantes = (p: Periodo) => ({ ini: new Date(`${p.inicio}T03:00:00.000Z`), fim: new Date(`${maisDias(p.fim, 1)}T03:00:00.000Z`) })
const diasDe = (p: Periodo) => Math.round((dataDia(p.fim).getTime() - dataDia(p.inicio).getTime()) / DIA_MS) + 1
const ultimoDiaDoMes = (a: number, m: number) => new Date(Date.UTC(a, m + 1, 0)).getUTCDate()

/** Mesmo intervalo do período anterior: começando no dia 1, o mesmo trecho do mês anterior; senão, a mesma duração logo antes. */
export function periodoAnterior(p: Periodo): Periodo {
  const i = dataDia(p.inicio), fm = dataDia(p.fim)
  if (i.getUTCDate() === 1 && diasDe(p) <= ultimoDiaDoMes(i.getUTCFullYear(), i.getUTCMonth())) {
    const a = i.getUTCMonth() === 0 ? i.getUTCFullYear() - 1 : i.getUTCFullYear(), m = (i.getUTCMonth() + 11) % 12
    const mesmoMes = fm.getUTCMonth() === i.getUTCMonth()
    const diaFim = mesmoMes ? Math.min(fm.getUTCDate(), ultimoDiaDoMes(a, m)) : ultimoDiaDoMes(a, m)
    return { inicio: iso(new Date(Date.UTC(a, m, 1))), fim: iso(new Date(Date.UTC(a, m, diaFim))) }
  }
  const n = diasDe(p)
  return { inicio: maisDias(p.inicio, -n), fim: maisDias(p.inicio, -1) }
}
export const mesCorrente = (agora = new Date()): Periodo => { const h = hojeBrt(agora); return { inicio: `${h.slice(0, 8)}01`, fim: h } }

// --- Cálculo ---

export interface Escopo { usuarioId: string; vendedorId?: string | null; papel: Papel }
export interface Valor { valor: number | null; amostra?: number; detalhe?: unknown }

const mediana = (xs: number[]) => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b), k = Math.floor(s.length / 2)
  return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2
}
const r2 = (n: number) => Math.round(n * 100) / 100
const pct = (a: number, b: number) => (b > 0 ? r2((a / b) * 100) : null)
const vend = (e: Escopo, col = Prisma.sql`l."vendedorId"`) => (e.vendedorId ? Prisma.sql` AND ${col} = ${e.vendedorId}` : Prisma.empty)
const q = <T>(s: Prisma.Sql) => prisma.$queryRaw<T[]>(s)
const num = (x: unknown) => (x == null ? 0 : Number(x))

async function gastoDoIntervalo(usuarioId: string, p: Periodo): Promise<number> {
  const conta = await prisma.trafegoConta.findUnique({ where: { usuarioId }, select: { id: true } })
  const porDia = conta ? await gastoPorDia(conta.id, dataDia(p.inicio), dataDia(p.fim)) : []
  const comDados = new Set(porDia.filter(d => d.gasto > 0).map(d => d.data.slice(0, 7)))
  let total = porDia.reduce((s, d) => s + d.gasto, 0)
  // Meses sem Tráfego: o valor digitado em Indicadores, proporcional aos dias do mês dentro do período.
  const manuais = await prisma.gastoAnuncioMensal.findMany({ where: { usuarioId, mesReferencia: { gte: dataDia(`${p.inicio.slice(0, 8)}01`), lte: dataDia(p.fim) } } })
  for (const g of manuais) {
    const mes = iso(g.mesReferencia).slice(0, 7)
    if (comDados.has(mes)) continue
    const a = g.mesReferencia.getUTCFullYear(), m = g.mesReferencia.getUTCMonth(), dm = ultimoDiaDoMes(a, m)
    const ini = p.inicio > `${mes}-01` ? p.inicio : `${mes}-01`, fim = p.fim < `${mes}-${dm}` ? p.fim : `${mes}-${String(dm).padStart(2, '0')}`
    const dias = Math.max(0, diasDe({ inicio: ini, fim }))
    total += (g.valor * dias) / dm
  }
  return r2(total)
}

const CALC: Record<string, (e: Escopo, p: Periodo, agora: Date) => Promise<Valor>> = {
  async leads_novos(e, p) {
    const { ini, fim } = instantes(p)
    const [r] = await q<{ n: bigint }>(Prisma.sql`SELECT count(*) n FROM pro_labore_leads l WHERE l."usuarioId" = ${e.usuarioId} AND l."criadoEm" >= ${ini} AND l."criadoEm" < ${fim}${vend(e)}`)
    return { valor: num(r.n) }
  },
  async tempo_primeira_resposta(e, p) {
    const { ini, fim } = instantes(p)
    const rs = await q<{ min: number }>(Prisma.sql`
      SELECT EXTRACT(EPOCH FROM (r."enviadaEm" - (SELECT min(c."enviadaEm") FROM pro_labore_assistente_mensagens c WHERE c."conversaId" = r."conversaId" AND c.remetente = 'CONTATO' AND c."enviadaEm" <= r."enviadaEm"))) / 60 AS min
      FROM pro_labore_assistente_mensagens r
      JOIN pro_labore_assistente_conversas cv ON cv.id = r."conversaId"
      JOIN pro_labore_assistente_comercial a ON a.id = cv."assistenteId"
      JOIN pro_labore_vendedores v ON v.id = a."vendedorId"
      WHERE r."primeiraRespostaHumana" AND r."enviadaEm" >= ${ini} AND r."enviadaEm" < ${fim} AND v."usuarioId" = ${e.usuarioId}${vend(e, Prisma.sql`a."vendedorId"`)}`)
    const xs = rs.map(x => Number(x.min)).filter(x => Number.isFinite(x) && x >= 0)
    const m = mediana(xs)
    return { valor: m == null ? null : r2(m), amostra: xs.length }
  },
  async taxa_abordagem(e, p) {
    const { ini, fim } = instantes(p)
    const [r] = await q<{ n: bigint; a: bigint }>(Prisma.sql`
      SELECT count(*) n, count(*) FILTER (WHERE EXISTS (SELECT 1 FROM pro_labore_lead_estagio_historico h WHERE h."leadId" = l.id AND h."estagioNovo" IN ('ABORDADO','LEVANTAMENTO','MQL','SQL','NEGOCIACAO','PROPOSTA','AGENDAMENTO','VISITA','VENDA'))
        OR l.etapa IN ('ABORDADO','LEVANTAMENTO','MQL','SQL','NEGOCIACAO','PROPOSTA','AGENDAMENTO','VISITA','VENDA')) a
      FROM pro_labore_leads l WHERE l."usuarioId" = ${e.usuarioId} AND l."criadoEm" >= ${ini} AND l."criadoEm" < ${fim}${vend(e)}`)
    return { valor: pct(num(r.a), num(r.n)), amostra: num(r.n), detalhe: { abordados: num(r.a), leads: num(r.n) } }
  },
  async conversao_por_etapa(e, p) {
    const { ini, fim } = instantes(p)
    const etapas = await conversaoPorEtapa({ usuarioId: e.usuarioId, ...(e.vendedorId ? { vendedorId: e.vendedorId } : {}) }, ini, fim)
    const chegaram = etapas.reduce((s, x) => s + x.chegaram, 0), seguiram = etapas.reduce((s, x) => s + x.seguiram, 0)
    return { valor: pct(seguiram, chegaram), amostra: chegaram, detalhe: etapas }
  },
  async conversao_lead_venda(e, p, agora) {
    const [l, v] = await Promise.all([CALC.leads_novos(e, p, agora), CALC.vendas(e, p, agora)])
    return { valor: pct(v.valor ?? 0, l.valor ?? 0), amostra: l.valor ?? 0, detalhe: { vendas: v.valor, leads: l.valor } }
  },
  async vendas(e, p) {
    const [r] = await q<{ n: bigint }>(Prisma.sql`SELECT count(*) n FROM pro_labore_vendas l WHERE l."usuarioId" = ${e.usuarioId} AND l.situacao = 'CONFIRMADA' AND l.data >= ${dataDia(p.inicio)} AND l.data < ${dataDia(maisDias(p.fim, 1))}${vend(e)}`)
    return { valor: num(r.n) }
  },
  async faturamento(e, p) {
    const [r] = await q<{ s: number | null; n: bigint }>(Prisma.sql`SELECT sum(l."valorVenda") s, count(*) n FROM pro_labore_vendas l WHERE l."usuarioId" = ${e.usuarioId} AND l.situacao = 'CONFIRMADA' AND l.data >= ${dataDia(p.inicio)} AND l.data < ${dataDia(maisDias(p.fim, 1))}${vend(e)}`)
    return { valor: r2(num(r.s)), amostra: num(r.n) }
  },
  async ticket_medio(e, p, agora) {
    const fat = await CALC.faturamento(e, p, agora)
    return { valor: fat.amostra ? r2((fat.valor ?? 0) / fat.amostra) : null, amostra: fat.amostra }
  },
  async leads_parados(e, _p, agora) {
    const limites = await limitesEmMs(e.usuarioId)
    const abertos = await prisma.lead.findMany({
      where: { usuarioId: e.usuarioId, ...(e.vendedorId ? { vendedorId: e.vendedorId } : {}), perdidoEm: null, vendaId: null, etapa: { not: null }, entrouNaEtapaEm: { not: null } },
      select: { etapa: true, entrouNaEtapaEm: true },
    })
    const parados = abertos.filter(l => { const lim = limites[l.etapa as Etapa]; return lim != null && agora.getTime() - l.entrouNaEtapaEm!.getTime() > lim })
    const porEtapa = Object.fromEntries(ETAPAS.map(x => [x, parados.filter(l => l.etapa === x).length]))
    return { valor: parados.length, amostra: abertos.length, detalhe: porEtapa }
  },
  async atividades_atrasadas(e, _p, agora) {
    const n = await prisma.atividade.count({ where: { usuarioId: e.usuarioId, status: 'PENDENTE', prazo: { lt: agora }, ...(e.vendedorId ? { responsavelId: e.vendedorId } : {}) } })
    return { valor: n }
  },
  async aprovacao_credito(e, p) {
    const { ini, fim } = instantes(p)
    const [r] = await q<{ n: bigint; a: bigint }>(Prisma.sql`
      SELECT count(*) n, count(*) FILTER (WHERE x.aprovada) a FROM (
        SELECT fc.id, bool_or(an.status = 'APROVADA') aprovada
        FROM pro_labore_assistente_fichas_credito fc
        JOIN pro_labore_assistente_analises_credito an ON an."fichaId" = fc.id AND an.status IN ('APROVADA','RECUSADA')
        LEFT JOIN pro_labore_leads l ON l.id = fc."leadId"
        WHERE fc."usuarioId" = ${e.usuarioId}${vend(e)}
        GROUP BY fc.id HAVING min(an."respondidoEm") >= ${ini} AND min(an."respondidoEm") < ${fim}
      ) x`)
    return { valor: pct(num(r.a), num(r.n)), amostra: num(r.n) }
  },
  async custo_por_lead(e, p) {
    const { ini, fim } = instantes(p)
    const [gasto, [r]] = await Promise.all([
      gastoDoIntervalo(e.usuarioId, p),
      q<{ n: bigint }>(Prisma.sql`SELECT count(*) n FROM pro_labore_leads l WHERE l."usuarioId" = ${e.usuarioId} AND l."criadoEm" >= ${ini} AND l."criadoEm" < ${fim} AND (l."origemTipo" = 'ANUNCIO' OR l."tipoLead" = 'TRAFEGO')`),
    ])
    const n = num(r.n)
    return { valor: gasto > 0 && n > 0 ? r2(gasto / n) : null, amostra: n, detalhe: { gasto, leadsTrafego: n } }
  },
  async roas(e, p, agora) {
    const [gasto, fat] = await Promise.all([gastoDoIntervalo(e.usuarioId, p), CALC.faturamento({ ...e, vendedorId: null }, p, agora)])
    return { valor: gasto > 0 ? r2((fat.valor ?? 0) / gasto) : null, detalhe: { gasto, faturamento: fat.valor } }
  },
  async pro_labore(e, p) {
    const [r] = await q<{ s: number | null; n: bigint }>(Prisma.sql`SELECT sum(l."valorProLabore") s, count(*) n FROM pro_labore_vendas l WHERE l."usuarioId" = ${e.usuarioId} AND l.situacao = 'CONFIRMADA' AND l.data >= ${dataDia(p.inicio)} AND l.data < ${dataDia(maisDias(p.fim, 1))}${vend(e)}`)
    return { valor: r2(num(r.s)), amostra: num(r.n) }
  },
  async previsao_fechamento(e, _p, agora) {
    const mes = mesCorrente(agora)
    const fat = await CALC.faturamento(e, mes, agora)
    const realizado = fat.valor ?? 0
    const passados = diasDe(mes), dm = ultimoDiaDoMes(Number(mes.inicio.slice(0, 4)), Number(mes.inicio.slice(5, 7)) - 1), restantes = dm - passados
    const ritmo = passados > 0 ? (realizado / passados) * restantes : 0
    // Funil aberto: oportunidades de Negociação a Visita × quanto cada etapa virou venda nos últimos 90 dias × ticket médio.
    const h90: Periodo = { inicio: maisDias(mes.fim, -89), fim: mes.fim }
    const { ini, fim } = instantes(h90)
    const conv = await q<{ etapa: string; chegaram: bigint; venderam: bigint }>(Prisma.sql`
      SELECT h."estagioNovo" etapa, count(DISTINCT h."leadId") chegaram, count(DISTINCT h."leadId") FILTER (WHERE l."vendaId" IS NOT NULL) venderam
      FROM pro_labore_lead_estagio_historico h JOIN pro_labore_leads l ON l.id = h."leadId"
      WHERE l."usuarioId" = ${e.usuarioId} AND h."criadoEm" >= ${ini} AND h."criadoEm" < ${fim} AND h."estagioNovo" IN ('NEGOCIACAO','PROPOSTA','AGENDAMENTO','VISITA')${vend(e)}
      GROUP BY 1`)
    const abertos = await q<{ etapa: string; n: bigint }>(Prisma.sql`SELECT l.etapa, count(*) n FROM pro_labore_leads l WHERE l."usuarioId" = ${e.usuarioId} AND l."perdidoEm" IS NULL AND l."vendaId" IS NULL AND l.etapa IN ('NEGOCIACAO','PROPOSTA','AGENDAMENTO','VISITA')${vend(e)} GROUP BY 1`)
    const ticket = await CALC.ticket_medio(e, h90, agora)
    const funil = abertos.reduce((s, a) => {
      const c = conv.find(x => x.etapa === a.etapa)
      const taxa = c && num(c.chegaram) > 0 ? num(c.venderam) / num(c.chegaram) : 0
      return s + num(a.n) * taxa * (ticket.valor ?? 0)
    }, 0)
    const projecao = restantes > 0 ? (ritmo + funil) / 2 : 0
    return { valor: r2(realizado + projecao), detalhe: { realizado, ritmo: r2(ritmo), funilAberto: r2(funil), diasRestantes: restantes } }
  },

  // --- Segundo lote ---
  async tempo_na_etapa(e, p) {
    const { ini, fim } = instantes(p)
    const rs = await q<{ etapa: string; dias: number }>(Prisma.sql`
      SELECT h."estagioNovo" etapa, EXTRACT(EPOCH FROM (h."saiuEm" - h."criadoEm")) / 86400 dias
      FROM pro_labore_lead_estagio_historico h JOIN pro_labore_leads l ON l.id = h."leadId"
      WHERE l."usuarioId" = ${e.usuarioId} AND h."saiuEm" >= ${ini} AND h."saiuEm" < ${fim} AND h."estagioNovo" = ANY(${[...ETAPAS] as string[]})${vend(e)}`)
    const porEtapa = Object.fromEntries(ETAPAS.filter(x => x !== 'VENDA').map(x => { const m = mediana(rs.filter(r => r.etapa === x).map(r => Number(r.dias))); return [x, m == null ? null : r2(m)] }))
    const m = mediana(rs.map(r => Number(r.dias)))
    return { valor: m == null ? null : r2(m), amostra: rs.length, detalhe: porEtapa }
  },
  async taxa_resposta(e, p) {
    const { ini, fim } = instantes(p)
    const [r] = await q<{ n: bigint; a: bigint }>(Prisma.sql`
      SELECT count(*) n, count(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM pro_labore_assistente_conversas cv JOIN pro_labore_assistente_mensagens m ON m."conversaId" = cv.id
        WHERE cv."leadId" = x."leadId" AND m.remetente = 'CONTATO' AND m."enviadaEm" > x.em)) a
      FROM (SELECT h."leadId", min(h."criadoEm") em FROM pro_labore_lead_estagio_historico h JOIN pro_labore_leads l ON l.id = h."leadId"
            WHERE l."usuarioId" = ${e.usuarioId} AND h."estagioNovo" = 'ABORDADO' AND h."criadoEm" >= ${ini} AND h."criadoEm" < ${fim}${vend(e)} GROUP BY 1) x`)
    return { valor: pct(num(r.a), num(r.n)), amostra: num(r.n) }
  },
  async tentativas_ate_resposta(e, p) {
    const { ini, fim } = instantes(p)
    // Primeira resposta do cliente depois de a loja ter falado primeiro; tentativas = mensagens da loja/robô antes dela.
    const rs = await q<{ t: bigint }>(Prisma.sql`
      SELECT (SELECT count(*) FROM pro_labore_assistente_mensagens s WHERE s."conversaId" = c.id AND s.remetente <> 'CONTATO' AND s."enviadaEm" < c.resp) t
      FROM (SELECT cv.id, (SELECT min(m."enviadaEm") FROM pro_labore_assistente_mensagens m WHERE m."conversaId" = cv.id AND m.remetente = 'CONTATO'
                           AND m."enviadaEm" > (SELECT min(o."enviadaEm") FROM pro_labore_assistente_mensagens o WHERE o."conversaId" = cv.id AND o.remetente <> 'CONTATO')) resp
            FROM pro_labore_assistente_conversas cv JOIN pro_labore_leads l ON l.id = cv."leadId" WHERE l."usuarioId" = ${e.usuarioId}${vend(e)}) c
      WHERE c.resp >= ${ini} AND c.resp < ${fim}`)
    const m = mediana(rs.map(r => num(r.t)))
    return { valor: m, amostra: rs.length }
  },
  async levantamentos_completos(e, p) {
    const { ini, fim } = instantes(p)
    const [r] = await q<{ n: bigint; a: bigint }>(Prisma.sql`
      SELECT count(*) n, count(*) FILTER (WHERE EXISTS (SELECT 1 FROM pro_labore_lead_estagio_historico h2 WHERE h2."leadId" = x."leadId" AND (h2."estagioNovo" = 'MQL' OR (h2."estagioNovo" = 'NEGOCIACAO' AND x.fp = 'A_VISTA')))) a
      FROM (SELECT DISTINCT h."leadId", l."formaPagamento" fp FROM pro_labore_lead_estagio_historico h JOIN pro_labore_leads l ON l.id = h."leadId"
            WHERE l."usuarioId" = ${e.usuarioId} AND h."estagioNovo" = 'LEVANTAMENTO' AND h."criadoEm" >= ${ini} AND h."criadoEm" < ${fim}${vend(e)}) x`)
    return { valor: pct(num(r.a), num(r.n)), amostra: num(r.n) }
  },
  async perfil_pagamento(e, p) {
    const { ini, fim } = instantes(p)
    const [r] = await q<{ n: bigint; av: bigint; fin: bigint; semcnh: bigint }>(Prisma.sql`
      SELECT count(*) n, count(*) FILTER (WHERE l."formaPagamento" = 'A_VISTA') av, count(*) FILTER (WHERE l."formaPagamento" = 'FINANCIADO') fin,
             count(*) FILTER (WHERE l."situacaoCnh" = 'NAO_TEM') semcnh
      FROM pro_labore_leads l WHERE l."usuarioId" = ${e.usuarioId}${vend(e)} AND l.id IN (
        SELECT h."leadId" FROM pro_labore_lead_estagio_historico h WHERE h."criadoEm" >= ${ini} AND h."criadoEm" < ${fim}
          AND (h."estagioNovo" = 'MQL' OR h."estagioNovo" = 'NEGOCIACAO'))
        AND l."levantamentoCompleto"`)
    const n = num(r.n)
    return { valor: pct(num(r.av), n), amostra: n, detalhe: { aVista: pct(num(r.av), n), financiado: pct(num(r.fin), n), semCnh: pct(num(r.semcnh), n) } }
  },
  async simulacao_vira_ficha(e, p) {
    const { ini, fim } = instantes(p)
    const [r] = await q<{ n: bigint; a: bigint }>(Prisma.sql`
      SELECT count(*) n, count(*) FILTER (WHERE EXISTS (SELECT 1 FROM pro_labore_assistente_fichas_credito fc JOIN pro_labore_assistente_analises_credito an ON an."fichaId" = fc.id WHERE fc."leadId" = x."leadId" AND an."enviadaEm" IS NOT NULL)) a
      FROM (SELECT DISTINCT h."leadId" FROM pro_labore_lead_estagio_historico h JOIN pro_labore_leads l ON l.id = h."leadId"
            WHERE l."usuarioId" = ${e.usuarioId} AND h."estagioNovo" = 'MQL' AND h."criadoEm" >= ${ini} AND h."criadoEm" < ${fim} AND coalesce(l."formaPagamento", '') <> 'A_VISTA'${vend(e)}) x`)
    return { valor: pct(num(r.a), num(r.n)), amostra: num(r.n) }
  },
  async tempo_resposta_banco(e, p) {
    const { ini, fim } = instantes(p)
    const rs = await q<{ banco: string; min: number }>(Prisma.sql`
      SELECT an.banco, EXTRACT(EPOCH FROM (an."respondidoEm" - an."enviadaEm")) / 60 min
      FROM pro_labore_assistente_analises_credito an JOIN pro_labore_assistente_fichas_credito fc ON fc.id = an."fichaId" LEFT JOIN pro_labore_leads l ON l.id = fc."leadId"
      WHERE an."usuarioId" = ${e.usuarioId} AND an."enviadaEm" IS NOT NULL AND an."respondidoEm" >= ${ini} AND an."respondidoEm" < ${fim}${vend(e)}`)
    const xs = rs.map(r => Number(r.min)).filter(x => x >= 0)
    const bancos = [...new Set(rs.map(r => r.banco))]
    const m = mediana(xs)
    return { valor: m == null ? null : r2(m), amostra: xs.length, detalhe: Object.fromEntries(bancos.map(b => { const mb = mediana(rs.filter(r => r.banco === b).map(r => Number(r.min)).filter(x => x >= 0)); return [b, mb == null ? null : r2(mb)] })) }
  },
  async tempo_ate_vendedor(e, p) {
    const { ini, fim } = instantes(p)
    const rs = await q<{ min: number }>(Prisma.sql`
      SELECT EXTRACT(EPOCH FROM (ps."passadaEm" - (SELECT min(h."criadoEm") FROM pro_labore_lead_estagio_historico h WHERE h."leadId" = ps."leadId" AND h."estagioNovo" = 'SQL'))) / 60 min
      FROM pro_labore_lead_passagens ps JOIN pro_labore_leads l ON l.id = ps."leadId"
      WHERE ps."usuarioId" = ${e.usuarioId} AND ps."passadaEm" >= ${ini} AND ps."passadaEm" < ${fim}${vend(e, Prisma.sql`ps."vendedorId"`)}`)
    const xs = rs.map(r => Number(r.min)).filter(x => Number.isFinite(x) && x >= 0)
    const m = mediana(xs)
    return { valor: m == null ? null : r2(m), amostra: xs.length }
  },
  async taxa_devolucao(e, p) {
    const { ini, fim } = instantes(p)
    const [r] = await q<{ n: bigint; d: bigint }>(Prisma.sql`SELECT count(*) n, count(*) FILTER (WHERE ps.devolvida) d FROM pro_labore_lead_passagens ps WHERE ps."usuarioId" = ${e.usuarioId} AND ps."passadaEm" >= ${ini} AND ps."passadaEm" < ${fim}${vend(e, Prisma.sql`ps."vendedorId"`)}`)
    return { valor: pct(num(r.d), num(r.n)), amostra: num(r.n) }
  },
  async objecoes_frequentes(e) {
    const rs = await prisma.assistenteConhecimento.findMany({ where: { usuarioId: e.usuarioId, tipo: 'OBJECAO', ocorrencias: { gt: 0 } }, orderBy: { ocorrencias: 'desc' }, take: 10, select: { titulo: true, ocorrencias: true } })
    return { valor: rs.reduce((s, x) => s + x.ocorrencias, 0), detalhe: rs }
  },
  async negociacoes_com_troca(e, p) {
    const { ini, fim } = instantes(p)
    const [r] = await q<{ n: bigint; t: bigint }>(Prisma.sql`
      SELECT count(*) n, count(*) FILTER (WHERE 'TEM_TROCA' = ANY(l.etiquetas) OR l."tipoNegociacao" ILIKE '%troca%') t
      FROM pro_labore_leads l WHERE l."usuarioId" = ${e.usuarioId}${vend(e)} AND l.id IN (SELECT h."leadId" FROM pro_labore_lead_estagio_historico h WHERE h."estagioNovo" = 'NEGOCIACAO' AND h."criadoEm" >= ${ini} AND h."criadoEm" < ${fim})`)
    return { valor: pct(num(r.t), num(r.n)), amostra: num(r.n) }
  },
  async propostas_enviadas(e, p) {
    const { ini, fim } = instantes(p)
    const [r] = await q<{ n: bigint; s: number | null }>(Prisma.sql`SELECT count(*) n, sum(pr.preco) s FROM pro_labore_lead_propostas pr JOIN pro_labore_leads l ON l.id = pr."leadId" WHERE pr."usuarioId" = ${e.usuarioId} AND pr."criadoEm" >= ${ini} AND pr."criadoEm" < ${fim}${vend(e)}`)
    return { valor: num(r.n), detalhe: { soma: num(r.s) } }
  },
  async valor_medio_propostas(e, p, agora) {
    const r = await CALC.propostas_enviadas(e, p, agora)
    const soma = (r.detalhe as { soma: number }).soma
    return { valor: r.valor ? r2(soma / r.valor) : null, amostra: r.valor ?? 0 }
  },
  async tempo_resposta_proposta(e, p) {
    const { ini, fim } = instantes(p)
    const rs = await q<{ min: number }>(Prisma.sql`SELECT EXTRACT(EPOCH FROM (pr."respondidaEm" - pr."enviadaEm")) / 60 min FROM pro_labore_lead_propostas pr JOIN pro_labore_leads l ON l.id = pr."leadId" WHERE pr."usuarioId" = ${e.usuarioId} AND pr."enviadaEm" IS NOT NULL AND pr."respondidaEm" >= ${ini} AND pr."respondidaEm" < ${fim}${vend(e)}`)
    const m = mediana(rs.map(r => Number(r.min)).filter(x => x >= 0))
    return { valor: m == null ? null : r2(m), amostra: rs.length }
  },
  async visitas_agendadas(e, p) {
    const { ini, fim } = instantes(p)
    const n = await prisma.leadVisita.count({ where: { usuarioId: e.usuarioId, marcadaPara: { gte: ini, lt: fim }, ...(e.vendedorId ? { vendedorId: e.vendedorId } : {}), lead: { vendaSemVisita: false } } })
    return { valor: n }
  },
  async taxa_comparecimento(e, p, agora) {
    const { ini, fim } = instantes(p)
    const ate = fim < agora ? fim : agora
    const base = { usuarioId: e.usuarioId, marcadaPara: { gte: ini, lt: ate }, ...(e.vendedorId ? { vendedorId: e.vendedorId } : {}), lead: { vendaSemVisita: false } }
    const [n, c] = await Promise.all([prisma.leadVisita.count({ where: base }), prisma.leadVisita.count({ where: { ...base, checkinEm: { not: null } } })])
    return { valor: pct(c, n), amostra: n }
  },
  async faltas_remarcacoes(e, p, agora) {
    const { ini, fim } = instantes(p)
    const ate = fim < agora ? fim : agora
    const w = { usuarioId: e.usuarioId, ...(e.vendedorId ? { vendedorId: e.vendedorId } : {}) }
    const [faltas, remarcadas] = await Promise.all([
      prisma.leadVisita.count({ where: { ...w, marcadaPara: { gte: ini, lt: ate }, checkinEm: null } }),
      prisma.leadVisita.count({ where: { ...w, remarcacoes: { gt: 0 }, atualizadoEm: { gte: ini, lt: fim } } }),
    ])
    return { valor: faltas + remarcadas, detalhe: { faltas, remarcadas } }
  },
  async conversao_visita(e, p) {
    const { ini, fim } = instantes(p)
    const [r] = await q<{ n: bigint; v: bigint }>(Prisma.sql`
      SELECT count(*) n, count(*) FILTER (WHERE l."vendaId" IS NOT NULL) v FROM pro_labore_lead_visitas vi JOIN pro_labore_leads l ON l.id = vi."leadId"
      WHERE vi."usuarioId" = ${e.usuarioId} AND vi."checkinEm" >= ${ini} AND vi."checkinEm" < ${fim} AND NOT l."vendaSemVisita"${vend(e)}`)
    return { valor: pct(num(r.v), num(r.n)), amostra: num(r.n) }
  },
  async tempo_total_jornada(e, p) {
    const rs = await q<{ dias: number }>(Prisma.sql`
      SELECT EXTRACT(EPOCH FROM (coalesce(v."confirmadaEm", v.data) - l."criadoEm")) / 86400 dias FROM pro_labore_vendas v JOIN pro_labore_leads l ON l."vendaId" = v.id
      WHERE v."usuarioId" = ${e.usuarioId} AND v.situacao = 'CONFIRMADA' AND v.data >= ${dataDia(p.inicio)} AND v.data < ${dataDia(maisDias(p.fim, 1))}${vend(e)}`)
    const m = mediana(rs.map(r => Number(r.dias)).filter(x => x >= 0))
    return { valor: m == null ? null : r2(m), amostra: rs.length }
  },
  async faturamento_por_origem(e, p) {
    const rs = await q<{ grupo: string; s: number | null }>(Prisma.sql`
      SELECT CASE WHEN l."reativadoEm" IS NOT NULL THEN 'RECUPERADO_CENTRAL' WHEN l."origemLista" = 'RETORNO_ESPONTANEO' THEN 'RETORNO_ESPONTANEO' ELSE 'NOVO_CLIENTE' END grupo, sum(v."valorVenda") s
      FROM pro_labore_vendas v LEFT JOIN pro_labore_leads l ON l."vendaId" = v.id
      WHERE v."usuarioId" = ${e.usuarioId} AND v.situacao = 'CONFIRMADA' AND v.data >= ${dataDia(p.inicio)} AND v.data < ${dataDia(maisDias(p.fim, 1))}${vend(e, Prisma.sql`v."vendedorId"`)}
      GROUP BY 1`)
    const d = { NOVO_CLIENTE: 0, RECUPERADO_CENTRAL: 0, RETORNO_ESPONTANEO: 0 } as Record<string, number>
    for (const r of rs) d[r.grupo] = r2(num(r.s))
    return { valor: r2(Object.values(d).reduce((a, b) => a + b, 0)), detalhe: d }
  },
}

export async function calcular(chave: string, e: Escopo, p: Periodo, agora = new Date()): Promise<Valor> {
  const fn = CALC[chave]
  if (!fn) throw new Error(`Métrica sem cálculo: ${chave}`)
  return fn(e, p, agora)
}

// --- Padrão da loja e faixas ---

/** Padrão da loja: mediana do valor em janelas de 7 dias nos últimos 90 dias (13 janelas). Guardado por dia. */
export async function padraoDaLoja(chave: string, e: Escopo, agora = new Date()): Promise<number | null> {
  const ficha = FICHAS_PADRAO.find(x => x.chave === chave)!
  const hoje = hojeBrt(agora)
  const escopoChave = e.vendedorId ?? 'LOJA'
  const salvo = await prisma.metricaPadrao.findUnique({ where: { usuarioId_chave_escopo_dia: { usuarioId: e.usuarioId, chave, escopo: escopoChave, dia: dataDia(hoje) } } })
  if (salvo) return salvo.valor
  let valor: number | null
  if (ficha.retrato) {
    // Retratos diários guardados pelo cron; com menos de 7 dias de histórico ainda não há padrão.
    const rs = await prisma.metricaPadrao.findMany({ where: { usuarioId: e.usuarioId, chave: `${chave}#retrato`, escopo: escopoChave, dia: { gte: dataDia(maisDias(hoje, -90)) } } })
    valor = rs.length >= 7 ? mediana(rs.map(r => r.valor).filter((x): x is number => x != null)) : null
  } else {
    const xs: number[] = []
    for (let k = 0; k < 13; k++) {
      const fim = maisDias(hoje, -1 - 7 * k), inicio = maisDias(fim, -6)
      const v = await calcular(chave, e, { inicio, fim }, agora).catch(() => ({ valor: null }))
      if (v.valor != null) xs.push(v.valor)
    }
    valor = xs.length >= 4 ? mediana(xs) : null
  }
  await prisma.metricaPadrao.upsert({
    where: { usuarioId_chave_escopo_dia: { usuarioId: e.usuarioId, chave, escopo: escopoChave, dia: dataDia(hoje) } },
    create: { usuarioId: e.usuarioId, chave, escopo: escopoChave, dia: dataDia(hoje), valor }, update: { valor },
  })
  return valor
}

export type Faixa = 'BOM' | 'ATENCAO' | 'CRITICO'
/** Bom: no padrão ou melhor; atenção: até 20% pior; crítico: mais de 20% pior. */
export function faixaDe(valor: number | null, referencia: number | null, melhor: Melhor, manual?: { bom: number; critico: number } | null): Faixa | null {
  if (valor == null || melhor === 'NEUTRO') return null
  if (manual) {
    if (melhor === 'MAIOR') return valor >= manual.bom ? 'BOM' : valor > manual.critico ? 'ATENCAO' : 'CRITICO'
    return valor <= manual.bom ? 'BOM' : valor < manual.critico ? 'ATENCAO' : 'CRITICO'
  }
  // Sem histórico (padrão zero ou ausente) não há referência para classificar.
  if (referencia == null || referencia === 0) return null
  if (melhor === 'MAIOR') return valor >= referencia ? 'BOM' : valor >= referencia * 0.8 ? 'ATENCAO' : 'CRITICO'
  return valor <= referencia ? 'BOM' : valor <= referencia * 1.2 ? 'ATENCAO' : 'CRITICO'
}

export interface Leitura {
  chave: string; nome: string; unidade: Unidade; melhor: Melhor; versao: number
  periodo: Periodo; valor: number | null; amostra?: number; detalhe?: unknown
  anterior: { periodo: Periodo; valor: number | null } | null
  variacao: number | null // % sobre o mesmo intervalo anterior
  projecao: number | null // fechamento do período em andamento (métricas somáveis)
  padrao: number | null // padrão da loja ajustado à duração do período
  faixa: Faixa | null
}

/** Leitura completa de uma métrica: valor, comparação pelo mesmo intervalo, projeção e faixa. */
export async function ler(chave: string, e: Escopo, p: Periodo, agora = new Date(), opcoes: { faixas?: boolean } = {}): Promise<Leitura> {
  const lista = await fichas(e.usuarioId)
  const ficha = lista.find(x => x.chave === chave)
  if (!ficha) throw new Error('Métrica não encontrada')
  const atual = await calcular(chave, e, p, agora)
  const ant = ficha.retrato || chave === 'previsao_fechamento' ? null : periodoAnterior(p)
  const anterior = ant ? { periodo: ant, valor: (await calcular(chave, e, ant, agora)).valor } : null
  const variacao = anterior && anterior.valor && atual.valor != null ? r2(((atual.valor - anterior.valor) / Math.abs(anterior.valor)) * 100) : null
  // Período em andamento: projeta o fechamento pelo ritmo (só métricas somáveis).
  const hoje = hojeBrt(agora)
  let projecao: number | null = null
  let fechamento = p
  if (ficha.aditiva && atual.valor != null && p.inicio <= hoje && p.fim >= hoje) {
    const i = dataDia(p.inicio)
    fechamento = i.getUTCDate() === 1 ? { inicio: p.inicio, fim: iso(new Date(Date.UTC(i.getUTCFullYear(), i.getUTCMonth(), ultimoDiaDoMes(i.getUTCFullYear(), i.getUTCMonth())))) } : p
    const passados = diasDe({ inicio: p.inicio, fim: hoje })
    projecao = r2((atual.valor / passados) * diasDe(fechamento))
  }
  let padrao: number | null = null
  if (opcoes.faixas !== false && ficha.melhor !== 'NEUTRO' && !ficha.faixas) {
    if (chave === 'previsao_fechamento') {
      // A previsão é do mês inteiro: comparada ao padrão de faturamento da loja no mesmo número de dias.
      const m = mesCorrente(agora), i = dataDia(m.inicio)
      const base = await padraoDaLoja('faturamento', e, agora)
      padrao = base == null ? null : r2((base / 7) * ultimoDiaDoMes(i.getUTCFullYear(), i.getUTCMonth()))
    } else {
      const base = await padraoDaLoja(chave, e, agora)
      padrao = base == null ? null : ficha.aditiva ? r2((base / 7) * diasDe(fechamento)) : base
    }
  }
  const comparado = projecao ?? atual.valor
  return {
    chave, nome: ficha.nome, unidade: ficha.unidade, melhor: ficha.melhor, versao: ficha.versao,
    periodo: p, valor: atual.valor, amostra: atual.amostra, detalhe: atual.detalhe,
    anterior, variacao, projecao, padrao, faixa: faixaDe(comparado, padrao, ficha.melhor, ficha.faixas),
  }
}

/** Quem vê: a ficha diz os perfis; vendedor e SDR veem só a própria produção (o escopo já recorta). */
export const podeVer = (ficha: Pick<Ficha, 'quemVe'>, papel: Papel) => ficha.quemVe.includes(papel)

/** Cron diário: guarda o retrato das métricas de "agora" (leads parados, atividades atrasadas) para o padrão. */
export async function guardarRetratos(agora = new Date()) {
  const contas = await prisma.proLaboreUsuario.findMany({ select: { id: true } })
  const dia = dataDia(hojeBrt(agora))
  let n = 0
  for (const c of contas) {
    for (const chave of ['leads_parados', 'atividades_atrasadas']) {
      const v = await calcular(chave, { usuarioId: c.id, papel: 'DONO' }, { inicio: hojeBrt(agora), fim: hojeBrt(agora) }, agora).catch(() => null)
      if (!v) continue
      await prisma.metricaPadrao.upsert({
        where: { usuarioId_chave_escopo_dia: { usuarioId: c.id, chave: `${chave}#retrato`, escopo: 'LOJA', dia } },
        create: { usuarioId: c.id, chave: `${chave}#retrato`, escopo: 'LOJA', dia, valor: v.valor }, update: { valor: v.valor },
      })
      n++
    }
  }
  return { retratosMetricas: n }
}
