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
import { randomUUID } from 'crypto'
import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { FICHAS_PADRAO, hojeBrt, ler, mesCorrente, calcular, metaDoMes, type Escopo, type Papel, type Periodo } from './metricas'
import { papeisDaConta } from './detectoresOnda4'

export type BlocoChave = 'RESULTADO' | 'PRE_VENDA' | 'CREDITO' | 'VENDEDORES' | 'TRAFEGO' | 'SOCIAL' | 'REATIVACAO' | 'GESTAO'
export type ModoDaily = 'GESTAO' | 'EQUIPE'
export interface BlocoCfg { chave: BlocoChave; minutos: number; ligado: boolean }
export const NOME_BLOCO: Record<BlocoChave, string> = {
  RESULTADO: 'Resultado', PRE_VENDA: 'Pré-venda (SDR)', CREDITO: 'Crédito', VENDEDORES: 'Vendedores', TRAFEGO: 'Tráfego', SOCIAL: 'Social media', REATIVACAO: 'Reativação', GESTAO: 'Gestão',
}
export const BLOCOS_PADRAO: BlocoCfg[] = [
  { chave: 'RESULTADO', minutos: 3, ligado: true }, { chave: 'PRE_VENDA', minutos: 5, ligado: true }, { chave: 'CREDITO', minutos: 3, ligado: true },
  { chave: 'VENDEDORES', minutos: 7, ligado: true }, { chave: 'TRAFEGO', minutos: 4, ligado: true }, { chave: 'SOCIAL', minutos: 3, ligado: true },
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
  RESULTADO: [
    { chave: 'previsao_fechamento', rotulo: 'Previsão de fechamento contra a meta', periodo: 'MES', alvo: 'META_MES' },
    { chave: 'faturamento', rotulo: 'Vendas e faturamento de ontem', periodo: 'ONTEM', junto: 'vendas', pessoal: true },
    { chave: 'vendas_por_dia_necessarias', rotulo: 'Vendas por dia necessárias', periodo: 'MES' },
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

async function numerosDoBloco(bloco: BlocoChave, quem: Leitor, modo: ModoDaily, equipe: Array<{ id: string; nome: string }>, agora: Date) {
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
    let junto: { nome: string; valor: number | null } | null = null
    if (n.junto) { const j = await ler(n.junto, e, p, agora).catch(() => null); junto = { nome: FICHAS_PADRAO.find(f => f.chave === n.junto)!.nome, valor: j?.valor ?? null } }
    // Por pessoa só no modo gestão.
    let porPessoa: Array<{ id: string; nome: string; valor: number | null }> | null = null
    if (modo === 'GESTAO' && n.pessoal && equipe.length) {
      porPessoa = await Promise.all(equipe.map(async v => {
        const r = await calcular(n.chave, { ...e, vendedorId: v.id }, p, agora).catch(() => null)
        return { id: v.id, nome: primeiro(v.nome), valor: r ? (n.campo ? ((r.detalhe as Record<string, number>)?.[n.campo] ?? null) : r.valor) : null }
      }))
    }
    out.push({ chave: n.chave, rotulo, unidade, melhor: ficha.melhor, periodo: p, tipoPeriodo: n.periodo, valor, anterior, variacao, alvo, status: l.faixa ?? null, junto, porPessoa, naoDefinido: ficha.naoDefinido ?? null, ficha: { definicao: ficha.definicao, formula: ficha.formula } })
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
  const imp = (r: { impacto: unknown }) => Number((r.impacto as { valor?: number } | null)?.valor ?? 0)
  return rs.sort((a, b) => imp(b) - imp(a) || b.criadoEm.getTime() - a.criadoEm.getTime()).slice(0, 3)
    .map(r => ({ id: r.id, codigo: r.codigo, titulo: r.titulo, forca: r.forca, impacto: (r.impacto as { texto?: string } | null)?.texto ?? null, acao: r.acaoSugerida, individual: r.alvoTipo === 'PESSOA' }))
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
  const nomes = new Map((await prisma.vendedor.findMany({ where: { usuarioId }, select: { id: true, nome: true } })).map(v => [v.id, v.nome]))
  const blocoDe = (a: typeof atvs[number]): BlocoChave => {
    if (a.origemTipo === 'REUNIAO') { const b = a.origemId?.split('|')[2] as BlocoChave | undefined; return b && NOME_BLOCO[b] ? b : 'RESULTADO' }
    if (a.origemTipo === 'PAUTA') return 'SOCIAL'
    if (a.origemTipo === 'RECOMENDACAO') return BLOCO_DO_DETECTOR.get(recs.get(a.origemId!.split('|')[0]) ?? '') ?? 'VENDEDORES'
    const l = a.leadId ? leads.get(a.leadId) : null
    if (l?.estagio === 'PERDIDO') return 'REATIVACAO'
    if (a.tipo === 'REFAZER_PRE_ANALISE' || l?.etapa === 'MQL' || l?.etapa === 'SQL') return 'CREDITO'
    if (l && PRE_VENDA.includes(l.etapa ?? 'LEAD')) return 'PRE_VENDA'
    return 'VENDEDORES'
  }
  return atvs.map(a => ({ id: a.id, codigo: a.codigo, oQue: a.oQueFazer ?? a.tipo, prazo: a.prazo, atrasada: a.prazo < agora, responsavelId: a.responsavelId, responsavel: a.responsavelId ? primeiro(nomes.get(a.responsavelId)) || 'Equipe' : 'Dono', cliente: a.leadId ? primeiro(leads.get(a.leadId)?.nomeCliente) : null, bloco: blocoDe(a) }))
}

// --- Responsável sugerido no "Decidido" (área sem pessoa: quem faz o trabalho hoje) ---

async function responsaveisSugeridos(usuarioId: string) {
  const p = await papeisDaConta(usuarioId)
  const sdr = await prisma.vendedor.findFirst({ where: { usuarioId, ativo: true, papel: 'SDR' }, select: { id: true } })
  const sup = p.supervisor
  const r: Record<BlocoChave, string | null> = {
    RESULTADO: sup, PRE_VENDA: sdr?.id ?? sup, CREDITO: sdr?.id ?? sup, VENDEDORES: sup, TRAFEGO: p.trafego, SOCIAL: null, REATIVACAO: sup, GESTAO: p.financeiro,
  }
  return r
}

// --- Pauta ---

export async function pautaDaily(quem: Leitor, modo: ModoDaily, reuniaoId: string | null, agora = new Date()) {
  if (quem.papel !== 'DONO' && quem.papel !== 'SUPERVISOR') throw new ErroDaily(403, 'O Daily é aberto pelo dono e pelo supervisor')
  const cfg = (await configDaily(quem.usuarioId)).filter(b => b.ligado)
  const equipe = (await prisma.vendedor.findMany({ where: { usuarioId: quem.usuarioId, ativo: true, funcao: null }, select: { id: true, nome: true, papel: true, vende: true }, orderBy: { nome: 'asc' } })).filter(v => v.vende || v.papel === 'SDR')
  const [criticas, sugeridos, reuniao] = await Promise.all([
    modo === 'GESTAO' ? atividadesCriticas(quem.usuarioId, agora) : Promise.resolve([]),
    responsaveisSugeridos(quem.usuarioId),
    reuniaoId ? prisma.reuniao.findFirst({ where: { id: reuniaoId, usuarioId: quem.usuarioId, tipo: 'DAILY' }, select: { id: true, ata: true, modo: true } }) : Promise.resolve(null),
  ])
  const decididas = reuniao ? await prisma.atividade.findMany({ where: { usuarioId: quem.usuarioId, origemTipo: 'REUNIAO', origemId: { startsWith: `daily|${reuniao.id}|` } }, select: { id: true, codigo: true, oQueFazer: true, prazo: true, responsavelId: true, origemId: true } }) : []
  // Responsáveis possíveis no "Decidido": toda a equipe ativa, inclusive tráfego e financeiro.
  const todos = await prisma.vendedor.findMany({ where: { usuarioId: quem.usuarioId, ativo: true }, select: { id: true, nome: true, funcao: true }, orderBy: { nome: 'asc' } })
  const nomes = new Map(todos.map(v => [v.id, primeiro(v.nome)]))
  const blocos = []
  for (const b of cfg) {
    const [numeros, recs] = await Promise.all([numerosDoBloco(b.chave, quem, modo, equipe, agora), recsDoBloco(b.chave, quem, modo)])
    // Gestão: o supervisor e a equipe veem só as quantidades (sem R$ e sem as Recomendações da área).
    const atividades = modo === 'GESTAO' ? criticas.filter(a => a.bloco === b.chave && (b.chave !== 'GESTAO' || quem.papel === 'DONO')).slice(0, 10) : []
    blocos.push({
      chave: b.chave, nome: NOME_BLOCO[b.chave], minutos: b.minutos, numeros, recs, atividades,
      decididas: decididas.filter(a => a.origemId?.split('|')[2] === b.chave).map(a => ({ id: a.id, codigo: a.codigo, oQue: a.oQueFazer, prazo: a.prazo, responsavel: a.responsavelId ? nomes.get(a.responsavelId) ?? 'Equipe' : 'Dono' })),
      responsavelSugerido: sugeridos[b.chave],
      semPessoa: (b.chave === 'PRE_VENDA' && !equipe.some(v => v.papel === 'SDR')) || (b.chave === 'SOCIAL' && !(await papeisDaConta(quem.usuarioId)).socialMedia) ? (b.chave === 'SOCIAL' ? 'Sem social media cadastrado: as atividades vão para o dono.' : 'Sem SDR cadastrado: as atividades vão para quem qualifica os leads hoje.') : null,
    })
  }
  return {
    modo, geradoEm: agora, papel: quem.papel, reuniao: reuniao ? { id: reuniao.id, ata: reuniao.ata } : null,
    totalMinutos: cfg.reduce((t, b) => t + b.minutos, 0), blocos,
    equipe: todos.map(v => ({ id: v.id, nome: v.funcao === 'GESTOR_TRAFEGO' ? `${v.nome} (tráfego)` : v.funcao === 'FINANCEIRO' ? `${v.nome} (financeiro)` : v.nome })),
  }
}

// --- Reunião: iniciar, decidir, tratar, tempo do bloco e encerrar com a ata ---

interface Ata {
  inicio: string; modo: ModoDaily; conduziu: string
  blocos: Array<{ chave: BlocoChave; segundos: number; pulado: boolean }>
  tratados: Array<{ bloco: BlocoChave; tipo: 'REC' | 'ATV' | 'NUMERO'; ref: string | null; texto: string; individual?: boolean }>
  decisoes: Array<{ bloco: BlocoChave; atividadeId: string; codigo: string | null; texto: string; responsavel: string; prazo: string }>
  numeros?: Array<{ bloco: BlocoChave; rotulo: string; texto: string }>
  fim?: string
}
async function reuniaoAberta(quem: Leitor, id: string) {
  const r = await prisma.reuniao.findFirst({ where: { id, usuarioId: quem.usuarioId, tipo: 'DAILY' } })
  if (!r) throw new ErroDaily(404, 'Reunião não encontrada')
  if ((r.ata as unknown as Ata | null)?.fim) throw new ErroDaily(409, 'Esta reunião já foi encerrada')
  return r
}
export async function iniciarDaily(quem: Leitor, modo: ModoDaily, agora = new Date()) {
  if (quem.papel !== 'DONO' && quem.papel !== 'SUPERVISOR') throw new ErroDaily(403, 'O Daily é aberto pelo dono e pelo supervisor')
  const ata: Ata = { inicio: agora.toISOString(), modo, conduziu: quem.nome, blocos: [], tratados: [], decisoes: [] }
  const dia = new Date(agora.getTime() - 3 * 3_600_000).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
  return prisma.reuniao.create({ data: { usuarioId: quem.usuarioId, vendedorId: quem.vendedorId, titulo: `Daily ${dia}${modo === 'EQUIPE' ? ' (com a equipe)' : ''}`, tipo: 'DAILY', data: agora, modo, autorId: quem.vendedorId ?? quem.usuarioId, ata: ata as unknown as Prisma.InputJsonValue }, select: { id: true, titulo: true, modo: true } })
}
export async function decidirDaily(quem: Leitor, reuniaoId: string, d: { bloco: BlocoChave; texto: string; responsavelId: string | null; prazo: string }) {
  const r = await reuniaoAberta(quem, reuniaoId)
  if (!NOME_BLOCO[d.bloco]) throw new ErroDaily(400, 'Bloco desconhecido')
  const prazo = new Date(d.prazo)
  if (Number.isNaN(prazo.getTime())) throw new ErroDaily(400, 'Escolha o prazo')
  const texto = d.texto.trim()
  if (texto.length < 3) throw new ErroDaily(400, 'Escreva o que foi decidido')
  let nome = 'Dono'
  if (d.responsavelId) {
    const v = await prisma.vendedor.findFirst({ where: { id: d.responsavelId, usuarioId: quem.usuarioId, ativo: true }, select: { nome: true } })
    if (!v) throw new ErroDaily(400, 'Responsável não encontrado')
    nome = primeiro(v.nome)
  }
  const atv = await prisma.atividade.create({
    data: {
      usuarioId: quem.usuarioId, auditoriaAutor: `${quem.nome} (Daily)`, tipo: 'DECISAO_REUNIAO', origemTipo: 'REUNIAO', origemId: `daily|${r.id}|${d.bloco}`,
      responsavelId: d.responsavelId, prazo, oQueFazer: texto, registroTabela: 'pro_labore_reunioes', registroId: `${r.id}|${randomUUID()}`,
    },
    select: { id: true, codigo: true },
  })
  const ata = r.ata as unknown as Ata
  ata.decisoes.push({ bloco: d.bloco, atividadeId: atv.id, codigo: atv.codigo, texto, responsavel: nome, prazo: prazo.toISOString() })
  await prisma.reuniao.update({ where: { id: r.id }, data: { ata: ata as unknown as Prisma.InputJsonValue } })
  return { atividade: atv, responsavel: nome }
}
export async function tratarDaily(quem: Leitor, reuniaoId: string, d: { bloco: BlocoChave; tipo: 'REC' | 'ATV' | 'NUMERO'; ref: string | null; texto: string; individual?: boolean }) {
  const r = await reuniaoAberta(quem, reuniaoId)
  const ata = r.ata as unknown as Ata
  if (!ata.tratados.some(t => t.bloco === d.bloco && t.ref === d.ref && t.tipo === d.tipo)) ata.tratados.push({ bloco: d.bloco, tipo: d.tipo, ref: d.ref, texto: d.texto.slice(0, 300), individual: !!d.individual })
  await prisma.reuniao.update({ where: { id: r.id }, data: { ata: ata as unknown as Prisma.InputJsonValue } })
  return { tratados: ata.tratados.length }
}
export async function tempoDoBloco(quem: Leitor, reuniaoId: string, d: { bloco: BlocoChave; segundos: number; pulado: boolean }) {
  const r = await reuniaoAberta(quem, reuniaoId)
  const ata = r.ata as unknown as Ata
  const i = ata.blocos.findIndex(b => b.chave === d.bloco)
  const item = { chave: d.bloco, segundos: Math.max(0, Math.round(d.segundos)), pulado: !!d.pulado }
  if (i >= 0) ata.blocos[i] = item; else ata.blocos.push(item)
  await prisma.reuniao.update({ where: { id: r.id }, data: { ata: ata as unknown as Prisma.InputJsonValue } })
  return item
}
const fmt = (v: number | null, u: string) => v == null ? '—' : u === 'BRL' ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : u === 'PCT' ? `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : u === 'MIN' ? `${Math.round(v)} min` : u === 'X' ? `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}x` : v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
/** Encerra: a ata é montada pelo código. No modo equipe, só o que foi decidido. */
export async function encerrarDaily(quem: Leitor, reuniaoId: string, agora = new Date()) {
  const r = await reuniaoAberta(quem, reuniaoId)
  const ata = r.ata as unknown as Ata
  ata.fim = agora.toISOString()
  // Retrato dos números no fim da reunião (modo gestão), sem cifras de quem não é o dono.
  if (ata.modo === 'GESTAO') {
    const p = await pautaDaily(quem, 'GESTAO', null, agora).catch(() => null)
    ata.numeros = p?.blocos.flatMap(b => b.numeros.map(n => ({ bloco: b.chave, rotulo: n.rotulo, texto: fmt(n.valor, n.unidade) }))) ?? []
  }
  const linhas: string[] = [`${r.titulo} · conduzida por ${ata.conduziu} · ${ata.modo === 'EQUIPE' ? 'modo equipe' : 'modo gestão'}`]
  const ordem = (await configDaily(quem.usuarioId)).map(b => b.chave)
  for (const b of ordem) {
    const t = ata.blocos.find(x => x.chave === b)
    const dec = ata.decisoes.filter(x => x.bloco === b)
    const trat = ata.modo === 'EQUIPE' ? [] : ata.tratados.filter(x => x.bloco === b)
    const nums = ata.modo === 'EQUIPE' ? [] : (ata.numeros ?? []).filter(x => x.bloco === b)
    if (!t && !dec.length && !trat.length && !nums.length) continue
    if (ata.modo === 'EQUIPE' && !dec.length) continue
    linhas.push('', `${NOME_BLOCO[b]}${t ? (t.pulado ? ' (pulado)' : ` · ${Math.round(t.segundos / 60)} min`) : ''}`)
    for (const n of nums) linhas.push(`  ${n.rotulo}: ${n.texto}`)
    for (const x of trat) linhas.push(`  Tratado: ${x.texto}`)
    for (const x of dec) linhas.push(`  Decidido: ${x.texto} — ${x.responsavel}, até ${new Date(x.prazo).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}${x.codigo ? ` (${x.codigo})` : ''}`)
  }
  if (!ata.decisoes.length) linhas.push('', 'Nenhuma decisão registrada.')
  const segundos = Math.round((agora.getTime() - new Date(ata.inicio).getTime()) / 1000)
  await prisma.reuniao.update({ where: { id: r.id }, data: { ata: ata as unknown as Prisma.InputJsonValue, transcricao: linhas.join('\n'), duracaoSegundos: segundos } })
  return { id: r.id, titulo: r.titulo, texto: linhas.join('\n'), decisoes: ata.decisoes.length }
}

// --- "Pauta do Daily pronta" no resumo da manhã (texto pelo código; sem cifras para o supervisor) ---

export async function textoPautaDaManha(usuarioId: string, papel: 'DONO' | 'SUPERVISOR', vendedorId: string | null, agora = new Date()): Promise<string | null> {
  const p = await pautaDaily({ usuarioId, papel, vendedorId, nome: '' }, 'GESTAO', null, agora).catch(() => null)
  if (!p || !p.blocos.length) return null
  const pontos: string[] = []
  for (const b of p.blocos) {
    const ruins = b.numeros.filter(n => n.status === 'CRITICO' || n.status === 'ATENCAO')
    if (ruins.length) pontos.push(`• ${b.nome}: ${ruins.map(n => `${n.rotulo.toLowerCase()} ${fmt(n.valor, n.unidade)}`).join('; ')}`)
    else if (b.recs.length) pontos.push(`• ${b.nome}: ${b.recs[0].titulo}`)
  }
  const atrasadas = p.blocos.reduce((t, b) => t + b.atividades.filter(a => a.atrasada).length, 0)
  return [`📋 *Pauta do Daily pronta* (${p.totalMinutos} min, ${p.blocos.length} blocos).`, ...(pontos.length ? pontos.slice(0, 5) : ['• Nenhum número fora do normal hoje.']), ...(atrasadas ? [`• ${atrasadas} atividade(s) atrasada(s) para tratar.`] : []), 'Abra em Hoje › Daily.'].join('\n')
}
