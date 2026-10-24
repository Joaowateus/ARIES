// Uso das respostas aprovadas da base de conhecimento: o robô responde
// dúvidas no meio do roteiro, a conversa mostra sugestões para o vendedor e
// cada uso fica registrado para medir se o lead andou no funil depois.
// Só sai para o cliente o que a loja aprovou (status ATIVO).
import { prisma } from './prisma'
import { logger } from './logger'
import { semDadosPessoais, semDinheiro } from './smIA'
import { ItemResposta, MAX_RESPOSTAS_DA_BASE, acharConhecimento, parteAfirmativa, preencherResposta, respostaDaBase } from './assistenteConhecimento'
import { BaseRespostas, ConfigAssistente, ContextoRoteiro, SimuladorRoteiro, preencher, primeiroNome, respostaDoCampo } from './assistenteRoteiro'
import { MotoVitrine, acharMotos, lerFicha, nomeDaMoto, perguntaDeEstoque, respostaDeEstoque } from './assistenteVitrine'
import {
  ConfigSimulacao, ResultadoSimulacao, TEXTO_CPF, TEXTO_CPF_INVALIDO, TEXTO_NASCIMENTO, TEXTO_NASCIMENTO_INVALIDO, TEXTO_RENDA, aceitaPreAnalise,
  lerConfigSimulacao, lerCpf, lerNascimento, lerValor, recusaPreAnalise, simular, textoConsentimento, textoFichaRecebida, textoSimulacao, vaiFinanciar,
} from './assistenteSimulacao'

const DIA = 86_400_000
const CACHE_MS = 60_000
// Sem avanço em 3 dias, a resposta conta como "não avançou".
const PRAZO_AVANCO_MS = 3 * DIA
export const RANK_ESTAGIO: Record<string, number> = { LEAD: 0, ABORDADO: 1, NEGOCIACAO: 2, PROPOSTA: 3, FECHADO: 4 }

export interface ItemAtivo extends ItemResposta { tipo: string; etapa: string | null; usos: number; avancos: number }

const cache = new Map<string, { em: number; itens: ItemAtivo[] }>()

export async function respostasAtivas(usuarioId: string): Promise<ItemAtivo[]> {
  const c = cache.get(usuarioId)
  if (c && Date.now() - c.em < CACHE_MS) return c.itens
  const linhas = await prisma.assistenteConhecimento.findMany({
    where: { usuarioId, status: 'ATIVO', resposta: { not: null } },
    select: { id: true, tipo: true, titulo: true, palavrasChave: true, resposta: true, etapa: true, usos: true, avancos: true },
  })
  const itens = linhas.filter(l => l.resposta?.trim()).map(l => ({ ...l, resposta: l.resposta! }))
  cache.set(usuarioId, { em: Date.now(), itens })
  return itens
}

/** Depois de aprovar/editar na aba Conhecimento: o robô já usa a versão nova. */
export function esquecerRespostasAtivas(usuarioId: string) {
  cache.delete(usuarioId)
}

// ---------- Vitrine (estoque) ----------

export interface VitrineLoja {
  motos: MotoVitrine[]
  mostrarPreco: boolean
  vitrineRobo: boolean
  // Taxas da simulação de financiamento (null = a loja ainda não cadastrou)
  // e se o robô simula sozinho no fim do roteiro.
  simulacao: ConfigSimulacao | null
  simulacaoAtiva: boolean
}
const cacheVitrine = new Map<string, { em: number; v: VitrineLoja }>()
// Vendida há pouco ainda entra: o cliente pergunta dela e recebe as parecidas.
const VENDIDA_RECENTE_MS = 60 * DIA

export const SELECT_MOTO_VITRINE = {
  id: true, modelo: true, marca: true, ano: true, cor: true, situacao: true, versao: true, km: true, cilindrada: true,
  preco: true, destaques: true, ficha: true, fotos: true, videoUrl: true,
} as const

export function paraVitrine(m: { ficha: unknown } & Omit<MotoVitrine, 'ficha'>): MotoVitrine {
  return { ...m, ficha: lerFicha(m.ficha) }
}

export async function vitrineDaLoja(usuarioId: string): Promise<VitrineLoja> {
  const c = cacheVitrine.get(usuarioId)
  if (c && Date.now() - c.em < CACHE_MS) return c.v
  const [motos, loja] = await Promise.all([
    prisma.smMotoEstoque.findMany({
      where: { usuarioId, OR: [{ situacao: { in: ['DISPONIVEL', 'RESERVADA'] } }, { situacao: 'VENDIDA', saidaEm: { gte: new Date(Date.now() - VENDIDA_RECENTE_MS) } }] },
      select: SELECT_MOTO_VITRINE,
      orderBy: { entradaEm: 'desc' },
    }),
    prisma.assistenteLoja.findUnique({ where: { usuarioId } }),
  ])
  const simulacao = loja?.simulacaoConfig ? lerConfigSimulacao(loja.simulacaoConfig) : null
  const v = {
    motos: motos.map(paraVitrine), mostrarPreco: loja?.mostrarPreco ?? false, vitrineRobo: loja?.vitrineRobo ?? true,
    simulacao, simulacaoAtiva: !!simulacao && (loja?.simulacaoAtiva ?? false),
  }
  cacheVitrine.set(usuarioId, { em: Date.now(), v })
  return v
}

export function esquecerVitrine(usuarioId: string) {
  cacheVitrine.delete(usuarioId)
}

/**
 * O que o robô responde sozinho: "tem a XRE?" com a ficha e a foto do
 * estoque; dúvidas e objeções com a resposta aprovada (argumentos e
 * gatilhos ficam para o vendedor).
 */
export function baseParaRobo(itens: ItemAtivo[], ctx: ContextoRoteiro & { moto?: string | null }, vitrine?: VitrineLoja): BaseRespostas | undefined {
  const doRobo = itens.filter(i => i.tipo === 'DUVIDA' || i.tipo === 'OBJECAO')
  const motos = vitrine?.vitrineRobo ? vitrine.motos : []
  if (!doRobo.length && !motos.length) return undefined
  return {
    responder: (texto, usados) => {
      // O limite de respostas automáticas por conversa vale para as duas.
      if (usados.length >= MAX_RESPOSTAS_DA_BASE) return null
      const alvo = motos.length ? perguntaDeEstoque(texto, motos) : null
      if (alvo && !usados.includes(`moto:${alvo.id}`)) {
        const r = respostaDeEstoque(alvo, motos, { mostrarPreco: vitrine!.mostrarPreco, nome: primeiroNome(ctx.nomeContato) })
        if (r) {
          return {
            id: `moto:${alvo.id}`, motoId: alvo.id, texto: r.texto, foto: r.foto, resto: parteAfirmativa(texto),
            ...(r.disponivel && { valeComo: { campo: 'modeloInteresse' as const, valor: nomeDaMoto(alvo) } }),
          }
        }
      }
      const item = respostaDaBase(texto, doRobo, usados)
      return item ? { id: item.id, texto: preencherResposta(item.resposta, ctx), resto: parteAfirmativa(texto) } : null
    },
  }
}

export async function registrarUso(dados: { usuarioId: string; conhecimentoId: string; conversaId: string; leadId: string | null; canal: 'ROBO' | 'SUGESTAO' }) {
  const lead = dados.leadId ? await prisma.lead.findUnique({ where: { id: dados.leadId }, select: { estagio: true } }) : null
  await prisma.$transaction([
    prisma.assistenteConhecimentoUso.create({ data: { ...dados, estagioNaHora: lead?.estagio ?? null } }),
    prisma.assistenteConhecimento.update({ where: { id: dados.conhecimentoId }, data: { usos: { increment: 1 } } }),
  ])
}

/**
 * Rodada do cron: para cada uso ainda sem resultado, confere se o lead
 * andou no funil desde então (avançou) ou se passaram 3 dias (não avançou).
 */
export async function verificarAvancos(limite = 500): Promise<{ usosVerificados: number; usosComAvanco: number }> {
  const pendentes = await prisma.assistenteConhecimentoUso.findMany({ where: { verificadoEm: null }, orderBy: { criadoEm: 'asc' }, take: limite })
  if (!pendentes.length) return { usosVerificados: 0, usosComAvanco: 0 }
  const leadIds = [...new Set(pendentes.map(u => u.leadId).filter((x): x is string => !!x))]
  const leads = new Map((await prisma.lead.findMany({ where: { id: { in: leadIds } }, select: { id: true, estagio: true } })).map(l => [l.id, l.estagio]))
  const agora = Date.now()
  let verificados = 0, comAvanco = 0
  for (const u of pendentes) {
    const atual = u.leadId ? leads.get(u.leadId) : undefined
    // Lead → Abordado é só o vendedor respondendo (e o assistente move sozinho):
    // avanço de verdade é chegar a Negociação ou além.
    const antes = Math.max(RANK_ESTAGIO[u.estagioNaHora ?? 'LEAD'] ?? 0, RANK_ESTAGIO.ABORDADO)
    const avancou = atual !== undefined && (RANK_ESTAGIO[atual] ?? -1) > antes
    if (!avancou && agora - u.criadoEm.getTime() < PRAZO_AVANCO_MS) continue
    try {
      await prisma.$transaction([
        prisma.assistenteConhecimentoUso.update({ where: { id: u.id }, data: { avancou, verificadoEm: new Date() } }),
        ...(avancou ? [prisma.assistenteConhecimento.update({ where: { id: u.conhecimentoId }, data: { avancos: { increment: 1 } } })] : []),
      ])
      verificados += 1
      if (avancou) comAvanco += 1
    } catch (e) {
      // Item excluído no meio do caminho: o uso some junto (cascade).
      logger.warn({ err: e, usoId: u.id }, 'assistente: falha ao verificar avanço do uso')
    }
  }
  return { usosVerificados: verificados, usosComAvanco: comAvanco }
}

export interface SugestaoDaBase {
  id: string
  tipo: string
  titulo: string
  texto: string
  motivo: string
  usos: number
  avancos: number
}

/**
 * Sugestões para o vendedor na conversa: respostas aprovadas para o que o
 * cliente perguntou por último, mais argumentos da etapa do lead no CRM.
 */
export function sugestoesDaBase(itens: ItemAtivo[], dados: { textosDoCliente: string[]; estagio: string | null; ctx: ContextoRoteiro & { moto?: string | null } }): SugestaoDaBase[] {
  const sugestoes: SugestaoDaBase[] = []
  const vistos = new Set<string>()
  const montar = (i: ItemAtivo, motivo: string) => {
    vistos.add(i.id)
    sugestoes.push({ id: i.id, tipo: i.tipo, titulo: i.titulo, texto: preencherResposta(i.resposta, dados.ctx), motivo, usos: i.usos, avancos: i.avancos })
  }
  // Mais recente primeiro: a última pergunta do cliente é a mais urgente.
  for (const texto of dados.textosDoCliente) {
    for (const achado of acharConhecimento(texto, itens.filter(i => !vistos.has(i.id))).slice(0, 2)) {
      if (sugestoes.length >= 3) break
      montar(achado.item, `Cliente: "${texto.length > 70 ? `${texto.slice(0, 70)}…` : texto}"`)
    }
  }
  const taxa = (i: ItemAtivo) => (i.avancos + 1) / (i.usos + 2)
  const daEtapa = itens
    .filter(i => !vistos.has(i.id) && (i.tipo === 'ARGUMENTO' || i.tipo === 'GATILHO') && (!i.etapa || i.etapa === dados.estagio))
    .sort((a, b) => taxa(b) - taxa(a))
  for (const i of daEtapa.slice(0, 5 - sugestoes.length)) montar(i, i.etapa ? `Argumento para a etapa ${i.etapa.toLowerCase()}` : 'Argumento da loja')
  return sugestoes
}

/** Para a IA do Copiloto: as respostas da loja que batem com a conversa, sem valores em R$. */
export function respostasDaLojaParaIA(sugestoes: SugestaoDaBase[]): Array<{ assunto: string; resposta: string }> {
  return sugestoes.filter(s => s.tipo === 'DUVIDA' || s.tipo === 'OBJECAO').slice(0, 3)
    .map(s => ({ assunto: s.titulo, resposta: semDinheiro(s.texto) }))
}

/** Respostas do roteiro para a IA: sem as chaves internas (renda, controle da base). */
export function respostasParaIA(respostas: unknown): Record<string, string> | null {
  if (!respostas || typeof respostas !== 'object') return null
  return Object.fromEntries(Object.entries(respostas as Record<string, string>).filter(([k]) => !k.startsWith('_')))
}

/** A renda, o CPF e a data de nascimento do cliente não vão para a IA. */
export function textoParaIA(texto: string, respostas: unknown): string {
  const renda = (respostas as Record<string, string> | null)?._renda
  if (renda && texto.trim().slice(0, 80) === renda) return '[renda informada para a simulação]'
  return semDadosPessoais(texto.slice(0, 600))
}

/** As três últimas mensagens do cliente, mais recente primeiro (mensagens em qualquer ordem). */
export function ultimasDoCliente(mensagens: Array<{ remetente: string; texto: string; criadoEm: Date }>, n = 3): string[] {
  return mensagens.filter(m => m.remetente === 'CONTATO').sort((a, b) => b.criadoEm.getTime() - a.criadoEm.getTime()).slice(0, n).map(m => m.texto)
}

// ---------- Simulação de financiamento ----------

/** A moto de interesse no estoque, com preço (vendida não entra). */
export function motoComPreco(interesse: string | null | undefined, motos: MotoVitrine[]): MotoVitrine | null {
  if (!interesse) return null
  return acharMotos(interesse, motos.filter(m => m.situacao !== 'VENDIDA' && (m.preco ?? 0) > 0))[0] ?? null
}

export interface DadosSimulacao extends ResultadoSimulacao { moto: string | null; motoId: string | null; origem: 'ROBO' | 'VENDEDOR'; criadoEm: string }

export function montarSimulacao(d: { valor: number; entrada: number | null; renda: number | null; moto: MotoVitrine | null; vitrine: VitrineLoja; vendedor: string; origem: 'ROBO' | 'VENDEDOR' }): { texto: string; dados: DadosSimulacao } | null {
  const cfg = d.vitrine.simulacao
  if (!cfg) return null
  const r = simular({ valor: d.valor, entrada: d.entrada, renda: d.renda, cfg })
  if (!r) return null
  const vendedor = primeiroNome(d.vendedor) || d.vendedor
  const aviso = cfg.aviso.replace(/\{vendedor\}/g, vendedor)
  const moto = d.moto ? nomeDaMoto(d.moto) : null
  return {
    texto: textoSimulacao(r, { moto, mostrarPreco: d.vitrine.mostrarPreco, aviso, vendedor }),
    dados: { ...r, moto, motoId: d.moto?.id ?? null, origem: d.origem, criadoEm: new Date().toISOString() },
  }
}

/**
 * Simulador do robô: só para quem disse que vai financiar e cuja moto de
 * interesse tem preço no estoque; a entrada sai da resposta do roteiro e a
 * renda do passo extra (opcional).
 */
export function simuladorDoRobo(cfg: ConfigAssistente, ctx: ContextoRoteiro, vitrine?: VitrineLoja): SimuladorRoteiro | undefined {
  if (!vitrine?.simulacaoAtiva || !vitrine.simulacao) return undefined
  const sc = vitrine.simulacao
  const alvo = (r: Record<string, string>) => (vaiFinanciar(respostaDoCampo(cfg, r, 'formaPagamento')) ? motoComPreco(respostaDoCampo(cfg, r, 'modeloInteresse'), vitrine.motos) : null)
  const vendedor = primeiroNome(ctx.vendedor) || ctx.vendedor
  return {
    textoRenda: preencher(TEXTO_RENDA, ctx),
    ficha: sc.preAnalise && sc.bancos.length ? {
      consentimento: textoConsentimento(sc.bancos, vendedor), recebido: textoFichaRecebida(vendedor),
      textos: { cpf: TEXTO_CPF, cpfInvalido: TEXTO_CPF_INVALIDO, nascimento: TEXTO_NASCIMENTO, nascimentoInvalido: TEXTO_NASCIMENTO_INVALIDO },
      aceita: aceitaPreAnalise, recusa: recusaPreAnalise, lerCpf, lerNascimento: t => lerNascimento(t),
    } : null,
    avaliar: r => (alvo(r) ? { perguntarRenda: sc.perguntarRenda } : null),
    simular: r => {
      const moto = alvo(r)
      if (!moto?.preco) return null
      const s = montarSimulacao({
        valor: moto.preco, entrada: lerValor(respostaDoCampo(cfg, r, 'valorEntrada') ?? ''), renda: r._renda ? lerValor(r._renda) : null,
        moto, vitrine, vendedor: ctx.vendedor, origem: 'ROBO',
      })
      return s ? { texto: s.texto, dados: s.dados as unknown as Record<string, unknown> } : null
    },
  }
}
