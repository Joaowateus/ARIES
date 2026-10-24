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
import { contarMensagensComContato, enviarImagem, enviarTexto, perfilInstancia } from './whatsappEvolution'
import { lerImagem } from './armazenamento'
import { origemPorCodigo } from './smAtribuicao'
import {
  ConfigAssistente, ContextoRoteiro, Desfecho, EstadoRoteiro, MidiaPasso, PassoRoteiro, TEXTO_MENU,
  avancarRoteiro, casaGatilho, complementarResposta, desiste, interpretarComando, iniciarRoteiro, lerConfig, linhasResumo, respostaDoCampo,
} from './assistenteRoteiro'
import { ItemAtivo, VitrineLoja, baseParaRobo, registrarUso, respostasAtivas, simuladorDoRobo, vitrineDaLoja } from './assistenteRespostas'
import { ResultadoSimulacao, resumoSimulacao } from './assistenteSimulacao'
import { calcularNota } from './assistenteNota'
import { Avanco, Etiqueta, ROTULO_ETAPA, etiquetasDoLead, proximaEtapa, rebaixadoHaPouco } from './assistenteJornada'
import { PassoFollow, baseDoFollow, dentroDoHorario, inicioDoDiaBrt, lerConfigFollow, proximoFollow, quandoDevido } from './assistenteFollow'
import { preencherResposta } from './assistenteConhecimento'
import { MotoVitrine, acharMotos, nomeDaMoto } from './assistenteVitrine'
import { interpretarPergunta } from './assistentePessoal'
import { leadsEsperando, primeiroNomeVendedor, responderPergunta, resumoDoDia, tempoDesde as tempoDesdePessoal } from './assistentePessoalDados'

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
    where: { conversaId: conversa.id, remetente: { in: ['ASSISTENTE', 'VENDEDOR'] }, providerId: null, texto: m.texto, criadoEm: { gte: new Date(Date.now() - 2 * 60_000) } },
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
  await avaliarJornada(conversa.id).catch(e => logger.warn({ err: e }, 'assistente: falha na jornada do lead'))
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
  // Respostas aprovadas da base (dúvidas no meio do roteiro). Base fora do
  // ar não para o atendimento: o roteiro segue sem elas.
  const [ativos, vitrine]: [ItemAtivo[], VitrineLoja | undefined] = a.atendimentoAutomatico
    ? await Promise.all([
      respostasAtivas(a.vendedor.usuarioId).catch(e => { logger.warn({ err: e }, 'assistente: base de respostas indisponível'); return [] }),
      vitrineDaLoja(a.vendedor.usuarioId).catch(e => { logger.warn({ err: e }, 'assistente: vitrine indisponível'); return undefined }),
    ])
    : [[], undefined]
  const baseDoRobo = (nomeContato: string, respostas: Record<string, string>) =>
    baseParaRobo(ativos, { ...contexto(a, cfg, nomeContato), moto: respostaDoCampo(cfg, respostas, 'modeloInteresse') }, vitrine)
  let conversaTocada: string | null = null

  const acao = await comTrava(`${a.id}:${m.numero}`, async (tx): Promise<AcaoPendente | null> => {
    if (m.id && await tx.assistenteMensagem.findUnique({ where: { providerId: m.id }, select: { id: true } })) return null
    const conversa = await tx.assistenteConversa.findFirst({
      where: { assistenteId: a.id, tipo: 'LEAD', numeroContato: m.numero, status: { in: STATUS_ABERTOS } },
      orderBy: { criadoEm: 'desc' },
      include: { mensagens: { orderBy: { criadoEm: 'desc' }, take: 12 } },
    })

    if (conversa) {
      conversaTocada = conversa.id
      const esperandoResposta = perguntaJaEntregue(conversa.mensagens)
      await tx.assistenteMensagem.create({ data: { conversaId: conversa.id, remetente: 'CONTATO', texto: m.texto, providerId: m.id } })
      const base = {
        ultimaMensagemEm: new Date(), ...(m.nomePerfil && conversa.nomeContato === formatarTelefone(m.numero) && { nomeContato: m.nomePerfil }),
        // Cliente respondeu: o follow automático recomeça do zero; pediu para parar (com o vendedor), para de vez.
        ...(conversa.followPasso > 0 && { followPasso: 0 }),
        ...(conversa.status !== 'ATIVA' && !conversa.followParado && desiste(m.texto) && { followParado: 'PEDIU_PARAR' }),
      }
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
      const passo = avancarRoteiro(cfg, estado, m.texto, contexto(a, cfg, nomeContato), baseDoRobo(nomeContato, estado.respostas), simuladorDoRobo(cfg, contexto(a, cfg, nomeContato), vitrine))
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
        conversaTocada = (await tx.assistenteConversa.create({
          data: {
            assistenteId: a.id, tipo: 'LEAD', robo: false, status: 'ASSUMIDA', leadId, origem,
            nomeContato: m.nomePerfil ?? formatarTelefone(m.numero), numeroContato: m.numero, jid: m.jid,
            respostas: { _inicial: m.texto } as Prisma.InputJsonValue,
            mensagens: { create: { remetente: 'CONTATO', texto: m.texto, providerId: m.id } },
          },
          select: { id: true },
        })).id
      }
      return null
    }
    const nomeContato = m.nomePerfil ?? formatarTelefone(m.numero)
    const passo = iniciarRoteiro(cfg, contexto(a, cfg, nomeContato), m.texto, baseDoRobo(nomeContato, {}))
    const criada = await tx.assistenteConversa.create({
      data: {
        assistenteId: a.id, tipo: 'LEAD', nomeContato, numeroContato: m.numero, jid: m.jid, origem, leadId,
        ...dadosDoPasso(passo),
        mensagens: { create: { remetente: 'CONTATO', texto: m.texto, providerId: m.id } },
      },
    })
    conversaTocada = criada.id
    return { conversaId: criada.id, jid: m.jid, passo, mensagensAvulsas: [], nomeContato, origem }
  })

  if (acao) {
    const textos = acao.passo ? acao.passo.mensagens : acao.mensagensAvulsas
    await enviarDoAssistente(a, cfg, acao.conversaId, acao.jid, textos, acao.passo?.midias)
    if (acao.passo?.desfecho === 'DESISTIU') {
      await anotarDesistencia(acao.conversaId).catch(e => logger.error({ err: e }, 'assistente: falha ao anotar desistência no lead'))
    } else if (acao.passo?.desfecho) {
      await concluirAtendimento(a, cfg, acao.conversaId)
    }
    if (acao.passo?.motoUsada) {
      await prisma.smMotoEstoque.updateMany({ where: { id: acao.passo.motoUsada }, data: { enviosWhatsapp: { increment: 1 } } }).catch(() => undefined)
    }
    if (acao.passo?.conhecimentoUsado) {
      const usada = await prisma.assistenteConversa.findUnique({ where: { id: acao.conversaId }, select: { leadId: true } })
      await registrarUso({ usuarioId: a.vendedor.usuarioId, conhecimentoId: acao.passo.conhecimentoUsado, conversaId: acao.conversaId, leadId: usada?.leadId ?? null, canal: 'ROBO' })
        .catch(e => logger.warn({ err: e }, 'assistente: falha ao registrar uso da base'))
    }
  }
  if (conversaTocada) {
    await atualizarNota(cfg, conversaTocada).catch(e => logger.warn({ err: e }, 'assistente: falha ao calcular a nota do lead'))
    await avaliarJornada(conversaTocada).catch(e => logger.warn({ err: e }, 'assistente: falha na jornada do lead'))
  }
}

// ---------- Jornada: etiquetas + avanço no funil ----------

const DIA_MS = 86_400_000

/**
 * Recalcula as etiquetas do lead pela conversa e, se a loja deixou ligado,
 * avança uma etapa quando há sinal claro (ver proximaEtapa). Avanço vai
 * para o histórico com o motivo e pode ser desfeito no card do CRM; o
 * vendedor recebe aviso no chat "Você" (menos o Lead → Abordado, que é ele
 * mesmo respondendo).
 */
export async function avaliarJornada(conversaId: string, opcoes: { avancar?: boolean; agora?: Date } = {}): Promise<{ etiquetas: Etiqueta[]; avanco: Avanco | null } | null> {
  const agora = opcoes.agora ?? new Date()
  const conversa = await prisma.assistenteConversa.findUnique({
    where: { id: conversaId },
    select: {
      tipo: true, leadId: true, respostas: true, nota: true, simulacao: true,
      assistente: { select: { id: true, instancia: true, numeroWhatsapp: true, configuracao: true, vendedor: { select: { nome: true, usuarioId: true } } } },
      mensagens: { orderBy: { criadoEm: 'desc' }, take: 80, select: { remetente: true, texto: true, criadoEm: true } },
    },
  })
  if (!conversa || conversa.tipo !== 'LEAD' || !conversa.leadId) return null
  const lead = await prisma.lead.findUnique({ where: { id: conversa.leadId }, select: { id: true, nomeCliente: true, estagio: true, etiquetas: true, avancosDesfeitos: true, vendaId: true } })
  if (!lead) return null
  const cfg = lerConfig(conversa.assistente.configuracao)
  const doContato = conversa.mensagens.filter(m => m.remetente === 'CONTATO')
  const doVendedor = conversa.mensagens.filter(m => m.remetente === 'VENDEDOR')
  const nossa = conversa.mensagens.find(m => m.remetente !== 'CONTATO')
  const etiquetas = etiquetasDoLead({
    cfg, respostas: (conversa.respostas ?? {}) as Record<string, string>, textosDoContato: doContato.map(m => m.texto), nota: conversa.nota,
    ultimaDoContatoEm: doContato[0]?.criadoEm ?? null, ultimaNossaEm: nossa?.criadoEm ?? null, agora, simulacao: avaliacaoDa(conversa.simulacao),
  })
  if (etiquetas.join() !== lead.etiquetas.join()) await prisma.lead.update({ where: { id: lead.id }, data: { etiquetas } })

  if (opcoes.avancar === false || lead.vendaId || lead.estagio === 'FECHADO' || lead.estagio === 'PERDIDO') return { etiquetas, avanco: null }
  const loja = await prisma.assistenteLoja.findUnique({ where: { usuarioId: conversa.assistente.vendedor.usuarioId }, select: { avancoAutomatico: true } })
  if (loja && !loja.avancoAutomatico) return { etiquetas, avanco: null }
  const historico = await prisma.leadEstagioHistorico.findMany({ where: { leadId: lead.id, criadoEm: { gte: new Date(agora.getTime() - 7 * DIA_MS) } } })
  if (rebaixadoHaPouco(historico, agora)) return { etiquetas, avanco: null }
  const avanco = proximaEtapa({
    estagio: lead.estagio, vendedorRespondeu: doVendedor.length > 0, textosDoContato: doContato.map(m => m.texto),
    textosDoVendedor: doVendedor.slice(0, 10).map(m => m.texto), etiquetas, nota: conversa.nota, desfeitos: lead.avancosDesfeitos,
  })
  if (!avanco) return { etiquetas, avanco: null }
  // Só move se ninguém mexeu no lead nesse meio-tempo.
  const movido = await prisma.lead.updateMany({ where: { id: lead.id, estagio: lead.estagio }, data: { estagio: avanco.para } })
  if (!movido.count) return { etiquetas, avanco: null }
  await prisma.leadEstagioHistorico.create({ data: { leadId: lead.id, estagioAnterior: lead.estagio, estagioNovo: avanco.para, origem: 'ASSISTENTE', motivo: avanco.motivo } })
  const a = conversa.assistente
  if (avanco.para !== 'ABORDADO' && cfg.avisarVendedor && a.numeroWhatsapp) {
    const texto = `➡️ Movi *${lead.nomeCliente}* para *${ROTULO_ETAPA[avanco.para]}* no CRM: ${avanco.motivo}.\nSe não for isso, toque em "Desfazer" no card do lead.`
    const suporte = await conversaDeSuporte({ ...a, vendedor: { nome: a.vendedor.nome } })
    await enviarDoAssistente(a, { ...cfg, atrasoSegundos: 0 }, suporte.id, a.numeroWhatsapp, [texto])
      .catch(e => logger.warn({ err: e }, 'assistente: falha ao avisar o avanço do lead'))
  }
  return { etiquetas, avanco }
}

// ---------- Follow automático (ver assistenteFollow.ts) ----------

const SELECT_CONVERSA_FOLLOW = {
  id: true, assistenteId: true, nomeContato: true, jid: true, numeroContato: true, respostas: true, followPasso: true, followUltimoEm: true,
  lead: { select: { modeloInteresse: true } },
  mensagens: { orderBy: { criadoEm: 'desc' as const }, take: 40, select: { remetente: true, criadoEm: true } },
} satisfies Prisma.AssistenteConversaSelect
type ConversaFollow = Prisma.AssistenteConversaGetPayload<{ select: typeof SELECT_CONVERSA_FOLLOW }>

function conversasDoFollow(assistenteIds: string[], agora: Date) {
  return prisma.assistenteConversa.findMany({
    where: {
      assistenteId: { in: assistenteIds }, tipo: 'LEAD', status: 'ASSUMIDA', followParado: null,
      ultimaMensagemEm: { gte: new Date(agora.getTime() - 40 * DIA_MS) },
      lead: { is: { estagio: { notIn: ['FECHADO', 'PERDIDO'] }, vendaId: null } },
    },
    select: SELECT_CONVERSA_FOLLOW,
    orderBy: { ultimaMensagemEm: 'asc' },
    take: 400,
  })
}

// A moto de interesse no estoque (disponível), para a foto/vídeo e o {moto}.
function motoDoFollow(cfg: ConfigAssistente, c: Pick<ConversaFollow, 'respostas' | 'lead'>, motos: MotoVitrine[]): { nome: string | null; moto: MotoVitrine | null } {
  const interesse = c.lead?.modeloInteresse ?? respostaDoCampo(cfg, (c.respostas ?? {}) as Record<string, string>, 'modeloInteresse')
  const moto = interesse ? acharMotos(interesse, motos.filter(m => m.situacao === 'DISPONIVEL'))[0] ?? null : null
  return { nome: moto ? nomeDaMoto(moto) : interesse, moto }
}

export function textoDoFollow(passo: PassoFollow, cfg: ConfigAssistente, ctx: { nomeContato: string; vendedor: string }, alvo: { nome: string | null; moto: MotoVitrine | null }): { texto: string; foto: string | null } {
  let texto = preencherResposta(passo.texto, { ...ctx, empresa: cfg.nomeEmpresa, moto: alvo.nome })
  if (passo.midia === 'VIDEO_MOTO' && alvo.moto?.videoUrl) texto += `\n🎬 ${alvo.moto.videoUrl}`
  return { texto, foto: passo.midia === 'FOTO_MOTO' ? alvo.moto?.fotos[0] ?? null : null }
}

/**
 * Rodada do cron (a cada 15 min): manda o passo devido de cada conversa,
 * dentro do horário e do teto diário de cada número. Marca a conversa antes
 * de enviar, para duas rodadas juntas não mandarem em dobro.
 */
export async function rodarFollows(agora = new Date(), prazoMs = 8000): Promise<{ followsEnviados: number }> {
  const inicio = Date.now()
  let enviados = 0
  for (const loja of await prisma.assistenteLoja.findMany({ where: { followAtivo: true } })) {
    const cfgF = lerConfigFollow(loja.followConfig)
    if (!dentroDoHorario(agora, cfgF)) continue
    const assistentes = await prisma.assistenteComercial.findMany({
      where: { vendedor: { usuarioId: loja.usuarioId }, status: 'CONECTADO', instancia: { not: null } },
      include: { vendedor: { select: { id: true, nome: true, usuarioId: true } } },
    })
    if (!assistentes.length) continue
    const { motos } = await vitrineDaLoja(loja.usuarioId).catch(() => ({ motos: [] as MotoVitrine[] }))
    for (const a of assistentes) {
      const cfg = lerConfig(a.configuracao)
      let hoje = await prisma.assistenteMensagem.count({ where: { origem: 'FOLLOW', criadoEm: { gte: inicioDoDiaBrt(agora) }, conversa: { assistenteId: a.id } } })
      for (const c of await conversasDoFollow([a.id], agora)) {
        if (hoje >= cfgF.tetoDiario || Date.now() - inicio > prazoMs) break
        const passo = proximoFollow({ cfg: cfgF, passo: c.followPasso, parado: null, baseEm: baseDoFollow(c.mensagens), ultimoFollowEm: c.followUltimoEm, agora })
        if (!passo) continue
        const marcado = await prisma.assistenteConversa.updateMany({ where: { id: c.id, followPasso: c.followPasso, followParado: null }, data: { followPasso: c.followPasso + 1, followUltimoEm: agora } })
        if (!marcado.count) continue
        const { texto, foto } = textoDoFollow(passo, cfg, { nomeContato: c.nomeContato, vendedor: a.vendedor.nome }, motoDoFollow(cfg, c, motos))
        const destino = c.jid ?? c.numeroContato
        try {
          if (foto) await enviarFotoNaConversa(a.instancia, c.id, destino, { url: foto, legenda: texto }, 'ASSISTENTE', 1500, 'FOLLOW')
          else {
            const registro = await prisma.assistenteMensagem.create({ data: { conversaId: c.id, remetente: 'ASSISTENTE', texto, origem: 'FOLLOW' } })
            try {
              const id = await enviarTexto(a.instancia!, destino, texto, 1500)
              if (id) await prisma.assistenteMensagem.update({ where: { id: registro.id }, data: { providerId: id, criadoEm: new Date() } }).catch(() => undefined)
            } catch (e) {
              await prisma.assistenteMensagem.delete({ where: { id: registro.id } }).catch(() => undefined)
              throw e
            }
          }
          await prisma.assistenteConversa.update({ where: { id: c.id }, data: { ultimaMensagemEm: new Date() } })
          hoje += 1
          enviados += 1
        } catch (e) {
          // Não saiu: devolve o passo para a próxima rodada tentar de novo.
          await prisma.assistenteConversa.updateMany({ where: { id: c.id, followPasso: c.followPasso + 1 }, data: { followPasso: c.followPasso, followUltimoEm: c.followUltimoEm } })
          logger.warn({ err: e, conversaId: c.id }, 'assistente: follow automático não saiu')
        }
      }
    }
  }
  return { followsEnviados: enviados }
}

export interface ItemFilaFollow { conversaId: string; nome: string; vendedor: string; passo: number; total: number; devidoEm: Date; texto: string; foto: string | null }

/** Próximos follows (para a tela), sem enviar nada. */
export async function filaDeFollow(usuarioId: string, vendedorId: string | null, agora = new Date()): Promise<ItemFilaFollow[]> {
  const loja = await prisma.assistenteLoja.findUnique({ where: { usuarioId } })
  const cfgF = lerConfigFollow(loja?.followConfig)
  const assistentes = await prisma.assistenteComercial.findMany({
    where: { vendedor: { usuarioId, ...(vendedorId && { id: vendedorId }) } },
    include: { vendedor: { select: { id: true, nome: true, usuarioId: true } } },
  })
  if (!assistentes.length) return []
  const { motos } = await vitrineDaLoja(usuarioId)
  const porId = new Map(assistentes.map(a => [a.id, a]))
  const fila: ItemFilaFollow[] = []
  for (const c of await conversasDoFollow(assistentes.map(a => a.id), agora)) {
    const devidoEm = quandoDevido({ cfg: cfgF, passo: c.followPasso, parado: null, baseEm: baseDoFollow(c.mensagens), ultimoFollowEm: c.followUltimoEm })
    if (!devidoEm) continue
    const a = porId.get(c.assistenteId)!
    const cfg = lerConfig(a.configuracao)
    const { texto, foto } = textoDoFollow(cfgF.passos[c.followPasso], cfg, { nomeContato: c.nomeContato, vendedor: a.vendedor.nome }, motoDoFollow(cfg, c, motos))
    fila.push({ conversaId: c.id, nome: c.nomeContato, vendedor: a.vendedor.nome, passo: c.followPasso + 1, total: cfgF.passos.length, devidoEm, texto, foto })
  }
  return fila.sort((x, y) => x.devidoEm.getTime() - y.devidoEm.getTime()).slice(0, 40)
}

/** Rodada do cron: "sumiu há 24h" muda com o tempo, sem mensagem nova. */
export async function atualizarEtiquetasRecentes(limite = 300, agora = new Date()): Promise<{ etiquetasConversas: number }> {
  const conversas = await prisma.assistenteConversa.findMany({
    where: { tipo: 'LEAD', leadId: { not: null }, ultimaMensagemEm: { gte: new Date(agora.getTime() - 3 * DIA_MS), lte: new Date(agora.getTime() - 23 * 3600e3) } },
    select: { id: true }, take: limite, orderBy: { ultimaMensagemEm: 'desc' },
  })
  for (const c of conversas) await avaliarJornada(c.id, { avancar: false, agora }).catch(e => logger.warn({ err: e }, 'assistente: falha nas etiquetas'))
  return { etiquetasConversas: conversas.length }
}

// Nota do lead recalculada a cada mensagem do cliente: fica na conversa
// (com os motivos) e no card do CRM.
export async function atualizarNota(cfg: ConfigAssistente, conversaId: string) {
  const conversa = await prisma.assistenteConversa.findUnique({
    where: { id: conversaId },
    select: { origem: true, respostas: true, resultado: true, leadId: true, simulacao: true, mensagens: { where: { remetente: 'CONTATO' }, orderBy: { criadoEm: 'desc' }, take: 40, select: { texto: true } } },
  })
  if (!conversa) return
  const { nota, sinais } = calcularNota({
    cfg, origem: conversa.origem, resultado: conversa.resultado, simulacao: avaliacaoDa(conversa.simulacao),
    respostas: (conversa.respostas ?? {}) as Record<string, string>,
    textosDoContato: conversa.mensagens.map(m => m.texto),
  })
  await prisma.assistenteConversa.update({ where: { id: conversaId }, data: { nota, sinais: sinais as unknown as Prisma.InputJsonValue } })
  if (conversa.leadId) {
    await prisma.lead.updateMany({ where: { id: conversa.leadId, OR: [{ pontuacao: null }, { pontuacao: { not: nota } }] }, data: { pontuacao: nota } })
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

const avaliacaoDa = (simulacao: Prisma.JsonValue | null) => (simulacao as { avaliacao?: string } | null)?.avaliacao ?? null

// Respostas do roteiro + a simulação de financiamento, para o CRM e o aviso.
function linhasDaConversa(cfg: ConfigAssistente, conversa: { respostas: Prisma.JsonValue; simulacao?: Prisma.JsonValue | null }) {
  const linhas = linhasResumo(cfg, (conversa.respostas ?? {}) as Record<string, string>)
  const sim = conversa.simulacao as unknown as ResultadoSimulacao | null | undefined
  if (sim?.opcoes?.length) linhas.push({ rotulo: 'Simulação', valor: resumoSimulacao(sim) })
  return linhas
}

function dadosDoPasso(passo: PassoRoteiro) {
  const agora = new Date()
  return {
    etapaRoteiro: passo.estado.etapa,
    respostas: passo.estado.respostas as Prisma.InputJsonValue,
    ...(passo.simulacao && { simulacao: passo.simulacao as Prisma.InputJsonValue }),
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

export async function enviarDoAssistente(a: { id: string; instancia: string | null }, cfg: ConfigAssistente, conversaId: string, destino: string, textos: string[], midias: MidiaPasso[] = []) {
  const fotosAntes = async (i: number) => {
    for (const f of midias.filter(x => x.antesDe === i || (i === textos.length && x.antesDe > i))) {
      await enviarFotoNaConversa(a.instancia, conversaId, destino, f, 'ASSISTENTE', tempoDigitando(cfg, f.legenda))
        .catch(e => logger.error({ err: e, conversaId }, 'assistente: falha ao enviar foto'))
    }
  }
  for (const [i, texto] of textos.entries()) {
    await fotosAntes(i)
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
  await fotosAntes(textos.length)
  await prisma.assistenteConversa.update({ where: { id: conversaId }, data: { ultimaMensagemEm: new Date() } })
}

/**
 * Foto do estoque na conversa (robô ou botão "Enviar moto"). Grava antes de
 * enviar, como o texto, para o eco ser reconhecido; sem foto válida, vai só
 * a legenda. Falhou o envio: apaga o registro e repassa o erro.
 */
export async function enviarFotoNaConversa(instancia: string | null, conversaId: string, destino: string, foto: { url: string; legenda: string }, remetente: 'ASSISTENTE' | 'VENDEDOR', digitandoMs = 0, origem: string | null = null) {
  const img = await lerImagem(foto.url)
  const valida = !!img && (img.mime === 'image/jpeg' || img.mime === 'image/png')
  if (!valida && !foto.legenda) return null
  const registro = await prisma.assistenteMensagem.create({ data: { conversaId, remetente, texto: foto.legenda || '[imagem]', midiaUrl: valida ? foto.url : null, origem } })
  try {
    if (!instancia) throw new Error('Assistente sem instância conectada')
    const id = valida ? await enviarImagem(instancia, destino, img!, foto.legenda, digitandoMs) : await enviarTexto(instancia, destino, foto.legenda, digitandoMs)
    if (id) await prisma.assistenteMensagem.update({ where: { id: registro.id }, data: { providerId: id, criadoEm: new Date() } }).catch(() => undefined)
    return registro.id
  } catch (e) {
    await prisma.assistenteMensagem.delete({ where: { id: registro.id } }).catch(() => undefined)
    throw e
  }
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
    const linhas = linhasDaConversa(cfg, conversa)
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
  conversa: { numeroContato: string; nomeContato: string; respostas: Prisma.JsonValue; origem: string | null; simulacao?: Prisma.JsonValue | null },
): Promise<string> {
  const final8 = conversa.numeroContato.slice(-8)
  const existentes = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "pro_labore_leads"
    WHERE "usuarioId" = ${usuarioId} AND "estagio" NOT IN ('FECHADO', 'PERDIDO')
      AND right(regexp_replace(coalesce("telefone", ''), '\\D', '', 'g'), 8) = ${final8}
    ORDER BY "criadoEm" DESC LIMIT 1`
  if (existentes[0]) return existentes[0].id

  const respostas = (conversa.respostas ?? {}) as Record<string, string>
  const resumo = linhasDaConversa(cfg, conversa).map(l => `${l.rotulo}: ${l.valor}`)
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
async function completarLead(leadId: string, cfg: ConfigAssistente, conversa: { numeroContato: string; nomeContato: string; respostas: Prisma.JsonValue; simulacao?: Prisma.JsonValue | null }) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { nomeCliente: true, modeloInteresse: true, observacao: true } })
  if (!lead) return
  const respostas = (conversa.respostas ?? {}) as Record<string, string>
  const resumo = linhasDaConversa(cfg, conversa).map(l => `${l.rotulo}: ${l.valor}`)
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
  // Fora os comandos, só responde pergunta clara ("? ..." / "...?" de um
  // assunto conhecido): anotação comum no chat "Você" continua ignorada.
  const pergunta = comando ? null : interpretarPergunta(m.texto)
  if ((!comando && !pergunta) || !a.numeroWhatsapp) return
  const cfg = lerConfig(a.configuracao)
  const conversa = await conversaDeSuporte(a)
  try {
    await prisma.assistenteMensagem.create({ data: { conversaId: conversa.id, remetente: 'CONTATO', texto: m.texto, providerId: m.id } })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return // webhook repetido
    throw e
  }
  const resposta = comando ? await responderComando(a, comando) : await responderPergunta(a, pergunta!)
  await enviarDoAssistente(a, { ...cfg, atrasoSegundos: 0 }, conversa.id, a.numeroWhatsapp, [resposta])
}

// ---------- Assistente pessoal: avisos no chat "Você" ----------

// Avisos para o vendedor: segunda a sábado, das 8h às 20h (Brasília).
function horarioDeAviso(agora: Date): boolean {
  const brt = new Date(agora.getTime() - 3 * 3600e3)
  const dia = brt.getUTCDay(), hora = brt.getUTCHours()
  return dia >= 1 && dia <= 6 && hora >= 8 && hora < 20
}

async function assistentesParaAvisar() {
  return prisma.assistenteComercial.findMany({
    where: { status: 'CONECTADO', instancia: { not: null }, numeroWhatsapp: { not: null } },
    include: { vendedor: { select: { id: true, nome: true, usuarioId: true } } },
  })
}

/**
 * Rodada de 15 em 15 min: lead esperando há N min (config do vendedor) sem
 * resposta vira um aviso no chat "Você" — um só por mensagem do cliente,
 * juntando todos que estão esperando.
 */
export async function avisarLeadsEsperando(agora = new Date()): Promise<{ avisosEspera: number }> {
  if (!horarioDeAviso(agora)) return { avisosEspera: 0 }
  let avisos = 0
  for (const a of await assistentesParaAvisar()) {
    const cfg = lerConfig(a.configuracao)
    if (!cfg.avisarVendedor || cfg.alertaEsperaMin <= 0) continue
    const limite = cfg.alertaEsperaMin * 60_000
    const esperando = (await leadsEsperando(a.id, agora)).filter(e => agora.getTime() - e.desde.getTime() >= limite && agora.getTime() - e.desde.getTime() <= 3 * 3600e3)
    if (!esperando.length) continue
    const jaAvisados = new Map((await prisma.assistenteConversa.findMany({ where: { id: { in: esperando.map(e => e.conversaId) } }, select: { id: true, alertaEsperaEm: true } })).map(c => [c.id, c.alertaEsperaEm]))
    const novos = esperando.filter(e => { const em = jaAvisados.get(e.conversaId); return !em || em < e.desde })
    if (!novos.length) continue
    const texto = [
      `⏰ *${novos.length === 1 ? '1 lead esperando' : `${novos.length} leads esperando`} você:*`,
      '',
      ...novos.slice(0, 6).map(e => `• ${e.nome} — ${tempoDesdePessoal(e.desde, agora)}${e.ultima ? `: "${e.ultima}"` : ''}\n  wa.me/${e.numero}`),
    ].join('\n')
    await prisma.assistenteConversa.updateMany({ where: { id: { in: novos.map(e => e.conversaId) } }, data: { alertaEsperaEm: agora } })
    const suporte = await conversaDeSuporte(a)
    await enviarDoAssistente(a, { ...cfg, atrasoSegundos: 0 }, suporte.id, a.numeroWhatsapp!, [texto])
      .catch(e => logger.warn({ err: e }, 'assistente: falha ao avisar lead esperando'))
    avisos += 1
  }
  return { avisosEspera: avisos }
}

/** Rodada de hora em hora: o resumo da manhã (8h–11h, segunda a sábado), uma vez por dia. */
export async function enviarResumosDaManha(agora = new Date()): Promise<{ resumosManha: number }> {
  const brt = new Date(agora.getTime() - 3 * 3600e3)
  const dia = brt.getUTCDay(), hora = brt.getUTCHours()
  if (dia < 1 || dia > 6 || hora < 8 || hora >= 11) return { resumosManha: 0 }
  const hoje = inicioDoDiaBrt(agora)
  let n = 0
  for (const a of await assistentesParaAvisar()) {
    const cfg = lerConfig(a.configuracao)
    if (!cfg.avisarVendedor || !cfg.resumoManha || (a.resumoManhaEm && a.resumoManhaEm >= hoje)) continue
    // Marca antes: duas rodadas juntas não mandam dois resumos.
    const marcado = await prisma.assistenteComercial.updateMany({ where: { id: a.id, OR: [{ resumoManhaEm: null }, { resumoManhaEm: { lt: hoje } }] }, data: { resumoManhaEm: agora } })
    if (!marcado.count) continue
    const texto = await resumoDoDia(a, agora, `☀️ *Bom dia, ${primeiroNomeVendedor(a.vendedor.nome)}!* Seu dia até agora:`)
    const suporte = await conversaDeSuporte(a)
    await enviarDoAssistente(a, { ...cfg, atrasoSegundos: 0 }, suporte.id, a.numeroWhatsapp!, [`${texto}\n\nPergunte o que precisar: mande *? ajuda*.`])
      .catch(e => logger.warn({ err: e }, 'assistente: falha no resumo da manhã'))
    n += 1
  }
  return { resumosManha: n }
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
