// PDF 07 · Central de Conhecimento — catálogo de TODOS os dados do Pró-Labore.
// Gerado do próprio banco (Prisma DMMF): toda tabela pro_labore_* vira uma "entidade" que o
// Pergunte pode listar, filtrar, ordenar, contar e somar, sem SQL da IA e com as mesmas regras:
// - P1: campos de dinheiro voltam como espaço reservado ({{vN}}), inclusive somas e médias;
//   CPF, nascimento, senha, token, e-mail, endereço, documento e localização nunca saem;
//   telefone só com os 4 últimos dígitos; campos JSON não saem.
// - Texto das conversas, notas da negociação, Processo e anotações não vão à IA (D5).
// - P7: o dono vê tudo; os demais papéis só as entidades liberadas a eles, com o escopo
//   pessoal (vendedor e SDR veem só o que é deles) aplicado no servidor.
import { Prisma } from '@prisma/client'
import { prisma } from '../prisma'
import type { CtxCentral } from './contexto'
import type { Reservas } from './consultas'

type Campo = Prisma.DMMF.Field
type Modelo = Prisma.DMMF.Model
type Where = Record<string, unknown>

const MODELOS: Modelo[] = Prisma.dmmf.datamodel.models.filter(m => (m.dbName ?? '').startsWith('pro_labore_')) as Modelo[]
const porNome = new Map(MODELOS.map(m => [m.name, m]))

// --- Regras de campo (por nome, em todas as tabelas) ---
const OCULTO = /^(cpf|nascimento|senhaHash|senhaVersao|hash|conviteHash|accessToken|auth|endpoint|segredo|webhookSegredo|email|endereco|documento|latitude|longitude|instancia|blobUrl|documentoGeradoUrl|p256dh|auditoriaAutor)$/i
const TELEFONE = /^(telefone|numeroContato|numeroWhatsapp|whatsappLoja|contato)$/
const DINHEIRO = new Set(['custoPorLeadTopo', 'entrada', 'gasto', 'margemContribuicaoVenda', 'metaCusto', 'metaFaturamentoAnual', 'metaFaturamentoMensal', 'metaMensal', 'metaMensalPadrao', 'orcamentoAnuncioMensal', 'orcamentoMarketing', 'parcela', 'preco', 'resultadoValor', 'salarioBase', 'tetoComissaoPadrao', 'tetoComissaoPorVenda', 'tetoComissaoRenegociacao', 'tetoProLaborePorVenda', 'tetoProLaboreRenegociacao', 'ticketMedio', 'valor', 'valorComissao', 'valorInicial', 'valorNegociacao', 'valorProLabore', 'valorTotal', 'valorVenda', 'limite', 'renda', 'valorParcela', 'valorEntrada'])

// Entidades que nunca vão à IA (P1, D5): o motivo aparece se alguém pedir.
const BLOQUEADAS: Record<string, string> = {
  LeadNota: 'notas da negociação não vão à IA',
  ProcessoAtendimento: 'a aba Processo não vai à IA',
  Nota: 'anotações são privadas de quem escreveu',
  Pasta: 'anotações são privadas de quem escreveu',
  MapaMental: 'anotações são privadas de quem escreveu',
  MapaMentalVersao: 'anotações são privadas de quem escreveu',
  ApresentacaoNotaPessoal: 'notas pessoais são privadas',
  InicioNota: 'notas do Início são da equipe, fora da IA',
  AgenteMensagem: 'o texto das conversas com o Aries no WhatsApp não vai à IA',
  IaEnvio: 'registro do que foi enviado à IA',
  AcessoDadoSensivel: 'registro de acesso a dado sensível',
  CopiaSeguranca: 'cópias de segurança',
  ImportacaoNeon: 'importação técnica',
  SmPushInscricao: 'dado técnico de notificação',
  SmWebhookEvento: 'dado técnico da integração',
  TrafegoPublicoCache: 'cache técnico',
  ProLaboreUsuario: 'conta de acesso',
  CentralEvento: 'fila técnica da Central',
  CentralDocumento: 'índice técnico da Central (use a pesquisa)',
  SmIATexto: 'texto gerado pela IA',
  CopilotoMensagem: 'conversas pessoais com o Copiloto',
  SmAssistenteEstado: 'estado técnico',
  AssistenteAprendizadoEstado: 'estado técnico',
}
// Campos de texto livre de conversa: saem só os metadados (D5).
const CAMPOS_FORA: Record<string, string[]> = {
  AssistenteMensagem: ['texto', 'transcricao', 'midiaUrl', 'legenda'],
  SmMensagem: ['texto', 'midiaUrl'],
  AssistenteConversa: ['resumo', 'ultimaMensagem'],
  Lead: ['observacao', 'notaPerda'],
  Reuniao: ['transcricao'],
  PergunteConversa: ['valores'],
  EventoAuditoria: ['valorAnterior', 'valorNovo'],
}
// Só o dono vê (o pró-labore é do dono).
const SO_DONO_CAMPOS = new Set(['valorProLabore', 'tetoProLaborePorVenda', 'tetoProLaboreRenegociacao', 'pagamentoProLaboreId', 'salarioBase'])

// --- Rótulos (o resto usa o nome técnico) ---
const ROTULO: Record<string, string> = {
  Lead: 'Leads e negociações (CRM)', LeadEstagioHistorico: 'Histórico de etapas dos leads', LeadFollow: 'Follows dos leads', LeadProposta: 'Propostas', LeadVisita: 'Visitas',
  LeadPassagem: 'Passagens ao vendedor', Cliente: 'Clientes', Venda: 'Vendas', PagamentoComissao: 'Pagamentos de comissão e recibos de pró-labore', LancamentoFinanceiro: 'Lançamentos do Financeiro',
  Vendedor: 'Equipe (vendedores, SDRs, supervisores)', Atividade: 'Atividades (ATV)', AgendaItem: 'Agenda (tarefas e rotinas)', AgendaConclusao: 'Conclusões da agenda', Ocorrencia: 'Ocorrências da equipe',
  SmMotoEstoque: 'Estoque de motos', AssistenteConversa: 'Conversas do WhatsApp (metadados)', AssistenteMensagem: 'Mensagens do WhatsApp (só quem mandou e quando)', AssistenteFichaCredito: 'Fichas de crédito',
  AssistenteAnaliseCredito: 'Análises de crédito por banco', AssistenteConhecimento: 'Conhecimento comercial (verbetes)', Recomendacao: 'Recomendações', Reuniao: 'Reuniões', DailyDecisao: 'Decisões do Daily', DailyItem: 'Pauta do Daily',
  TrafegoConta: 'Conta de anúncios (Meta)', TrafegoInsightDiario: 'Resultados diários dos anúncios', TrafegoContaDiario: 'Totais diários da conta de anúncios', TrafegoEstrutura: 'Campanhas, conjuntos e anúncios',
  SocialMediaConta: 'Conta do Instagram (seguidores e dados do perfil)', SocialMediaMidia: 'Posts do Instagram', SocialMediaSnapshotDiario: 'Retrato diário do Instagram (seguidores, alcance)', SmPauta: 'Pautas do Social Media',
  ParametroLiquidez: 'Parâmetros da operação (tetos, metas)', FunilMensal: 'Funil mensal (digitado)', GastoAnuncioMensal: 'Gasto com anúncio mensal (digitado)', LigacaoTarefa: 'Ligações', CadenciaLigacao: 'Cadências de ligação',
  PergunteConversa: 'Perguntas feitas ao ARIES', MetricaVersao: 'Versões das fichas do dicionário', EventoAuditoria: 'Trilha de auditoria (quem mudou o quê)', RodizioLead: 'Rodízio de leads', FechamentoMesVendas: 'Fechamentos do mês de vendas',
}

// --- Permissões por entidade (o dono vê todas; sem regra aqui, só o dono) ---
const TODOS = ['DONO', 'SUPERVISOR', 'SDR', 'VENDEDOR', 'SOCIAL_MEDIA', 'TRAFEGO', 'FINANCEIRO']
interface Acesso {
  papeis: string[]
  modulo?: string
  /** Filtro do escopo (pessoal ou da equipe); null = a pessoa não vê nada desta entidade. */
  escopo?: (ctx: CtxCentral) => Where | null
}
const gestao = (ctx: CtxCentral) => ctx.pessoa.papel === 'DONO' || ctx.pessoa.papel === 'SUPERVISOR'
const doLead = (ctx: CtxCentral): Where | null => (ctx.leads ? { lead: ctx.leads } : null)
const meuVendedor = (ctx: CtxCentral, campo = 'vendedorId'): Where | null => (ctx.pessoal ? { [campo]: ctx.pessoa.vendedorId ?? '__nenhum__' } : {})
const ACESSO: Record<string, Acesso> = {
  Lead: { papeis: ['SUPERVISOR', 'SDR', 'VENDEDOR', 'TRAFEGO'], modulo: 'crm', escopo: ctx => ctx.leads },
  LeadEstagioHistorico: { papeis: ['SUPERVISOR', 'SDR', 'VENDEDOR'], escopo: doLead },
  LeadFollow: { papeis: ['SUPERVISOR', 'SDR', 'VENDEDOR'], escopo: doLead },
  LeadProposta: { papeis: ['SUPERVISOR', 'SDR', 'VENDEDOR'], escopo: doLead },
  LeadVisita: { papeis: ['SUPERVISOR', 'SDR', 'VENDEDOR'], escopo: doLead },
  LeadPassagem: { papeis: ['SUPERVISOR', 'SDR', 'VENDEDOR'], escopo: doLead },
  AssistenteFichaCredito: { papeis: ['SUPERVISOR', 'SDR', 'VENDEDOR'], escopo: doLead },
  LigacaoTarefa: { papeis: ['SUPERVISOR', 'SDR', 'VENDEDOR'], escopo: ctx => meuVendedor(ctx) },
  Cliente: { papeis: ['SUPERVISOR'], modulo: 'crm' },
  Venda: { papeis: ['SUPERVISOR', 'SDR', 'VENDEDOR', 'FINANCEIRO'], escopo: ctx => (ctx.pessoal ? meuVendedor(ctx) : ctx.ve('vendas') ? {} : null) },
  PagamentoComissao: { papeis: ['FINANCEIRO', 'VENDEDOR', 'SDR'], escopo: ctx => (ctx.pessoal ? { vendedorId: ctx.pessoa.vendedorId ?? '__nenhum__', tipo: 'COMISSAO' } : ctx.ve('vendas') ? {} : null) },
  LancamentoFinanceiro: { papeis: ['FINANCEIRO', 'VENDEDOR', 'SDR'], modulo: 'financeiro', escopo: ctx => meuVendedor(ctx) },
  Vendedor: { papeis: TODOS, escopo: ctx => (gestao(ctx) || ctx.ve('vendedores') ? {} : { id: ctx.pessoa.vendedorId ?? '__nenhum__' }) },
  Atividade: { papeis: TODOS, escopo: ctx => (gestao(ctx) ? {} : { responsavelId: ctx.pessoa.vendedorId ?? ctx.pessoa.id }) },
  ReguaRegistro: { papeis: ['SUPERVISOR'] },
  AgendaItem: { papeis: ['SUPERVISOR'], modulo: 'agenda' },
  AgendaConclusao: { papeis: ['SUPERVISOR'], modulo: 'agenda' },
  Ocorrencia: { papeis: ['SUPERVISOR'], modulo: 'ocorrencias' },
  OcorrenciaHistorico: { papeis: ['SUPERVISOR'], modulo: 'ocorrencias' },
  SmMotoEstoque: { papeis: TODOS },
  AssistenteConhecimento: { papeis: TODOS, escopo: ctx => (gestao(ctx) ? {} : { status: 'ATIVO' }) },
  AssistenteConversa: { papeis: ['SUPERVISOR', 'SDR', 'VENDEDOR'], escopo: ctx => (gestao(ctx) ? {} : { assistente: { vendedorId: ctx.pessoa.vendedorId ?? '__nenhum__' } }) },
  AssistenteMensagem: { papeis: ['SUPERVISOR', 'SDR', 'VENDEDOR'], escopo: ctx => (gestao(ctx) ? {} : { conversa: { assistente: { vendedorId: ctx.pessoa.vendedorId ?? '__nenhum__' } } }) },
  Recomendacao: { papeis: TODOS, escopo: ctx => (ctx.pessoa.papel === 'DONO' ? {} : { OR: [{ visivelPara: { has: ctx.pessoa.papel } }, { destinatarioId: ctx.pessoa.id }, { acompanhaIds: { has: ctx.pessoa.id } }] }) },
  Reuniao: { papeis: ['SUPERVISOR', 'SDR', 'VENDEDOR'], modulo: 'reunioes', escopo: ctx => meuVendedor(ctx) },
  DailyDecisao: { papeis: ['SUPERVISOR'] },
  DailyItem: { papeis: ['SUPERVISOR'] },
  TrafegoConta: { papeis: ['TRAFEGO'], modulo: 'trafego' },
  TrafegoInsightDiario: { papeis: ['TRAFEGO'], modulo: 'trafego' },
  TrafegoContaDiario: { papeis: ['TRAFEGO'], modulo: 'trafego' },
  TrafegoEstrutura: { papeis: ['TRAFEGO'], modulo: 'trafego' },
  TrafegoAlcance: { papeis: ['TRAFEGO'], modulo: 'trafego' },
  SocialMediaConta: { papeis: ['SOCIAL_MEDIA', 'SUPERVISOR'] },
  SocialMediaMidia: { papeis: ['SOCIAL_MEDIA', 'SUPERVISOR'] },
  SocialMediaSnapshotDiario: { papeis: ['SOCIAL_MEDIA', 'SUPERVISOR'] },
  SocialMediaAlcancePeriodo: { papeis: ['SOCIAL_MEDIA', 'SUPERVISOR'] },
  SmPauta: { papeis: ['SOCIAL_MEDIA'] },
  PergunteConversa: { papeis: TODOS, escopo: ctx => (ctx.pessoa.papel === 'DONO' ? {} : { pessoaId: ctx.pessoa.id }) },
}

// Tabelas sem a coluna da loja: o caminho até ela (relação) ou um filtro por id.
const LOJA_VIA: Record<string, (u: string) => Promise<Where> | Where> = {
  TrafegoAlcance: async u => ({ contaId: { in: (await prisma.trafegoConta.findMany({ where: { usuarioId: u }, select: { id: true } })).map(c => c.id) } }),
  TrafegoEstrutura: async u => ({ contaId: { in: (await prisma.trafegoConta.findMany({ where: { usuarioId: u }, select: { id: true } })).map(c => c.id) } }),
  EventoAuditoria: () => ({}), // filtrada pelos registros da loja abaixo
}

const camposEscalares = (m: Modelo) => m.fields.filter(f => f.kind === 'scalar' || f.kind === 'enum')
const relacoes = (m: Modelo) => m.fields.filter(f => f.kind === 'object')
const temLoja = (m: Modelo) => m.fields.some(f => f.name === 'usuarioId')

/** Caminho de relações até uma tabela com usuarioId (até 3 saltos). */
function caminhoLoja(m: Modelo, prof = 0): string[] | null {
  if (temLoja(m)) return []
  if (prof >= 3) return null
  for (const r of relacoes(m)) {
    if (r.isList || !r.relationFromFields?.length) continue
    const alvo = porNome.get(r.type)
    if (!alvo || alvo.name === 'ProLaboreUsuario') continue
    const resto = caminhoLoja(alvo, prof + 1)
    if (resto) return [r.name, ...resto]
  }
  return null
}

async function whereLoja(m: Modelo, u: string): Promise<Where | null> {
  if (temLoja(m)) return { usuarioId: u }
  if (LOJA_VIA[m.name]) return LOJA_VIA[m.name](u)
  const c = caminhoLoja(m)
  if (!c) return null
  return c.reduceRight<Where>((acc, rel) => ({ [rel]: acc }), { usuarioId: u })
}

const delegate = (m: Modelo) => (prisma as unknown as Record<string, { findMany: (a: unknown) => Promise<Record<string, unknown>[]>; count: (a: unknown) => Promise<number>; aggregate: (a: unknown) => Promise<Record<string, Record<string, unknown>>>; groupBy: (a: unknown) => Promise<Array<Record<string, unknown>>> }>)[m.name.charAt(0).toLowerCase() + m.name.slice(1)]

export type TipoCampo = 'texto' | 'numero' | 'dinheiro' | 'data' | 'sim/nao' | 'lista' | 'id' | 'telefone (4 últimos dígitos)'
function tipoDe(f: Campo): TipoCampo | null {
  if (OCULTO.test(f.name) || f.type === 'Json' || f.type === 'Bytes' || f.type === 'Unsupported') return null
  if (TELEFONE.test(f.name)) return 'telefone (4 últimos dígitos)'
  if (f.isList) return 'lista'
  if (f.type === 'DateTime') return 'data'
  if (f.type === 'Boolean') return 'sim/nao'
  if (f.type === 'Float' || f.type === 'Int' || f.type === 'Decimal' || f.type === 'BigInt') return DINHEIRO.has(f.name) ? 'dinheiro' : 'numero'
  if (f.name === 'id' || /Id$/.test(f.name)) return 'id'
  return 'texto'
}

export interface Entidade { nome: string; rotulo: string; campos: Array<{ nome: string; tipo: TipoCampo }>; relacoes: Array<{ nome: string; entidade: string }>; campoData: string | null }

function permitido(ctx: CtxCentral, m: Modelo): { ok: true; escopo: Where } | { ok: false; motivo: string } {
  if (BLOQUEADAS[m.name]) return { ok: false, motivo: `Fora da Central: ${BLOQUEADAS[m.name]}.` }
  if (ctx.pessoa.papel === 'DONO') return { ok: true, escopo: {} }
  const a = ACESSO[m.name]
  if (!a || !a.papeis.includes(ctx.pessoa.papel)) return { ok: false, motivo: 'Esta informação não fica visível para o seu perfil.' }
  if (a.modulo && !ctx.ve(a.modulo)) return { ok: false, motivo: 'Seu acesso não inclui este módulo.' }
  const e = a.escopo ? a.escopo(ctx) : {}
  if (e === null) return { ok: false, motivo: 'Esta informação não fica visível para o seu perfil.' }
  return { ok: true, escopo: e }
}

function camposVisiveis(ctx: CtxCentral, m: Modelo) {
  const fora = new Set(CAMPOS_FORA[m.name] ?? [])
  return camposEscalares(m)
    .filter(f => !fora.has(f.name) && !(SO_DONO_CAMPOS.has(f.name) && ctx.pessoa.papel !== 'DONO'))
    .map(f => ({ f, tipo: tipoDe(f) }))
    .filter((x): x is { f: Campo; tipo: TipoCampo } => !!x.tipo && x.f.name !== 'usuarioId')
}

const campoDataDe = (m: Modelo) => ['data', 'criadoEm', 'dataOcorrencia', 'pagoEm', 'publicadoEm', 'agendadoPara', 'prazo', 'entradaEm', 'dia', 'iniciadoEm'].find(n => m.fields.some(f => f.name === n && f.type === 'DateTime')) ?? null
const rotuloDe = (m: Modelo) => ROTULO[m.name] ?? m.name.replace(/([a-z])([A-Z])/g, '$1 $2')
const campoNomeDe = (m: Modelo) => ['nome', 'nomeCliente', 'titulo', 'modelo', 'codigo', 'protocolo', 'texto', 'descricao', 'numero'].find(n => m.fields.some(f => f.name === n && f.kind === 'scalar' && !OCULTO.test(n))) ?? 'id'

/** As entidades que a pessoa pode consultar (para a IA saber o que existe). */
export function listarEntidades(ctx: CtxCentral, busca?: string): Entidade[] {
  const t = (busca ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  return MODELOS.filter(m => permitido(ctx, m).ok && (temLoja(m) || LOJA_VIA[m.name] || caminhoLoja(m)))
    .map(m => ({
      nome: m.name, rotulo: rotuloDe(m), campoData: campoDataDe(m),
      campos: camposVisiveis(ctx, m).map(x => ({ nome: x.f.name, tipo: x.tipo })),
      relacoes: relacoes(m).filter(r => !r.isList && porNome.has(r.type) && r.type !== 'ProLaboreUsuario' && !BLOQUEADAS[r.type]).map(r => ({ nome: r.name, entidade: r.type })),
    }))
    .filter(e => !t || `${e.nome} ${e.rotulo} ${e.campos.map(c => c.nome).join(' ')}`.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(t))
}

// --- Filtros (validados contra o catálogo; nada de SQL) ---
export interface Filtro { campo: string; op: 'igual' | 'diferente' | 'contem' | 'maior' | 'menor' | 'maior_igual' | 'menor_igual' | 'vazio' | 'preenchido' | 'em'; valor?: unknown }
export interface Pedido { entidade: string; filtros?: Filtro[]; desde?: string; ate?: string; campoData?: string; ordenar?: { campo: string; direcao?: 'asc' | 'desc' }; campos?: string[]; limite?: number }
export interface PedidoAgregado extends Omit<Pedido, 'campos' | 'ordenar' | 'limite'> { medida: 'contar' | 'somar' | 'media' | 'minimo' | 'maximo'; campoMedida?: string; agruparPor?: string; limite?: number }

class ErroPedido extends Error {}

function resolverCampo(ctx: CtxCentral, m: Modelo, caminho: string): { modelo: Modelo; f: Campo; tipo: TipoCampo; rel: string | null } {
  const [a, b] = caminho.split('.')
  if (b) {
    const r = relacoes(m).find(x => x.name === a && !x.isList)
    const alvo = r ? porNome.get(r.type) : undefined
    if (!r || !alvo || BLOQUEADAS[alvo.name] || alvo.name === 'ProLaboreUsuario') throw new ErroPedido(`Relação desconhecida: ${a}`)
    const c = camposVisiveis(ctx, alvo).find(x => x.f.name === b)
    if (!c) throw new ErroPedido(`Campo desconhecido ou fora da Central: ${caminho}`)
    return { modelo: alvo, f: c.f, tipo: c.tipo, rel: a }
  }
  const c = camposVisiveis(ctx, m).find(x => x.f.name === a)
  if (!c) throw new ErroPedido(`Campo desconhecido ou fora da Central: ${caminho}`)
  return { modelo: m, f: c.f, tipo: c.tipo, rel: null }
}

function valorDoFiltro(f: Campo, v: unknown): unknown {
  if (f.type === 'DateTime') { const d = new Date(String(v)); if (Number.isNaN(d.getTime())) throw new ErroPedido(`Data inválida: ${v}`); return d }
  if (f.type === 'Int' || f.type === 'Float') { const n = Number(v); if (!Number.isFinite(n)) throw new ErroPedido(`Número inválido: ${v}`); return n }
  if (f.type === 'Boolean') return v === true || v === 'true' || v === 'sim'
  return String(v).slice(0, 200)
}

function condicao(ctx: CtxCentral, m: Modelo, x: Filtro): Where {
  const c = resolverCampo(ctx, m, x.campo)
  if (c.tipo === 'telefone (4 últimos dígitos)') {
    const dig = String(x.valor ?? '').replace(/\D/g, '').slice(-4)
    if (dig.length < 4) throw new ErroPedido('Telefone: informe os 4 últimos dígitos')
    const w = { [c.f.name]: { endsWith: dig } }
    return c.rel ? { [c.rel]: w } : w
  }
  let cond: unknown
  const v = () => valorDoFiltro(c.f, x.valor)
  switch (x.op) {
    case 'igual': cond = c.f.isList ? { has: v() } : c.f.type === 'String' ? { equals: v(), mode: 'insensitive' } : v(); break
    case 'diferente': cond = { not: v() }; break
    case 'contem': cond = c.f.isList ? { has: v() } : { contains: String(x.valor ?? ''), mode: 'insensitive' }; break
    case 'maior': cond = { gt: v() }; break
    case 'menor': cond = { lt: v() }; break
    case 'maior_igual': cond = { gte: v() }; break
    case 'menor_igual': cond = { lte: v() }; break
    case 'vazio': cond = null; break
    case 'preenchido': cond = { not: null }; break
    case 'em': cond = { in: (Array.isArray(x.valor) ? x.valor : [x.valor]).slice(0, 50).map(y => valorDoFiltro(c.f, y)) }; break
    default: throw new ErroPedido(`Operação desconhecida: ${String(x.op)}`)
  }
  const w = { [c.f.name]: cond }
  return c.rel ? { [c.rel]: w } : w
}

async function montarWhere(ctx: CtxCentral, m: Modelo, p: Pick<Pedido, 'filtros' | 'desde' | 'ate' | 'campoData'>): Promise<Where> {
  const perm = permitido(ctx, m)
  if (!perm.ok) throw new ErroPedido(perm.motivo)
  const loja = await whereLoja(m, ctx.pessoa.usuarioId)
  if (!loja) throw new ErroPedido('Entidade sem ligação com a loja')
  const and: Where[] = [loja, perm.escopo]
  // Trilha de auditoria: só eventos de registros da loja (pelas tabelas que têm a loja).
  if (m.name === 'EventoAuditoria') and.push({ registroId: { in: await idsDaLojaParaAuditoria(ctx.pessoa.usuarioId) } })
  for (const x of (p.filtros ?? []).slice(0, 12)) and.push(condicao(ctx, m, x))
  const campoData = p.campoData ?? campoDataDe(m)
  if ((p.desde || p.ate) && campoData) {
    const cd = resolverCampo(ctx, m, campoData)
    const d = p.desde ? valorDoFiltro(cd.f, p.desde) : undefined
    const a = p.ate ? new Date((valorDoFiltro(cd.f, p.ate) as Date).getTime() + (String(p.ate).length <= 10 ? 86_400_000 : 0)) : undefined
    and.push({ [cd.f.name]: { ...(d ? { gte: d } : {}), ...(a ? { lt: a } : {}) } })
  }
  return { AND: and }
}

async function idsDaLojaParaAuditoria(u: string): Promise<string[]> {
  const [l, v] = await Promise.all([prisma.lead.findMany({ where: { usuarioId: u }, select: { id: true }, take: 20_000 }), prisma.venda.findMany({ where: { usuarioId: u }, select: { id: true }, take: 20_000 })])
  return [...l, ...v].map(x => x.id)
}

/** Converte um valor para o que pode ir à IA (dinheiro reservado, telefone mascarado, datas ISO). */
function paraIa(tipo: TipoCampo, v: unknown, r: Reservas): unknown {
  if (v == null) return null
  if (tipo === 'dinheiro') return r.brl(Number(v))
  if (tipo === 'telefone (4 últimos dígitos)') { const d = String(v).replace(/\D/g, ''); return d.length >= 4 ? `final ${d.slice(-4)}` : null }
  if (v instanceof Date) return v.toISOString()
  if (typeof v === 'string') return v.length > 300 ? `${v.slice(0, 299)}…` : v
  if (typeof v === 'bigint') return Number(v)
  return v
}

export async function consultarDados(ctx: CtxCentral, p: Pedido, r: Reservas): Promise<unknown> {
  const m = porNome.get(p.entidade)
  if (!m) return { erro: `Entidade desconhecida: ${p.entidade}. Use listar_dados.` }
  try {
    const where = await montarWhere(ctx, m, p)
    const visiveis = camposVisiveis(ctx, m)
    const pedidos = (p.campos?.length ? p.campos : visiveis.map(x => x.f.name)).slice(0, 40)
    const select: Where = {}
    const tipos = new Map<string, TipoCampo>()
    for (const c of pedidos) {
      const rc = resolverCampo(ctx, m, c)
      if (rc.rel) { const s = (select[rc.rel] as { select: Where } | undefined) ?? { select: {} }; s.select[rc.f.name] = true; select[rc.rel] = s } else select[rc.f.name] = true
      tipos.set(c, rc.tipo)
    }
    if (m.fields.some(f => f.name === 'id')) select.id = true
    let orderBy: Where | undefined
    if (p.ordenar) { const o = resolverCampo(ctx, m, p.ordenar.campo); const dir = p.ordenar.direcao === 'asc' ? 'asc' : 'desc'; orderBy = o.rel ? { [o.rel]: { [o.f.name]: dir } } : { [o.f.name]: dir } }
    else { const cd = campoDataDe(m); if (cd) orderBy = { [cd]: 'desc' } }
    const limite = Math.min(Math.max(1, p.limite ?? 20), 100)
    const d = delegate(m)
    const [total, linhas] = await Promise.all([d.count({ where }), d.findMany({ where, select, ...(orderBy ? { orderBy } : {}), take: limite })])
    return {
      entidade: rotuloDe(m), total, mostrando: linhas.length,
      linhas: linhas.map(l => {
        const o: Record<string, unknown> = {}
        for (const c of pedidos) {
          const [a, b] = c.split('.')
          o[c] = paraIa(tipos.get(c)!, b ? (l[a] as Record<string, unknown> | null)?.[b] : l[a], r)
        }
        return o
      }),
    }
  } catch (e) {
    if (e instanceof ErroPedido) return { erro: e.message }
    throw e
  }
}

export async function agregarDados(ctx: CtxCentral, p: PedidoAgregado, r: Reservas): Promise<unknown> {
  const m = porNome.get(p.entidade)
  if (!m) return { erro: `Entidade desconhecida: ${p.entidade}. Use listar_dados.` }
  try {
    const where = await montarWhere(ctx, m, p)
    const d = delegate(m)
    const medida = p.medida
    let campoMedida: { f: Campo; tipo: TipoCampo } | null = null
    if (medida !== 'contar') {
      if (!p.campoMedida) throw new ErroPedido('Informe o campo da medida')
      const c = resolverCampo(ctx, m, p.campoMedida)
      if (c.rel) throw new ErroPedido('A medida precisa ser um campo da própria entidade')
      if (!['numero', 'dinheiro', 'data'].includes(c.tipo) || (c.tipo === 'data' && (medida === 'somar' || medida === 'media'))) throw new ErroPedido('Esse campo não pode ser somado')
      campoMedida = c
    }
    const chaveAgg = { somar: '_sum', media: '_avg', minimo: '_min', maximo: '_max', contar: '_count' }[medida]
    const fmt = (v: unknown) => (campoMedida ? paraIa(campoMedida.tipo, v == null ? null : campoMedida.tipo === 'data' ? v : Math.round(Number(v) * 100) / 100, r) : v)
    if (!p.agruparPor) {
      if (medida === 'contar') return { entidade: rotuloDe(m), medida, valor: await d.count({ where }) }
      const a = await d.aggregate({ where, [chaveAgg]: { [campoMedida!.f.name]: true }, _count: { _all: true } })
      return { entidade: rotuloDe(m), medida, campo: campoMedida!.f.name, valor: fmt(a[chaveAgg]?.[campoMedida!.f.name]), registros: (a._count as { _all: number })._all }
    }
    const g = resolverCampo(ctx, m, p.agruparPor)
    if (g.rel) throw new ErroPedido('Agrupe por um campo da própria entidade (por exemplo, vendedorId)')
    if (g.tipo === 'dinheiro' || g.tipo === 'lista') throw new ErroPedido('Não dá para agrupar por esse campo')
    const grupos = await d.groupBy({ by: [g.f.name], where, _count: { _all: true }, ...(medida !== 'contar' ? { [chaveAgg]: { [campoMedida!.f.name]: true } } : {}) })
    // Grupo por id de relação: troca pelo nome (ex.: vendedorId → nome do vendedor).
    const rel = relacoes(m).find(x => x.relationFromFields?.includes(g.f.name))
    const nomes = new Map<string, string>()
    if (rel && porNome.get(rel.type) && !BLOQUEADAS[rel.type]) {
      const alvo = porNome.get(rel.type)!
      const campoNome = campoNomeDe(alvo)
      const ids = grupos.map(x => x[g.f.name]).filter((x): x is string => typeof x === 'string')
      if (ids.length && campoNome !== 'id') for (const x of await delegate(alvo).findMany({ where: { id: { in: ids } }, select: { id: true, [campoNome]: true } })) nomes.set(String(x.id), String(x[campoNome]))
    }
    const lista = grupos.map(x => {
      const chave = x[g.f.name]
      const valor = medida === 'contar' ? (x._count as { _all: number })._all : fmt((x[chaveAgg] as Record<string, unknown>)?.[campoMedida!.f.name])
      return { grupo: chave == null ? '(vazio)' : nomes.get(String(chave)) ?? paraIa(g.tipo, chave, r), valor, registros: (x._count as { _all: number })._all, _ordem: medida === 'contar' ? (x._count as { _all: number })._all : Number((x[chaveAgg] as Record<string, unknown>)?.[campoMedida!.f.name] ?? 0) }
    }).sort((a, b) => b._ordem - a._ordem).slice(0, Math.min(p.limite ?? 30, 100)).map(({ _ordem, ...x }) => x)
    return { entidade: rotuloDe(m), medida, campo: campoMedida?.f.name ?? null, agrupadoPor: g.f.name, grupos: lista }
  } catch (e) {
    if (e instanceof ErroPedido) return { erro: e.message }
    throw e
  }
}

export const ENTIDADES_TOTAL = MODELOS.length
export const ENTIDADES_BLOQUEADAS = BLOQUEADAS
