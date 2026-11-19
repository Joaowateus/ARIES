// PDF 07 · Central de Conhecimento — catálogo de consultas seguras.
// Uma lista fixa: cada consulta tem nome, descrição para a IA, parâmetros validados,
// a fonte, o filtro de permissão de quem perguntou e o link da tela. A IA só escolhe
// a consulta e os parâmetros; nunca escreve SQL.
//
// P1: o que volta para a IA nunca traz R$, custo, margem, CPF nem data de nascimento.
// Todo valor em dinheiro vira um espaço reservado ({{v1}}, {{v2}}…) que só o sistema
// conhece e preenche na resposta final. Telefone: só os 4 últimos dígitos. Texto das
// conversas, notas da negociação, Processo e anotações não entram (D5).
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../prisma'
import { NOME_ETAPA, type Etapa } from '../etapasJornada'
import { fichas } from '../metricas'
import { calcularNumeros, formatar, PERIODOS, type NumeroResposta, type PeriodoPedido } from '../pergunte'
import type { CtxCentral } from './contexto'
import { buscar } from './indice'
import { NOME_TIPO, type TipoDoc } from './fontes'

const DIA = 86_400_000

/** Valores que a IA não pode ver: guardados aqui e trocados por espaços reservados. */
export class Reservas {
  private mapa = new Map<string, string>()
  private n = 0
  /** Valor em R$ → espaço reservado (o texto real fica só no servidor). */
  brl(v: number | null | undefined): string | null {
    if (v == null) return null
    return this.texto(v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }))
  }
  texto(t: string): string { const k = `{{v${++this.n}}}`; this.mapa.set(k, t); return k }
  numero(n: NumeroResposta) {
    // Número do dicionário: valor, comparação e meta reservados; a IA recebe o sentido.
    return {
      metrica: n.nome, valor: this.texto(n.valorTexto), periodo: n.periodoTexto === 'agora' ? 'agora' : 'o período pedido', sobre: n.escopo,
      movimento: n.comparacao?.variacao == null ? 'SEM_COMPARACAO' : n.comparacao.variacao > 2 ? 'SUBIU' : n.comparacao.variacao < -2 ? 'CAIU' : 'ESTAVEL',
      anterior: n.comparacao ? this.texto(n.comparacao.valorTexto) : null, meta: n.meta ? this.texto(n.meta.valorTexto) : null,
      situacao: n.meta && n.valor != null ? (n.valor >= n.meta.valor ? 'ACIMA_DA_META' : 'ABAIXO_DA_META') : n.faixa, tela: n.link, avisoDeQualidade: n.aviso ? 'há registros incompletos ou suspeitos na base desta métrica' : null,
      periodoReservado: this.texto(n.periodoTexto),
    }
  }
  preencher(t: string): string { return t.replace(/\{\{v\d+\}\}/g, k => this.mapa.get(k) ?? '') }
  get usados() { return this.mapa.size }
}

const final4 = (tel: string | null | undefined) => { const d = (tel ?? '').replace(/\D/g, ''); return d.length >= 4 ? `final ${d.slice(-4)}` : null }
const dia = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null)
const diasDesde = (d: Date | null | undefined, agora: Date) => (d ? Math.max(0, Math.floor((agora.getTime() - d.getTime()) / DIA)) : null)
const etapaNome = (e: string | null) => (e ? NOME_ETAPA[e as Etapa] ?? e : null)
const primeiro = (n: string | null | undefined) => (n ? n.split(/\s+/)[0] : null)
const dataOuNull = (s: string | undefined) => { if (!s) return null; const d = new Date(s); return Number.isNaN(d.getTime()) ? null : d }

export interface Execucao { dados: unknown; fonte: string; tela: string | null; numeros?: NumeroResposta[] }
export interface Consulta<P extends z.ZodTypeAny = z.ZodTypeAny> {
  nome: string
  descricao: string
  fonte: string
  parametros: P
  /** JSON Schema dos parâmetros (o mesmo da validação, escrito para a IA). */
  esquema: Record<string, unknown>
  executar: (ctx: CtxCentral, p: z.infer<P>, r: Reservas, agora: Date) => Promise<Execucao>
}

async function vendedorPorNome(usuarioId: string, nome: string | undefined) {
  if (!nome?.trim()) return null
  return prisma.vendedor.findFirst({ where: { usuarioId, nome: { contains: nome.trim(), mode: 'insensitive' } }, select: { id: true } })
}

const pMetricas = z.object({ chaves: z.array(z.string()).min(1).max(6), periodo: z.enum(PERIODOS as [PeriodoPedido, ...PeriodoPedido[]]).default('MES'), sobre: z.enum(['EU', 'LOJA', 'PESSOA']).default('EU'), pessoa: z.string().max(60).optional() })
const pLeads = z.object({ texto: z.string().max(80).optional(), etapa: z.string().max(20).optional(), vendedor: z.string().max(60).optional(), temperatura: z.enum(['QUENTE', 'MORNO', 'FRIO']).optional(), situacao: z.enum(['ABERTOS', 'PERDIDOS', 'FECHADOS', 'TODOS']).default('ABERTOS'), criados_desde: z.string().max(10).optional(), criados_ate: z.string().max(10).optional(), limite: z.number().int().min(1).max(40).default(15) })
const pLead = z.object({ id: z.string().min(1).max(60) })
const pVendas = z.object({ desde: z.string().max(10).optional(), ate: z.string().max(10).optional(), vendedor: z.string().max(60).optional(), texto: z.string().max(80).optional(), limite: z.number().int().min(1).max(50).default(20) })
const pEstoque = z.object({ texto: z.string().max(80).optional(), situacao: z.enum(['DISPONIVEL', 'RESERVADA', 'VENDIDA']).optional(), limite: z.number().int().min(1).max(60).default(30) })
const pAtividades = z.object({ quando: z.enum(['ATRASADAS', 'HOJE', 'PROXIMOS_7_DIAS']), responsavel: z.string().max(60).optional() })
const pVazio = z.object({})
const pRecs = z.object({ situacao: z.enum(['ABERTAS', 'TODAS']).default('ABERTAS') })
const TIPOS_PESQUISA = ['LEAD', 'CLIENTE', 'VENDA', 'MOTO', 'ATIVIDADE', 'VERBETE', 'INDICADOR', 'RECOMENDACAO', 'OCORRENCIA', 'REUNIAO', 'PAUTA', 'POST', 'CAMPANHA', 'LANCAMENTO', 'DECISAO'] as const
const pPesquisa = z.object({ texto: z.string().min(2).max(120), tipos: z.array(z.enum(TIPOS_PESQUISA)).max(6).optional() })

/** Declara uma consulta com os parâmetros tipados pelo próprio esquema. */
const def = <P extends z.ZodTypeAny>(c: Consulta<P>): Consulta => c as unknown as Consulta

export const CONSULTAS: Consulta[] = [
  def({
    nome: 'metricas', fonte: 'indicadores', parametros: pMetricas,
    descricao: 'Números do dicionário de métricas (fichas do catálogo) para um período, com comparação, meta e situação. Os valores voltam como espaços reservados {{vN}}: use-os no texto exatamente como vieram; o sistema troca pelos valores reais. Respeita o que a pessoa pode ver.',
    esquema: { type: 'object', properties: { chaves: { type: 'array', items: { type: 'string' }, description: 'Chaves do catálogo (até 6).' }, periodo: { type: 'string', enum: PERIODOS }, sobre: { type: 'string', enum: ['EU', 'LOJA', 'PESSOA'], description: 'EU = a própria pessoa; LOJA = a loja; PESSOA = alguém da equipe (informe "pessoa").' }, pessoa: { type: 'string' } }, required: ['chaves', 'periodo', 'sobre'] },
    async executar(ctx, p, r, agora) {
      const catalogo = await fichas(ctx.pessoa.usuarioId)
      const c = await calcularNumeros(ctx.pessoa, { metricas: p.chaves, periodo: p.periodo, sobre: p.sobre, pessoa: p.pessoa ?? null, acao: null, onde: null }, catalogo, agora)
      const desconhecidas = p.chaves.filter(k => !catalogo.some(f => f.chave === k))
      return { fonte: 'indicadores', tela: c.numeros[0]?.link ?? null, numeros: c.numeros, dados: { escopo: c.escopo, recusa: c.recusa, semPermissao: c.semPermissao, metricaQueNaoExiste: desconhecidas, numeros: c.numeros.map(n => r.numero(n)) } }
    },
  }),
  def({
    nome: 'buscar_leads', fonte: 'leads', parametros: pLeads,
    descricao: 'Lista leads e negociações do CRM com filtros. Devolve nome, etapa, há quantos dias está na etapa, moto, temperatura, origem, vendedor e o valor da negociação como espaço reservado. Sem CPF, sem conversas.',
    esquema: { type: 'object', properties: { texto: { type: 'string', description: 'Parte do nome, da moto ou os 4 últimos dígitos do telefone.' }, etapa: { type: 'string', description: 'LEAD, ABORDADO, LEVANTAMENTO, MQL, SQL, NEGOCIACAO, PROPOSTA, AGENDAMENTO, VISITA, VENDA, FECHADO ou PERDIDO.' }, vendedor: { type: 'string' }, temperatura: { type: 'string', enum: ['QUENTE', 'MORNO', 'FRIO'] }, situacao: { type: 'string', enum: ['ABERTOS', 'PERDIDOS', 'FECHADOS', 'TODOS'] }, criados_desde: { type: 'string', description: 'AAAA-MM-DD' }, criados_ate: { type: 'string', description: 'AAAA-MM-DD' }, limite: { type: 'integer' } } },
    async executar(ctx, p, r, agora) {
      if (!ctx.leads) return { fonte: 'leads', tela: null, dados: { erro: 'O acesso desta pessoa não inclui o CRM.' } }
      const and: Prisma.LeadWhereInput[] = [ctx.leads]
      if (p.texto) { const dig = p.texto.replace(/\D/g, ''); and.push({ OR: [{ nomeCliente: { contains: p.texto, mode: 'insensitive' } }, { modeloInteresse: { contains: p.texto, mode: 'insensitive' } }, ...(dig.length >= 4 ? [{ telefone: { endsWith: dig.slice(-4) } }] : [])] }) }
      const et = p.etapa?.toUpperCase()
      if (et === 'FECHADO' || et === 'PERDIDO') and.push({ estagio: et }); else if (et) and.push({ etapa: et })
      if (p.temperatura) and.push({ temperatura: p.temperatura })
      if (p.situacao === 'ABERTOS') and.push({ estagio: { notIn: ['FECHADO', 'PERDIDO'] } })
      else if (p.situacao === 'PERDIDOS') and.push({ estagio: 'PERDIDO' })
      else if (p.situacao === 'FECHADOS') and.push({ estagio: 'FECHADO' })
      const desde = dataOuNull(p.criados_desde), ate = dataOuNull(p.criados_ate)
      if (desde || ate) and.push({ criadoEm: { ...(desde ? { gte: desde } : {}), ...(ate ? { lte: new Date(ate.getTime() + DIA) } : {}) } })
      if (p.vendedor && !ctx.pessoal) { const v = await vendedorPorNome(ctx.pessoa.usuarioId, p.vendedor); and.push({ vendedorId: v?.id ?? '__nenhum__' }) }
      const where = { AND: and }
      const [total, lista] = await Promise.all([
        prisma.lead.count({ where }),
        prisma.lead.findMany({ where, orderBy: { atualizadoEm: 'desc' }, take: p.limite, select: { id: true, nomeCliente: true, telefone: true, etapa: true, estagio: true, modeloInteresse: true, valorNegociacao: true, temperatura: true, origemTipo: true, tipoLead: true, criadoEm: true, entrouNaEtapaEm: true, motivoPerda: true, vendedor: { select: { nome: true } } } }),
      ])
      return {
        fonte: 'leads', tela: '/pro-labore/leads', dados: {
          total, mostrando: lista.length,
          leads: lista.map(l => ({ id: l.id, nome: l.nomeCliente, telefone: final4(l.telefone), etapa: etapaNome(l.etapa) ?? l.estagio, diasNaEtapa: diasDesde(l.entrouNaEtapaEm, agora), moto: l.modeloInteresse, valorNegociacao: l.valorNegociacao ? r.brl(l.valorNegociacao) : null, temperatura: l.temperatura, origem: l.origemTipo ?? l.tipoLead, vendedor: primeiro(l.vendedor?.nome), criadoEm: dia(l.criadoEm), motivoPerda: l.motivoPerda, tela: `/pro-labore/leads?lead=${l.id}` })),
        },
      }
    },
  }),
  def({
    nome: 'ver_lead', fonte: 'leads', parametros: pLead,
    descricao: 'Um lead: etapa, histórico de etapas (da trilha), follows e atividades com datas, propostas e visitas (quantas), e os metadados da conversa no WhatsApp (quem falou por último e há quanto tempo). Não traz o texto das mensagens, as notas da negociação nem dados pessoais.',
    esquema: { type: 'object', properties: { id: { type: 'string', description: 'O id que veio de buscar_leads.' } }, required: ['id'] },
    async executar(ctx, p, r, agora) {
      if (!ctx.leads) return { fonte: 'leads', tela: null, dados: { erro: 'O acesso desta pessoa não inclui o CRM.' } }
      const l = await prisma.lead.findFirst({
        where: { AND: [ctx.leads, { id: p.id }] },
        select: {
          id: true, nomeCliente: true, telefone: true, etapa: true, estagio: true, modeloInteresse: true, valorNegociacao: true, tipoNegociacao: true, formaPagamento: true, temperatura: true, pontuacao: true, etiquetas: true,
          origemTipo: true, tipoLead: true, origemCampanha: true, situacaoCnh: true, temEntrada: true, levantamentoCompleto: true, criadoEm: true, entrouNaEtapaEm: true, motivoPerda: true, perdidoEm: true, perfilCliente: true,
          vendedor: { select: { nome: true } },
          historico: { orderBy: { criadoEm: 'desc' }, take: 15, select: { estagioAnterior: true, estagioNovo: true, criadoEm: true } },
          follows: { orderBy: { agendadoPara: 'desc' }, take: 10, select: { agendadoPara: true, status: true, tipo: true, canal: true } },
          _count: { select: { propostas: true, visitas: true } },
          assistenteConversas: { orderBy: { ultimaMensagemEm: 'desc' }, take: 1, select: { status: true, ultimaMensagemEm: true, mensagens: { orderBy: { criadoEm: 'desc' }, take: 1, select: { remetente: true, criadoEm: true } } } },
        },
      })
      if (!l) return { fonte: 'leads', tela: null, dados: { erro: 'Lead não encontrado ou fora do acesso desta pessoa.' } }
      const conversa = l.assistenteConversas[0]
      const ultima = conversa?.mensagens[0]
      return {
        fonte: 'leads', tela: `/pro-labore/leads?lead=${l.id}`, dados: {
          id: l.id, nome: l.nomeCliente, telefone: final4(l.telefone), etapa: etapaNome(l.etapa) ?? l.estagio, diasNaEtapa: diasDesde(l.entrouNaEtapaEm, agora), moto: l.modeloInteresse,
          valorNegociacao: l.valorNegociacao ? r.brl(l.valorNegociacao) : null, tipoNegociacao: l.tipoNegociacao, formaPagamento: l.formaPagamento, temperatura: l.temperatura, nota: l.pontuacao, etiquetas: l.etiquetas, perfil: l.perfilCliente,
          origem: l.origemTipo ?? l.tipoLead, campanha: l.origemCampanha, cnh: l.situacaoCnh, temEntrada: l.temEntrada, levantamentoCompleto: l.levantamentoCompleto,
          vendedor: primeiro(l.vendedor?.nome), criadoEm: dia(l.criadoEm), perda: l.motivoPerda ? { motivo: l.motivoPerda, em: dia(l.perdidoEm) } : null,
          historicoEtapas: l.historico.map(h => ({ de: etapaNome(h.estagioAnterior), para: etapaNome(h.estagioNovo), em: dia(h.criadoEm) })),
          follows: l.follows.map(f => ({ quando: dia(f.agendadoPara), situacao: f.status, tipo: f.tipo, canal: f.canal })),
          propostas: l._count.propostas, visitas: l._count.visitas,
          conversa: conversa ? { situacao: conversa.status, ultimaMensagemDe: ultima ? (ultima.remetente === 'CONTATO' ? 'cliente' : ultima.remetente === 'VENDEDOR' ? 'loja' : 'robô') : null, horasDesdeUltimaMensagem: ultima ? Math.round((agora.getTime() - ultima.criadoEm.getTime()) / 3_600_000) : null } : null,
          tela: `/pro-labore/leads?lead=${l.id}`,
        },
      }
    },
  }),
  def({
    nome: 'buscar_vendas', fonte: 'vendas', parametros: pVendas,
    descricao: 'Vendas num intervalo: data, cliente, moto, vendedor e situação. Quantidade de vendas em número; valores (venda, pró-labore, comissão e totais) como espaços reservados. Vendedor e SDR veem só as próprias.',
    esquema: { type: 'object', properties: { desde: { type: 'string', description: 'AAAA-MM-DD' }, ate: { type: 'string', description: 'AAAA-MM-DD' }, vendedor: { type: 'string' }, texto: { type: 'string', description: 'Cliente, moto ou placa.' }, limite: { type: 'integer' } } },
    async executar(ctx, p, r, agora) {
      if (!ctx.pessoal && !ctx.ve('vendas')) return { fonte: 'vendas', tela: null, dados: { erro: 'O acesso desta pessoa não inclui Vendas.' } }
      const u = ctx.pessoa.usuarioId
      const ini = dataOuNull(p.desde) ?? new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1, 3))
      const fim = p.ate ? new Date((dataOuNull(p.ate) ?? agora).getTime() + DIA) : agora
      const and: Prisma.VendaWhereInput[] = [{ usuarioId: u, data: { gte: ini, lt: fim } }]
      if (ctx.pessoal) and.push({ vendedorId: ctx.pessoa.vendedorId ?? '__nenhum__' })
      else if (p.vendedor) { const v = await vendedorPorNome(u, p.vendedor); and.push({ vendedorId: v?.id ?? '__nenhum__' }) }
      if (p.texto) and.push({ OR: [{ lead: { nomeCliente: { contains: p.texto, mode: 'insensitive' } } }, { moto: { modelo: { contains: p.texto, mode: 'insensitive' } } }, { placa: { contains: p.texto, mode: 'insensitive' } }] })
      const where = { AND: and }
      const veValores = !ctx.pessoal ? ctx.ve('vendas') : true
      const [soma, lista] = await Promise.all([
        prisma.venda.aggregate({ where, _count: true, _sum: { valorVenda: true, valorProLabore: true, valorComissao: true } }),
        prisma.venda.findMany({ where, orderBy: { data: 'desc' }, take: p.limite, select: { data: true, situacao: true, valorVenda: true, valorProLabore: true, valorComissao: true, placa: true, lead: { select: { nomeCliente: true } }, moto: { select: { modelo: true, ano: true } }, vendedor: { select: { nome: true } } } }),
      ])
      // Pró-labore é só do dono (como no dicionário); comissão, do dono, do financeiro e de quem vendeu.
      const dono = ctx.pessoa.papel === 'DONO'
      return {
        fonte: 'vendas', tela: '/pro-labore/vendas', dados: {
          quantidade: soma._count,
          totais: veValores ? { faturamento: r.brl(soma._sum.valorVenda ?? 0), proLabore: dono ? r.brl(soma._sum.valorProLabore ?? 0) : null, comissoes: r.brl(soma._sum.valorComissao ?? 0) } : null,
          vendas: lista.map(v => ({ data: dia(v.data), situacao: v.situacao, cliente: v.lead?.nomeCliente ?? null, moto: v.moto ? `${v.moto.modelo}${v.moto.ano ? ` ${v.moto.ano}` : ''}` : null, placa: v.placa, vendedor: primeiro(v.vendedor?.nome), valor: veValores ? r.brl(v.valorVenda) : null, proLabore: dono ? r.brl(v.valorProLabore) : null, comissao: veValores ? r.brl(v.valorComissao) : null })),
        },
      }
    },
  }),
  def({
    nome: 'estoque', fonte: 'estoque', parametros: pEstoque,
    descricao: 'Motos do estoque: modelo, ano, km, cor, situação, placa e dias em estoque; o preço volta como espaço reservado.',
    esquema: { type: 'object', properties: { texto: { type: 'string' }, situacao: { type: 'string', enum: ['DISPONIVEL', 'RESERVADA', 'VENDIDA'] }, limite: { type: 'integer' } } },
    async executar(ctx, p, r, agora) {
      const lista = await prisma.smMotoEstoque.findMany({
        where: { usuarioId: ctx.pessoa.usuarioId, ...(p.situacao ? { situacao: p.situacao } : {}), ...(p.texto ? { OR: [{ modelo: { contains: p.texto, mode: 'insensitive' } }, { marca: { contains: p.texto, mode: 'insensitive' } }, { placa: { contains: p.texto, mode: 'insensitive' } }] } : {}) },
        orderBy: { entradaEm: 'desc' }, take: p.limite,
        select: { modelo: true, marca: true, versao: true, ano: true, km: true, cor: true, cilindrada: true, preco: true, situacao: true, placa: true, entradaEm: true, saidaEm: true },
      })
      return { fonte: 'estoque', tela: '/pro-labore/aba/estoque-demanda', dados: { total: lista.length, motos: lista.map(m => ({ moto: [m.marca, m.modelo, m.versao].filter(Boolean).join(' '), ano: m.ano, km: m.km, cor: m.cor, cilindrada: m.cilindrada, preco: r.brl(m.preco), situacao: m.situacao, placa: m.placa, diasEmEstoque: diasDesde(m.entradaEm, m.saidaEm ?? agora) })) } }
    },
  }),
  def({
    nome: 'atividades', fonte: 'atividades', parametros: pAtividades,
    descricao: 'Atividades e follows atrasados, de hoje ou dos próximos 7 dias: o que fazer, prazo, responsável e lead. Vendedor e SDR veem só os próprios.',
    esquema: { type: 'object', properties: { quando: { type: 'string', enum: ['ATRASADAS', 'HOJE', 'PROXIMOS_7_DIAS'] }, responsavel: { type: 'string', description: 'Primeiro nome (só para quem vê a equipe).' } }, required: ['quando'] },
    async executar(ctx, p, _r, agora) {
      const u = ctx.pessoa.usuarioId
      const inicioHoje = new Date(agora.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) + 'T00:00:00-03:00')
      const janela = p.quando === 'ATRASADAS' ? { lt: agora } : p.quando === 'HOJE' ? { gte: inicioHoje, lt: new Date(inicioHoje.getTime() + DIA) } : { gte: agora, lt: new Date(agora.getTime() + 7 * DIA) }
      const gestao = ctx.pessoa.papel === 'DONO' || ctx.pessoa.papel === 'SUPERVISOR'
      let responsavelId: string | undefined
      if (!gestao) responsavelId = ctx.pessoa.vendedorId ?? ctx.pessoa.id
      else if (p.responsavel) responsavelId = (await vendedorPorNome(u, p.responsavel))?.id ?? '__nenhum__'
      const [atvs, follows, nomes] = await Promise.all([
        prisma.atividade.findMany({ where: { usuarioId: u, status: 'PENDENTE', prazo: janela, ...(responsavelId ? { responsavelId } : {}) }, orderBy: { prazo: 'asc' }, take: 40, select: { codigo: true, tipo: true, oQueFazer: true, prazo: true, responsavelId: true } }),
        ctx.leads ? prisma.leadFollow.findMany({ where: { usuarioId: u, status: 'PENDENTE', agendadoPara: janela, lead: ctx.leads, ...(responsavelId ? { vendedorId: responsavelId } : {}) }, orderBy: { agendadoPara: 'asc' }, take: 40, select: { agendadoPara: true, tipo: true, canal: true, lead: { select: { id: true, nomeCliente: true } }, vendedorId: true } }) : Promise.resolve([]),
        prisma.vendedor.findMany({ where: { usuarioId: u }, select: { id: true, nome: true } }),
      ])
      const nome = new Map(nomes.map(v => [v.id, primeiro(v.nome)]))
      return {
        fonte: 'atividades', tela: '/pro-labore/atividades', dados: {
          atividades: atvs.map(a => ({ codigo: a.codigo, tipo: a.tipo, oQueFazer: a.oQueFazer, prazo: a.prazo.toISOString().slice(0, 16), responsavel: a.responsavelId ? nome.get(a.responsavelId) ?? 'dono' : null })),
          follows: follows.map(f => ({ quando: f.agendadoPara.toISOString().slice(0, 16), tipo: f.tipo, canal: f.canal, lead: f.lead.nomeCliente, leadId: f.lead.id, vendedor: f.vendedorId ? nome.get(f.vendedorId) ?? null : null })),
        },
      }
    },
  }),
  def({
    nome: 'equipe', fonte: 'historico', parametros: pVazio,
    descricao: 'Pessoas da equipe: nome, papel, função e se está ativa; a meta mensal volta como espaço reservado. Vendedor e SDR veem só os próprios dados.',
    esquema: { type: 'object', properties: {} },
    async executar(ctx, _p, r) {
      if (ctx.pessoal && !ctx.ve('vendedores')) {
        const eu = ctx.pessoa.vendedorId ? await prisma.vendedor.findUnique({ where: { id: ctx.pessoa.vendedorId }, select: { nome: true, papel: true, metaMensal: true } }) : null
        return { fonte: 'historico', tela: null, dados: { aviso: 'Este perfil vê só os próprios dados.', voce: eu ? { nome: eu.nome, papel: eu.papel, metaMensal: r.brl(eu.metaMensal) } : null } }
      }
      const lista = await prisma.vendedor.findMany({ where: { usuarioId: ctx.pessoa.usuarioId }, orderBy: [{ ativo: 'desc' }, { nome: 'asc' }], select: { nome: true, papel: true, ativo: true, funcao: true, vende: true, metaMensal: true } })
      return { fonte: 'historico', tela: '/pro-labore/vendedores', dados: { equipe: lista.map(v => ({ nome: v.nome, papel: v.papel, funcao: v.funcao, vende: v.vende, ativo: v.ativo, metaMensal: r.brl(v.metaMensal) })) } }
    },
  }),
  def({
    nome: 'recomendacoes', fonte: 'recomendacoes', parametros: pRecs,
    descricao: 'Recomendações do ARIES em aberto ou recentes: título, área, ação sugerida, prazo e situação.',
    esquema: { type: 'object', properties: { situacao: { type: 'string', enum: ['ABERTAS', 'TODAS'] } } },
    async executar(ctx, p, _r, agora) {
      const pe = ctx.pessoa
      const lista = await prisma.recomendacao.findMany({
        where: { usuarioId: pe.usuarioId, ...(p.situacao === 'TODAS' ? { criadoEm: { gte: new Date(agora.getTime() - 60 * DIA) } } : { status: { in: ['NOVA', 'ABERTA', 'ACEITA', 'EM_ANDAMENTO'] } }), ...(pe.papel === 'DONO' ? {} : { OR: [{ visivelPara: { has: pe.papel } }, { destinatarioId: pe.id }, { acompanhaIds: { has: pe.id } }] }) },
        orderBy: { criadoEm: 'desc' }, take: 20, select: { codigo: true, titulo: true, area: true, acaoSugerida: true, prazo: true, status: true, forca: true },
      })
      return { fonte: 'recomendacoes', tela: '/pro-labore/recomendacoes', dados: { recomendacoes: lista.map(x => ({ codigo: x.codigo, titulo: x.titulo, area: x.area, acao: x.acaoSugerida, prazo: dia(x.prazo), situacao: x.status, forca: x.forca })) } }
    },
  }),
  def({
    nome: 'pesquisar', fonte: 'conhecimento', parametros: pPesquisa,
    descricao: 'Pesquisa por texto na Central de Conhecimento (respostas aprovadas do conhecimento comercial, indicadores, motos, leads, vendas, atividades, recomendações, reuniões, decisões do Daily, posts e campanhas), só no que a pessoa pode ver. Use para "como responder a objeção X", "o que é a métrica Y", achar um registro pelo nome. Para conhecimento comercial, passe tipos ["VERBETE"].',
    esquema: { type: 'object', properties: { texto: { type: 'string' }, tipos: { type: 'array', items: { type: 'string', enum: TIPOS_PESQUISA } } }, required: ['texto'] },
    async executar(ctx, p) {
      // Anotações nunca vão à IA (são privadas do autor).
      const r = await buscar(ctx, p.texto, { tipos: p.tipos as TipoDoc[] | undefined, limitePorTipo: 6, incluirAnotacoes: false })
      return {
        fonte: p.tipos?.length === 1 && p.tipos[0] === 'VERBETE' ? 'conhecimento' : 'conhecimento', tela: '/pro-labore/aba/central-conhecimento',
        dados: { total: r.total, grupos: r.grupos.map(g => ({ tipo: NOME_TIPO[g.tipo], itens: g.itens.map(i => ({ titulo: i.titulo, resumo: i.resumo, tela: i.link, fonteAtrasada: i.fonteAtrasada })) })) },
      }
    },
  }),
]

export const consultaPorNome = (nome: string) => CONSULTAS.find(c => c.nome === nome) ?? null

/** Executa uma consulta do catálogo com os parâmetros validados; parâmetro inválido volta como erro, sem executar. */
export async function executarConsulta(ctx: CtxCentral, nome: string, entrada: unknown, r: Reservas, agora = new Date()): Promise<Execucao> {
  const c = consultaPorNome(nome)
  if (!c) return { fonte: 'historico', tela: null, dados: { erro: `Consulta desconhecida: ${nome}. Use só as do catálogo.` } }
  const p = c.parametros.safeParse(entrada ?? {})
  if (!p.success) return { fonte: c.fonte, tela: null, dados: { erro: `Parâmetros inválidos: ${p.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}` } }
  return c.executar(ctx, p.data, r, agora)
}

export { formatar }
