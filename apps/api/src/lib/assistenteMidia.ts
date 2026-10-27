// Áudios e fotos das conversas do WhatsApp (modelo AssistenteMidia): o
// webhook registra a mídia da mensagem e tenta baixar na hora pela
// Evolution; o que não der fica PENDENTE e baixa na primeira vez que alguém
// abrir. O arquivo vai para o Vercel Blob (privado; se o store não aceitar,
// público com sufixo aleatório) ou, sem Blob configurado, para o banco. O
// endereço do Blob nunca sai da API: a tela recebe o arquivo pela rota com
// login. Nada disso vai para a IA.
import { get, put } from '@vercel/blob'
import { prisma } from './prisma'
import { logger } from './logger'
import { baixarMidiaDaMensagem, evolutionConfigurada } from './whatsappEvolution'

export type TipoMidia = 'AUDIO' | 'IMAGEM'
export interface MidiaRecebida { providerId: string; tipo: TipoMidia; mime: string | null; segundos: number | null }

// A resposta da Vercel não passa de 4,5 MB; áudio de voz e foto do WhatsApp ficam bem abaixo.
const MAX_BYTES = 4 * 1024 * 1024
const MAX_TENTATIVAS = 3
const tokenBlob = () => process.env.BLOB_READ_WRITE_TOKEN?.trim() || null
const EXTENSAO: Record<string, string> = {
  'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/aac': 'aac', 'audio/amr': 'amr',
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
}

async function guardar(usuarioId: string, midiaId: string, arquivo: { mime: string; dados: Buffer }) {
  const token = tokenBlob()
  if (token) {
    const caminho = `conversas/${usuarioId}/${midiaId}.${EXTENSAO[arquivo.mime] ?? 'bin'}`
    for (const acesso of ['private', 'public'] as const) {
      try {
        const r = await put(caminho, arquivo.dados, { access: acesso, token, contentType: arquivo.mime, addRandomSuffix: true })
        return { blobUrl: r.url, blobAcesso: acesso, dados: null }
      } catch (e) {
        logger.warn({ err: e, acesso }, 'midia: o Blob recusou o arquivo')
      }
    }
  }
  return { blobUrl: null, blobAcesso: null, dados: arquivo.dados }
}

/** Baixa pela Evolution e guarda. true = arquivo disponível. */
export async function baixarMidia(midiaId: string): Promise<boolean> {
  const m = await prisma.assistenteMidia.findUnique({
    where: { id: midiaId },
    select: { id: true, usuarioId: true, status: true, tentativas: true, mensagem: { select: { providerId: true, conversa: { select: { assistente: { select: { instancia: true } } } } } } },
  })
  if (!m) return false
  if (m.status !== 'PENDENTE') return m.status === 'OK'
  const instancia = m.mensagem.conversa.assistente.instancia
  const providerId = m.mensagem.providerId
  let arquivo: { mime: string; dados: Buffer } | null = null
  if (instancia && providerId && evolutionConfigurada()) {
    try {
      arquivo = await baixarMidiaDaMensagem(instancia, providerId)
    } catch (e) {
      logger.warn({ err: e, midiaId }, 'midia: a Evolution não entregou o arquivo')
    }
  }
  if (!arquivo || arquivo.dados.length > MAX_BYTES) {
    const tentativas = m.tentativas + 1
    const desiste = !instancia || !providerId || tentativas >= MAX_TENTATIVAS || !!arquivo
    await prisma.assistenteMidia.update({
      where: { id: m.id },
      data: { tentativas, ...(desiste && { status: 'INDISPONIVEL' }), ...(arquivo && { tamanho: arquivo.dados.length }) },
    })
    return false
  }
  const guardado = await guardar(m.usuarioId, m.id, arquivo)
  const r = await prisma.assistenteMidia.updateMany({
    where: { id: m.id, status: 'PENDENTE' },
    data: { status: 'OK', mime: arquivo.mime, tamanho: arquivo.dados.length, ...guardado },
  })
  return r.count > 0 || (await prisma.assistenteMidia.findUnique({ where: { id: m.id }, select: { status: true } }))?.status === 'OK'
}

function comPrazo<T>(p: Promise<T>, ms: number, padrao: T): Promise<T> {
  return Promise.race([p, new Promise<T>(r => setTimeout(() => r(padrao), Math.max(0, ms)))])
}

/**
 * Webhook: registra a mídia das mensagens já gravadas (pelo ID do WhatsApp)
 * e tenta baixar dentro do prazo. Mensagem que não foi gravada (conversa
 * pessoal do vendedor) não tem mídia registrada.
 */
export async function registrarMidias(usuarioId: string, lista: MidiaRecebida[], prazoMs = 5000): Promise<void> {
  const criadas: string[] = []
  for (const x of lista) {
    const msg = await prisma.assistenteMensagem.findUnique({ where: { providerId: x.providerId }, select: { id: true, midia: { select: { id: true } } } })
    if (!msg || msg.midia) continue
    const m = await prisma.assistenteMidia.create({
      data: { mensagemId: msg.id, usuarioId, tipo: x.tipo, mime: x.mime, duracaoSeg: x.segundos != null ? Math.round(x.segundos) : null },
      select: { id: true },
    }).catch(() => null) // webhook repetido ao mesmo tempo: o outro já registrou
    if (m) criadas.push(m.id)
  }
  const fim = Date.now() + prazoMs
  for (const id of criadas) {
    if (Date.now() >= fim) break
    await comPrazo(baixarMidia(id).catch(e => { logger.warn({ err: e }, 'midia: falha ao baixar'); return false }), fim - Date.now(), false)
  }
}

export type ArquivoMidia = { status: 'OK'; mime: string; dados: Buffer } | { status: 'PENDENTE' | 'INDISPONIVEL' }

/** O arquivo para a tela: baixa na hora se ainda estiver pendente. null = a mensagem não tem mídia. */
export async function arquivoDaMidia(mensagemId: string): Promise<ArquivoMidia | null> {
  const atual = await prisma.assistenteMidia.findUnique({ where: { mensagemId }, select: { id: true, status: true } })
  if (!atual) return null
  if (atual.status === 'PENDENTE') await baixarMidia(atual.id)
  const m = await prisma.assistenteMidia.findUnique({ where: { mensagemId }, select: { status: true, mime: true, dados: true, blobUrl: true, blobAcesso: true } })
  if (!m || m.status !== 'OK') return { status: m?.status === 'INDISPONIVEL' ? 'INDISPONIVEL' : 'PENDENTE' }
  const mime = m.mime ?? 'application/octet-stream'
  if (m.dados) return { status: 'OK', mime, dados: Buffer.from(m.dados) }
  if (!m.blobUrl) return { status: 'INDISPONIVEL' }
  if (m.blobAcesso === 'private') {
    const r = await get(m.blobUrl, { access: 'private', token: tokenBlob() ?? undefined })
    if (!r || r.statusCode !== 200) return { status: 'INDISPONIVEL' }
    return { status: 'OK', mime, dados: Buffer.from(await new Response(r.stream).arrayBuffer()) }
  }
  const r = await fetch(m.blobUrl)
  if (!r.ok) return { status: 'INDISPONIVEL' }
  return { status: 'OK', mime, dados: Buffer.from(await r.arrayBuffer()) }
}
