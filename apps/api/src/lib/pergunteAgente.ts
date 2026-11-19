// Pergunte ao ARIES — agente (19/11). Responde qualquer pergunta: sobre os dados da
// própria loja (consultando o sistema por ferramentas, sempre com o filtro de acesso
// de quem perguntou) e sobre qualquer outro assunto (conhecimento do modelo + busca na
// internet). Decisão do dono (19/11): a IA pode ver todos os dados que a pessoa já vê
// nas telas, inclusive R$, CPF e nascimento; CPF/nascimento lidos ficam no registro de
// acesso a dado sensível. Modelo: Sonnet 5.5 (troca por PERGUNTE_IA_MODELO).
//
// Roda dentro da função da Vercel (30 s): orçamento de ~24 s. Perto do fim, o agente
// para de consultar e responde com o que já tem. Sem a chave da IA, ou se a IA falhar
// antes de responder, cai no Pergunte por regras (lib/pergunte.ts).
import Anthropic from '@anthropic-ai/sdk'
import { randomUUID } from 'crypto'
import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { logger } from './logger'
import { fichas } from './metricas'
import { calcularNumeros, PERIODOS, perguntar, type PeriodoPedido, type Resposta } from './pergunte'
import { iaLigada } from './smIA'
import { registrarAcesso } from './dadoSensivel'
import { NOME_ETAPA, type Etapa } from './etapasJornada'
import type { Pessoa } from './hoje'

const MODELO = process.env.PERGUNTE_IA_MODELO?.trim() || 'claude-sonnet-5-5'
const ORCAMENTO_MS = 24_000
const MAX_RODADAS = 6
const PESSOAL = new Set(['VENDEDOR', 'SDR'])
const DIA = 86_400_000

/** O que a pessoa pode ver, montado na rota a partir das permissões dela (mesmas regras das telas). */
export interface ContextoPergunte {
  pessoa: Pessoa
  /** Filtro de leads de quem perguntou (leadWhereBase); null = sem acesso ao CRM. */
  leads: Prisma.LeadWhereInput | null
  veVendas: boolean
  veEquipe: boolean
  veTrafego: boolean
}

export interface TrocaAnterior { pergunta: string; resposta: string }
export interface RespostaAgente extends Resposta { fontes: Array<{ titulo: string; url: string }>; consultas: string[] }

let cliente: Anthropic | null = null
const anthropic = () => (cliente ??= new Anthropic({ timeout: 20_000, maxRetries: 0 }))

const brl = (v: number | null | undefined) => (v == null ? null : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))
const dia = (d: Date | null | undefined) => (d ? d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : null)
const dataHora = (d: Date | null | undefined) => (d ? d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null)
const etapaNome = (e: string | null) => (e ? NOME_ETAPA[e as Etapa] ?? e : null)
const dataDe = (s: unknown, padrao: Date) => { const d = typeof s === 'string' ? new Date(s) : null; return d && !isNaN(d.getTime()) ? d : padrao }
const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
const limite = (v: unknown, padrao: number, max: number) => Math.min(max, Math.max(1, Number(v) || padrao))

// ---------- Ferramentas (só leitura) ----------

const FERRAMENTAS: Anthropic.Beta.BetaToolUnion[] = [
  {
    name: 'metricas',
    description: 'Calcula números do dicionário de métricas da loja (faturamento, vendas, leads, conversões, tempo de resposta, atividades, tráfego etc.) para um período, com comparação e meta quando houver. Use as chaves do catálogo do sistema. Respeita o que a pessoa pode ver.',
    input_schema: {
      type: 'object',
      properties: {
        chaves: { type: 'array', items: { type: 'string' }, description: 'Chaves do catálogo (até 6).' },
        periodo: { type: 'string', enum: PERIODOS },
        sobre: { type: 'string', enum: ['EU', 'LOJA', 'PESSOA'], description: 'EU = a própria pessoa; LOJA = a loja toda; PESSOA = alguém da equipe (informe "pessoa").' },
        pessoa: { type: 'string', description: 'Primeiro nome de alguém da equipe, quando sobre = PESSOA.' },
      },
      required: ['chaves', 'periodo', 'sobre'],
    },
  },
  {
    name: 'buscar_leads',
    description: 'Lista leads/negociações do CRM com filtros. Devolve nome, telefone, etapa, moto de interesse, valor, temperatura, origem, vendedor e datas.',
    input_schema: {
      type: 'object',
      properties: {
        texto: { type: 'string', description: 'Parte do nome, telefone ou moto.' },
        etapa: { type: 'string', description: 'Etapa da jornada (ex.: LEAD, ABORDADO, LEVANTAMENTO, MQL, SQL, NEGOCIACAO, PROPOSTA, AGENDAMENTO, VISITA, VENDA) ou estágio antigo (FECHADO, PERDIDO).' },
        vendedor: { type: 'string', description: 'Primeiro nome do vendedor.' },
        temperatura: { type: 'string', enum: ['QUENTE', 'MORNO', 'FRIO'] },
        situacao: { type: 'string', enum: ['ABERTOS', 'PERDIDOS', 'FECHADOS', 'TODOS'] },
        criados_desde: { type: 'string', description: 'Data ISO (AAAA-MM-DD).' },
        criados_ate: { type: 'string', description: 'Data ISO (AAAA-MM-DD).' },
        limite: { type: 'integer', description: 'Até 40 (padrão 15).' },
      },
    },
  },
  {
    name: 'ver_lead',
    description: 'Tudo de um lead: dados, etapa, histórico de etapas, notas, follows, propostas, e as últimas mensagens do WhatsApp. Use o id que veio de buscar_leads.',
    input_schema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  },
  {
    name: 'buscar_vendas',
    description: 'Vendas registradas num intervalo: data, cliente, moto, valor da venda, pró-labore, comissão, forma de pagamento e vendedor.',
    input_schema: {
      type: 'object',
      properties: { desde: { type: 'string' }, ate: { type: 'string' }, vendedor: { type: 'string' }, texto: { type: 'string', description: 'Cliente, moto ou placa.' }, limite: { type: 'integer', description: 'Até 50 (padrão 20).' } },
    },
  },
  {
    name: 'estoque',
    description: 'Motos do estoque/vitrine da loja: modelo, marca, ano, km, cor, preço, situação, placa e data de entrada.',
    input_schema: { type: 'object', properties: { texto: { type: 'string' }, situacao: { type: 'string', description: 'Ex.: DISPONIVEL, RESERVADA, VENDIDA.' }, limite: { type: 'integer' } } },
  },
  {
    name: 'atividades',
    description: 'Atividades e follows: atrasados, de hoje ou dos próximos dias, com o que fazer, prazo, responsável e lead.',
    input_schema: { type: 'object', properties: { quando: { type: 'string', enum: ['ATRASADAS', 'HOJE', 'PROXIMOS_7_DIAS'] }, responsavel: { type: 'string', description: 'Primeiro nome (só para quem vê a equipe).' } }, required: ['quando'] },
  },
  {
    name: 'equipe',
    description: 'Pessoas da equipe: nome, papel, se está ativa e meta mensal.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'recomendacoes',
    description: 'Recomendações do ARIES em aberto ou recentes: título, área, ação sugerida, prazo e situação.',
    input_schema: { type: 'object', properties: { situacao: { type: 'string', enum: ['ABERTAS', 'TODAS'] } } },
  },
]

type Entrada = Record<string, unknown>

async function vendedorPorNome(usuarioId: string, nome: unknown) {
  const n = texto(nome)
  if (!n) return null
  return prisma.vendedor.findFirst({ where: { usuarioId, nome: { contains: n, mode: 'insensitive' } }, select: { id: true, nome: true } })
}

async function executar(ctx: ContextoPergunte, nome: string, e: Entrada, agora: Date): Promise<unknown> {
  const { pessoa } = ctx
  const u = pessoa.usuarioId
  const pessoal = PESSOAL.has(pessoa.papel)
  switch (nome) {
    case 'metricas': {
      const catalogo = await fichas(u)
      const chaves = (Array.isArray(e.chaves) ? e.chaves : []).map(String).slice(0, 6)
      const periodo = (PERIODOS as string[]).includes(String(e.periodo)) ? (e.periodo as PeriodoPedido) : 'MES'
      const sobre = e.sobre === 'LOJA' || e.sobre === 'PESSOA' ? e.sobre : 'EU'
      const r = await calcularNumeros(pessoa, { metricas: chaves, periodo, sobre, pessoa: texto(e.pessoa), acao: null, onde: null }, catalogo, agora)
      return {
        escopo: r.escopo, recusa: r.recusa ?? null, semPermissao: r.semPermissao,
        numeros: r.numeros.map(n => ({ metrica: n.nome, valor: n.valorTexto, periodo: n.periodoTexto, comparacao: n.comparacao ? { valor: n.comparacao.valorTexto, variacaoPct: n.comparacao.variacao } : null, meta: n.meta?.valorTexto ?? null, faixa: n.faixa, tela: n.link, aviso: n.aviso })),
      }
    }
    case 'buscar_leads': {
      if (!ctx.leads) return { erro: 'Seu acesso não inclui o CRM.' }
      const and: Prisma.LeadWhereInput[] = [ctx.leads]
      const t = texto(e.texto)
      if (t) { const dig = t.replace(/\D/g, ''); and.push({ OR: [{ nomeCliente: { contains: t, mode: 'insensitive' } }, { modeloInteresse: { contains: t, mode: 'insensitive' } }, ...(dig.length >= 4 ? [{ telefone: { contains: dig } }] : [])] }) }
      const et = texto(e.etapa)?.toUpperCase()
      if (et === 'FECHADO' || et === 'PERDIDO') and.push({ estagio: et }); else if (et) and.push({ etapa: et })
      if (e.temperatura) and.push({ temperatura: String(e.temperatura) })
      if (e.situacao === 'ABERTOS' || !e.situacao) and.push({ estagio: { notIn: ['FECHADO', 'PERDIDO'] } })
      else if (e.situacao === 'PERDIDOS') and.push({ estagio: 'PERDIDO' })
      else if (e.situacao === 'FECHADOS') and.push({ estagio: 'FECHADO' })
      if (e.criados_desde || e.criados_ate) and.push({ criadoEm: { gte: dataDe(e.criados_desde, new Date(0)), lte: dataDe(e.criados_ate, agora) } })
      if (e.vendedor && !pessoal) { const v = await vendedorPorNome(u, e.vendedor); and.push({ vendedorId: v?.id ?? '__nenhum__' }) }
      const where = { AND: and }
      const [total, lista] = await Promise.all([
        prisma.lead.count({ where }),
        prisma.lead.findMany({ where, orderBy: { atualizadoEm: 'desc' }, take: limite(e.limite, 15, 40), select: { id: true, nomeCliente: true, telefone: true, etapa: true, estagio: true, modeloInteresse: true, valorNegociacao: true, temperatura: true, pontuacao: true, origemTipo: true, tipoLead: true, criadoEm: true, atualizadoEm: true, entrouNaEtapaEm: true, motivoPerda: true, vendedor: { select: { nome: true } } } }),
      ])
      return { total, mostrando: lista.length, leads: lista.map(l => ({ id: l.id, nome: l.nomeCliente, telefone: l.telefone, etapa: etapaNome(l.etapa) ?? l.estagio, moto: l.modeloInteresse, valor: brl(l.valorNegociacao), temperatura: l.temperatura, nota: l.pontuacao, origem: l.origemTipo ?? l.tipoLead, vendedor: l.vendedor?.nome ?? null, criado: dia(l.criadoEm), atualizado: dia(l.atualizadoEm), naEtapaDesde: dia(l.entrouNaEtapaEm), motivoPerda: l.motivoPerda, tela: `/pro-labore/leads?lead=${l.id}` })) }
    }
    case 'ver_lead': {
      if (!ctx.leads) return { erro: 'Seu acesso não inclui o CRM.' }
      const id = String(e.id ?? '')
      const l = await prisma.lead.findFirst({
        where: { AND: [ctx.leads, { id }] },
        include: {
          vendedor: { select: { nome: true } },
          notas: { orderBy: { criadoEm: 'desc' }, take: 10, select: { texto: true, autorNome: true, criadoEm: true } },
          follows: { orderBy: { agendadoPara: 'desc' }, take: 10, select: { agendadoPara: true, status: true, tipo: true, nota: true, resultado: true, canal: true } },
          historico: { orderBy: { criadoEm: 'desc' }, take: 15 },
          assistenteConversas: { orderBy: { ultimaMensagemEm: 'desc' }, take: 1, select: { id: true, mensagens: { orderBy: { criadoEm: 'desc' }, take: 20, select: { remetente: true, texto: true, criadoEm: true } } } },
        },
      })
      if (!l) return { erro: 'Lead não encontrado (ou fora do seu acesso).' }
      const sensiveis: Array<'CPF' | 'NASCIMENTO'> = l.cpf ? ['CPF'] : []
      if (sensiveis.length) await registrarAcesso({ usuarioId: u, leadId: l.id, dados: sensiveis, quemId: pessoa.id, quemNome: `${pessoa.nome} (Pergunte ao ARIES)`, quemPapel: pessoa.papel }).catch(() => undefined)
      const msgs = l.assistenteConversas[0]?.mensagens ?? []
      return {
        id: l.id, nome: l.nomeCliente, telefone: l.telefone, email: l.email, cpf: l.cpf, endereco: l.endereco,
        etapa: etapaNome(l.etapa) ?? l.estagio, moto: l.modeloInteresse, valor: brl(l.valorNegociacao), tipoNegociacao: l.tipoNegociacao, formaPagamento: l.formaPagamento,
        temperatura: l.temperatura, nota: l.pontuacao, etiquetas: l.etiquetas, origem: l.origemTipo ?? l.tipoLead, campanha: l.origemCampanha, anuncio: l.origemTituloAnuncio,
        situacaoCnh: l.situacaoCnh, temEntrada: l.temEntrada, levantamento: l.levantamento, observacao: l.observacao,
        vendedor: l.vendedor?.nome ?? null, criado: dataHora(l.criadoEm), atualizado: dataHora(l.atualizadoEm), perda: l.motivoPerda ? { motivo: l.motivoPerda, nota: l.notaPerda, em: dia(l.perdidoEm) } : null,
        notas: l.notas.map(n => ({ texto: n.texto, autor: n.autorNome, em: dataHora(n.criadoEm) })),
        follows: l.follows.map(f => ({ quando: dataHora(f.agendadoPara), situacao: f.status, tipo: f.tipo, canal: f.canal, nota: f.nota, resultado: f.resultado })),
        historicoEtapas: l.historico.map(h => ({ ...(h as Record<string, unknown>) })),
        whatsapp: msgs.reverse().map(m => ({ de: m.remetente === 'CONTATO' ? 'cliente' : m.remetente === 'VENDEDOR' ? 'vendedor' : 'robô', texto: m.texto.slice(0, 400), em: dataHora(m.criadoEm) })),
        tela: `/pro-labore/leads?lead=${l.id}`,
      }
    }
    case 'buscar_vendas': {
      if (!pessoal && !ctx.veVendas) return { erro: 'Seu acesso não inclui Vendas.' }
      const and: Prisma.VendaWhereInput[] = [{ usuarioId: u, data: { gte: dataDe(e.desde, new Date(agora.getFullYear(), agora.getMonth(), 1)), lte: dataDe(e.ate, agora) } }]
      if (pessoal) and.push({ vendedorId: pessoa.vendedorId ?? '__nenhum__' })
      else if (e.vendedor) { const v = await vendedorPorNome(u, e.vendedor); and.push({ vendedorId: v?.id ?? '__nenhum__' }) }
      const t = texto(e.texto)
      if (t) and.push({ OR: [{ lead: { nomeCliente: { contains: t, mode: 'insensitive' } } }, { moto: { modelo: { contains: t, mode: 'insensitive' } } }, { placa: { contains: t, mode: 'insensitive' } }] })
      const where = { AND: and }
      const [soma, lista] = await Promise.all([
        prisma.venda.aggregate({ where, _count: true, _sum: { valorVenda: true, valorProLabore: true, valorComissao: true } }),
        prisma.venda.findMany({ where, orderBy: { data: 'desc' }, take: limite(e.limite, 20, 50), select: { id: true, data: true, valorVenda: true, valorProLabore: true, valorComissao: true, placa: true, lead: { select: { nomeCliente: true, formaPagamento: true } }, moto: { select: { modelo: true, ano: true } }, vendedor: { select: { nome: true } } } }),
      ])
      return {
        totais: { vendas: soma._count, faturamento: brl(soma._sum.valorVenda ?? 0), proLabore: brl(soma._sum.valorProLabore ?? 0), comissoes: brl(soma._sum.valorComissao ?? 0) },
        vendas: lista.map(v => ({ data: dia(v.data), cliente: v.lead?.nomeCliente ?? null, moto: v.moto ? `${v.moto.modelo}${v.moto.ano ? ` ${v.moto.ano}` : ''}` : null, placa: v.placa, valor: brl(v.valorVenda), proLabore: brl(v.valorProLabore), comissao: brl(v.valorComissao), pagamento: v.lead?.formaPagamento ?? null, vendedor: v.vendedor?.nome ?? null })),
      }
    }
    case 'estoque': {
      const t = texto(e.texto)
      const lista = await prisma.smMotoEstoque.findMany({
        where: { usuarioId: u, ...(e.situacao ? { situacao: String(e.situacao) } : {}), ...(t ? { OR: [{ modelo: { contains: t, mode: 'insensitive' } }, { marca: { contains: t, mode: 'insensitive' } }, { placa: { contains: t, mode: 'insensitive' } }] } : {}) },
        orderBy: { entradaEm: 'desc' }, take: limite(e.limite, 30, 60),
        select: { modelo: true, marca: true, versao: true, ano: true, km: true, cor: true, cilindrada: true, preco: true, situacao: true, placa: true, entradaEm: true, saidaEm: true, destaques: true },
      })
      return { total: lista.length, motos: lista.map(m => ({ moto: [m.marca, m.modelo, m.versao].filter(Boolean).join(' '), ano: m.ano, km: m.km, cor: m.cor, cilindrada: m.cilindrada, preco: brl(m.preco), situacao: m.situacao, placa: m.placa, entrada: dia(m.entradaEm), diasEmEstoque: Math.floor(((m.saidaEm ?? agora).getTime() - m.entradaEm.getTime()) / DIA), destaques: m.destaques })) }
    }
    case 'atividades': {
      const inicioHoje = new Date(agora.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) + 'T00:00:00-03:00')
      const fimHoje = new Date(inicioHoje.getTime() + DIA)
      const janela = e.quando === 'ATRASADAS' ? { lt: agora } : e.quando === 'HOJE' ? { gte: inicioHoje, lt: fimHoje } : { gte: agora, lt: new Date(agora.getTime() + 7 * DIA) }
      let responsavelId: string | undefined
      if (pessoal) responsavelId = pessoa.vendedorId ?? '__nenhum__'
      else if (e.responsavel) responsavelId = (await vendedorPorNome(u, e.responsavel))?.id ?? '__nenhum__'
      const [atvs, follows] = await Promise.all([
        prisma.atividade.findMany({ where: { usuarioId: u, status: { in: ['PENDENTE', 'ABERTA', 'EM_ANDAMENTO'] }, prazo: janela, ...(responsavelId ? { responsavelId } : {}) }, orderBy: { prazo: 'asc' }, take: 40, select: { codigo: true, tipo: true, oQueFazer: true, prazo: true, responsavelId: true, leadId: true, status: true } }),
        ctx.leads ? prisma.leadFollow.findMany({ where: { usuarioId: u, status: 'PENDENTE', agendadoPara: janela, lead: ctx.leads, ...(responsavelId ? { vendedorId: responsavelId } : {}) }, orderBy: { agendadoPara: 'asc' }, take: 40, select: { agendadoPara: true, tipo: true, nota: true, canal: true, lead: { select: { id: true, nomeCliente: true } }, vendedorId: true } }) : [],
      ])
      const nomes = new Map((await prisma.vendedor.findMany({ where: { usuarioId: u }, select: { id: true, nome: true } })).map(v => [v.id, v.nome]))
      return {
        atividades: atvs.map(a => ({ codigo: a.codigo, tipo: a.tipo, oQueFazer: a.oQueFazer, prazo: dataHora(a.prazo), responsavel: a.responsavelId ? nomes.get(a.responsavelId) ?? 'dono' : null, situacao: a.status })),
        follows: follows.map(f => ({ quando: dataHora(f.agendadoPara), tipo: f.tipo, canal: f.canal, nota: f.nota, lead: f.lead.nomeCliente, leadId: f.lead.id, vendedor: f.vendedorId ? nomes.get(f.vendedorId) ?? null : null })),
      }
    }
    case 'equipe': {
      if (pessoal && !ctx.veEquipe) {
        const eu = pessoa.vendedorId ? await prisma.vendedor.findUnique({ where: { id: pessoa.vendedorId }, select: { nome: true, papel: true, metaMensal: true } }) : null
        return { aviso: 'Seu perfil vê só os próprios dados.', voce: eu ? { nome: eu.nome, papel: eu.papel, metaMensal: brl(eu.metaMensal) } : null }
      }
      const lista = await prisma.vendedor.findMany({ where: { usuarioId: u }, orderBy: [{ ativo: 'desc' }, { nome: 'asc' }], select: { nome: true, papel: true, ativo: true, funcao: true, vende: true, metaMensal: true } })
      return { equipe: lista.map(v => ({ nome: v.nome, papel: v.papel, funcao: v.funcao, vende: v.vende, ativo: v.ativo, metaMensal: brl(v.metaMensal) })) }
    }
    case 'recomendacoes': {
      const lista = await prisma.recomendacao.findMany({
        where: { usuarioId: u, ...(e.situacao === 'TODAS' ? { criadoEm: { gte: new Date(agora.getTime() - 60 * DIA) } } : { status: { in: ['NOVA', 'ABERTA', 'ACEITA', 'EM_ANDAMENTO'] } }), ...(pessoa.papel === 'DONO' ? {} : { OR: [{ visivelPara: { has: pessoa.papel } }, { destinatarioId: pessoa.id }, { acompanhaIds: { has: pessoa.id } }] }) },
        orderBy: { criadoEm: 'desc' }, take: 20, select: { codigo: true, titulo: true, area: true, acaoSugerida: true, prazo: true, status: true, forca: true, contexto: true },
      })
      return { recomendacoes: lista.map(r => ({ codigo: r.codigo, titulo: r.titulo, area: r.area, acao: r.acaoSugerida, prazo: dia(r.prazo), situacao: r.status, forca: r.forca, contexto: r.contexto.slice(0, 300) })), tela: '/pro-labore/recomendacoes' }
    }
    default:
      return { erro: `Ferramenta desconhecida: ${nome}` }
  }
}

const ROTULO_FERRAMENTA: Record<string, string> = {
  metricas: 'Métricas', buscar_leads: 'Leads', ver_lead: 'Lead', buscar_vendas: 'Vendas', estoque: 'Estoque', atividades: 'Atividades', equipe: 'Equipe', recomendacoes: 'Recomendações', web_search: 'Internet',
}

// ---------- Instruções ----------

async function instrucoes(ctx: ContextoPergunte) {
  const catalogo = (await fichas(ctx.pessoa.usuarioId)).filter(f => !f.naoDefinido)
  const linhas = catalogo.map(f => `- ${f.chave}: ${f.nome} — ${f.definicao.slice(0, 140)}`).join('\n')
  // Fixo por loja (fica em cache); o que muda a cada pergunta vai na mensagem.
  return `Você é o ARIES, o assistente da loja de motos dentro do sistema ARIES (gestão comercial: CRM com jornada de 10 etapas, WhatsApp com robô de pré-atendimento, vendas, pró-labore, comissões, estoque, tráfego pago, social media, equipe, atividades e recomendações).

Responda qualquer pergunta, como um bom assistente geral:
- Sobre a operação da loja: consulte o sistema pelas ferramentas antes de afirmar qualquer número ou fato. Nunca invente dado da loja; se a ferramenta não trouxe, diga que não encontrou e onde procurar.
- Sobre qualquer outro assunto (conceitos, mercado de motos, financiamento, legislação, técnicas de venda, notícias, preços de referência): responda com seu conhecimento e use a busca na internet quando a resposta depender de algo atual ou que você não tenha certeza. Cite as fontes da internet que usar.
- Quando juntar as duas coisas (ex.: comparar o preço do estoque com o mercado), consulte o sistema e a internet.
- Faça contas quando ajudar (quanto falta para a meta, média por venda, projeções), mostrando de onde saiu cada número.
- As ferramentas já aplicam o acesso de quem pergunta. Se uma delas disser que o perfil não vê algo, explique isso e não tente contornar.
- Responda em português do Brasil, direto e curto, em texto simples com listas curtas quando ajudar. Valores em R$ no formato brasileiro. Quando fizer sentido, indique a tela do sistema (o campo "tela" das ferramentas).

Catálogo de métricas (chave: nome — definição), para a ferramenta "metricas":
${linhas}`
}

// ---------- A pergunta ----------

export async function perguntarAgente(ctx: ContextoPergunte, pergunta: string, anteriores: TrocaAnterior[] = [], canal: 'TELA' | 'WHATSAPP' = 'TELA', agora = new Date()): Promise<RespostaAgente> {
  const semAgente = async (): Promise<RespostaAgente> => ({ ...(await perguntar(ctx.pessoa, pergunta, canal, agora)), fontes: [], consultas: [] })
  if (!iaLigada()) return semAgente()
  const inicio = Date.now()
  const conversaId = `pg_${randomUUID()}`
  const sistema = await instrucoes(ctx)
  const quando = agora.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const messages: Anthropic.Beta.BetaMessageParam[] = []
  for (const t of anteriores.slice(-6)) {
    messages.push({ role: 'user', content: t.pergunta.slice(0, 1500) }, { role: 'assistant', content: t.resposta.slice(0, 3000) })
  }
  messages.push({ role: 'user', content: `[${quando} · quem pergunta: ${ctx.pessoa.nome}, papel ${ctx.pessoa.papel}]\n${pergunta}` })

  const tools: Anthropic.Beta.BetaToolUnion[] = [...FERRAMENTAS, { type: 'web_search_20260209', name: 'web_search', max_uses: 3, user_location: { type: 'approximate', country: 'BR' } }]
  const consultas: string[] = []
  const fontes = new Map<string, string>()
  let respostaFinal: string | null = null

  try {
    for (let rodada = 0; rodada < MAX_RODADAS; rodada++) {
      const restante = ORCAMENTO_MS - (Date.now() - inicio)
      // Pouco tempo: responde sem novas consultas, com o que já tem.
      const fechar = restante < 9000 || rodada === MAX_RODADAS - 1
      const r = await anthropic().beta.messages.create({
        model: MODELO, max_tokens: 4000,
        betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
        system: [{ type: 'text', text: sistema, cache_control: { type: 'ephemeral' } }],
        tools, ...(fechar ? { tool_choice: { type: 'none' } } : {}),
        output_config: { effort: 'low' },
        messages,
      }, { timeout: Math.max(5000, restante - 1000) })
      for (const b of r.content) {
        if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) for (const w of b.content) if (w.type === 'web_search_result') fontes.set(w.url, w.title)
        if (b.type === 'server_tool_use') consultas.push(ROTULO_FERRAMENTA.web_search)
      }
      if (r.stop_reason === 'refusal') { respostaFinal = 'Não posso responder isso.'; break }
      if (r.stop_reason === 'pause_turn') { messages.push({ role: 'assistant', content: r.content }); continue }
      const usos = r.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use')
      if (r.stop_reason !== 'tool_use' || !usos.length) {
        respostaFinal = r.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text').map(b => b.text).join('\n').trim()
        break
      }
      messages.push({ role: 'assistant', content: r.content })
      const resultados = await Promise.all(usos.map(async (uso): Promise<Anthropic.Beta.BetaToolResultBlockParam> => {
        consultas.push(ROTULO_FERRAMENTA[uso.name] ?? uso.name)
        try {
          const dados = await executar(ctx, uso.name, (uso.input ?? {}) as Entrada, agora)
          return { type: 'tool_result', tool_use_id: uso.id, content: JSON.stringify(dados).slice(0, 30_000) }
        } catch (e) {
          logger.warn({ err: e, ferramenta: uso.name }, 'pergunte: ferramenta falhou')
          return { type: 'tool_result', tool_use_id: uso.id, content: 'Não deu para consultar isso agora.', is_error: true }
        }
      }))
      messages.push({ role: 'user', content: resultados })
    }
  } catch (e) {
    logger.warn({ err: e }, 'pergunte: agente falhou — usando o Pergunte por regras')
    if (!respostaFinal) return semAgente()
  }
  if (!respostaFinal) return semAgente()

  const salva = await prisma.pergunteConversa.create({
    data: {
      id: conversaId, usuarioId: ctx.pessoa.usuarioId, pessoaId: ctx.pessoa.id, papel: ctx.pessoa.papel, canal, pergunta: pergunta.slice(0, 1000),
      metricas: consultas as unknown as Prisma.InputJsonValue, valores: [] as unknown as Prisma.InputJsonValue, resposta: respostaFinal.slice(0, 20_000), naoSabe: false, acoes: [] as unknown as Prisma.InputJsonValue,
    },
  })
  // Auditoria do que foi à IA (a pergunta; os dados das ferramentas seguem as permissões de quem perguntou).
  await prisma.iaEnvio.create({ data: { usuarioId: ctx.pessoa.usuarioId, conversaId, finalidade: 'AGENTE', conteudo: `${pergunta.slice(0, 1000)}\n[consultas: ${consultas.join(', ') || 'nenhuma'}]` } }).catch(() => undefined)
  return {
    id: salva.id, pergunta, resposta: respostaFinal, naoSabe: false, onde: null, numeros: [], acaoProposta: null, acoes: [], usouIa: true, criadoEm: salva.criadoEm.toISOString(),
    fontes: [...fontes].slice(0, 6).map(([url, titulo]) => ({ url, titulo })), consultas: [...new Set(consultas)],
  }
}
