// ARIES DISPARO — canal Instagram (direct da conta da empresa).
//
// Regras da Meta (API oficial do Instagram), respeitadas em toda mensagem, na hora do envio:
//   • DM só para quem falou com a conta: até 24 h depois da última mensagem da pessoa (direct ou
//     resposta a story). Fora disso a mensagem não sai (fica "fora da janela", sem gastar tentativa).
//   • Quem só comentou num post: uma resposta privada por comentário, em até 7 dias. Só texto.
//     Se a pessoa responder, abre a janela de 24 h e os próximos passos saem como DM.
//   • Seguidor que nunca interagiu não pode receber DM pela API (a Meta não entrega a lista).
//   • Nada de etiqueta HUMAN_AGENT para mensagem promocional.
// O remetente é a conta da empresa, gravado como "ig:<id da conta>" no lugar do número do WhatsApp.
import { Prisma } from '@prisma/client'
import { prisma } from '../prisma'
import { logger } from '../logger'
import { avisarNoWhatsapp } from '../ligacoesAviso'
import { comApiDaEmpresa, enviarAnexoDirect, enviarMensagemDirect, enviarRespostaPrivada, ErroGraphApi } from '../instagramGraph'
import { registrarSaida } from '../smAtendimento'
import { lerConfigEnvio, lerConfigLoja, pedeParaSair } from './regras'
import { registrarAutorizacao } from './autorizacao'

const DIA_MS = 86_400_000
const JANELA_DM_MS = DIA_MS
const JANELA_COMENTARIO_MS = 7 * DIA_MS
export const CANAIS_DM = ['DIRECT', 'COMENTARIO_AUTOMACAO', 'RESPOSTA_STORY']
/** A Meta limita mensagens automáticas por conta: o Disparo fica abaixo disso. */
export const MAX_POR_HORA_INSTAGRAM = 180

export const remetenteInstagram = (contaId: string) => `ig:${contaId}`
export const ehRemetenteInstagram = (id: string | null | undefined) => !!id && id.startsWith('ig:')

export type ContaIg = { id: string; usuarioId: string; instagramUserId: string; accessToken: string; tipoConexao: string; paginaId: string | null; nomeUsuario: string }

export async function contaInstagramDaLoja(usuarioId: string): Promise<ContaIg | null> {
  return prisma.socialMediaConta.findUnique({
    where: { titular: `dono:${usuarioId}` },
    select: { id: true, usuarioId: true, instagramUserId: true, accessToken: true, tipoConexao: true, paginaId: true, nomeUsuario: true },
  })
}
async function contaDoRemetente(remetenteId: string): Promise<ContaIg | null> {
  return prisma.socialMediaConta.findUnique({
    where: { id: remetenteId.slice(3) },
    select: { id: true, usuarioId: true, instagramUserId: true, accessToken: true, tipoConexao: true, paginaId: true, nomeUsuario: true },
  })
}
const naApi = <T,>(conta: ContaIg, fn: () => Promise<T>) => (conta.tipoConexao === 'EMPRESA' ? comApiDaEmpresa(fn) : fn())
const quemEnvia = (conta: ContaIg) => (conta.tipoConexao === 'EMPRESA' ? conta.paginaId ?? conta.instagramUserId : 'me')

/**
 * Última mensagem da pessoa no direct, por conversa. Na conversa que nasceu de "Comente QUERO", o
 * comentário em si não abre a janela de DM (só a resposta dela no direct abre).
 */
export async function ultimasEntradasDm(conversaIds: string[]): Promise<Map<string, Date>> {
  const r = new Map<string, Date>()
  for (let i = 0; i < conversaIds.length; i += 5000) {
    const lote = conversaIds.slice(i, i + 5000)
    if (!lote.length) break
    const linhas = await prisma.$queryRaw<Array<{ conversaId: string; ultima: Date }>>`
      SELECT m."conversaId", max(m."enviadaEm") AS ultima FROM pro_labore_sm_mensagens m JOIN pro_labore_sm_conversas c ON c.id = m."conversaId"
      WHERE m."conversaId" IN (${Prisma.join(lote)}) AND m.direcao = 'IN' AND (c."comentarioIgId" IS NULL OR m."igMensagemId" IS DISTINCT FROM c."comentarioIgId")
      GROUP BY m."conversaId"`
    for (const l of linhas) r.set(l.conversaId, l.ultima)
  }
  return r
}

/** Comentários que já receberam a resposta privada do Disparo (a Meta aceita só uma por comentário). */
export async function comentariosJaRespondidos(conversaIds: string[]): Promise<Set<string>> {
  if (!conversaIds.length) return new Set()
  const ms = await prisma.smMensagem.findMany({ where: { conversaId: { in: conversaIds }, direcao: 'OUT', automacao: 'DISPARO' }, select: { conversaId: true }, distinct: ['conversaId'] })
  return new Set(ms.map(m => m.conversaId))
}

export interface DadosIg { _igId?: string; _igConversa?: string; _igComentario?: string | null; _igCanal?: string }
export type Alvo =
  | { modo: 'DM'; igId: string; conversaId: string; ate: Date }
  | { modo: 'PRIVADA'; igId: string; conversaId: string; comentarioId: string; ate: Date }
  | { modo: 'FECHADA'; igId: string | null; motivo: string }

/** Como (e se) dá para mandar agora para este contato, conferido na hora de cada mensagem. */
export async function alvoDoEnvio(usuarioId: string, dados: DadosIg, passo: number, agora = new Date()): Promise<Alvo> {
  const igId = dados._igId ?? null
  if (!igId) return { modo: 'FECHADA', igId: null, motivo: 'Contato sem conta do Instagram' }
  const dm = await prisma.smConversa.findFirst({ where: { usuarioId, clienteIgId: igId, canal: { in: CANAIS_DM } }, orderBy: { ultimaMsgEm: 'desc' }, select: { id: true } })
  if (dm) {
    const ultima = (await ultimasEntradasDm([dm.id])).get(dm.id)
    if (ultima && ultima.getTime() + JANELA_DM_MS > agora.getTime()) return { modo: 'DM', igId, conversaId: dm.id, ate: new Date(ultima.getTime() + JANELA_DM_MS) }
  }
  // Só o 1º passo vai como resposta privada (a Meta aceita uma por comentário).
  if (passo === 0 && dados._igComentario && dados._igConversa) {
    const cc = await prisma.smConversa.findUnique({ where: { id: dados._igConversa }, select: { id: true, criadoEm: true } })
    if (cc && cc.criadoEm.getTime() + JANELA_COMENTARIO_MS > agora.getTime() && !(await comentariosJaRespondidos([cc.id])).size) {
      return { modo: 'PRIVADA', igId, conversaId: cc.id, comentarioId: dados._igComentario, ate: new Date(cc.criadoEm.getTime() + JANELA_COMENTARIO_MS) }
    }
  }
  return { modo: 'FECHADA', igId, motivo: 'JANELA_FECHADA' }
}

/** Erro de envio com a classe que o motor entende (CONEXAO para o remetente; DEFINITIVO não repete). */
class ErroEnvioIg extends Error { constructor(msg: string, readonly classe: 'CONEXAO' | 'DEFINITIVO' | 'TEMPORARIO' | 'DESCONHECIDO' | 'LIMITE', readonly codigo: string | null = null) { super(msg) } }

export function classificarErroMeta(e: unknown): ErroEnvioIg {
  if (e instanceof ErroEnvioIg) return e
  if (e instanceof ErroGraphApi) {
    const c = e.codigo ?? null
    const cod = c === null ? null : String(c)
    if (c === 190) return new ErroEnvioIg('O acesso ao Instagram expirou: reconecte a conta em Social Media › Conexão.', 'CONEXAO', cod)
    if (c === 10 || c === 200 || c === 3) return new ErroEnvioIg('A Meta não liberou o envio de mensagens para esta conta (permissão instagram_manage_messages).', 'CONEXAO', cod)
    if (c === 4 || c === 17 || c === 32 || c === 613) return new ErroEnvioIg('Limite de envios da Meta atingido: o Disparo continua mais tarde.', 'LIMITE', cod)
    if (c === 10900 || /window|outside of allowed|janela/i.test(e.message)) return new ErroEnvioIg('Fora da janela da Meta: a pessoa precisa mandar mensagem de novo.', 'DEFINITIVO', 'JANELA_FECHADA')
    if (c === 551 || c === 100) return new ErroEnvioIg(`A Meta recusou a mensagem para este contato: ${e.message}`, 'DEFINITIVO', cod)
    return new ErroEnvioIg(e.message || 'A Meta recusou a mensagem', 'TEMPORARIO', cod)
  }
  // Rede ou tempo esgotado: o pedido pode ter saído. Nunca repete às cegas.
  return new ErroEnvioIg(`Sem resposta da Meta: ${(e as Error)?.message ?? String(e)}`.slice(0, 300), 'DESCONHECIDO')
}

const comPrazo = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<never>((_, nao) => setTimeout(() => nao(new Error('tempo esgotado')), ms))])
const TIPO_ANEXO: Record<string, 'image' | 'video' | 'audio'> = { IMAGEM: 'image', VIDEO: 'video', AUDIO: 'audio' }
const ROTULO_ANEXO: Record<string, string> = { IMAGEM: '[foto da campanha]', VIDEO: '[vídeo da campanha]', AUDIO: '[áudio da campanha]' }

/**
 * Envia um passo pelo Instagram. Texto + anexo viram duas mensagens (o direct não tem legenda).
 * Tudo que sai fica no histórico do Atendimento do Social Media (autor AUTOMACAO, "DISPARO").
 */
export async function enviarPeloInstagram(remetenteId: string, usuarioId: string, dados: DadosIg, passo: number, envio: { tipo: string; texto: string; midia: { url: string | null } | null; prazoMs: number }): Promise<{ providerId: string | null }> {
  const conta = await contaDoRemetente(remetenteId)
  if (!conta || conta.usuarioId !== usuarioId) throw new ErroEnvioIg('O Instagram da empresa não está conectado: conecte em Social Media › Conexão.', 'CONEXAO')
  const alvo = await alvoDoEnvio(usuarioId, dados, passo)
  if (alvo.modo === 'FECHADA') throw new ErroEnvioIg('Fora da janela da Meta: a pessoa precisa mandar mensagem de novo.', 'DEFINITIVO', 'JANELA_FECHADA')
  const tipo = envio.tipo ?? 'TEXTO'
  if (tipo !== 'TEXTO' && !TIPO_ANEXO[tipo]) throw new ErroEnvioIg('O Instagram não aceita documento no direct: use foto, vídeo, áudio ou texto.', 'DEFINITIVO', 'TIPO_NAO_SUPORTADO')
  if (tipo !== 'TEXTO' && !envio.midia?.url) throw new ErroEnvioIg('O arquivo precisa estar na nuvem para ir pelo Instagram: envie de novo na Biblioteca.', 'DEFINITIVO', 'MIDIA_SEM_LINK')
  const conversa = await prisma.smConversa.findUniqueOrThrow({ where: { id: alvo.conversaId } })
  const prazo = Math.max(4000, envio.prazoMs)
  let ultimo: string | null = null
  try {
    if (alvo.modo === 'PRIVADA') {
      // Resposta privada: só texto, uma vez por comentário.
      const texto = envio.texto.trim() || 'Oi! Vimos seu comentário e queremos te ajudar por aqui 🙂'
      ultimo = await comPrazo(naApi(conta, () => enviarRespostaPrivada(quemEnvia(conta), conta.accessToken, alvo.comentarioId, texto)), prazo)
      await registrarSaida(conversa, texto, 'AUTOMACAO', ultimo, 'DISPARO').catch(e => logger.warn({ err: e }, 'disparo: histórico do Instagram'))
      return { providerId: ultimo }
    }
    if (tipo !== 'TEXTO') {
      const mid = await comPrazo(naApi(conta, () => enviarAnexoDirect(quemEnvia(conta), conta.accessToken, alvo.igId, TIPO_ANEXO[tipo], envio.midia!.url!)), prazo)
      ultimo = mid
      await registrarSaida(conversa, ROTULO_ANEXO[tipo], 'AUTOMACAO', mid, 'DISPARO').catch(e => logger.warn({ err: e }, 'disparo: histórico do Instagram'))
    }
    if (envio.texto.trim()) {
      const mid = await comPrazo(naApi(conta, () => enviarMensagemDirect(quemEnvia(conta), conta.accessToken, alvo.igId, envio.texto)), prazo)
      ultimo = mid
      await registrarSaida(conversa, envio.texto, 'AUTOMACAO', mid, 'DISPARO').catch(e => logger.warn({ err: e }, 'disparo: histórico do Instagram'))
    }
  } catch (e) {
    // O anexo já saiu e o texto falhou: conta como enviada (não repete o anexo).
    if (ultimo) { logger.warn({ err: e }, 'disparo: o anexo saiu pelo Instagram, o texto não'); return { providerId: ultimo } }
    throw classificarErroMeta(e)
  }
  return { providerId: ultimo }
}

/** Confere no histórico do Atendimento se uma mensagem de resultado desconhecido saiu (eco da Meta). */
export async function reconciliarInstagram(usuarioId: string, igId: string | null, texto: string, desde: Date): Promise<string | null> {
  if (!igId) return null
  const m = await prisma.smMensagem.findFirst({ where: { direcao: 'OUT', enviadaEm: { gte: new Date(desde.getTime() - 60_000) }, texto: texto.trim(), conversa: { usuarioId, clienteIgId: igId } }, select: { id: true, igMensagemId: true } })
  return m ? m.igMensagemId ?? m.id : null
}

/**
 * A pessoa respondeu no direct depois de receber campanha: liga à campanha, para a sequência
 * (padrão), cria o retorno para o vendedor e avisa. "SAIR" descadastra das promocionais.
 */
export async function registrarRespostaInstagram(usuarioId: string, igId: string, texto: string, conversaId: string): Promise<boolean> {
  const d = await prisma.disparoDestinatario.findFirst({
    where: { usuarioId, telefone: `ig:${igId}`, campanha: { iniciadaEm: { gte: new Date(Date.now() - 30 * DIA_MS) } }, mensagens: { some: { status: { in: ['ACEITA', 'ENTREGUE', 'LIDA'] } } } },
    orderBy: { criadoEm: 'desc' },
    select: { id: true, campanhaId: true, usuarioId: true, leadId: true, vendedorId: true, nome: true, respondeuEm: true, campanha: { select: { nome: true, config: true } } },
  })
  if (!d) return false
  const cfgLoja = lerConfigLoja((await prisma.disparoConfig.findUnique({ where: { usuarioId }, select: { config: true } }))?.config ?? {})
  const cfg = lerConfigEnvio(d.campanha.config, cfgLoja.envio)
  const agora = new Date()
  const primeira = !d.respondeuEm
  const conversa = await prisma.smConversa.findUnique({ where: { id: conversaId }, select: { leadId: true } })
  if (primeira) {
    await prisma.disparoDestinatario.update({ where: { id: d.id }, data: { respondeuEm: agora, ...(cfg.pararAoResponder ? { status: 'RESPONDEU' } : {}), ...(conversa?.leadId && !d.leadId ? { leadId: conversa.leadId } : {}) } })
    if (cfg.pararAoResponder) await prisma.disparoMensagem.updateMany({ where: { destinatarioId: d.id, status: 'AGENDADA' }, data: { status: 'PULADA', ultimoErro: 'RESPONDEU' } })
  }
  await prisma.disparoEvento.create({ data: { usuarioId, campanhaId: d.campanhaId, destinatarioId: d.id, tipo: 'RESPOSTA', descricao: `Instagram: ${texto.slice(0, 270)}`, dados: { smConversaId: conversaId } } })
  if (pedeParaSair(texto, cfgLoja.palavrasSair)) {
    await registrarAutorizacao({ usuarioId, telefone: `ig:${igId}`, situacao: 'REVOGADO', origem: 'RESPOSTA_SAIR', evidencia: `Respondeu "${texto.slice(0, 120)}" no Instagram à campanha "${d.campanha.nome}"`, leadId: conversa?.leadId ?? d.leadId, autorNome: 'Contato' })
    await prisma.disparoEvento.create({ data: { usuarioId, campanhaId: d.campanhaId, destinatarioId: d.id, tipo: 'DESCADASTRO', descricao: 'Pediu para não receber mais mensagens promocionais (Instagram)' } })
    return true
  }
  if (primeira) {
    const leadId = conversa?.leadId ?? d.leadId
    if (leadId) {
      const jaTem = await prisma.leadFollow.count({ where: { leadId, status: 'PENDENTE', tipo: 'CONTATO' } })
      if (!jaTem) await prisma.leadFollow.create({ data: { usuarioId, leadId, vendedorId: d.vendedorId, agendadoPara: agora, canal: 'OUTRO', nota: `Respondeu no Instagram à campanha "${d.campanha.nome}": responder no Atendimento do Social Media`, contexto: { origem: 'DISPARO', campanhaId: d.campanhaId, canal: 'INSTAGRAM' }, criadoPor: 'ARIES Disparo' } }).catch(e => logger.warn({ err: e }, 'disparo: follow da resposta do Instagram'))
    }
    await avisarNoWhatsapp(usuarioId, d.vendedorId, `💬 ${d.nome ?? 'Um contato'} respondeu no Instagram à campanha "${d.campanha.nome}": "${texto.slice(0, 160)}"`).catch(e => logger.warn({ err: e }, 'disparo: aviso da resposta do Instagram'))
  }
  return true
}
