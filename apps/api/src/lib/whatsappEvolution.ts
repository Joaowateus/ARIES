// Cliente da Evolution API (v2) — servidor que mantém a sessão "aparelho
// conectado" de cada vendedor (igual ao WhatsApp Web), aberta por QR Code
// ou código de pareamento. Um servidor só atende todos os números; cada
// vendedor vira uma "instância" lá. A Vercel não segura conexão aberta com
// o WhatsApp, por isso esse pedaço mora fora — aqui só falamos HTTP com ele.
//
// Configuração: EVOLUTION_API_URL (ex.: https://evolution.seudominio.com)
// e EVOLUTION_API_KEY (a AUTHENTICATION_API_KEY global do servidor).

export class ErroWhatsapp extends Error {
  constructor(message: string, readonly status?: number) {
    super(message)
  }
}

export function evolutionConfigurada(): boolean {
  return !!process.env.EVOLUTION_API_URL && !!process.env.EVOLUTION_API_KEY
}

const TIMEOUT_MS = 15_000

async function chamar<T>(metodo: 'GET' | 'POST' | 'PUT' | 'DELETE', caminho: string, corpo?: unknown): Promise<T> {
  const base = (process.env.EVOLUTION_API_URL ?? '').replace(/\/+$/, '')
  const chave = process.env.EVOLUTION_API_KEY ?? ''
  if (!base || !chave) throw new ErroWhatsapp('Servidor do WhatsApp não configurado (EVOLUTION_API_URL / EVOLUTION_API_KEY).')

  const controle = new AbortController()
  const timer = setTimeout(() => controle.abort(), TIMEOUT_MS)
  let resposta: globalThis.Response
  try {
    resposta = await fetch(`${base}${caminho}`, {
      method: metodo,
      headers: { apikey: chave, 'Content-Type': 'application/json' },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      signal: controle.signal,
    })
  } catch (e) {
    throw new ErroWhatsapp(controle.signal.aborted ? 'O servidor do WhatsApp demorou demais pra responder.' : `Não foi possível falar com o servidor do WhatsApp: ${(e as Error).message}`)
  } finally {
    clearTimeout(timer)
  }

  const texto = await resposta.text()
  let dados: unknown = null
  try { dados = texto ? JSON.parse(texto) : null } catch { dados = texto }
  if (!resposta.ok) {
    const d = dados as { response?: { message?: unknown }; message?: unknown; error?: unknown } | null
    const bruto = d?.response?.message ?? d?.message ?? d?.error ?? texto
    const msg = Array.isArray(bruto) ? bruto.map(String).join('; ') : String(bruto || `HTTP ${resposta.status}`)
    throw new ErroWhatsapp(msg, resposta.status)
  }
  return dados as T
}

export type EstadoConexao = 'open' | 'connecting' | 'close'

export interface CodigoConexao {
  qrBase64: string | null // data:image/png;base64,... pronto pra <img>
  pairingCode: string | null // código de 8 caracteres pra "conectar com número de telefone"
}

const EVENTOS_WEBHOOK = ['MESSAGES_UPSERT', 'CONNECTION_UPDATE', 'QRCODE_UPDATED']

function normalizarQr(dados: { base64?: string | null; pairingCode?: string | null; qrcode?: { base64?: string | null; pairingCode?: string | null } } | null): CodigoConexao {
  const qr = dados?.qrcode ?? dados
  const base64 = qr?.base64 ?? null
  return {
    qrBase64: base64 ? (base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`) : null,
    pairingCode: qr?.pairingCode ?? null,
  }
}

export async function estadoInstancia(instancia: string): Promise<EstadoConexao | 'inexistente'> {
  try {
    const r = await chamar<{ instance?: { state?: string }; state?: string }>('GET', `/instance/connectionState/${encodeURIComponent(instancia)}`)
    const estado = r.instance?.state ?? r.state
    return estado === 'open' || estado === 'connecting' ? estado : 'close'
  } catch (e) {
    if (e instanceof ErroWhatsapp && e.status === 404) return 'inexistente'
    throw e
  }
}

// Cria a instância (se ainda não existe) já com o webhook apontado pra cá,
// e devolve o QR / código de pareamento pra abrir a sessão.
export async function prepararConexao(instancia: string, webhookUrl: string, numeroPareamento?: string): Promise<CodigoConexao> {
  // Logo depois de desconectar, o servidor ainda está apagando a sessão
  // antiga e recusa mexer nela por uns segundos: espera e tenta de novo.
  for (let tentativa = 0; ; tentativa++) {
    try {
      await garantirInstancia(instancia, webhookUrl)
      break
    } catch (e) {
      if (tentativa >= 3 || !(e instanceof ErroWhatsapp) || e.status === 401) throw e
      await new Promise(r => setTimeout(r, 2000))
    }
  }
  const numero = numeroPareamento?.replace(/\D/g, '')
  const caminho = `/instance/connect/${encodeURIComponent(instancia)}${numero ? `?number=${numero}` : ''}`
  // A sessão leva alguns segundos para receber o QR do WhatsApp (sobretudo
  // na primeira conexão do servidor): pergunta de novo antes de devolver
  // vazio, senão a tela ficaria sem imagem até a próxima renovação.
  let codigo = normalizarQr(await chamar<Parameters<typeof normalizarQr>[0]>('GET', caminho))
  for (let tentativa = 0; tentativa < 3 && !codigo.qrBase64 && !codigo.pairingCode; tentativa++) {
    await new Promise(r => setTimeout(r, 1500))
    if ((await estadoInstancia(instancia)) === 'open') break
    codigo = normalizarQr(await chamar<Parameters<typeof normalizarQr>[0]>('GET', caminho))
  }
  return codigo
}

async function garantirInstancia(instancia: string, webhookUrl: string): Promise<void> {
  if ((await estadoInstancia(instancia)) !== 'inexistente') {
    await configurarWebhook(instancia, webhookUrl)
    return
  }
  await chamar('POST', '/instance/create', {
    instanceName: instancia,
    integration: 'WHATSAPP-BAILEYS',
    qrcode: false,
    // Sem histórico antigo e sem grupos: o assistente só precisa das
    // mensagens novas que chegarem depois de conectado.
    syncFullHistory: false,
    groupsIgnore: true,
    readMessages: false,
    alwaysOnline: false,
    webhook: { url: webhookUrl, byEvents: false, base64: false, events: EVENTOS_WEBHOOK },
  })
}

export async function configurarWebhook(instancia: string, webhookUrl: string): Promise<void> {
  await chamar('POST', `/webhook/set/${encodeURIComponent(instancia)}`, {
    webhook: { enabled: true, url: webhookUrl, byEvents: false, base64: false, events: EVENTOS_WEBHOOK },
  })
}

export interface PerfilInstancia { numero: string | null; nome: string | null; fotoUrl: string | null }

export async function perfilInstancia(instancia: string): Promise<PerfilInstancia> {
  const r = await chamar<unknown>('GET', `/instance/fetchInstances?instanceName=${encodeURIComponent(instancia)}`)
  const lista = Array.isArray(r) ? r : [r]
  const item = (lista[0] ?? {}) as {
    ownerJid?: string | null; profileName?: string | null; profilePicUrl?: string | null
    instance?: { owner?: string | null; profileName?: string | null; profilePictureUrl?: string | null }
  }
  const dono = item.ownerJid ?? item.instance?.owner ?? null
  return {
    numero: dono ? dono.split('@')[0].split(':')[0].replace(/\D/g, '') || null : null,
    nome: item.profileName ?? item.instance?.profileName ?? null,
    fotoUrl: item.profilePicUrl ?? item.instance?.profilePictureUrl ?? null,
  }
}

// Perfil do número (nome, recado e foto) — usado pelo Aries, o agente da
// conta, para aparecer no WhatsApp com a logo e o nome da loja. Cada parte é
// independente: uma falha (ex.: foto recusada) não impede as outras.
export async function atualizarPerfil(instancia: string, perfil: { nome?: string; recado?: string; fotoUrl?: string }): Promise<{ nome: boolean; recado: boolean; foto: boolean }> {
  const tentar = async (caminho: string, corpo: unknown) => { try { await chamar('POST', `${caminho}/${encodeURIComponent(instancia)}`, corpo); return true } catch { return false } }
  return {
    nome: perfil.nome ? await tentar('/chat/updateProfileName', { name: perfil.nome }) : false,
    recado: perfil.recado ? await tentar('/chat/updateProfileStatus', { status: perfil.recado }) : false,
    foto: perfil.fotoUrl ? await tentar('/chat/updateProfilePicture', { picture: perfil.fotoUrl }) : false,
  }
}

// Desconecta o aparelho e apaga a instância (o próximo "Conectar" começa do
// zero, com QR novo). Erro de "não existe" é ignorado — o objetivo já foi
// atingido.
export async function removerInstancia(instancia: string): Promise<void> {
  for (const caminho of [`/instance/logout/${encodeURIComponent(instancia)}`, `/instance/delete/${encodeURIComponent(instancia)}`]) {
    try { await chamar('DELETE', caminho) } catch (e) {
      if (!(e instanceof ErroWhatsapp) || (e.status !== 404 && e.status !== 400)) throw e
    }
  }
}

// Envia texto. `digitandoMs` faz o WhatsApp mostrar "digitando..." antes
// — deixa a conversa com ritmo humano e reduz o risco de bloqueio por
// resposta instantânea em massa.
export async function enviarTexto(instancia: string, destino: string, texto: string, digitandoMs = 0): Promise<string | null> {
  const numero = destino.includes('@') ? destino : destino.replace(/\D/g, '')
  const r = await chamar<{ key?: { id?: string } }>('POST', `/message/sendText/${encodeURIComponent(instancia)}`, {
    number: numero, text: texto, delay: Math.max(0, Math.round(digitandoMs)),
  })
  return r?.key?.id ?? null
}

// Envia uma foto (em base64, sem depender de endereço público) com legenda.
export async function enviarImagem(instancia: string, destino: string, imagem: { mime: string; dados: Buffer }, legenda: string, digitandoMs = 0): Promise<string | null> {
  const numero = destino.includes('@') ? destino : destino.replace(/\D/g, '')
  const r = await chamar<{ key?: { id?: string } }>('POST', `/message/sendMedia/${encodeURIComponent(instancia)}`, {
    number: numero, mediatype: 'image', mimetype: imagem.mime, caption: legenda, media: imagem.dados.toString('base64'),
    fileName: imagem.mime === 'image/png' ? 'moto.png' : 'moto.jpg', delay: Math.max(0, Math.round(digitandoMs)),
  })
  return r?.key?.id ?? null
}

// Arquivo de um áudio/foto que passou pela instância (recebido ou enviado
// pelo celular), pelo ID da mensagem no WhatsApp. O servidor busca a mídia
// no WhatsApp e devolve em base64; com o tempo o WhatsApp apaga o arquivo e
// aí não tem mais como baixar (null).
export async function baixarMidiaDaMensagem(instancia: string, providerId: string): Promise<{ mime: string; dados: Buffer } | null> {
  const r = await chamar<{ base64?: string; mimetype?: string } | null>('POST', `/chat/getBase64FromMediaMessage/${encodeURIComponent(instancia)}`, {
    message: { key: { id: providerId } }, convertToMp4: false,
  })
  const base64 = (r?.base64 ?? '').replace(/^data:[^;]+;base64,/, '')
  if (!base64) return null
  const dados = Buffer.from(base64, 'base64')
  return dados.length ? { mime: (r?.mimetype ?? 'application/octet-stream').split(';')[0].trim(), dados } : null
}

// Quantas mensagens o servidor tem guardadas com esse contato (limitado a
// uma página pequena — só interessa saber se existe conversa anterior).
export async function contarMensagensComContato(instancia: string, jid: string): Promise<number> {
  return (await historicoDoContato(instancia, jid)).total
}

/** Últimas mensagens trocadas com o contato (mais recentes primeiro), como vêm do servidor. */
export async function mensagensDoContato(instancia: string, jid: string, limite = 20): Promise<{ total: number; registros: unknown[] }> {
  const r = await chamar<unknown>('POST', `/chat/findMessages/${encodeURIComponent(instancia)}`, {
    where: { key: { remoteJid: jid } }, limit: limite, offset: limite, page: 1,
  })
  const d = r as { messages?: { records?: unknown[]; total?: number } } | unknown[]
  if (Array.isArray(d)) return { total: d.length, registros: d }
  const registros = d.messages?.records ?? []
  return { total: d.messages?.total ?? registros.length, registros }
}

/** Quantas mensagens há com o contato e em que instantes (ms) as mais recentes foram trocadas. */
export async function historicoDoContato(instancia: string, jid: string): Promise<{ total: number; instantes: number[] }> {
  const { total, registros } = await mensagensDoContato(instancia, jid, 20)
  const instantes = registros.map(r => Number((r as { messageTimestamp?: unknown }).messageTimestamp)).filter(t => Number.isFinite(t) && t > 0).map(t => (t > 1e12 ? t : t * 1000))
  return { total, instantes }
}

export interface ConversaRecente { jid: string; nome: string | null; atualizadaEm: number | null; salvo: boolean; ultimaDeMim: boolean | null }

/** Conversas com mensagem entre `desde` e `ate` (para a varredura de leads perdidos). */
export async function conversasRecentes(instancia: string, desde: Date, ate: Date, limite = 60): Promise<ConversaRecente[]> {
  const r = await chamar<unknown>('POST', `/chat/findChats/${encodeURIComponent(instancia)}`, {
    where: { messageTimestamp: { gte: desde.toISOString(), lte: ate.toISOString() } }, take: limite,
  })
  const lista = Array.isArray(r) ? r : Array.isArray((r as { chats?: unknown[] })?.chats) ? (r as { chats: unknown[] }).chats : []
  return lista.map(c => {
    const o = (c ?? {}) as { remoteJid?: string; pushName?: string | null; updatedAt?: string; isSaved?: boolean; lastMessage?: { key?: { fromMe?: boolean }; messageTimestamp?: number } }
    const ts = Number(o.lastMessage?.messageTimestamp)
    const atualizada = Number.isFinite(ts) && ts > 0 ? (ts > 1e12 ? ts : ts * 1000) : o.updatedAt ? Date.parse(o.updatedAt) : NaN
    return { jid: o.remoteJid ?? '', nome: o.pushName ?? null, atualizadaEm: Number.isFinite(atualizada) ? atualizada : null, salvo: o.isSaved === true, ultimaDeMim: typeof o.lastMessage?.key?.fromMe === 'boolean' ? o.lastMessage.key.fromMe : null }
  }).filter(c => c.jid && !/@(g\.us|broadcast|newsletter)$/.test(c.jid))
}
