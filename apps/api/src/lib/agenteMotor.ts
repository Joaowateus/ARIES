// Aries no WhatsApp — o motor: webhook do número do agente, vínculo pelo
// código, a conversa (entender → responder → mandar em partes, com
// "digitando..." antes de cada uma, como uma pessoa), o resumo da manhã e os
// avisos de lead esperando.
//
// Segurança: só responde com dados para números vinculados por código (a
// pessoa gera o código logada no sistema e manda do próprio WhatsApp). Número
// desconhecido recebe só a apresentação. O vendedor recebe só o que é dele.
import { randomBytes } from 'crypto'
import type { AgenteVinculo, AgenteWhatsapp } from '@prisma/client'
import { prisma } from './prisma'
import { logger } from './logger'
import { lerMensagens, type MensagemWhatsapp } from './assistenteMotor'
import { atualizarPerfil, perfilInstancia } from './whatsappEvolution'
import { entenderMensagem, intencaoDoRotulo, novoCodigo, textoAjuda, variar, type Intencao } from './agenteConversa'
import { enviarComoPessoa } from './agenteEnvio'
import { responderIntencao, resumoDaManha, type ContextoAgente } from './agenteRespostas'
import { classificarMensagemAgente, iaLigada } from './copilotoIA'
import { conversarComCopiloto } from './copilotoChat'
import { EQUIPE, primeiroNome } from './copilotoFatos'

export const DONO = 'DONO'
const MIN = 60_000
const H = 60 * MIN

export const instanciaDoAgente = (usuarioId: string) => `aries-agente-${usuarioId}`
export const novoSegredo = () => randomBytes(24).toString('hex')
export const RECADO_AGENTE = 'Assistente da equipe comercial 🤖'
/** A logo da loja como foto do agente (servida pelo site; AGENTE_FOTO_URL troca). */
export function fotoDoAgente(): string | undefined {
  if (process.env.AGENTE_FOTO_URL) return process.env.AGENTE_FOTO_URL
  const site = (process.env.FRONTEND_URL ?? '').replace(/\/+$/, '')
  return site ? `${site}/sm-icone-512.png` : undefined
}
export const linkDoCodigo = (numero: string | null, codigo: string) => (numero ? `https://wa.me/${numero}?text=${encodeURIComponent(`ARIES ${codigo}`)}` : null)
const horaBR = (d: Date) => new Date(d.getTime() - 3 * H).toISOString().slice(11, 16)
const diaBR = (d: Date) => new Date(d.getTime() - 3 * H).toISOString().slice(0, 10)

// ---------- Perfil e conexão ----------

export async function aplicarPerfil(agente: Pick<AgenteWhatsapp, 'id' | 'instancia' | 'nome'>) {
  const r = await atualizarPerfil(agente.instancia, { nome: agente.nome, recado: RECADO_AGENTE, fotoUrl: fotoDoAgente() })
  if (r.nome || r.foto) await prisma.agenteWhatsapp.update({ where: { id: agente.id }, data: { perfilEm: new Date() } })
  return r
}

export async function marcarAgenteConectado(agente: AgenteWhatsapp) {
  let numero: string | null = null
  try { numero = (await perfilInstancia(agente.instancia)).numero } catch (e) { logger.warn({ err: e }, 'agente: perfil da instância indisponível') }
  const atualizado = await prisma.agenteWhatsapp.update({ where: { id: agente.id }, data: { status: 'CONECTADO', ...(numero && { numero }) } })
  if (!atualizado.perfilEm) await aplicarPerfil(atualizado).catch(e => logger.warn({ err: e }, 'agente: não aplicou nome/foto'))
  return atualizado
}

// ---------- Quem está do outro lado ----------

export async function contextoDoVinculo(agente: Pick<AgenteWhatsapp, 'usuarioId'>, vinculo: Pick<AgenteVinculo, 'pessoa'>): Promise<ContextoAgente | null> {
  if (vinculo.pessoa === DONO) {
    const dono = await prisma.proLaboreUsuario.findUnique({ where: { id: agente.usuarioId }, select: { nome: true } })
    return dono ? { usuarioId: agente.usuarioId, pessoa: DONO, nome: primeiroNome(dono.nome), dono: true, assistente: null } : null
  }
  const v = await prisma.vendedor.findFirst({ where: { id: vinculo.pessoa, usuarioId: agente.usuarioId, ativo: true }, select: { id: true, nome: true, usuarioId: true, assistenteComercial: { select: { id: true } } } })
  if (!v) return null
  return {
    usuarioId: agente.usuarioId, pessoa: v.id, nome: primeiroNome(v.nome), dono: false,
    assistente: v.assistenteComercial ? { id: v.assistenteComercial.id, vendedorId: v.id, vendedor: { nome: v.nome, usuarioId: v.usuarioId } } : null,
  }
}

const naoEntendi = (c: ContextoAgente, semente: string) =>
  `${variar(['Hmm, essa eu ainda não sei responder. 🤔', 'Não peguei bem essa. 🤔', 'Essa me pegou! 😅'], semente)}\n\n${textoAjuda(c.nome, c.dono)}`

// ---------- Webhook ----------

type Obj = Record<string, unknown>
const obj = (v: unknown): Obj => (v && typeof v === 'object' ? (v as Obj) : {})
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)
// Número desconhecido recebe a apresentação no máximo a cada 12h (por instância do servidor).
const apresentados = new Map<string, number>()
// Contato com endereço anônimo do WhatsApp ("@lid", sem o telefone): responde e vincula pelo próprio endereço.
const contatoDa = (m: MensagemWhatsapp) => (m.semTelefone ? m.jid : m.numero)

export async function processarWebhookAgente(segredo: string, corpo: unknown): Promise<number> {
  const agente = await prisma.agenteWhatsapp.findUnique({ where: { segredo } })
  if (!agente) return 404
  const c = obj(corpo)
  const evento = (str(c.event) ?? '').toLowerCase().replace(/_/g, '.')
  if (evento === 'connection.update') {
    const estado = str(obj(c.data).state)
    if (estado === 'open') await marcarAgenteConectado(agente)
    else if (estado === 'close' && agente.status === 'CONECTADO') await prisma.agenteWhatsapp.update({ where: { id: agente.id }, data: { status: 'DESCONECTADO' } })
    return 200
  }
  if (evento !== 'messages.upsert') return 200
  for (const m of lerMensagens(c.data)) {
    try { await tratarMensagem(agente, m) } catch (e) { logger.error({ err: e, agenteId: agente.id }, 'agente: falha ao processar mensagem') }
  }
  return 200
}

async function tratarMensagem(agente: AgenteWhatsapp, m: MensagemWhatsapp, agora = new Date()) {
  // O eco do que o próprio agente mandou, mídia sem texto e reentrega antiga ficam de fora.
  if (m.deMim || !m.ehTexto || !m.texto?.trim()) return
  if (m.instanteMs && agora.getTime() - m.instanteMs > 15 * MIN) return
  if (m.id && (await prisma.agenteMensagem.findUnique({ where: { externoId: m.id }, select: { id: true } }))) return

  const intencao = entenderMensagem(m.texto)
  if (intencao?.tipo === 'VINCULAR') { await vincular(agente, m, intencao.codigo, agora); return }

  const contato = contatoDa(m)
  const vinculo = await prisma.agenteVinculo.findUnique({ where: { agenteId_numero: { agenteId: agente.id, numero: contato } } })
  if (!vinculo?.verificadoEm) {
    const chave = `${agente.id}|${contato}`
    if ((apresentados.get(chave) ?? 0) > agora.getTime() - 12 * H) return
    if (apresentados.size > 2000) for (const [k, t] of apresentados) if (t < agora.getTime() - 12 * H) apresentados.delete(k)
    apresentados.set(chave, agora.getTime())
    await enviarComoPessoa(agente, contato, `Oi! Eu sou o *${agente.nome}*, assistente da equipe comercial. 🤖\n\nPara conversar comigo, gere o seu código no sistema (Copiloto › ${agente.nome} no WhatsApp) e me mande aqui, assim: *ARIES 123456*.`)
    return
  }
  await prisma.agenteMensagem.create({ data: { vinculoId: vinculo.id, direcao: 'ENTRADA', texto: m.texto.slice(0, 4000), intencao: intencao?.tipo ?? null, externoId: m.id ?? null } })
  const ctx = await contextoDoVinculo(agente, vinculo)
  if (!ctx) { await enviarComoPessoa(agente, contato, 'Seu acesso à equipe não está ativo no sistema. Fala com o gestor. 🙏', { vinculoId: vinculo.id }); return }

  // A IA só classifica o que as regras não pegaram (só o texto da pergunta, sem dados).
  let i: Intencao | null = intencao
  if (!i && iaLigada()) { const rotulo = await classificarMensagemAgente(agente.usuarioId, m.texto); i = rotulo ? intencaoDoRotulo(rotulo) : null }
  if (i?.tipo === 'PAUSAR' || i?.tipo === 'RETOMAR') await prisma.agenteVinculo.update({ where: { id: vinculo.id }, data: { alertas: i.tipo === 'RETOMAR', manha: i.tipo === 'RETOMAR' } })

  let resposta: string
  if (i) resposta = await responderIntencao(ctx, i, agora)
  else if (iaLigada()) {
    // Conversa livre (técnica de venda, como responder um cliente...): o mentor do Copiloto responde.
    const r = await conversarComCopiloto({ usuarioId: agente.usuarioId, pessoa: ctx.dono ? EQUIPE : ctx.pessoa, nome: ctx.nome }, m.texto)
    resposta = r.origem === 'IA' ? r.resposta : naoEntendi(ctx, m.texto)
  } else resposta = naoEntendi(ctx, m.texto)
  await enviarComoPessoa(agente, contato, resposta, { vinculoId: vinculo.id, intencao: i?.tipo ?? 'LIVRE' })
}

async function vincular(agente: AgenteWhatsapp, m: MensagemWhatsapp, codigo: string, agora: Date) {
  const v = await prisma.agenteVinculo.findUnique({ where: { agenteId_codigo: { agenteId: agente.id, codigo } } })
  const contato = contatoDa(m)
  if (!v) {
    await enviarComoPessoa(agente, contato, 'Esse código não confere. 🤔 Gere um novo no sistema (Copiloto) e me mande de novo.')
    return
  }
  // O número passa a ser desta pessoa (se estava com outra, sai de lá) e o código não vale mais.
  const vinculo = await prisma.$transaction(async tx => {
    await tx.agenteVinculo.updateMany({ where: { agenteId: agente.id, numero: contato, NOT: { id: v.id } }, data: { numero: null, verificadoEm: null } })
    return tx.agenteVinculo.update({ where: { id: v.id }, data: { numero: contato, verificadoEm: agora, codigo: await codigoLivre(agente.id) } })
  })
  const ctx = await contextoDoVinculo(agente, vinculo)
  const nome = ctx?.nome ?? 'tudo certo'
  await enviarComoPessoa(agente, contato, [
    `Prontinho, ${nome}! 🎉 Agora a gente se fala por aqui.`,
    `Todo dia às ${agente.manhaHora} eu te mando o resumo do dia${ctx?.dono ? '' : ' e aviso quando um lead estiver esperando você'}.`,
    textoAjuda(nome, !!ctx?.dono),
  ].join('\n\n'), { vinculoId: vinculo.id, intencao: 'VINCULAR' })
}

/** Código de 6 dígitos que ainda não está em uso neste agente. */
export async function codigoLivre(agenteId: string): Promise<string> {
  for (;;) {
    const codigo = novoCodigo()
    if (!(await prisma.agenteVinculo.findUnique({ where: { agenteId_codigo: { agenteId, codigo } }, select: { id: true } }))) return codigo
  }
}

// ---------- Resumo da manhã e avisos (cron) ----------

/**
 * Resumo da manhã de quem conversa com o Aries (no horário escolhido pelo
 * gestor, uma vez por dia). Os avisos de lead esperando saem pela rodada do
 * Assistente Comercial (avisarLeadsEsperando), que entrega pelo Aries quando a
 * pessoa está vinculada.
 */
export async function rodarAgente(agora = new Date(), orcamentoMs = 5000): Promise<{ manhaAgente: number }> {
  const inicio = Date.now()
  const r = { manhaAgente: 0 }
  const agentes = await prisma.agenteWhatsapp.findMany({ where: { status: 'CONECTADO' }, include: { vinculos: { where: { verificadoEm: { not: null }, numero: { not: null } } } } })
  const hora = horaBR(agora), hoje = diaBR(agora)
  // Segunda a sábado, como o resumo do chat "Você".
  const semana = new Date(agora.getTime() - 3 * H).getUTCDay()
  if (semana === 0) return r
  for (const a of agentes) {
    for (const v of a.vinculos) {
      if (Date.now() - inicio > orcamentoMs) return r
      try {
        if (v.manha && hora >= a.manhaHora && hora < '12:00' && (!v.ultimaManhaEm || diaBR(v.ultimaManhaEm) !== hoje)) {
          // Marca antes de mandar: se der erro no envio, não repete o resumo a cada rodada.
          await prisma.agenteVinculo.update({ where: { id: v.id }, data: { ultimaManhaEm: agora } })
          const ctx = await contextoDoVinculo(a, v)
          if (ctx) { await enviarComoPessoa(a, v.numero!, await resumoDaManha(ctx, agora), { vinculoId: v.id, intencao: 'MANHA' }); r.manhaAgente++ }
        }
      } catch (e) { logger.warn({ err: e, vinculoId: v.id }, 'agente: falha no resumo da manhã') }
    }
  }
  return r
}
