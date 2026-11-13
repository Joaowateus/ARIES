// Ajuste 1 · Daily: a reunião de 30 minutos da manhã, dentro do Hoje do dono
// (e do supervisor). Oito blocos na ordem e no tempo aprovados; cada bloco traz
// até 3 números de ontem (comparação padrão), até 3 Recomendações da área por
// impacto, as atividades críticas e os botões "Decidido" (vira ATV com origem
// "reunião", que segue a régua) e "Tratado". Dois modos: gestão (tudo, por
// pessoa) e equipe (só totais, só REC de equipe e de etapa, só o decidido).
// Cifras do dono (P7): gasto, custos, pró-labore e comissões em R$ só para ele;
// o supervisor e a equipe veem o ritmo do gasto em % do planejado e o ROAS.
// Gestão (PDF 05): o supervisor nunca vê as Recomendações da área.
// A ata e a pauta são montadas pelo código (nada vai para a IA).
// PDF 06: o primeiro bloco é "Pendências do Daily anterior"; cada bloco recebe
// no topo o que foi enviado do Hoje ("Levar ao Daily") e o que foi adiado; cada
// item termina em Decidido (uma ATV por responsável, prazo no fim do expediente),
// Tratado ou Adiar (vai para o próximo Daily com o motivo). Ao encerrar, a ata vai
// para Reuniões e cada responsável recebe as tarefas no WhatsApp. A transmissão
// usa a apresentação ao vivo de Reuniões e o espectador vê sempre o modo equipe.
import { randomUUID } from 'crypto'
import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { FICHAS_PADRAO, hojeBrt, ler, mesCorrente, calcular, metaDoMes, type Escopo, type Papel, type Periodo } from './metricas'
import { papeisDaConta } from './detectoresOnda4'
import { fmtValor, nomesDistintos } from './formato'
import { metaCobertaAgora, situacaoDaMeta, type SituacaoMeta } from './metaCoerente'
import { lerExpediente, prazoDoDiaEscolhido } from './expediente'
import { avisarNoWhatsapp } from './ligacoesAviso'

export type BlocoChave = 'PENDENCIAS' | 'RESULTADO' | 'PRE_VENDA' | 'CREDITO' | 'VENDEDORES' | 'TRAFEGO' | 'SOCIAL' | 'REATIVACAO' | 'GESTAO'
export type ModoDaily = 'GESTAO' | 'EQUIPE'
export interface BlocoCfg { chave: BlocoChave; minutos: number; ligado: boolean }
export const NOME_BLOCO: Record<BlocoChave, string> = {
  PENDENCIAS: 'Pendências do Daily anterior', RESULTADO: 'Resultado', PRE_VENDA: 'Pré-venda (SDR)', CREDITO: 'Crédito', VENDEDORES: 'Vendedores', TRAFEGO: 'Tráfego', SOCIAL: 'Social media', REATIVACAO: 'Reativação', GESTAO: 'Gestão',
}
export const BLOCOS_PADRAO: BlocoCfg[] = [
  { chave: 'PENDENCIAS', minutos: 2, ligado: true }, { chave: 'RESULTADO', minutos: 3, ligado: true }, { chave: 'PRE_VENDA', minutos: 5, ligado: true }, { chave: 'CREDITO', minutos: 3, ligado: true },
  { chave: 'VENDEDORES', minutos: 5, ligado: true }, { chave: 'TRAFEGO', minutos: 4, ligado: true }, { chave: 'SOCIAL', minutos: 3, ligado: true },
  { chave: 'REATIVACAO', minutos: 3, ligado: true }, { chave: 'GESTAO', minutos: 2, ligado: true },
]
export class ErroDaily extends Error { constructor(public status: number, msg: string) { super(msg) } }

type Per = 'ONTEM' | 'MES' | 'AGORA' | 'HOJE'
interface NumDef {
  chave: string; rotulo: string; periodo: Per; pessoal?: boolean
  // Parte do resultado que vira o número (o valor da ficha, ou um campo do detalhe).
  campo?: 'planejados' | 'reativados' | 'vendasAConfirmar' | 'pagamentosAAprovar'
  alvo?: 'META_MES' | 'ORCAMENTO_DIA' | 'PLANEJADOS'
  junto?: string // ficha mostrada junto (ex.: vendas ao lado do faturamento)
}
const NUMEROS: Record<BlocoChave, NumDef[]> = {
  PENDENCIAS: [],
  RESULTADO: [
    { chave: 'previsao_fechamento', rotulo: 'Previsão de fechamento contra a meta', periodo: 'MES', alvo: 'META_MES' },
    { chave: 'faturamento', rotulo: 'Vendas e faturamento de ontem', periodo: 'ONTEM', junto: 'vendas', pessoal: true },
    { chave: 'vendas_por_dia_necessarias', rotulo: 'Ritmo para a meta', periodo: 'MES' },
  ],
  PRE_VENDA: [
    { chave: 'leads_novos', rotulo: 'Leads novos ontem', periodo: 'ONTEM', pessoal: true },
    { chave: 'tempo_primeira_resposta', rotulo: 'Tempo de primeira resposta de ontem', periodo: 'ONTEM', pessoal: true },
    { chave: 'leads_sem_primeira_resposta', rotulo: 'Leads sem resposta agora', periodo: 'AGORA', pessoal: true },
  ],
  CREDITO: [
    { chave: 'fichas_aguardando_banco', rotulo: 'Fichas aguardando banco', periodo: 'AGORA' },
    { chave: 'aprovacoes_vencendo', rotulo: 'Aprovações que vencem em até 2 dias', periodo: 'AGORA' },
    { chave: 'aprovacao_credito', rotulo: 'Aprovação de crédito de ontem', periodo: 'ONTEM' },
  ],
  VENDEDORES: [
    { chave: 'visitas_do_dia', rotulo: 'Visitas de hoje', periodo: 'HOJE', pessoal: true },
    { chave: 'propostas_sem_follow', rotulo: 'Propostas sem follow', periodo: 'AGORA', pessoal: true },
    { chave: 'sql_sem_contato', rotulo: 'SQL sem contato do vendedor', periodo: 'AGORA', pessoal: true },
  ],
  TRAFEGO: [
    { chave: 'gasto_anuncio', rotulo: 'Gasto de ontem contra o planejado', periodo: 'ONTEM', alvo: 'ORCAMENTO_DIA' },
    { chave: 'custo_por_lead', rotulo: 'Custo por lead', periodo: 'ONTEM' },
    { chave: 'roas', rotulo: 'ROAS do mês', periodo: 'MES' },
  ],
  SOCIAL: [
    { chave: 'posts_publicados', rotulo: 'Posts de ontem contra o planejado', periodo: 'ONTEM', alvo: 'PLANEJADOS' },
    { chave: 'posts_publicados', rotulo: 'Posts planejados para hoje', periodo: 'HOJE', campo: 'planejados' },
    { chave: 'leads_dos_posts', rotulo: 'Leads gerados por posts', periodo: 'ONTEM' },
  ],
  REATIVACAO: [
    { chave: 'taxa_recuperacao', rotulo: 'Clientes recuperados ontem', periodo: 'ONTEM', campo: 'reativados' },
    { chave: 'prioridade_sem_atividade', rotulo: 'Prioridade alta sem atividade', periodo: 'AGORA' },
    { chave: 'taxa_resposta_reativacao', rotulo: 'Taxa de resposta das campanhas', periodo: 'ONTEM' },
  ],
  GESTAO: [
    { chave: 'decisoes_aguardando', rotulo: 'Vendas a confirmar', periodo: 'AGORA', campo: 'vendasAConfirmar' },
    { chave: 'decisoes_aguardando', rotulo: 'Pagamentos a aprovar', periodo: 'AGORA', campo: 'pagamentosAAprovar' },
    { chave: 'decisoes_aguardando', rotulo: 'Decisões pendentes', periodo: 'AGORA' },
  ],
}
// Recomendações de cada bloco (pelo detector).
const DETECTORES_DO_BLOCO: Record<BlocoChave, string[]> = {
  PENDENCIAS: [],
  RESULTADO: ['meta_em_risco'],
  PRE_VENDA: ['resposta_lenta'],
  CREDITO: ['credito_emperrado'],
  VENDEDORES: ['funil_parado', 'etapa_travando', 'atividades_acumuladas', 'queda_ritmo', 'rotina_nao_cumprida', 'ponto_fraco', 'ocorrencia_repetida', 'boa_pratica'],
  TRAFEGO: ['anuncio_encarecendo', 'criativo_cansado', 'campanha_lead_fraco', 'orcamento_fora_ritmo'],
  SOCIAL: ['conteudo_abaixo', 'post_que_vende'],
  REATIVACAO: ['prioridade_esquecida', 'campanha_sem_resposta', 'roteiro_que_recupera', 'limite_chegando', 'recuperacao_caindo'],
  GESTAO: ['venda_parada_confirmacao', 'pagamento_atrasado', 'conta_nao_fecha', 'saida_fora_padrao', 'pilar_travando'],
}
const BLOCO_DO_DETECTOR = new Map(Object.entries(DETECTORES_DO_BLOCO).flatMap(([b, ds]) => ds.map(d => [d, b as BlocoChave])))
// Cifras do dono no bloco Tráfego: R$ só para ele (o resto vê o ritmo em %).
const CIFRA_DO_DONO = new Set(['gasto_anuncio', 'custo_por_lead'])

const DIA = 86_400_000
const diaMenos = (s: string, n: number) => new Date(new Date(`${s}T00:00:00.000Z`).getTime() - n * DIA).toISOString().slice(0, 10)
const periodo = (p: Per, agora: Date): Periodo => {
  const h = hojeBrt(agora)
  if (p === 'ONTEM') { const o = diaMenos(h, 1); return { inicio: o, fim: o } }
  if (p === 'MES') return mesCorrente(agora)
  return { inicio: h, fim: h }
}
const inicioDoDia = (agora: Date) => new Date(`${hojeBrt(agora)}T03:00:00.000Z`)
const primeiro = (s: string | null | undefined) => (s ?? '').trim().split(/\s+/)[0] || ''

export async function configDaily(usuarioId: string): Promise<BlocoCfg[]> {
  const p = await prisma.parametroLiquidez.findUnique({ where: { usuarioId }, select: { dailyConfig: true } })
  const salvo = (p?.dailyConfig as { blocos?: BlocoCfg[] } | null)?.blocos
  if (!Array.isArray(salvo)) return BLOCOS_PADRAO
  const ok = salvo.filter(b => b && NOME_BLOCO[b.chave])
  // PDF 06: "Pendências do Daily anterior" entra em primeiro; para caber nos 30 minutos, Vendedores passa de 7 para 5.
  if (!ok.some(x => x.chave === 'PENDENCIAS')) {
    ok.unshift({ chave: 'PENDENCIAS', minutos: 2, ligado: true })
    const v = ok.find(x => x.chave === 'VENDEDORES'); if (v && v.minutos === 7) v.minutos = 5
  }
  // Bloco novo que ainda não está na configuração salva entra no fim, desligado.
  for (const b of BLOCOS_PADRAO) if (!ok.some(x => x.chave === b.chave)) ok.push({ ...b, ligado: false })
  return ok
}
export async function salvarConfigDaily(usuarioId: string, blocos: BlocoCfg[], justificativa: string, autorId: string) {
  const antes = await configDaily(usuarioId)
  const limpo = blocos.filter(b => NOME_BLOCO[b.chave]).map(b => ({ chave: b.chave, minutos: Math.max(1, Math.min(30, Math.round(b.minutos))), ligado: !!b.ligado }))
  if (new Set(limpo.map(b => b.chave)).size !== limpo.length) throw new ErroDaily(400, 'Cada bloco aparece uma vez só')
  await prisma.parametroLiquidez.upsert({ where: { usuarioId }, create: { usuarioId, dailyConfig: { blocos: limpo } }, update: { dailyConfig: { blocos: limpo } } })
  await prisma.parametroHistorico.create({ data: { usuarioId, nome: 'daily.blocos', valorAnterior: antes as unknown as Prisma.InputJsonValue, valorNovo: limpo as unknown as Prisma.InputJsonValue, origem: 'MANUAL', justificativa, autorId } })
  return limpo
}

export interface Leitor { usuarioId: string; papel: Papel; vendedorId: string | null; nome: string }

// --- Números do bloco ---

async function numerosDoBloco(bloco: BlocoChave, quem: Leitor, modo: ModoDaily, equipe: Array<{ id: string; nome: string }>, agora: Date, meta: SituacaoMeta | null) {
  const nomes = nomesDistintos(equipe)
  const dono = quem.papel === 'DONO' && modo === 'GESTAO'
  const e: Escopo = { usuarioId: quem.usuarioId, papel: 'DONO' }
  const out = []
  for (const n of NUMEROS[bloco]) {
    const ficha = FICHAS_PADRAO.find(f => f.chave === n.chave)!
    const p = periodo(n.periodo, agora)
    const l = await ler(n.chave, e, p, agora).catch(() => null)
    if (!l) continue
    const det = l.detalhe as Record<string, number | null | undefined> | undefined
    let valor = n.campo ? (det?.[n.campo] ?? null) : l.valor
    let unidade: string = ficha.unidade
    let anterior = n.campo ? null : l.anterior?.valor ?? null
    let variacao = n.campo ? null : l.variacao
    let alvo: { valor: number | null; rotulo: string } | null = null
    if (n.alvo === 'META_MES') { const m = await metaDoMes({ usuarioId: quem.usuarioId, vendedorId: null }); alvo = { valor: m, rotulo: 'meta do mês' } }
    if (n.alvo === 'PLANEJADOS') alvo = { valor: det?.planejados ?? null, rotulo: 'planejados' }
    if (n.alvo === 'ORCAMENTO_DIA') {
      const orc = (det?.orcamentoMensal as number | null | undefined) ?? null
      const h = hojeBrt(agora), dm = new Date(Date.UTC(Number(h.slice(0, 4)), Number(h.slice(5, 7)), 0)).getUTCDate()
      alvo = { valor: orc != null ? Math.round((orc / dm) * 100) / 100 : null, rotulo: 'planejado do dia' }
    }
    // Cifras: gasto e custos em R$ só para o dono no modo gestão; os outros veem o gasto em % do planejado.
    let rotulo = n.rotulo
    if (!dono && CIFRA_DO_DONO.has(n.chave)) {
      if (n.chave === 'custo_por_lead') continue
      valor = alvo?.valor && valor != null ? Math.round((valor / alvo.valor) * 1000) / 10 : null
      unidade = 'PCT'; anterior = null; variacao = null; alvo = { valor: 100, rotulo: 'do planejado' }; rotulo = 'Gasto de ontem (% do planejado)'
    }
    // Outras cifras em R$ fora do que o leitor pode ver (P7) não aparecem.
    if (unidade === 'BRL' && !dono && !ficha.quemVe.includes(modo === 'EQUIPE' ? 'VENDEDOR' : quem.papel)) continue
    // PDF 06 · correções 4 e 5: previsão e ritmo pela mesma conta do Hoje e da REC, em vendas inteiras.
    let texto: string | null = null
    if (n.chave === 'previsao_fechamento' && meta) { valor = meta.previsao; texto = meta.pct != null ? `${meta.pct}% da meta${meta.cobre ? ' · Meta no ritmo' : ''}` : null }
    if (n.chave === 'vendas_por_dia_necessarias') { texto = meta?.ritmo ?? ((det as { texto?: string } | undefined)?.texto ?? null); unidade = 'TEXTO'; anterior = null; variacao = null }
    let junto: { nome: string; valor: number | null } | null = null
    if (n.junto) { const j = await ler(n.junto, e, p, agora).catch(() => null); junto = { nome: FICHAS_PADRAO.find(f => f.chave === n.junto)!.nome, valor: j?.valor ?? null } }
    // Por pessoa só no modo gestão.
    let porPessoa: Array<{ id: string; nome: string; valor: number | null }> | null = null
    let semVenda: { total: number; nomes: string[] } | null = null
    if (modo === 'GESTAO' && n.pessoal && equipe.length) {
      porPessoa = await Promise.all(equipe.map(async v => {
        const r = await calcular(n.chave, { ...e, vendedorId: v.id }, p, agora).catch(() => null)
        return { id: v.id, nome: nomes.get(v.id) ?? primeiro(v.nome), valor: r ? (n.campo ? ((r.detalhe as Record<string, number>)?.[n.campo] ?? null) : r.valor) : null }
      }))
      // PDF 06 · correção 6: no faturamento de ontem, só quem vendeu; os outros num total que abre a lista.
      if (n.chave === 'faturamento') {
        // Quem não vende (o SDR) não entra em "sem venda".
        const sdrs = new Set(equipe.filter(v => (v as { papel?: string }).papel === 'SDR').map(v => v.id))
        const sem = porPessoa.filter(x => !x.valor && !sdrs.has(x.id))
        porPessoa = porPessoa.filter(x => (x.valor ?? 0) > 0)
        semVenda = { total: sem.length, nomes: sem.map(x => x.nome) }
      }
    }
    out.push({ chave: n.chave, rotulo, unidade, melhor: ficha.melhor, periodo: p, tipoPeriodo: n.periodo, valor, anterior, variacao, alvo, status: n.chave === 'previsao_fechamento' && meta ? meta.faixa : l.faixa ?? null, junto, porPessoa, semVenda, texto, naoDefinido: ficha.naoDefinido ?? null, ficha: { definicao: ficha.definicao, formula: ficha.formula } })
  }
  return out.slice(0, 3)
}

// --- Recomendações do bloco ---

const ABERTAS = ['NOVA', 'ACEITA', 'EM_EXECUCAO']
async function recsDoBloco(bloco: BlocoChave, quem: Leitor, modo: ModoDaily) {
  if (bloco === 'GESTAO' && !(quem.papel === 'DONO' && modo === 'GESTAO')) return []
  const where: Prisma.RecomendacaoWhereInput = { usuarioId: quem.usuarioId, detector: { in: DETECTORES_DO_BLOCO[bloco] }, status: { in: ABERTAS } }
  if (modo === 'EQUIPE') where.alvoTipo = { in: ['EQUIPE', 'ETAPA'] }
  else if (quem.papel !== 'DONO') where.visivelPara = { has: quem.vendedorId ?? '__' }
  const rs = await prisma.recomendacao.findMany({ where, select: { id: true, codigo: true, titulo: true, forca: true, impacto: true, acaoSugerida: true, alvoTipo: true, detector: true, criadoEm: true }, take: 50 })
  if (bloco === 'RESULTADO' && rs.length && await metaCobertaAgora(quem.usuarioId)) rs.splice(0, rs.length, ...rs.filter(r => r.detector !== 'meta_em_risco'))
  const imp = (r: { impacto: unknown }) => Number((r.impacto as { valor?: number } | null)?.valor ?? 0)
  return rs.sort((a, b) => imp(b) - imp(a) || b.criadoEm.getTime() - a.criadoEm.getTime()).slice(0, 3)
    .map(r => ({ id: r.id, codigo: r.codigo, titulo: r.titulo, forca: r.forca, impacto: (r.impacto as { texto?: string } | null)?.texto ?? null, acao: r.acaoSugerida, individual: r.alvoTipo === 'PESSOA' }))
}

// --- Nomes: pessoas da conta, com o dono (correção 8: toda atividade tem uma pessoa) ---

async function pessoasDaConta(usuarioId: string) {
  const [dono, vs] = await Promise.all([
    prisma.proLaboreUsuario.findUnique({ where: { id: usuarioId }, select: { nome: true } }),
    prisma.vendedor.findMany({ where: { usuarioId }, select: { id: true, nome: true, ativo: true, funcao: true }, orderBy: { nome: 'asc' } }),
  ])
  const lista = [{ id: usuarioId, nome: dono?.nome ?? 'Dono' }, ...vs]
  const curtos = nomesDistintos(lista)
  const nomeDe = (id: string | null | undefined) => (id ? curtos.get(id) : null) ?? curtos.get(usuarioId) ?? 'Dono'
  return { dono: { id: usuarioId, nome: curtos.get(usuarioId) ?? 'Dono' }, vendedores: vs, nomeDe }
}

// --- Atividades críticas (atrasadas ou que vencem hoje), por bloco ---

const PRE_VENDA = ['LEAD', 'ABORDADO', 'LEVANTAMENTO']
async function atividadesCriticas(usuarioId: string, agora: Date) {
  const fimHoje = new Date(inicioDoDia(agora).getTime() + DIA)
  const atvs = await prisma.atividade.findMany({
    where: { usuarioId, status: 'PENDENTE', prazo: { lt: fimHoje } },
    select: { id: true, codigo: true, tipo: true, prazo: true, oQueFazer: true, origemTipo: true, origemId: true, responsavelId: true, leadId: true },
    orderBy: { prazo: 'asc' }, take: 400,
  })
  const leads = new Map((await prisma.lead.findMany({ where: { id: { in: atvs.map(a => a.leadId).filter((x): x is string => !!x) } }, select: { id: true, etapa: true, estagio: true, nomeCliente: true } })).map(l => [l.id, l]))
  const recIds = atvs.filter(a => a.origemTipo === 'RECOMENDACAO' && a.origemId).map(a => a.origemId!.split('|')[0])
  const recs = new Map((await prisma.recomendacao.findMany({ where: { id: { in: recIds } }, select: { id: true, detector: true } })).map(r => [r.id, r.detector]))
  const { nomeDe } = await pessoasDaConta(usuarioId)
  const blocoDe = (a: typeof atvs[number]): BlocoChave => {
    if (a.origemTipo === 'REUNIAO') { const b = a.origemId?.split('|')[2] as BlocoChave | undefined; return b && NOME_BLOCO[b] && b !== 'PENDENCIAS' ? b : 'RESULTADO' }
    if (a.origemTipo === 'PAUTA') return 'SOCIAL'
    if (a.origemTipo === 'RECOMENDACAO') return BLOCO_DO_DETECTOR.get(recs.get(a.origemId!.split('|')[0]) ?? '') ?? 'VENDEDORES'
    const l = a.leadId ? leads.get(a.leadId) : null
    if (l?.estagio === 'PERDIDO') return 'REATIVACAO'
    if (a.tipo === 'REFAZER_PRE_ANALISE' || l?.etapa === 'MQL' || l?.etapa === 'SQL') return 'CREDITO'
    if (l && PRE_VENDA.includes(l.etapa ?? 'LEAD')) return 'PRE_VENDA'
    return 'VENDEDORES'
  }
  return atvs.map(a => ({ id: a.id, codigo: a.codigo, oQue: a.oQueFazer ?? a.tipo, prazo: a.prazo, atrasada: a.prazo < agora, responsavelId: a.responsavelId ?? usuarioId, responsavel: nomeDe(a.responsavelId), cliente: a.leadId ? primeiro(leads.get(a.leadId)?.nomeCliente) : null, bloco: blocoDe(a) }))
}

// --- Responsável sugerido no "Decidido" (área sem pessoa: quem faz o trabalho hoje; no fim, o dono) ---

async function responsaveisSugeridos(usuarioId: string) {
  const p = await papeisDaConta(usuarioId)
  const sdr = await prisma.vendedor.findFirst({ where: { usuarioId, ativo: true, papel: 'SDR' }, select: { id: true } })
  const sup = p.supervisor ?? usuarioId
  const r: Record<BlocoChave, string> = {
    PENDENCIAS: sup, RESULTADO: sup, PRE_VENDA: sdr?.id ?? sup, CREDITO: sdr?.id ?? sup, VENDEDORES: sup, TRAFEGO: p.trafego ?? usuarioId, SOCIAL: usuarioId, REATIVACAO: sup, GESTAO: p.financeiro ?? usuarioId,
  }
  return r
}

// --- Pendências do Daily anterior: o que foi decidido, com a situação de hoje ---

type SituacaoPendencia = 'FEITA' | 'ATRASADA' | 'VENCE_HOJE' | 'NO_PRAZO' | 'CANCELADA'
export async function pendenciasDoAnterior(usuarioId: string, antesDe: Date | null, agora = new Date()) {
  const anterior = await prisma.reuniao.findFirst({
    where: { usuarioId, tipo: 'DAILY', transcricao: { not: null }, ...(antesDe ? { data: { lt: antesDe } } : {}) },
    orderBy: { data: 'desc' }, select: { id: true, titulo: true, data: true, ata: true },
  })
  if (!anterior) return { reuniao: null, itens: [] as Array<{ id: string; codigo: string | null; oQue: string; responsavel: string; prazo: Date; situacao: SituacaoPendencia; feitaEm: Date | null; resultado: string | null }> }
  const ids = ((anterior.ata as { decisoes?: Array<{ atividadeId: string }> } | null)?.decisoes ?? []).map(d => d.atividadeId)
  const atvs = ids.length ? await prisma.atividade.findMany({ where: { id: { in: ids } }, select: { id: true, codigo: true, oQueFazer: true, responsavelId: true, prazo: true, status: true, executadaEm: true, resultado: true }, orderBy: { prazo: 'asc' } }) : []
  const { nomeDe } = await pessoasDaConta(usuarioId)
  const fimHoje = new Date(inicioDoDia(agora).getTime() + DIA)
  const situacao = (a: typeof atvs[number]): SituacaoPendencia => a.status === 'EXECUTADA' ? 'FEITA' : a.status === 'CANCELADA' ? 'CANCELADA' : a.prazo < agora ? 'ATRASADA' : a.prazo < fimHoje ? 'VENCE_HOJE' : 'NO_PRAZO'
  return {
    reuniao: { id: anterior.id, titulo: anterior.titulo, data: anterior.data },
    itens: atvs.map(a => ({ id: a.id, codigo: a.codigo, oQue: a.oQueFazer ?? 'Decisão do Daily', responsavel: nomeDe(a.responsavelId), prazo: a.prazo, situacao: situacao(a), feitaEm: a.executadaEm, resultado: a.resultado })),
  }
}

// --- "Levar ao Daily": itens enviados do Hoje (e os adiados), no topo do bloco ---

export const AREA_PARA_BLOCO: Record<string, BlocoChave> = {
  RESULTADO: 'RESULTADO', PRE_VENDA: 'PRE_VENDA', CREDITO: 'CREDITO', VENDEDORES: 'VENDEDORES', TRAFEGO: 'TRAFEGO', SOCIAL: 'SOCIAL', REATIVACAO: 'REATIVACAO', GESTAO: 'GESTAO', EQUIPE: 'VENDEDORES',
}
export async function levarAoDaily(pessoa: { usuarioId: string; id: string; nome: string }, d: { area: string; texto: string; detalhe?: string | null; refTipo?: string | null; refId?: string | null }, agora = new Date()) {
  const bloco = AREA_PARA_BLOCO[d.area] ?? (NOME_BLOCO[d.area as BlocoChave] ? d.area as BlocoChave : null)
  if (!bloco || bloco === 'PENDENCIAS') throw new ErroDaily(400, 'Área desconhecida')
  const texto = d.texto.trim().slice(0, 300)
  if (texto.length < 3) throw new ErroDaily(400, 'Escreva o que levar ao Daily')
  // O mesmo ponto já está na pauta: não duplica.
  const ja = await prisma.dailyItem.findFirst({ where: { usuarioId: pessoa.usuarioId, situacao: 'ABERTO', bloco, ...(d.refTipo && d.refId ? { refTipo: d.refTipo, refId: d.refId } : { texto }) } })
  if (ja) return { item: ja, jaEstava: true }
  const item = await prisma.dailyItem.create({ data: { usuarioId: pessoa.usuarioId, bloco, origem: 'HOJE', texto, detalhe: d.detalhe?.slice(0, 500) ?? null, refTipo: d.refTipo ?? null, refId: d.refId ?? null, enviadoPorId: pessoa.id, enviadoPorNome: pessoa.nome, enviadoEm: agora } })
  return { item, jaEstava: false }
}
export async function itensEnviados(usuarioId: string, enviadoPorId: string) {
  return prisma.dailyItem.findMany({ where: { usuarioId, enviadoPorId, situacao: 'ABERTO' }, select: { id: true, bloco: true, texto: true, refTipo: true, refId: true, enviadoEm: true } })
}

// --- Pauta ---

export async function pautaDaily(quem: Leitor, modo: ModoDaily, reuniaoId: string | null, agora = new Date()) {
  if (quem.papel !== 'DONO' && quem.papel !== 'SUPERVISOR') throw new ErroDaily(403, 'O Daily é aberto pelo dono e pelo supervisor')
  const cfg = (await configDaily(quem.usuarioId)).filter(b => b.ligado)
  const equipe = (await prisma.vendedor.findMany({ where: { usuarioId: quem.usuarioId, ativo: true, funcao: null }, select: { id: true, nome: true, papel: true, vende: true }, orderBy: { nome: 'asc' } })).filter(v => v.vende || v.papel === 'SDR')
  const [criticas, sugeridos, reuniao, meta, pessoas, papeis] = await Promise.all([
    modo === 'GESTAO' ? atividadesCriticas(quem.usuarioId, agora) : Promise.resolve([]),
    responsaveisSugeridos(quem.usuarioId),
    reuniaoId ? prisma.reuniao.findFirst({ where: { id: reuniaoId, usuarioId: quem.usuarioId, tipo: 'DAILY' }, select: { id: true, ata: true, modo: true, data: true } }) : Promise.resolve(null),
    situacaoDaMeta(quem.usuarioId, agora).catch(() => null),
    pessoasDaConta(quem.usuarioId),
    papeisDaConta(quem.usuarioId),
  ])
  const ata = (reuniao?.ata ?? null) as Ata | null
  const decididas = reuniao ? await prisma.atividade.findMany({ where: { usuarioId: quem.usuarioId, origemTipo: 'REUNIAO', origemId: { startsWith: `daily|${reuniao.id}|` } }, select: { id: true, codigo: true, oQueFazer: true, prazo: true, responsavelId: true, origemId: true } }) : []
  // Itens enviados do Hoje e adiados de Dailys anteriores (abertos), e os já resolvidos nesta reunião.
  const itensPauta = await prisma.dailyItem.findMany({ where: { usuarioId: quem.usuarioId, OR: [{ situacao: 'ABERTO' }, ...(reuniao ? [{ reuniaoId: reuniao.id }] : [])] }, orderBy: { enviadoEm: 'asc' } })
  const pend = cfg.some(b => b.chave === 'PENDENCIAS') ? await pendenciasDoAnterior(quem.usuarioId, reuniao?.data ?? null, agora) : null
  const todos = pessoas.vendedores.filter(v => v.ativo)
  const blocos = []
  for (const b of cfg) {
    const [numeros, recs] = b.chave === 'PENDENCIAS' ? [[], []] : await Promise.all([numerosDoBloco(b.chave, quem, modo, equipe, agora, meta), recsDoBloco(b.chave, quem, modo)])
    // Gestão: o supervisor e a equipe veem só as quantidades (sem R$ e sem as Recomendações da área).
    const atividades = modo === 'GESTAO' ? criticas.filter(a => a.bloco === b.chave && (b.chave !== 'GESTAO' || quem.papel === 'DONO')).slice(0, 10) : []
    // Modo equipe: itens individuais (sobre uma pessoa) não aparecem; o resto aparece sem quem enviou.
    const enviados = itensPauta.filter(i => i.bloco === b.chave && (modo === 'GESTAO' || i.refTipo !== 'PESSOA')).map(i => ({
      id: i.id, origem: i.origem, texto: i.texto, detalhe: i.detalhe, refTipo: i.refTipo, refId: i.refId,
      enviadoPor: modo === 'GESTAO' ? i.enviadoPorNome : null, enviadoEm: i.enviadoEm, motivoAdiamento: i.motivoAdiamento,
      situacao: i.reuniaoId === reuniao?.id && i.situacao !== 'ABERTO' ? i.situacao : 'ABERTO',
    }))
    const resolvidos = ata ? [
      ...ata.tratados.filter(t => t.bloco === b.chave).map(t => ({ tipo: t.tipo, ref: t.ref, situacao: 'TRATADO' as const })),
      ...(ata.adiados ?? []).filter(t => t.bloco === b.chave).map(t => ({ tipo: t.tipo, ref: t.ref, situacao: 'ADIADO' as const })),
      ...ata.decisoes.filter(t => t.bloco === b.chave && t.itemRef).map(t => ({ tipo: t.itemTipo ?? 'ITEM', ref: t.itemRef ?? null, situacao: 'DECIDIDO' as const })),
    ] : []
    let pendencias = null
    if (b.chave === 'PENDENCIAS' && pend) {
      const cont = (s: SituacaoPendencia) => pend.itens.filter(i => i.situacao === s).length
      pendencias = {
        reuniao: pend.reuniao, total: pend.itens.length,
        feitas: cont('FEITA'), atrasadas: cont('ATRASADA'), venceHoje: cont('VENCE_HOJE'), noPrazo: cont('NO_PRAZO'),
        // Modo equipe: só os totais (sem nomes).
        itens: modo === 'GESTAO' ? pend.itens : [],
      }
    }
    const semSdr = b.chave === 'PRE_VENDA' && !equipe.some(v => v.papel === 'SDR')
    const semSm = b.chave === 'SOCIAL' && !papeis.socialMedia
    blocos.push({
      chave: b.chave, nome: NOME_BLOCO[b.chave], minutos: b.minutos, numeros, recs, atividades, enviados, resolvidos, pendencias,
      decididas: decididas.filter(a => a.origemId?.split('|')[2] === b.chave).map(a => ({ id: a.id, codigo: a.codigo, oQue: a.oQueFazer, prazo: a.prazo, responsavel: pessoas.nomeDe(a.responsavelId) })),
      responsavelSugerido: sugeridos[b.chave],
      semPessoa: semSm ? 'Sem social media cadastrado: as atividades vão para o dono.' : semSdr ? 'Sem SDR cadastrado: as atividades vão para quem qualifica os leads hoje.' : null,
    })
  }
  return {
    modo, geradoEm: agora, papel: quem.papel, reuniao: reuniao ? { id: reuniao.id, ata: reuniao.ata } : null,
    totalMinutos: cfg.reduce((t, b) => t + b.minutos, 0), blocos,
    meta: meta ? { previsao: modo === 'GESTAO' && quem.papel === 'DONO' ? meta.previsao : null, pct: meta.pct, faixa: meta.faixa, ritmo: meta.ritmo } : null,
    // Responsáveis possíveis no "Decidido": o dono e toda a equipe ativa, inclusive tráfego e financeiro.
    equipe: [{ id: pessoas.dono.id, nome: `${pessoas.dono.nome} (dono)` }, ...todos.map(v => ({ id: v.id, nome: `${pessoas.nomeDe(v.id)}${v.funcao === 'GESTOR_TRAFEGO' ? ' (tráfego)' : v.funcao === 'FINANCEIRO' ? ' (financeiro)' : ''}` }))],
  }
}

// --- Reunião: iniciar, decidir, tratar, adiar, tempo do bloco e encerrar com a ata ---

type TipoItem = 'REC' | 'ATV' | 'NUMERO' | 'ITEM' | 'PENDENCIA'
interface Ata {
  inicio: string; modo: ModoDaily; conduziu: string; conduziuId?: string
  participantes?: Array<{ id: string; nome: string }>
  apresentacaoId?: string | null
  blocos: Array<{ chave: BlocoChave; segundos: number; pulado: boolean }>
  tratados: Array<{ bloco: BlocoChave; tipo: TipoItem; ref: string | null; texto: string; individual?: boolean }>
  adiados?: Array<{ bloco: BlocoChave; tipo: TipoItem; ref: string | null; texto: string; motivo: string; itemId: string }>
  decisoes: Array<{ bloco: BlocoChave; atividadeId: string; codigo: string | null; texto: string; responsavel: string; responsavelId?: string; prazo: string; prioridade?: string; decisaoId?: string; itemTipo?: TipoItem; itemRef?: string | null }>
  numeros?: Array<{ bloco: BlocoChave; rotulo: string; texto: string }>
  whatsapp?: Array<{ responsavel: string; enviado: boolean }>
  fim?: string
}
async function reuniaoAberta(quem: Leitor, id: string) {
  const r = await prisma.reuniao.findFirst({ where: { id, usuarioId: quem.usuarioId, tipo: 'DAILY' } })
  if (!r) throw new ErroDaily(404, 'Reunião não encontrada')
  if ((r.ata as unknown as Ata | null)?.fim) throw new ErroDaily(409, 'Esta reunião já foi encerrada')
  return r
}
const salvarAta = (id: string, ata: Ata) => prisma.reuniao.update({ where: { id }, data: { ata: ata as unknown as Prisma.InputJsonValue } })

export async function iniciarDaily(quem: Leitor, modo: ModoDaily, agora = new Date(), opcoes: { participantes?: string[]; transmitir?: boolean } = {}) {
  if (quem.papel !== 'DONO' && quem.papel !== 'SUPERVISOR') throw new ErroDaily(403, 'O Daily é aberto pelo dono e pelo supervisor')
  const pessoas = await pessoasDaConta(quem.usuarioId)
  const ids = opcoes.participantes?.length ? opcoes.participantes : pessoas.vendedores.filter(v => v.ativo).map(v => v.id)
  const participantes = [...new Set([quem.vendedorId ?? quem.usuarioId, ...ids])].filter(id => id === quem.usuarioId || pessoas.vendedores.some(v => v.id === id && v.ativo)).map(id => ({ id, nome: pessoas.nomeDe(id) }))
  const ata: Ata = { inicio: agora.toISOString(), modo, conduziu: quem.nome, conduziuId: quem.vendedorId ?? quem.usuarioId, participantes, blocos: [], tratados: [], adiados: [], decisoes: [] }
  const dia = new Date(agora.getTime() - 3 * 3_600_000).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
  const titulo = `Daily ${dia}${modo === 'EQUIPE' ? ' (com a equipe)' : ''}`
  // Transmissão: uma apresentação ao vivo de Reuniões, que o espectador abre pelo link (sempre no modo equipe).
  if (opcoes.transmitir) {
    const ap = await prisma.apresentacao.create({
      data: {
        usuarioId: quem.usuarioId, titulo, descricao: 'Daily ao vivo · modo equipe', icone: '📋', arvore: { id: 'raiz', text: titulo, children: [] },
        configuracao: { tipo: 'DAILY' }, visivelEquipe: true, aprovacao: 'APROVADA',
        autorPessoa: quem.vendedorId ? `vendedor:${quem.vendedorId}` : null, autorNome: quem.nome, aoVivo: true, aoVivoDesde: agora, apresentadorSinalEm: agora,
      },
      select: { id: true },
    })
    ata.apresentacaoId = ap.id
  }
  const r = await prisma.reuniao.create({ data: { usuarioId: quem.usuarioId, vendedorId: quem.vendedorId, titulo, tipo: 'DAILY', data: agora, modo, autorId: quem.vendedorId ?? quem.usuarioId, ata: ata as unknown as Prisma.InputJsonValue }, select: { id: true, titulo: true, modo: true } })
  if (ata.apresentacaoId) await prisma.apresentacao.update({ where: { id: ata.apresentacaoId }, data: { configuracao: { tipo: 'DAILY', reuniaoId: r.id } } })
  return { ...r, apresentacaoId: ata.apresentacaoId ?? null, participantes }
}

/** Palco da transmissão: o slide do bloco atual no modo equipe (montado pela tela de quem conduz a partir da pauta equipe). */
export async function palcoDoDaily(quem: Leitor, reuniaoId: string, palco: unknown) {
  const r = await reuniaoAberta(quem, reuniaoId)
  const ap = (r.ata as unknown as Ata).apresentacaoId
  if (!ap) throw new ErroDaily(409, 'Este Daily não está sendo transmitido')
  const json = JSON.stringify(palco ?? null)
  if (json.length > 60_000) throw new ErroDaily(400, 'Palco grande demais')
  await prisma.apresentacao.update({ where: { id: ap }, data: { palco: JSON.parse(json) as Prisma.InputJsonValue, palcoVersao: { increment: 1 }, apresentadorSinalEm: new Date(), aoVivo: true } })
  return { ok: true }
}

const PRIORIDADES = ['ALTA', 'MEDIA', 'BAIXA'] as const
export type Prioridade = typeof PRIORIDADES[number]
export async function decidirDaily(quem: Leitor, reuniaoId: string, d: { bloco: BlocoChave; texto: string; responsaveis?: string[]; responsavelId?: string | null; prazo: string; prioridade?: Prioridade; itemTipo?: TipoItem; itemRef?: string | null }) {
  const r = await reuniaoAberta(quem, reuniaoId)
  if (!NOME_BLOCO[d.bloco]) throw new ErroDaily(400, 'Bloco desconhecido')
  const texto = d.texto.trim()
  if (texto.length < 3) throw new ErroDaily(400, 'Escreva o que foi decidido')
  // PDF 06 · 4.3: responsável obrigatório (uma ou mais pessoas) e prazo obrigatório.
  const ids = [...new Set(d.responsaveis ?? (d.responsavelId ? [d.responsavelId] : []))]
  if (!ids.length) throw new ErroDaily(400, 'Escolha quem vai fazer (uma ou mais pessoas)')
  if (!d.prazo || Number.isNaN(new Date(d.prazo.length === 10 ? `${d.prazo}T12:00:00Z` : d.prazo).getTime())) throw new ErroDaily(400, 'Escolha o prazo')
  const pessoas = await pessoasDaConta(quem.usuarioId)
  for (const id of ids) if (id !== quem.usuarioId && !pessoas.vendedores.some(v => v.id === id && v.ativo)) throw new ErroDaily(400, 'Responsável não encontrado')
  const prioridade: Prioridade = PRIORIDADES.includes(d.prioridade as Prioridade) ? d.prioridade! : 'MEDIA'
  // Correção 9: vence no fim do expediente do dia escolhido.
  const prazo = prazoDoDiaEscolhido(d.prazo, await lerExpediente(quem.usuarioId))
  const ata = r.ata as unknown as Ata
  const decisao = await prisma.dailyDecisao.create({ data: { usuarioId: quem.usuarioId, reuniaoId: r.id, bloco: d.bloco, itemId: d.itemRef ?? null, itemTipo: d.itemTipo ?? null, texto, responsaveis: ids, prazo, prioridade } })
  const criadas: Array<{ id: string; codigo: string | null; responsavel: string }> = []
  for (const id of ids) {
    const atv = await prisma.atividade.create({
      data: {
        usuarioId: quem.usuarioId, auditoriaAutor: `${quem.nome} (Daily)`, tipo: 'DECISAO_REUNIAO', origemTipo: 'REUNIAO', origemId: `daily|${r.id}|${d.bloco}`,
        responsavelId: id, prazo, oQueFazer: prioridade === 'ALTA' ? `Prioridade alta: ${texto}` : texto, registroTabela: 'pro_labore_reunioes', registroId: `${r.id}|${randomUUID()}`,
      },
      select: { id: true, codigo: true },
    })
    criadas.push({ ...atv, responsavel: pessoas.nomeDe(id) })
    ata.decisoes.push({ bloco: d.bloco, atividadeId: atv.id, codigo: atv.codigo, texto, responsavel: pessoas.nomeDe(id), responsavelId: id, prazo: prazo.toISOString(), prioridade, decisaoId: decisao.id, itemTipo: d.itemTipo, itemRef: d.itemRef ?? null })
  }
  await prisma.dailyDecisao.update({ where: { id: decisao.id }, data: { atividadeIds: criadas.map(c => c.id) } })
  if (d.itemTipo === 'ITEM' && d.itemRef) await prisma.dailyItem.updateMany({ where: { id: d.itemRef, usuarioId: quem.usuarioId }, data: { situacao: 'DECIDIDO', reuniaoId: r.id, resolvidoEm: new Date() } })
  await salvarAta(r.id, ata)
  return { decisao: { id: decisao.id, prazo, prioridade }, atividades: criadas, atividade: criadas[0], responsavel: criadas.map(c => c.responsavel).join(', ') }
}
export async function tratarDaily(quem: Leitor, reuniaoId: string, d: { bloco: BlocoChave; tipo: TipoItem; ref: string | null; texto: string; individual?: boolean }) {
  const r = await reuniaoAberta(quem, reuniaoId)
  const ata = r.ata as unknown as Ata
  if (!ata.tratados.some(t => t.bloco === d.bloco && t.ref === d.ref && t.tipo === d.tipo)) ata.tratados.push({ bloco: d.bloco, tipo: d.tipo, ref: d.ref, texto: d.texto.slice(0, 300), individual: !!d.individual })
  if (d.tipo === 'ITEM' && d.ref) await prisma.dailyItem.updateMany({ where: { id: d.ref, usuarioId: quem.usuarioId }, data: { situacao: 'TRATADO', reuniaoId: r.id, resolvidoEm: new Date() } })
  await salvarAta(r.id, ata)
  return { tratados: ata.tratados.length }
}
/** Adiar: o item vai para a pauta do próximo Daily, no mesmo bloco, com o motivo. */
export async function adiarDaily(quem: Leitor, reuniaoId: string, d: { bloco: BlocoChave; tipo: TipoItem; ref: string | null; texto: string; motivo: string }) {
  const r = await reuniaoAberta(quem, reuniaoId)
  const motivo = d.motivo.trim()
  if (motivo.length < 3) throw new ErroDaily(400, 'Escreva o motivo do adiamento')
  const ata = r.ata as unknown as Ata
  ata.adiados ??= []
  if (ata.adiados.some(t => t.bloco === d.bloco && t.ref === d.ref && t.tipo === d.tipo)) return { adiados: ata.adiados.length }
  let detalhe: string | null = null, refTipo: string | null = d.tipo === 'REC' ? 'REC' : d.tipo === 'ATV' ? 'ATV' : d.tipo === 'NUMERO' ? 'METRICA' : null, refId: string | null = d.ref
  if (d.tipo === 'ITEM' && d.ref) {
    const it = await prisma.dailyItem.findFirst({ where: { id: d.ref, usuarioId: quem.usuarioId } })
    if (it) { detalhe = it.detalhe; refTipo = it.refTipo; refId = it.refId; await prisma.dailyItem.update({ where: { id: it.id }, data: { situacao: 'ADIADO', reuniaoId: r.id, motivoAdiamento: motivo, resolvidoEm: new Date() } }) }
  }
  const novo = await prisma.dailyItem.create({ data: { usuarioId: quem.usuarioId, bloco: d.bloco === 'PENDENCIAS' ? 'RESULTADO' : d.bloco, origem: 'ADIADO', texto: d.texto.slice(0, 300), detalhe, refTipo, refId, enviadoPorId: quem.vendedorId ?? quem.usuarioId, enviadoPorNome: quem.nome, motivoAdiamento: motivo, adiadoDeId: r.id } })
  ata.adiados.push({ bloco: d.bloco, tipo: d.tipo, ref: d.ref, texto: d.texto.slice(0, 300), motivo, itemId: novo.id })
  await salvarAta(r.id, ata)
  return { adiados: ata.adiados.length, item: novo.id }
}
export async function tempoDoBloco(quem: Leitor, reuniaoId: string, d: { bloco: BlocoChave; segundos: number; pulado: boolean }) {
  const r = await reuniaoAberta(quem, reuniaoId)
  const ata = r.ata as unknown as Ata
  const i = ata.blocos.findIndex(b => b.chave === d.bloco)
  const item = { chave: d.bloco, segundos: Math.max(0, Math.round(d.segundos)), pulado: !!d.pulado }
  if (i >= 0) ata.blocos[i] = item; else ata.blocos.push(item)
  await salvarAta(r.id, ata)
  return item
}
const fmt = (v: number | null, u: string) => fmtValor(v, u)
const dataBr = (iso: string | Date) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' })
const horaBr = (iso: string | Date) => new Date(iso).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })
const PRIORIDADE_NOME: Record<string, string> = { ALTA: 'alta', MEDIA: 'média', BAIXA: 'baixa' }

/** Mensagem do WhatsApp com as tarefas da pessoa (texto pelo código). */
export function textoTarefas(nome: string, titulo: string, tarefas: Ata['decisoes']) {
  return [`📋 *${titulo}: suas tarefas*`, `Oi, ${primeiro(nome)}! Ficou com você:`, '', ...tarefas.map(t => `• ${t.texto} — até ${dataBr(t.prazo)} às ${horaBr(t.prazo)}${t.prioridade === 'ALTA' ? ' (prioridade alta)' : ''}${t.codigo ? ` · ${t.codigo}` : ''}`), '', 'Elas já estão na sua agenda, em Atividades.'].join('\n')
}

/** Encerra: a ata é montada pelo código e salva em Reuniões; cada responsável recebe as tarefas no WhatsApp. */
export async function encerrarDaily(quem: Leitor, reuniaoId: string, agora = new Date(), opcoes: { enviarWhatsapp?: boolean } = {}) {
  const r = await reuniaoAberta(quem, reuniaoId)
  const ata = r.ata as unknown as Ata
  ata.fim = agora.toISOString()
  // Retrato dos números no fim da reunião (modo gestão), sem cifras de quem não é o dono.
  if (ata.modo === 'GESTAO') {
    const p = await pautaDaily(quem, 'GESTAO', null, agora).catch(() => null)
    ata.numeros = p?.blocos.flatMap(b => b.numeros.map(n => ({ bloco: b.chave, rotulo: n.rotulo, texto: n.texto ?? fmt(n.valor, n.unidade) }))) ?? []
  }
  const linhas: string[] = [`${r.titulo} · conduzida por ${ata.conduziu} · ${ata.modo === 'EQUIPE' ? 'modo equipe' : 'modo gestão'}`]
  if (ata.participantes?.length) linhas.push(`Participantes: ${ata.participantes.map(p => p.nome).join(', ')}`)
  const ordem = (await configDaily(quem.usuarioId)).map(b => b.chave)
  for (const b of ordem) {
    const t = ata.blocos.find(x => x.chave === b)
    const dec = ata.decisoes.filter(x => x.bloco === b)
    const trat = ata.modo === 'EQUIPE' ? [] : ata.tratados.filter(x => x.bloco === b)
    const adi = (ata.adiados ?? []).filter(x => x.bloco === b)
    const nums = ata.modo === 'EQUIPE' ? [] : (ata.numeros ?? []).filter(x => x.bloco === b)
    if (!t && !dec.length && !trat.length && !nums.length && !adi.length) continue
    if (ata.modo === 'EQUIPE' && !dec.length && !adi.length) continue
    linhas.push('', `${NOME_BLOCO[b]}${t ? (t.pulado ? ' (pulado)' : ` · ${Math.max(1, Math.round(t.segundos / 60))} min`) : ''}`)
    for (const n of nums) linhas.push(`  ${n.rotulo}: ${n.texto}`)
    for (const x of trat) linhas.push(`  Tratado: ${x.texto}`)
    // Uma decisão com várias pessoas aparece numa linha só, com todos os responsáveis.
    const porDecisao = new Map<string, typeof dec>()
    for (const x of dec) porDecisao.set(x.decisaoId ?? x.atividadeId, [...(porDecisao.get(x.decisaoId ?? x.atividadeId) ?? []), x])
    for (const xs of porDecisao.values()) linhas.push(`  Decidido: ${xs[0].texto} — ${xs.map(x => x.responsavel).join(', ')}, até ${dataBr(xs[0].prazo)} às ${horaBr(xs[0].prazo)}${xs[0].prioridade ? ` · prioridade ${PRIORIDADE_NOME[xs[0].prioridade]}` : ''} (${xs.map(x => x.codigo).filter(Boolean).join(', ')})`)
    for (const x of adi) linhas.push(`  Adiado para o próximo Daily: ${x.texto} — motivo: ${x.motivo}`)
  }
  if (!ata.decisoes.length) linhas.push('', 'Nenhuma decisão registrada.')
  // WhatsApp: a lista de tarefas de cada responsável, com os prazos.
  const porPessoa = new Map<string, Ata['decisoes']>()
  for (const x of ata.decisoes) { const id = x.responsavelId ?? quem.usuarioId; porPessoa.set(id, [...(porPessoa.get(id) ?? []), x]) }
  ata.whatsapp = []
  if (opcoes.enviarWhatsapp !== false) {
    for (const [id, tarefas] of porPessoa) {
      const enviado = await avisarNoWhatsapp(quem.usuarioId, id === quem.usuarioId ? null : id, textoTarefas(tarefas[0].responsavel, r.titulo, tarefas)).catch(() => false)
      ata.whatsapp.push({ responsavel: tarefas[0].responsavel, enviado })
    }
  }
  const segundos = Math.round((agora.getTime() - new Date(ata.inicio).getTime()) / 1000)
  await prisma.reuniao.update({ where: { id: r.id }, data: { ata: ata as unknown as Prisma.InputJsonValue, transcricao: linhas.join('\n'), duracaoSegundos: segundos } })
  if (ata.apresentacaoId) await prisma.apresentacao.update({ where: { id: ata.apresentacaoId }, data: { aoVivo: false, palco: Prisma.DbNull, palcoVersao: { increment: 1 } } }).catch(() => undefined)
  // Resumo final para quem conduziu: quantas decisões, para quem e o tempo de cada bloco.
  const decisoesUnicas = new Set(ata.decisoes.map(x => x.decisaoId ?? x.atividadeId)).size
  const resumo = {
    decisoes: decisoesUnicas, atividades: ata.decisoes.length,
    porPessoa: [...porPessoa.values()].map(t => ({ nome: t[0].responsavel, tarefas: t.length, whatsapp: ata.whatsapp?.find(w => w.responsavel === t[0].responsavel)?.enviado ?? false })),
    blocos: ordem.map(b => { const t = ata.blocos.find(x => x.chave === b); return t ? { chave: b, nome: NOME_BLOCO[b], segundos: t.segundos, pulado: t.pulado } : null }).filter(Boolean),
    tratados: ata.tratados.length, adiados: ata.adiados?.length ?? 0, segundos,
  }
  return { id: r.id, titulo: r.titulo, texto: linhas.join('\n'), decisoes: decisoesUnicas, resumo }
}

// --- "Pauta do Daily pronta" no resumo da manhã (texto pelo código; sem cifras para o supervisor) ---

export async function textoPautaDaManha(usuarioId: string, papel: 'DONO' | 'SUPERVISOR', vendedorId: string | null, agora = new Date()): Promise<string | null> {
  const p = await pautaDaily({ usuarioId, papel, vendedorId, nome: '' }, 'GESTAO', null, agora).catch(() => null)
  if (!p || !p.blocos.length) return null
  const pontos: string[] = []
  for (const b of p.blocos) {
    if (b.chave === 'PENDENCIAS') { if (b.pendencias?.atrasadas) pontos.push(`• ${b.nome}: ${b.pendencias.atrasadas} atrasada(s) de ${b.pendencias.total}`); continue }
    const ruins = b.numeros.filter(n => n.status === 'CRITICO' || n.status === 'ATENCAO')
    if (ruins.length) pontos.push(`• ${b.nome}: ${ruins.map(n => `${n.rotulo.toLowerCase()} ${n.texto ?? fmt(n.valor, n.unidade)}`).join('; ')}`)
    else if (b.enviados.length) pontos.push(`• ${b.nome}: ${b.enviados[0].texto}`)
    else if (b.recs.length) pontos.push(`• ${b.nome}: ${b.recs[0].titulo}`)
  }
  const atrasadas = p.blocos.reduce((t, b) => t + b.atividades.filter(a => a.atrasada).length, 0)
  return [`📋 *Pauta do Daily pronta* (${p.totalMinutos} min, ${p.blocos.length} blocos).`, ...(pontos.length ? pontos.slice(0, 5) : ['• Nenhum número fora do normal hoje.']), ...(atrasadas ? [`• ${atrasadas} ${atrasadas === 1 ? 'atividade atrasada' : 'atividades atrasadas'} para tratar.`] : []), 'Abra em Hoje › Daily.'].join('\n')
}
