// Aprendizado do Assistente Comercial: lê as mensagens novas dos clientes
// (só conversas de lead — conversa pessoal nunca é guardada), reconhece de
// qual dúvida/objeção da base cada uma fala, guarda a frase real como
// exemplo e o que o vendedor respondeu logo depois. O que não bate com nada
// vira assunto novo PARA_REVISAR (agrupado pela IA, ou em "Outras dúvidas").
// Nada aprendido vai para o cliente sem aprovação da loja.
import { createHash } from 'crypto'
import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { logger } from './logger'
import { MODELOS_PRONTOS, acharConhecimento, pareceDuvidaOuObjecao, paraBusca } from './assistenteConhecimento'
import { agruparDuvidas } from './assistenteIA'

const DIA = 86_400_000
const PRIMEIRA_LEITURA_DIAS = 30
// Espera a conversa "assentar": dá tempo de o vendedor responder (é dessa
// resposta que sai o rascunho).
const ATRASO_PADRAO_MS = 30 * 60_000
const JANELA_RESPOSTA_MS = 3 * 3600e3
const MAX_RESPOSTAS_EQUIPE = 5
const MAX_PARA_IA = 40
export const CHAVE_OUTRAS = 'aprendido:outras'

/** Cria (uma vez) os modelos prontos da conta. Arquivado ou editado pela loja não volta. */
export async function garantirModelosProntos(usuarioId: string): Promise<number> {
  const r = await prisma.assistenteConhecimento.createMany({
    data: MODELOS_PRONTOS.map(m => ({
      usuarioId, chave: m.chave, tipo: m.tipo, titulo: m.titulo, palavrasChave: m.palavrasChave,
      rascunho: m.rascunho, rascunhoOrigem: 'MODELO', etapa: m.etapa ?? null, status: 'PARA_REVISAR', origem: 'MODELO_PRONTO',
    })),
    skipDuplicates: true,
  })
  return r.count
}

interface RespostaEquipe { texto: string; vendedor: string | null; em: string }

export interface ResultadoAprendizado { lidas: number; reconhecidas: number; novasNaBase: number; semAssunto: number; ia: boolean }

type MensagemLida = Prisma.AssistenteMensagemGetPayload<{
  select: { id: true; texto: true; criadoEm: true; conversaId: true; conversa: { select: { leadId: true; lead: { select: { estagio: true } }; assistente: { select: { vendedorId: true; vendedor: { select: { nome: true } } } } } } }
}>

export async function aprenderConta(usuarioId: string, opcoes: { atrasoMs?: number; limite?: number; usarIA?: boolean } = {}): Promise<ResultadoAprendizado> {
  const agora = Date.now()
  const ate = new Date(agora - (opcoes.atrasoMs ?? ATRASO_PADRAO_MS))
  const estado = await prisma.assistenteAprendizadoEstado.findUnique({ where: { usuarioId } })
  const desde = estado?.lidoAte ?? new Date(agora - PRIMEIRA_LEITURA_DIAS * DIA)
  const limite = opcoes.limite ?? 300
  const resultado: ResultadoAprendizado = { lidas: 0, reconhecidas: 0, novasNaBase: 0, semAssunto: 0, ia: false }
  if (desde >= ate) return resultado

  await garantirModelosProntos(usuarioId)
  const mensagens: MensagemLida[] = await prisma.assistenteMensagem.findMany({
    where: { remetente: 'CONTATO', criadoEm: { gt: desde, lte: ate }, conversa: { tipo: 'LEAD', assistente: { vendedor: { usuarioId } } } },
    orderBy: { criadoEm: 'asc' },
    take: limite,
    select: { id: true, texto: true, criadoEm: true, conversaId: true, conversa: { select: { leadId: true, lead: { select: { estagio: true } }, assistente: { select: { vendedorId: true, vendedor: { select: { nome: true } } } } } } },
  })
  resultado.lidas = mensagens.length
  // Se o lote veio cheio, a próxima rodada continua de onde parou.
  const lidoAte = mensagens.length === limite ? mensagens[mensagens.length - 1].criadoEm : ate

  if (mensagens.length) {
    const base = await prisma.assistenteConhecimento.findMany({ where: { usuarioId }, select: { id: true, titulo: true, palavrasChave: true, chave: true } })
    const reconhecidas: Array<{ m: MensagemLida; itemId: string }> = []
    const semAssunto: MensagemLida[] = []
    for (const m of mensagens) {
      const candidata = pareceDuvidaOuObjecao(m.texto)
      const [melhor] = acharConhecimento(m.texto, base.filter(b => b.chave !== CHAVE_OUTRAS))
      // Resposta de roteiro ("Financiado", "3 mil de entrada") cita o assunto
      // mas não é dúvida: só conta se parecer pergunta/objeção ou se casar
      // uma expressão de várias palavras.
      if (melhor && (candidata || melhor.pontos >= 4)) reconhecidas.push({ m, itemId: melhor.item.id })
      else if (candidata) semAssunto.push(m)
    }
    resultado.reconhecidas = reconhecidas.length

    // Assuntos novos: a IA agrupa; sem ela (ou o que sobrar), "Outras dúvidas".
    const novas: Array<{ m: MensagemLida; itemId: string }> = []
    let restantes = semAssunto
    if (semAssunto.length && opcoes.usarIA !== false) {
      const lote = semAssunto.slice(0, MAX_PARA_IA)
      const grupos = await agruparDuvidas(usuarioId, lote.map(m => m.texto), base.filter(b => b.chave !== CHAVE_OUTRAS).map(b => b.titulo))
      if (grupos) {
        resultado.ia = true
        const usadas = new Set<number>()
        for (const g of grupos) {
          const idx = g.mensagens.filter(i => !usadas.has(i))
          if (!idx.length) continue
          idx.forEach(i => usadas.add(i))
          const chave = `aprendido:${createHash('sha1').update(paraBusca(g.titulo)).digest('hex').slice(0, 16)}`
          const item = await prisma.assistenteConhecimento.upsert({
            where: { usuarioId_chave: { usuarioId, chave } },
            update: {},
            create: {
              usuarioId, chave, tipo: g.tipo, titulo: g.titulo, palavrasChave: g.palavrasChave, status: 'PARA_REVISAR', origem: 'APRENDIDO',
              ...(g.rascunho && { rascunho: g.rascunho, rascunhoOrigem: 'IA' }),
            },
            select: { id: true },
          })
          resultado.novasNaBase += 1
          for (const i of idx) novas.push({ m: lote[i], itemId: item.id })
        }
        restantes = [...lote.filter((_, i) => !usadas.has(i)), ...semAssunto.slice(MAX_PARA_IA)]
      }
    }
    if (restantes.length) {
      const outras = await prisma.assistenteConhecimento.upsert({
        where: { usuarioId_chave: { usuarioId, chave: CHAVE_OUTRAS } },
        update: {},
        create: { usuarioId, chave: CHAVE_OUTRAS, tipo: 'DUVIDA', titulo: 'Outras dúvidas (ainda sem assunto)', status: 'PARA_REVISAR', origem: 'APRENDIDO' },
        select: { id: true },
      })
      for (const m of restantes) novas.push({ m, itemId: outras.id })
    }
    resultado.semAssunto = restantes.length

    await registrarOcorrencias(usuarioId, [...reconhecidas, ...novas])
  }

  await prisma.assistenteAprendizadoEstado.upsert({
    where: { usuarioId },
    create: { usuarioId, lidoAte, rodadaEm: new Date() },
    update: { lidoAte, rodadaEm: new Date() },
  })
  return resultado
}

// Guarda as frases reais, soma as ocorrências e pega a resposta do vendedor
// que veio logo depois (é o melhor ponto de partida para o rascunho).
async function registrarOcorrencias(usuarioId: string, lista: Array<{ m: MensagemLida; itemId: string }>) {
  if (!lista.length) return
  const criadas = await prisma.assistenteConhecimentoOcorrencia.createMany({
    data: lista.map(({ m, itemId }) => ({
      usuarioId, conhecimentoId: itemId, mensagemId: m.id, conversaId: m.conversaId, leadId: m.conversa.leadId,
      vendedorId: m.conversa.assistente.vendedorId, texto: m.texto.slice(0, 500), estagioNaHora: m.conversa.lead?.estagio ?? null, criadoEm: m.criadoEm,
    })),
    skipDuplicates: true,
  })
  if (!criadas.count) return
  const porItem = new Map<string, Array<MensagemLida>>()
  for (const { m, itemId } of lista) porItem.set(itemId, [...(porItem.get(itemId) ?? []), m])

  for (const [itemId, msgs] of porItem) {
    const item = await prisma.assistenteConhecimento.findUnique({ where: { id: itemId }, select: { respostasEquipe: true, rascunho: true } })
    if (!item) continue
    const respostas = ((item.respostasEquipe ?? []) as unknown as RespostaEquipe[]).slice()
    for (const m of msgs) {
      const resposta = await prisma.assistenteMensagem.findFirst({
        where: { conversaId: m.conversaId, remetente: 'VENDEDOR', criadoEm: { gt: m.criadoEm, lte: new Date(m.criadoEm.getTime() + JANELA_RESPOSTA_MS) } },
        orderBy: { criadoEm: 'asc' },
        select: { texto: true, criadoEm: true },
      })
      if (resposta && resposta.texto.trim().length >= 8 && !respostas.some(r => r.texto === resposta.texto)) {
        respostas.unshift({ texto: resposta.texto.slice(0, 700), vendedor: m.conversa.assistente.vendedor.nome, em: resposta.criadoEm.toISOString() })
      }
    }
    const ultima = msgs.reduce((d, m) => (m.criadoEm > d ? m.criadoEm : d), msgs[0].criadoEm)
    const equipe = respostas.slice(0, MAX_RESPOSTAS_EQUIPE)
    const total = await prisma.assistenteConhecimentoOcorrencia.count({ where: { conhecimentoId: itemId } })
    await prisma.assistenteConhecimento.update({
      where: { id: itemId },
      data: {
        ocorrencias: total,
        ultimaOcorrenciaEm: ultima,
        respostasEquipe: equipe as unknown as Prisma.InputJsonValue,
        // Sem rascunho ainda: parte do que a equipe respondeu de verdade.
        ...(!item.rascunho && equipe[0] && { rascunho: equipe[0].texto, rascunhoOrigem: 'VENDEDOR' }),
      },
    })
  }
}

/** Rodada do cron: cada conta com WhatsApp conectado, dentro do tempo que sobra. */
export async function aprenderTodas(prazoMs: number): Promise<{ aprendizadoContas: number; aprendizadoReconhecidas: number }> {
  const inicio = Date.now()
  const contas = await prisma.vendedor.findMany({ where: { assistenteComercial: { isNot: null } }, distinct: ['usuarioId'], select: { usuarioId: true } })
  let n = 0, reconhecidas = 0
  for (const c of contas) {
    if (Date.now() - inicio > prazoMs) break
    try {
      const r = await aprenderConta(c.usuarioId)
      n += 1; reconhecidas += r.reconhecidas
    } catch (e) {
      logger.error({ err: e, usuarioId: c.usuarioId }, 'assistente: falha no aprendizado')
    }
  }
  return { aprendizadoContas: n, aprendizadoReconhecidas: reconhecidas }
}
