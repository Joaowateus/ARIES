// Uso das respostas aprovadas da base de conhecimento: o robô responde
// dúvidas no meio do roteiro, a conversa mostra sugestões para o vendedor e
// cada uso fica registrado para medir se o lead andou no funil depois.
// Só sai para o cliente o que a loja aprovou (status ATIVO).
import { prisma } from './prisma'
import { logger } from './logger'
import { semDinheiro } from './smIA'
import { ItemResposta, MAX_RESPOSTAS_DA_BASE, acharConhecimento, parteAfirmativa, preencherResposta, respostaDaBase } from './assistenteConhecimento'
import { BaseRespostas, ContextoRoteiro, primeiroNome } from './assistenteRoteiro'
import { MotoVitrine, lerFicha, nomeDaMoto, perguntaDeEstoque, respostaDeEstoque } from './assistenteVitrine'

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

export interface VitrineLoja { motos: MotoVitrine[]; mostrarPreco: boolean; vitrineRobo: boolean }
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
  const v = { motos: motos.map(paraVitrine), mostrarPreco: loja?.mostrarPreco ?? false, vitrineRobo: loja?.vitrineRobo ?? true }
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
    const antes = RANK_ESTAGIO[u.estagioNaHora ?? 'LEAD'] ?? 0
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

/** As três últimas mensagens do cliente, mais recente primeiro (mensagens em qualquer ordem). */
export function ultimasDoCliente(mensagens: Array<{ remetente: string; texto: string; criadoEm: Date }>, n = 3): string[] {
  return mensagens.filter(m => m.remetente === 'CONTATO').sort((a, b) => b.criadoEm.getTime() - a.criadoEm.getTime()).slice(0, n).map(m => m.texto)
}
