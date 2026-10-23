// Motor do Assistente Comercial ligado ao WhatsApp de verdade: recebe os
// eventos do servidor Evolution (webhook), decide se a mensagem é de um lead
// novo, conduz o roteiro, passa a conversa pro vendedor e cria o Lead no CRM.
//
// Cadastro automático (independe das respostas): o contato novo que chama o
// vendedor entra no CRM, etapa Lead, já na primeira mensagem. Telefone que já
// tem lead aberto não duplica; lead perdido que volta a chamar vira follow
// pra hoje. Lead excluído do CRM nunca mais é cadastrado sozinho.
//
// Regras de segurança (o número é o WhatsApp pessoal/comercial do vendedor):
// - Só responde contato NOVO: veio de anúncio, usou uma frase de campanha,
//   ou nunca conversou com o vendedor (nem aqui, nem no histórico do
//   servidor). Na dúvida, não responde.
// - Parou de vez quando o vendedor digita qualquer coisa na conversa.
// - Conversa pessoal nunca é guardada: só o número entra na lista de
//   ignorados, pro assistente nunca se meter ali.
// - Grupo, status e canal são ignorados.

import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { logger } from './logger'
import { diaBrasilia, inicioDoDiaBrasilia } from './socialMediaSync'
import { contarMensagensComContato, enviarTexto, perfilInstancia } from './whatsappEvolution'
import { origemPorCodigo } from './smAtribuicao'
import {
  ConfigAssistente, ContextoRoteiro, Desfecho, EstadoRoteiro, PassoRoteiro, TEXTO_MENU,
  avancarRoteiro, casaGatilho, complementarResposta, interpretarComando, iniciarRoteiro, lerConfig, linhasResumo, respostaDoCampo,
} from './assistenteRoteiro'

export const STATUS_ABERTOS = ['ATIVA', 'AGUARDANDO_VENDEDOR', 'ASSUMIDA']
const MAX_IDADE_MENSAGEM_MS = 10 * 60_000
const TEXTO_SO_TEXTO = 'Por aqui eu só consigo ler mensagens de texto 🙂 Pode me responder escrevendo?'

type AssistenteCompleto = Prisma.AssistenteComercialGetPayload<{ include: { vendedor: { select: { id: true; nome: true; usuarioId: true } } } }>

export interface MensagemWhatsapp {
  id: string | null
  jid: string
  numero: string
  deMim: boolean
  texto: string
  ehTexto: boolean
  nomePerfil: string | null
  instanteMs: number | null
  veioDeAnuncio: boolean
  tituloAnuncio: string | null
  // Endereço "@lid" sem o telefone ao lado: `numero` é só um identificador.
  semTelefone: boolean
}

export function soDigitos(v: string | null | undefined): string {
  return (v ?? '').replace(/\D/g, '')
}

export function formatarTelefone(digitos: string): string {
  const d = soDigitos(digitos)
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) {
    const ddd = d.slice(2, 4)
    const resto = d.slice(4)
    return `+55 ${ddd} ${resto.slice(0, resto.length - 4)}-${resto.slice(-4)}`
  }
  return d ? `+${d}` : ''
}

// ---------- Leitura do payload da Evolution ----------

type Obj = Record<string, unknown>
const obj = (v: unknown): Obj => (v && typeof v === 'object' ? (v as Obj) : {})
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)

const MIDIA_ROTULO: Record<string, string> = {
  audioMessage: '[áudio]', imageMessage: '[imagem]', videoMessage: '[vídeo]', documentMessage: '[documento]',
  stickerMessage: '[figurinha]', locationMessage: '[localização]', contactMessage: '[contato]', ptvMessage: '[vídeo]',
}

function extrairTexto(message: Obj): { texto: string; ehTexto: boolean } {
  const ext = obj(message.extendedTextMessage)
  const candidatos = [
    message.conversation, ext.text,
    obj(message.imageMessage).caption, obj(message.videoMessage).caption,
    obj(message.buttonsResponseMessage).selectedDisplayText, obj(obj(message.listResponseMessage)).title,
    obj(message.templateButtonReplyMessage).selectedDisplayText,
  ]
  const texto = candidatos.map(str).find(Boolean)
  if (texto) return { texto, ehTexto: true }
  const tipo = Object.keys(message).find(k => MIDIA_ROTULO[k])
  return { texto: tipo ? MIDIA_ROTULO[tipo] : '[mensagem]', ehTexto: false }
}

// Clique em anúncio "enviar mensagem pelo WhatsApp" chega com o anúncio de
// origem anexado (externalAdReply / conversionSource).
function contextosDaMensagem(dados: Obj, message: Obj): Obj[] {
  return [obj(dados.contextInfo), ...Object.values(message).map(v => obj(obj(v).contextInfo))]
}

function veioDeAnuncio(contextos: Obj[]): boolean {
  return contextos.some(c => {
    const ad = obj(c.externalAdReply)
    const fonte = `${str(c.conversionSource) ?? ''} ${str(c.entryPointConversionSource) ?? ''}`
    return str(ad.sourceType) === 'ad' || !!str(ad.sourceId) || /\bads?\b|ctwa|fb_ads/i.test(fonte)
  })
}

// Título do anúncio do clique para WhatsApp (ex.: "Onix 2020") — vai pra observação do lead.
function tituloDoAnuncio(contextos: Obj[]): string | null {
  for (const c of contextos) {
    const ad = obj(c.externalAdReply)
    const titulo = (str(ad.title) ?? str(ad.body))?.trim()
    if (titulo) return titulo.slice(0, 120)
  }
  return null
}

export function lerMensagens(dadosBrutos: unknown): MensagemWhatsapp[] {
  const d = obj(dadosBrutos)
  const lista: unknown[] = Array.isArray(dadosBrutos) ? dadosBrutos : Array.isArray(d.messages) ? d.messages : [dadosBrutos]
  const saida: MensagemWhatsapp[] = []
  for (const bruto of lista) {
    const dados = obj(bruto)
    const key = obj(dados.key)
    const remoteJid = str(key.remoteJid)
    if (!remoteJid) continue
    if (remoteJid.endsWith('@g.us') || remoteJid.endsWith('@broadcast') || remoteJid.endsWith('@newsletter') || remoteJid === 'status@broadcast') continue
    const message = obj(dados.message)
    if (message.protocolMessage || message.reactionMessage || message.pollUpdateMessage) continue
    // Endereço "@lid" (identificador anônimo novo do WhatsApp) — o número de
    // telefone vem num campo alternativo quando o servidor conhece.
    const alternativo = str(key.remoteJidAlt) ?? str(key.senderPn) ?? str(dados.senderPn)
    const jidTelefone = remoteJid.endsWith('@lid') && alternativo ? alternativo : remoteJid
    const numero = soDigitos(jidTelefone.split('@')[0].split(':')[0])
    if (!numero) continue
    const { texto, ehTexto } = extrairTexto(message)
    const contextos = contextosDaMensagem(dados, message)
    const ts = Number(dados.messageTimestamp)
    saida.push({
      id: str(key.id),
      jid: remoteJid,
      numero,
      deMim: key.fromMe === true,
      texto,
      ehTexto,
      nomePerfil: str(dados.pushName),
      instanteMs: Number.isFinite(ts) && ts > 0 ? (ts > 1e12 ? ts : ts * 1000) : null,
      veioDeAnuncio: veioDeAnuncio(contextos),
      tituloAnuncio: tituloDoAnuncio(contextos),
      semTelefone: jidTelefone.endsWith('@lid'),
    })
  }
  return saida
}

// ---------- Entrada do webhook ----------

export async function processarWebhookAssistente(segredo: string, corpo: unknown): Promise<number> {
  const assistente = await prisma.assistenteComercial.findUnique({
    where: { webhookSegredo: segredo },
    include: { vendedor: { select: { id: true, nome: true, usuarioId: true } } },
  })
  if (!assistente) return 404
  const c = obj(corpo)
  const evento = (str(c.event) ?? '').toLowerCase().replace(/_/g, '.')

  if (evento === 'connection.update') {
    await tratarConexao(assistente, obj(c.data))
    return 200
  }
  if (evento !== 'messages.upsert') return 200

  for (const m of lerMensagens(c.data)) {
    try {
      await tratarMensagem(assistente, m)
    } catch (e) {
      logger.error({ err: e, assistenteId: assistente.id }, 'assistente: falha ao processar mensagem')
    }
  }
  await prisma.assistenteComercial.update({ where: { id: assistente.id }, data: { ultimoEventoEm: new Date() } })
  return 200
}

async function tratarConexao(a: AssistenteCompleto, dados: Obj) {
  const estado = str(dados.state)
  if (estado === 'open') await marcarConectado(a)
  else if (estado === 'close' && a.status === 'CONECTADO') {
    await prisma.assistenteComercial.update({ where: { id: a.id }, data: { status: 'DESCONECTADO' } })
  }
}

export async function marcarConectado(a: { id: string; instancia: string | null; status: string; nomeExibicao: string | null }) {
  let perfil = { numero: null as string | null, nome: null as string | null, fotoUrl: null as string | null }
  if (a.instancia) {
    try { perfil = await perfilInstancia(a.instancia) } catch (e) { logger.warn({ err: e }, 'assistente: perfil da instância indisponível') }
  }
  await prisma.assistenteComercial.update({
    where: { id: a.id },
    data: {
      status: 'CONECTADO',
      ...(a.status !== 'CONECTADO' && { conectadoEm: new Date() }),
      ...(perfil.numero && { numeroWhatsapp: perfil.numero }),
      ...(perfil.nome && !a.nomeExibicao && { nomeExibicao: perfil.nome }),
      ...(perfil.fotoUrl && { fotoPerfilUrl: perfil.fotoUrl }),
    },
  })
}

async function tratarMensagem(a: AssistenteCompleto, m: MensagemWhatsapp) {
  // Mensagem antiga (reentrega depois de o servidor ficar fora do ar,
  // sincronização) nunca dispara resposta.
  if (m.instanteMs && Date.now() - m.instanteMs > MAX_IDADE_MENSAGEM_MS) return
  const proprio = !!a.numeroWhatsapp && m.numero === a.numeroWhatsapp
  if (m.deMim) {
    if (proprio) await tratarSuporte(a, m)
    else await tratarMensagemDoVendedor(a, m)
    return
  }
  if (proprio) return
  await tratarMensagemDoContato(a, m)
}

async function jaRegistrada(providerId: string | null): Promise<boolean> {
  if (!providerId) return false
  return !!(await prisma.assistenteMensagem.findUnique({ where: { providerId }, select: { id: true } }))
}

function contexto(a: AssistenteCompleto, cfg: ConfigAssistente, nomeContato: string): ContextoRoteiro {
  return { nomeContato, vendedor: a.vendedor.nome, empresa: cfg.nomeEmpresa }
}

async function comTrava<T>(chave: string, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT 1 AS ok FROM (SELECT pg_advisory_xact_lock(hashtext(${chave}))) t`
    return fn(tx)
  }, { maxWait: 10_000, timeout: 15_000 })
}

// ---------- Vendedor digitou no celular ----------

async function tratarMensagemDoVendedor(a: AssistenteCompleto, m: MensagemWhatsapp) {
  if (await jaRegistrada(m.id)) return // eco de algo que o próprio assistente/painel mandou
  const conversa = await prisma.assistenteConversa.findFirst({
    where: { assistenteId: a.id, tipo: 'LEAD', numeroContato: m.numero, status: { in: STATUS_ABERTOS } },
    orderBy: { criadoEm: 'desc' },
  })
  if (!conversa) {
    // Conversa pessoal/antiga do vendedor: só marca o número pra nunca
    // ser tratado como lead. O conteúdo não é guardado.
    await prisma.assistenteContatoIgnorado.upsert({
      where: { assistenteId_numero: { assistenteId: a.id, numero: m.numero } },
      update: {},
      create: { assistenteId: a.id, numero: m.numero, motivo: 'CONVERSA_PESSOAL' },
    })
    return
  }
  // O eco da mensagem do assistente às vezes chega antes de o envio
  // terminar de gravar o ID — reconhece pelo texto recente.
  const eco = await prisma.assistenteMensagem.findFirst({
    where: { conversaId: conversa.id, remetente: 'ASSISTENTE', providerId: null, texto: m.texto, criadoEm: { gte: new Date(Date.now() - 2 * 60_000) } },
  })
  if (eco) {
    if (m.id) await prisma.assistenteMensagem.update({ where: { id: eco.id }, data: { providerId: m.id, criadoEm: new Date() } }).catch(() => undefined)
    return
  }
  const agora = new Date()
  await prisma.$transaction([
    prisma.assistenteMensagem.create({ data: { conversaId: conversa.id, remetente: 'VENDEDOR', texto: m.texto, providerId: m.id } }),
    prisma.assistenteConversa.update({
      where: { id: conversa.id },
      data: {
        ultimaMensagemEm: agora,
        ...(conversa.status !== 'ASSUMIDA' && { status: 'ASSUMIDA', assumidaEm: agora }),
      },
    }),
  ])
}

// ---------- Contato escreveu ----------

interface AcaoPendente { conversaId: string; jid: string; passo: PassoRoteiro | null; mensagensAvulsas: string[]; nomeContato: string; origem: string | null }

async function tratarMensagemDoContato(a: AssistenteCompleto, m: MensagemWhatsapp) {
  if (await jaRegistrada(m.id)) return
  const cfg = lerConfig(a.configuracao)

  // Checagens que precisam de rede ficam fora da trava.
  const aberta = await prisma.assistenteConversa.findFirst({
    where: { assistenteId: a.id, tipo: 'LEAD', numeroContato: m.numero, status: { in: STATUS_ABERTOS } },
    select: { id: true },
  })
  let origem: string | null = null
  if (!aberta && (a.atendimentoAutomatico || a.cadastroAutomatico)) {
    if (m.veioDeAnuncio) origem = 'ANUNCIO'
    else if (casaGatilho(m.texto, cfg.gatilhos)) origem = 'GATILHO'
    else if ((a.cadastroAutomatico || cfg.responderContatosNovos) && await contatoSemHistorico(a, m)) origem = 'CONTATO_NOVO'
  }
  // O roteiro só roda com as respostas ligadas; o cadastro no CRM acontece
  // mesmo com elas pausadas (aí o vendedor atende sozinho, sem conversa aqui).
  const roboAtende = !!origem && a.atendimentoAutomatico && (origem !== 'CONTATO_NOVO' || cfg.responderContatosNovos)

  const acao = await comTrava(`${a.id}:${m.numero}`, async (tx): Promise<AcaoPendente | null> => {
    if (m.id && await tx.assistenteMensagem.findUnique({ where: { providerId: m.id }, select: { id: true } })) return null
    const conversa = await tx.assistenteConversa.findFirst({
      where: { assistenteId: a.id, tipo: 'LEAD', numeroContato: m.numero, status: { in: STATUS_ABERTOS } },
      orderBy: { criadoEm: 'desc' },
      include: { mensagens: { orderBy: { criadoEm: 'desc' }, take: 12 } },
    })

    if (conversa) {
      const esperandoResposta = perguntaJaEntregue(conversa.mensagens)
      await tx.assistenteMensagem.create({ data: { conversaId: conversa.id, remetente: 'CONTATO', texto: m.texto, providerId: m.id } })
      const base = { ultimaMensagemEm: new Date(), ...(m.nomePerfil && conversa.nomeContato === formatarTelefone(m.numero) && { nomeContato: m.nomePerfil }) }
      const estado: EstadoRoteiro = { etapa: conversa.etapaRoteiro, respostas: (conversa.respostas ?? {}) as Record<string, string> }
      if (conversa.status !== 'ATIVA' || !a.atendimentoAutomatico) {
        await tx.assistenteConversa.update({ where: { id: conversa.id }, data: base })
        return null
      }
      const nomeContato = m.nomePerfil ?? conversa.nomeContato
      if (!esperandoResposta) {
        // Várias mensagens seguidas antes do assistente responder: junta
        // na resposta anterior (ou na mensagem inicial) sem mandar nada.
        const novo = estado.etapa > 0 ? complementarResposta(cfg, estado, m.texto) : { ...estado, respostas: { ...estado.respostas, _inicial: `${estado.respostas._inicial ?? ''} ${m.texto}`.trim() } }
        await tx.assistenteConversa.update({ where: { id: conversa.id }, data: { ...base, respostas: novo.respostas } })
        return null
      }
      if (!m.ehTexto) {
        await tx.assistenteConversa.update({ where: { id: conversa.id }, data: base })
        return { conversaId: conversa.id, jid: conversa.jid ?? m.jid, passo: null, mensagensAvulsas: [TEXTO_SO_TEXTO], nomeContato, origem: conversa.origem }
      }
      const passo = avancarRoteiro(cfg, estado, m.texto, contexto(a, cfg, nomeContato))
      await tx.assistenteConversa.update({ where: { id: conversa.id }, data: { ...base, ...dadosDoPasso(passo) } })
      return { conversaId: conversa.id, jid: conversa.jid ?? m.jid, passo, mensagensAvulsas: [], nomeContato, origem: conversa.origem }
    }

    if (!origem && !a.cadastroAutomatico) return null
    const ignorado = await tx.assistenteContatoIgnorado.findUnique({ where: { assistenteId_numero: { assistenteId: a.id, numero: m.numero } } })
    // Conversa pessoal não ganha lead novo nem robô, mas um lead perdido
    // que volta a chamar (o vendedor já tinha falado com ele) é sinalizado.
    const leadId = a.cadastroAutomatico && (!ignorado || ignorado.motivo === 'CONVERSA_PESSOAL')
      ? await capturarLead(tx, a, m, ignorado ? null : origem)
      : null
    if (!roboAtende || ignorado) {
      // Lead sem o robô: a conversa fica registrada (aprendizado, sugestões,
      // follow), já com o vendedor. Conversa pessoal continua de fora.
      if (leadId && !ignorado) {
        await tx.assistenteConversa.create({
          data: {
            assistenteId: a.id, tipo: 'LEAD', robo: false, status: 'ASSUMIDA', leadId, origem,
            nomeContato: m.nomePerfil ?? formatarTelefone(m.numero), numeroContato: m.numero, jid: m.jid,
            respostas: { _inicial: m.texto } as Prisma.InputJsonValue,
            mensagens: { create: { remetente: 'CONTATO', texto: m.texto, providerId: m.id } },
          },
        })
      }
      return null
    }
    const nomeContato = m.nomePerfil ?? formatarTelefone(m.numero)
    const passo = iniciarRoteiro(cfg, contexto(a, cfg, nomeContato), m.texto)
    const criada = await tx.assistenteConversa.create({
      data: {
        assistenteId: a.id, tipo: 'LEAD', nomeContato, numeroContato: m.numero, jid: m.jid, origem, leadId,
        ...dadosDoPasso(passo),
        mensagens: { create: { remetente: 'CONTATO', texto: m.texto, providerId: m.id } },
      },
    })
    return { conversaId: criada.id, jid: m.jid, passo, mensagensAvulsas: [], nomeContato, origem }
  })

  if (!acao) return
  const textos = acao.passo ? acao.passo.mensagens : acao.mensagensAvulsas
  await enviarDoAssistente(a, cfg, acao.conversaId, acao.jid, textos)
  if (acao.passo?.desfecho === 'DESISTIU') {
    await anotarDesistencia(acao.conversaId).catch(e => logger.error({ err: e }, 'assistente: falha ao anotar desistência no lead'))
  } else if (acao.passo?.desfecho) {
    await concluirAtendimento(a, cfg, acao.conversaId)
  }
}

// A mensagem do contato só é resposta da última pergunta se essa pergunta já
// tinha chegado no celular dele (o WhatsApp devolveu o ID do envio) e veio
// depois da última mensagem dele. Enquanto o assistente ainda está
// "digitando", o que o contato manda é continuação da resposta anterior.
function perguntaJaEntregue(recentes: Array<{ remetente: string; providerId: string | null; criadoEm: Date }>): boolean {
  const limiteFalha = Date.now() - 30_000 // envio que falhou não trava a conversa pra sempre
  const pergunta = recentes.find(m => m.remetente === 'ASSISTENTE' && (m.providerId || m.criadoEm.getTime() < limiteFalha))
  if (!pergunta) return false
  const ultimaDoContato = recentes.find(m => m.remetente === 'CONTATO')
  return !ultimaDoContato || pergunta.criadoEm > ultimaDoContato.criadoEm
}

function dadosDoPasso(passo: PassoRoteiro) {
  const agora = new Date()
  return {
    etapaRoteiro: passo.estado.etapa,
    respostas: passo.estado.respostas as Prisma.InputJsonValue,
    ...(passo.desfecho === 'DESISTIU' && { status: 'ENCERRADA', resultado: 'DESISTIU', encerradaEm: agora }),
    ...((passo.desfecho === 'QUALIFICADO' || passo.desfecho === 'PEDIU_ATENDENTE') && { status: 'AGUARDANDO_VENDEDOR', resultado: passo.desfecho as Desfecho, aguardandoVendedorEm: agora }),
  }
}

// "Nunca falou com o vendedor": nenhuma conversa registrada aqui e nada no
// histórico do servidor além da própria mensagem. Se o servidor não
// responder, assume que NÃO é novo — melhor perder um lead do que o
// assistente responder um amigo/cliente antigo do vendedor.
async function contatoSemHistorico(a: AssistenteCompleto, m: MensagemWhatsapp): Promise<boolean> {
  const [anteriores, ignorado] = await Promise.all([
    prisma.assistenteConversa.count({ where: { assistenteId: a.id, numeroContato: m.numero } }),
    prisma.assistenteContatoIgnorado.findUnique({ where: { assistenteId_numero: { assistenteId: a.id, numero: m.numero } }, select: { id: true } }),
  ])
  if (anteriores > 0 || ignorado || !a.instancia) return false
  try {
    return (await contarMensagensComContato(a.instancia, m.jid)) <= 1
  } catch (e) {
    logger.warn({ err: e }, 'assistente: histórico do contato indisponível — tratando como contato conhecido')
    return false
  }
}

function tempoDigitando(cfg: ConfigAssistente, texto: string): number {
  if (cfg.atrasoSegundos <= 0) return 0
  return Math.min(cfg.atrasoSegundos * 1000, 800 + texto.length * 30)
}

export async function enviarDoAssistente(a: { id: string; instancia: string | null }, cfg: ConfigAssistente, conversaId: string, destino: string, textos: string[]) {
  for (const texto of textos) {
    // Grava antes de enviar: o eco (fromMe) pode chegar antes da resposta
    // do envio e precisa ser reconhecido como mensagem do assistente.
    const registro = await prisma.assistenteMensagem.create({ data: { conversaId, remetente: 'ASSISTENTE', texto } })
    try {
      if (!a.instancia) throw new Error('Assistente sem instância conectada')
      const id = await enviarTexto(a.instancia, destino, texto, tempoDigitando(cfg, texto))
      // A hora da mensagem passa a ser a da entrega — o que o contato
      // escreveu enquanto o assistente "digitava" fica antes dela.
      if (id) await prisma.assistenteMensagem.update({ where: { id: registro.id }, data: { providerId: id, criadoEm: new Date() } }).catch(() => undefined)
    } catch (e) {
      logger.error({ err: e, conversaId }, 'assistente: falha ao enviar mensagem')
    }
  }
  await prisma.assistenteConversa.update({ where: { id: conversaId }, data: { ultimaMensagemEm: new Date() } })
}

// ---------- Fim do roteiro: CRM + aviso ----------

const ROTULO_ORIGEM: Record<string, string> = { ANUNCIO: 'anúncio', GATILHO: 'mensagem de campanha', CONTATO_NOVO: 'contato novo' }

async function concluirAtendimento(a: AssistenteCompleto, cfg: ConfigAssistente, conversaId: string) {
  const conversa = await prisma.assistenteConversa.findUnique({ where: { id: conversaId } })
  if (!conversa) return
  let leadId = conversa.leadId
  if (leadId) {
    await completarLead(leadId, cfg, conversa).catch(e => logger.error({ err: e, conversaId }, 'assistente: falha ao completar lead no CRM'))
  } else if (cfg.criarLeadNoCrm) {
    try {
      leadId = await vincularOuCriarLead(a.vendedor.usuarioId, a.vendedorId, cfg, conversa)
      await prisma.assistenteConversa.update({ where: { id: conversaId }, data: { leadId } })
    } catch (e) {
      logger.error({ err: e, conversaId }, 'assistente: falha ao criar lead no CRM')
    }
  }
  if (cfg.avisarVendedor && a.numeroWhatsapp) {
    const respostas = (conversa.respostas ?? {}) as Record<string, string>
    const linhas = linhasResumo(cfg, respostas)
    const texto = [
      conversa.resultado === 'PEDIU_ATENDENTE' ? '🔔 *Lead pediu pra falar com você*' : '🔔 *Novo lead qualificado*',
      `*${conversa.nomeContato}* · wa.me/${conversa.numeroContato}`,
      conversa.origem ? `Origem: ${ROTULO_ORIGEM[conversa.origem] ?? conversa.origem}` : null,
      respostas._inicial ? `Primeira mensagem: "${respostas._inicial.slice(0, 140)}"` : null,
      linhas.length ? '' : null,
      ...linhas.map(l => `• ${l.rotulo}: ${l.valor}`),
      '',
      leadId ? 'Já está no CRM como lead. ' : '',
      'Responda direto na conversa dele — o assistente sai de cena assim que você escrever.',
    ].filter(l => l !== null).join('\n').replace(/\n{3,}/g, '\n\n')
    const suporte = await conversaDeSuporte(a)
    await enviarDoAssistente(a, cfg, suporte.id, a.numeroWhatsapp, [texto])
  }
}

export async function vincularOuCriarLead(
  usuarioId: string,
  vendedorId: string,
  cfg: ConfigAssistente,
  conversa: { numeroContato: string; nomeContato: string; respostas: Prisma.JsonValue; origem: string | null },
): Promise<string> {
  const final8 = conversa.numeroContato.slice(-8)
  const existentes = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "pro_labore_leads"
    WHERE "usuarioId" = ${usuarioId} AND "estagio" NOT IN ('FECHADO', 'PERDIDO')
      AND right(regexp_replace(coalesce("telefone", ''), '\\D', '', 'g'), 8) = ${final8}
    ORDER BY "criadoEm" DESC LIMIT 1`
  if (existentes[0]) return existentes[0].id

  const respostas = (conversa.respostas ?? {}) as Record<string, string>
  const resumo = linhasResumo(cfg, respostas).map(l => `${l.rotulo}: ${l.valor}`)
  const observacao = [
    `Pré-atendido pelo Assistente Comercial no WhatsApp${conversa.origem ? ` (origem: ${ROTULO_ORIGEM[conversa.origem] ?? conversa.origem})` : ''}.`,
    respostas._inicial ? `Primeira mensagem: "${respostas._inicial}"` : null,
    ...resumo,
  ].filter(Boolean).join('\n')
  // Mensagem do link rastreado ("Oi! Vi a XRE 300 no Instagram (#P-0917-XRE)"):
  // o lead já nasce ligado ao post (seção 3.5).
  const origemPost = conversa.origem === 'ANUNCIO' ? null : await origemPorCodigo(usuarioId, respostas._inicial)
  const lead = await prisma.lead.create({
    data: {
      usuarioId,
      vendedorId,
      ...origemPost,
      nomeCliente: respostaDoCampo(cfg, respostas, 'nomeCompleto') ?? conversa.nomeContato,
      telefone: formatarTelefone(conversa.numeroContato),
      modeloInteresse: respostaDoCampo(cfg, respostas, 'modeloInteresse'),
      observacao,
      origemCadastro: 'WHATSAPP',
      // Anúncio e frase de campanha = tráfego pago. Contato novo sem sinal
      // de campanha fica sem canal — o vendedor classifica.
      tipoLead: origemPost ? 'ORGANICO' : conversa.origem === 'ANUNCIO' || conversa.origem === 'GATILHO' ? 'TRAFEGO' : null,
    },
  })
  await prisma.leadEstagioHistorico.create({ data: { leadId: lead.id, estagioAnterior: null, estagioNovo: 'LEAD' } })
  return lead.id
}

// ---------- Cadastro automático no CRM ----------

interface LeadDoTelefone { id: string; estagio: string; vendedorId: string | null; nomeCliente: string; fechadoEm: Date | null }

const trecho = (t: string, max: number) => (t.length > max ? `${t.slice(0, max - 1)}…` : t)
const dataBR = (d: Date) => d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
const DIAS_ENTRE_SINAIS_DE_RETORNO = 7
const primeiroNome = (nome: string) => { const n = nome.trim().split(/\s+/)[0] ?? ''; return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase() }

/**
 * Chamado na 1ª mensagem de um contato sem conversa aberta. Devolve o lead
 * ligado ao telefone (aberto, perdido que voltou ou recém-criado) ou null.
 * `origem` null = não é contato novo: só procura o que já existe.
 */
async function capturarLead(tx: Prisma.TransactionClient, a: AssistenteCompleto, m: MensagemWhatsapp, origem: string | null): Promise<string | null> {
  const usuarioId = a.vendedor.usuarioId
  const doTelefone = m.semTelefone ? [] : await tx.$queryRaw<LeadDoTelefone[]>`
    SELECT id, estagio, "vendedorId", "nomeCliente", "fechadoEm" FROM "pro_labore_leads"
    WHERE "usuarioId" = ${usuarioId}
      AND right(regexp_replace(coalesce("telefone", ''), '\\D', '', 'g'), 8) = ${m.numero.slice(-8)}
    ORDER BY "criadoEm" DESC LIMIT 10`
  const aberto = doTelefone.find(l => l.estagio !== 'FECHADO' && l.estagio !== 'PERDIDO')
  if (aberto) return aberto.id
  const perdido = doTelefone.find(l => l.estagio === 'PERDIDO')
  if (perdido) {
    await sinalizarRetorno(tx, a, perdido, m)
    return perdido.id
  }
  if (!origem) return null

  const cliente = doTelefone.find(l => l.estagio === 'FECHADO')
  // Link rastreado do Instagram ("Vi a XRE 300 (#P-0917-XRE)") liga o lead ao post.
  const origemPost = origem === 'ANUNCIO' ? null : await origemPorCodigo(usuarioId, m.texto)
  const nomePerfil = m.nomePerfil?.trim()
  const observacao = [
    `Cadastrado automaticamente pelo WhatsApp de ${primeiroNome(a.vendedor.nome)} (origem: ${ROTULO_ORIGEM[origem] ?? origem}${m.tituloAnuncio ? ` "${m.tituloAnuncio}"` : ''}).`,
    m.texto ? `Primeira mensagem: "${trecho(m.texto, 300)}"` : null,
    cliente ? `Já é cliente: comprou${cliente.fechadoEm ? ` em ${dataBR(cliente.fechadoEm)}` : ''}.` : null,
    m.semTelefone ? 'O WhatsApp não mostrou o número deste contato (privacidade): pegue o telefone na conversa.' : null,
  ].filter(Boolean).join('\n')
  const lead = await tx.lead.create({
    data: {
      usuarioId,
      vendedorId: a.vendedorId,
      ...origemPost,
      nomeCliente: nomePerfil && nomePerfil.length >= 2 ? nomePerfil.slice(0, 120) : m.semTelefone ? 'Contato do WhatsApp' : formatarTelefone(m.numero),
      telefone: m.semTelefone ? null : formatarTelefone(m.numero),
      observacao,
      origemCadastro: 'WHATSAPP',
      tipoLead: origemPost ? 'ORGANICO' : origem === 'ANUNCIO' || origem === 'GATILHO' ? 'TRAFEGO' : null,
    },
  })
  await tx.leadEstagioHistorico.create({ data: { leadId: lead.id, estagioAnterior: null, estagioNovo: 'LEAD' } })
  logger.info({ leadId: lead.id, vendedorId: a.vendedorId, origem }, 'assistente: lead cadastrado automaticamente pelo WhatsApp')
  return lead.id
}

// Lead perdido escreveu de novo: fica quente na Reativação com um follow pra
// hoje. No máximo um aviso por semana, e nada se já houver follow pendente.
async function sinalizarRetorno(tx: Prisma.TransactionClient, a: AssistenteCompleto, lead: LeadDoTelefone, m: MensagemWhatsapp) {
  const recente = await tx.leadFollow.findFirst({
    where: { leadId: lead.id, OR: [{ status: 'PENDENTE' }, { criadoEm: { gte: new Date(Date.now() - DIAS_ENTRE_SINAIS_DE_RETORNO * 86_400_000) } }] },
    select: { id: true },
  })
  if (recente) return
  const outroVendedor = lead.vendedorId && lead.vendedorId !== a.vendedorId ? ` de ${primeiroNome(a.vendedor.nome)}` : ''
  await tx.lead.update({ where: { id: lead.id }, data: { temperatura: 'QUENTE' } })
  await tx.leadFollow.create({
    data: {
      usuarioId: a.vendedor.usuarioId,
      leadId: lead.id,
      vendedorId: lead.vendedorId ?? a.vendedorId,
      agendadoPara: new Date(),
      canal: 'WHATSAPP',
      nota: `Voltou a chamar no WhatsApp${outroVendedor}: "${trecho(m.texto, 160)}"`,
      criadoPor: 'WhatsApp (automático)',
    },
  })
}

// Fim do roteiro com o lead já no CRM: acrescenta o que o assistente apurou
// sem apagar o que o vendedor já tenha preenchido.
async function completarLead(leadId: string, cfg: ConfigAssistente, conversa: { numeroContato: string; nomeContato: string; respostas: Prisma.JsonValue }) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { nomeCliente: true, modeloInteresse: true, observacao: true } })
  if (!lead) return
  const respostas = (conversa.respostas ?? {}) as Record<string, string>
  const resumo = linhasResumo(cfg, respostas).map(l => `${l.rotulo}: ${l.valor}`)
  const nome = respostaDoCampo(cfg, respostas, 'nomeCompleto')
  const nomeAutomatico = [conversa.nomeContato, formatarTelefone(conversa.numeroContato)].includes(lead.nomeCliente)
  const jaTemResumo = lead.observacao?.includes('Pré-atendido pelo Assistente Comercial')
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      ...(nome && nomeAutomatico && { nomeCliente: nome }),
      ...(!lead.modeloInteresse && { modeloInteresse: respostaDoCampo(cfg, respostas, 'modeloInteresse') }),
      ...(!jaTemResumo && resumo.length && {
        observacao: [lead.observacao, 'Pré-atendido pelo Assistente Comercial no WhatsApp:', ...resumo].filter(Boolean).join('\n'),
      }),
    },
  })
}

// Pediu pra parar no meio do roteiro: o lead (já cadastrado na 1ª mensagem)
// fica no CRM, mas o vendedor sabe o que aconteceu antes de abordar.
async function anotarDesistencia(conversaId: string) {
  const c = await prisma.assistenteConversa.findUnique({ where: { id: conversaId }, select: { lead: { select: { id: true, observacao: true } } } })
  const NOTA = 'Pediu para parar o atendimento automático do WhatsApp.'
  if (!c?.lead || c.lead.observacao?.includes(NOTA)) return
  await prisma.lead.update({ where: { id: c.lead.id }, data: { observacao: [c.lead.observacao, NOTA].filter(Boolean).join('\n') } })
}

// ---------- Suporte ao vendedor pelo chat "Você" ----------

export async function conversaDeSuporte(a: { id: string; numeroWhatsapp: string | null; vendedor: { nome: string } }) {
  const numero = a.numeroWhatsapp ?? ''
  const existente = await prisma.assistenteConversa.findFirst({ where: { assistenteId: a.id, tipo: 'SUPORTE' }, orderBy: { criadoEm: 'asc' } })
  if (existente) return existente
  return prisma.assistenteConversa.create({
    data: { assistenteId: a.id, tipo: 'SUPORTE', nomeContato: a.vendedor.nome, numeroContato: numero, jid: numero ? `${numero}@s.whatsapp.net` : null, status: 'ATIVA' },
  })
}

async function tratarSuporte(a: AssistenteCompleto, m: MensagemWhatsapp) {
  if (await jaRegistrada(m.id)) return
  const comando = interpretarComando(m.texto)
  if (!comando || !a.numeroWhatsapp) return
  const cfg = lerConfig(a.configuracao)
  const conversa = await conversaDeSuporte(a)
  try {
    await prisma.assistenteMensagem.create({ data: { conversaId: conversa.id, remetente: 'CONTATO', texto: m.texto, providerId: m.id } })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return // webhook repetido
    throw e
  }
  const resposta = await responderComando(a, comando)
  await enviarDoAssistente(a, { ...cfg, atrasoSegundos: 0 }, conversa.id, a.numeroWhatsapp, [resposta])
}

async function responderComando(a: AssistenteCompleto, comando: NonNullable<ReturnType<typeof interpretarComando>>): Promise<string> {
  if (comando === 'MENU') return TEXTO_MENU
  if (comando === 'PAUSAR' || comando === 'ATIVAR') {
    const ativo = comando === 'ATIVAR'
    await prisma.assistenteComercial.update({ where: { id: a.id }, data: { atendimentoAutomatico: ativo } })
    return ativo
      ? '▶️ Assistente ativado — volto a responder leads novos.'
      : '⏸️ Assistente pausado — não vou responder ninguém até você mandar *ativar*. Conversas em andamento ficam com você.'
  }
  if (comando === 'PENDENTES') {
    const pendentes = await prisma.assistenteConversa.findMany({
      where: { assistenteId: a.id, tipo: 'LEAD', status: 'AGUARDANDO_VENDEDOR' },
      orderBy: { aguardandoVendedorEm: 'asc' },
      take: 8,
    })
    if (pendentes.length === 0) return '✅ Nenhum lead esperando resposta sua agora.'
    return [
      `⏳ *${pendentes.length} lead${pendentes.length > 1 ? 's' : ''} esperando você:*`,
      '',
      ...pendentes.map(p => `• ${p.nomeContato} — wa.me/${p.numeroContato} (${tempoDesde(p.aguardandoVendedorEm ?? p.ultimaMensagemEm)})`),
    ].join('\n')
  }
  // RESUMO — dia corrente no horário de Brasília
  const inicio = inicioDoDiaBrasilia(diaBrasilia(new Date()))
  const [novos, qualificados, aguardando, assumidos] = await Promise.all([
    prisma.assistenteConversa.count({ where: { assistenteId: a.id, tipo: 'LEAD', robo: true, criadoEm: { gte: inicio } } }),
    prisma.assistenteConversa.count({ where: { assistenteId: a.id, tipo: 'LEAD', aguardandoVendedorEm: { gte: inicio } } }),
    prisma.assistenteConversa.count({ where: { assistenteId: a.id, tipo: 'LEAD', status: 'AGUARDANDO_VENDEDOR' } }),
    prisma.assistenteConversa.count({ where: { assistenteId: a.id, tipo: 'LEAD', assumidaEm: { gte: inicio } } }),
  ])
  return [
    '📊 *Resumo de hoje*',
    '',
    `• Leads atendidos pelo assistente: ${novos}`,
    `• Concluíram as perguntas / pediram você: ${qualificados}`,
    `• Conversas que você assumiu: ${assumidos}`,
    `• Esperando sua resposta agora: ${aguardando}`,
    '',
    a.atendimentoAutomatico ? 'Assistente ativo. Mande *pausar* pra parar.' : 'Assistente pausado. Mande *ativar* pra voltar.',
  ].join('\n')
}

function tempoDesde(d: Date): string {
  const min = Math.max(0, Math.round((Date.now() - d.getTime()) / 60_000))
  if (min < 60) return `há ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `há ${h}h`
  return `há ${Math.round(h / 24)} dia(s)`
}
