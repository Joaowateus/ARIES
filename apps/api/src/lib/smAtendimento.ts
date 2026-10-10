// Atendimento do Instagram (seção 7): conversas de direct e comentários que
// chegam pelo webhook da Meta, respostas pela API, automações ("Comente
// QUERO" e fora do expediente), tempo de resposta e "Transformar em lead".
//
// Regras da especificação:
// - o tempo de resposta vai do recebimento até a 1ª resposta HUMANA
//   (automação não conta);
// - a janela de 24 h da Meta para mensagens é respeitada, com aviso perto de fechar;
// - a conversa nasce ligada ao post de origem (pauta e código), quando há.
import { Prisma, SmConversa } from '@prisma/client'
import { prisma } from './prisma'
import {
  buscarPerfilRemetente, comApiDaEmpresa, enviarMensagemDirect, enviarRespostaPrivada, ErroGraphApi, responderComentario,
} from './instagramGraph'
import { carregarConfig, type ConfigCalendario } from './smCalendario'
import { notificar } from './smPautas'

export const JANELA_HORAS = 24
export const AVISO_JANELA_HORAS = 20
const HORA_MS = 3600 * 1000
const OFFSET_MS = 3 * HORA_MS
const REPETIR_FORA_HORARIO_MS = 12 * HORA_MS
const RE_CODIGO = /#(?:[PS]-\d{4}-[A-Z0-9]+(?:-\d+)?|BIO)\b/

export const AUTOMACOES_PADRAO = {
  PALAVRA_CHAVE: {
    palavra: 'QUERO',
    resposta: 'Oi, {nome}! Aqui vai a ficha da {moto}. Quer que eu simule a parcela? Responda aqui mesmo que eu te ajudo.',
  },
  FORA_HORARIO: {
    palavra: null,
    resposta: 'Oi! Recebemos sua mensagem. Nosso atendimento é {expediente}. Respondemos assim que abrirmos.',
  },
} as const

export const RESPOSTAS_RAPIDAS_PADRAO = [
  { titulo: 'Disponibilidade', texto: 'Está disponível sim! Quer agendar uma visita para ver de perto?' },
  { titulo: 'Simular financiamento', texto: 'Consigo simular a parcela para você. Me passa sua data de nascimento e quanto pensa em dar de entrada?' },
  { titulo: 'Agendar visita', texto: 'Qual o melhor dia e horário para você vir à loja? Te espero!' },
  { titulo: 'Aceita troca', texto: 'Aceitamos sim! Me manda o modelo, o ano e umas fotos da sua moto que eu faço a avaliação.' },
]

/** Cria as automações e respostas rápidas padrão na primeira vez. */
export async function garantirPadroes(usuarioId: string) {
  const [autos, respostas] = await Promise.all([
    prisma.smAutomacao.count({ where: { usuarioId } }),
    prisma.smRespostaRapida.count({ where: { usuarioId } }),
  ])
  if (autos < 2) {
    for (const [tipo, d] of Object.entries(AUTOMACOES_PADRAO)) {
      await prisma.smAutomacao.upsert({ where: { usuarioId_tipo: { usuarioId, tipo } }, create: { usuarioId, tipo, palavra: d.palavra, resposta: d.resposta }, update: {} })
    }
  }
  if (!respostas) {
    await prisma.smRespostaRapida.createMany({ data: RESPOSTAS_RAPIDAS_PADRAO.map((r, i) => ({ usuarioId, ...r, ordem: i })) })
  }
}

// ---------- Expediente ----------

export function textoExpediente(c: Pick<ConfigCalendario, 'expedienteInicio' | 'expedienteFim' | 'expedienteDias'>): string {
  const dias = c.expedienteDias.split(',').map(Number).sort()
  const nomes = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
  const faixa = dias.join(',') === '1,2,3,4,5' ? 'de segunda a sexta' : dias.join(',') === '1,2,3,4,5,6' ? 'de segunda a sábado' : dias.map(d => nomes[d]).join(', ')
  return `${faixa}, das ${c.expedienteInicio}h às ${c.expedienteFim}h`
}

export function dentroDoExpediente(agora: Date, c: Pick<ConfigCalendario, 'expedienteInicio' | 'expedienteFim' | 'expedienteDias'>): boolean {
  const local = new Date(agora.getTime() - OFFSET_MS)
  const dias = c.expedienteDias.split(',').map(Number)
  const h = local.getUTCHours() + local.getUTCMinutes() / 60
  return dias.includes(local.getUTCDay()) && h >= c.expedienteInicio && h < c.expedienteFim
}

// ---------- Conta e API ----------

type ContaAtendimento = { id: string; usuarioId: string; instagramUserId: string; accessToken: string; tipoConexao: string; paginaId: string | null; nomeUsuario: string }

async function contaDaOperacao(usuarioId: string): Promise<ContaAtendimento | null> {
  return prisma.socialMediaConta.findUnique({
    where: { titular: `dono:${usuarioId}` },
    select: { id: true, usuarioId: true, instagramUserId: true, accessToken: true, tipoConexao: true, paginaId: true, nomeUsuario: true },
  })
}

function naApi<T>(conta: ContaAtendimento, fn: () => Promise<T>): Promise<T> {
  return conta.tipoConexao === 'EMPRESA' ? comApiDaEmpresa(fn) : fn()
}
const remetenteDa = (conta: ContaAtendimento) => (conta.tipoConexao === 'EMPRESA' ? conta.paginaId ?? conta.instagramUserId : 'me')

export function mensagemDeErroMeta(e: unknown): string {
  if (e instanceof ErroGraphApi && (e.codigo === 10 || e.codigo === 200 || e.codigo === 3)) {
    return 'A Meta ainda não liberou o envio de mensagens para este app (permissão instagram_manage_messages, que depende da revisão do app).'
  }
  if (e instanceof ErroGraphApi && e.codigo === 190) return 'O acesso ao Instagram expirou. O gestor precisa reconectar a conta.'
  if (e instanceof ErroGraphApi && (e.codigo === 10900 || /window|janela|outside of allowed/i.test(e.message))) return 'Passou da janela de 24 h da Meta: só é possível responder quando o cliente mandar uma mensagem nova.'
  return e instanceof Error ? e.message : 'Falha ao enviar'
}

// ---------- Origem (post, código e moto) ----------

export async function origemDaMidia(usuarioId: string, midiaIgId: string | null | undefined) {
  if (!midiaIgId) return { postCode: null, postTitulo: null, motoInteresse: null }
  const pauta = await prisma.smPauta.findFirst({
    where: { usuarioId, igMediaId: midiaIgId },
    select: { codigo: true, titulo: true, moto: { select: { modelo: true, ano: true, cor: true } } },
  })
  if (pauta) {
    const moto = pauta.moto ? [pauta.moto.modelo, pauta.moto.ano, pauta.moto.cor].filter(Boolean).join(' ') : null
    return { postCode: pauta.codigo, postTitulo: pauta.titulo, motoInteresse: moto }
  }
  const midia = await prisma.socialMediaMidia.findUnique({ where: { instagramMediaId: midiaIgId }, select: { legenda: true, formato: true } })
  if (!midia) return { postCode: null, postTitulo: null, motoInteresse: null }
  const legenda = (midia.legenda ?? '').replace(/\s+/g, ' ').trim()
  return {
    postCode: legenda.match(RE_CODIGO)?.[0] ?? null,
    postTitulo: legenda ? (legenda.length > 60 ? `${legenda.slice(0, 57)}…` : legenda) : (midia.formato === 'STORY' ? 'Story' : 'Post sem legenda'),
    motoInteresse: null,
  }
}

// ---------- Mensagens ----------

async function registrarEntrada(conversa: SmConversa, texto: string, instante: Date, igMensagemId: string | null) {
  if (igMensagemId && await prisma.smMensagem.findUnique({ where: { igMensagemId } })) return false
  await prisma.$transaction([
    prisma.smMensagem.create({ data: { conversaId: conversa.id, direcao: 'IN', autor: 'CLIENTE', texto, igMensagemId, enviadaEm: instante } }),
    prisma.smConversa.update({
      where: { id: conversa.id },
      data: {
        ultimaMsgEm: instante, ultimaEntradaEm: instante,
        aguardandoDesde: conversa.aguardandoDesde ?? instante,
        status: conversa.status === 'LEAD' || conversa.status === 'ARQUIVADA' ? (conversa.status === 'ARQUIVADA' ? 'ABERTA' : 'LEAD') : 'ABERTA',
      },
    }),
  ])
  return true
}

/** Registra uma saída. Se for humana e houver cliente esperando, mede o tempo de resposta. */
async function registrarSaida(conversa: SmConversa, texto: string, autor: 'HUMANO' | 'AUTOMACAO', igMensagemId: string | null, automacao?: string, instante = new Date()) {
  if (igMensagemId && await prisma.smMensagem.findUnique({ where: { igMensagemId } })) return
  const atual = await prisma.smConversa.findUniqueOrThrow({ where: { id: conversa.id } })
  const humana = autor === 'HUMANO'
  const respostaMin = humana && atual.aguardandoDesde ? Math.max(0, (instante.getTime() - atual.aguardandoDesde.getTime()) / 60000) : null
  await prisma.$transaction([
    prisma.smMensagem.create({ data: { conversaId: conversa.id, direcao: 'OUT', autor, automacao, texto, igMensagemId, respostaMin, enviadaEm: instante } }),
    prisma.smConversa.update({
      where: { id: conversa.id },
      data: {
        ultimaMsgEm: instante,
        ...(humana && { aguardandoDesde: null, status: atual.status === 'LEAD' ? 'LEAD' : 'RESPONDIDA' }),
        ...(automacao === 'FORA_HORARIO' && { foraHorarioEm: instante }),
      },
    }),
  ])
}

async function conversaDe(usuarioId: string, canal: string, chave: string, base: Omit<Prisma.SmConversaUncheckedCreateInput, 'usuarioId' | 'canal' | 'chave'>) {
  return prisma.smConversa.upsert({
    where: { usuarioId_canal_chave: { usuarioId, canal, chave } },
    create: { usuarioId, canal, chave, ...base },
    update: {},
  })
}

function preencher(modelo: string, dados: Record<string, string>) {
  return modelo.replace(/\{(\w+)\}/g, (_, k: string) => dados[k] ?? '').replace(/\s+([,.!?])/g, '$1').replace(/,\s*!/g, '!').trim()
}

// ---------- Processamento dos eventos do webhook ----------

interface MsgWebhook { sender?: { id?: string }; recipient?: { id?: string }; timestamp?: number; message?: { mid?: string; text?: string; is_echo?: boolean; reply_to?: { story?: { id?: string } }; attachments?: Array<{ type?: string }> } }
interface ComentarioWebhook { id?: string; text?: string; from?: { id?: string; username?: string }; media?: { id?: string }; parent_id?: string }

async function processarMensagem(conta: ContaAtendimento, m: MsgWebhook, config: ConfigCalendario) {
  const msg = m.message
  if (!msg || !m.sender?.id || !m.recipient?.id) return
  const usuarioId = conta.usuarioId
  const instante = m.timestamp ? new Date(m.timestamp) : new Date()
  const eco = !!msg.is_echo || m.sender.id === conta.instagramUserId
  const clienteId = eco ? m.recipient.id : m.sender.id
  const texto = msg.text?.trim() || (msg.attachments?.length ? `[${msg.attachments[0].type === 'image' ? 'foto' : msg.attachments[0].type === 'audio' ? 'áudio' : 'anexo'}]` : '')
  if (!texto) return

  // A conversa de direct é uma só por cliente. Se ela nasceu de um
  // "Comente QUERO" ou de resposta a story, continua no mesmo canal.
  const existente = await prisma.smConversa.findFirst({ where: { usuarioId, clienteIgId: clienteId, canal: { in: ['DIRECT', 'COMENTARIO_AUTOMACAO', 'RESPOSTA_STORY'] } } })
  let conversa = existente
  if (!conversa) {
    if (eco) return // eco sem conversa aberta: nada a acompanhar
    const story = msg.reply_to?.story?.id ?? null
    const origem = await origemDaMidia(usuarioId, story)
    const perfil = await naApi(conta, () => buscarPerfilRemetente(clienteId, conta.accessToken))
    conversa = await conversaDe(usuarioId, story ? 'RESPOSTA_STORY' : 'DIRECT', clienteId, {
      clienteIgId: clienteId, clienteNome: perfil.nome, clienteUsuario: perfil.usuario,
      midiaIgId: story, postCode: origem.postCode ?? (story ? null : '#BIO'), postTitulo: origem.postTitulo ?? (story ? 'Story' : 'Perfil (sem post)'),
      motoInteresse: origem.motoInteresse, ultimaMsgEm: instante,
    })
  }
  if (eco) { await registrarSaida(conversa, texto, 'HUMANO', msg.mid ?? null, undefined, instante); return }
  const nova = await registrarEntrada(conversa, texto, instante, msg.mid ?? null)
  if (!nova) return

  // Fora do expediente: avisa uma vez a cada 12 h (não conta como resposta).
  const fora = await prisma.smAutomacao.findUnique({ where: { usuarioId_tipo: { usuarioId, tipo: 'FORA_HORARIO' } } })
  const recente = conversa.foraHorarioEm && Date.now() - conversa.foraHorarioEm.getTime() < REPETIR_FORA_HORARIO_MS
  if (fora?.ativa && !recente && !dentroDoExpediente(instante, config)) {
    const resposta = preencher(fora.resposta, { expediente: textoExpediente(config), nome: conversa.clienteNome?.split(' ')[0] ?? '' })
    try {
      const mid = await naApi(conta, () => enviarMensagemDirect(remetenteDa(conta), conta.accessToken, clienteId, resposta))
      await registrarSaida(conversa, resposta, 'AUTOMACAO', mid, 'FORA_HORARIO')
    } catch { /* sem permissão ainda: a conversa segue na fila normalmente */ }
  }
}

async function processarComentario(conta: ContaAtendimento, v: ComentarioWebhook) {
  if (!v.id || !v.from?.id || !v.text) return
  const usuarioId = conta.usuarioId
  const instante = new Date()
  const proprio = v.from.id === conta.instagramUserId || v.from.username === conta.nomeUsuario
  const raiz = v.parent_id ?? v.id
  if (proprio) {
    // Resposta dada pelo próprio Instagram (fora do sistema): conta como humana.
    const fio = await prisma.smConversa.findUnique({ where: { usuarioId_canal_chave: { usuarioId, canal: 'COMENTARIO', chave: raiz } } })
    if (fio) await registrarSaida(fio, v.text, 'HUMANO', v.id, undefined, instante)
    return
  }
  const origem = await origemDaMidia(usuarioId, v.media?.id)

  // "Comente QUERO": a palavra-chave manda a ficha no direct e a conversa
  // nasce ligada ao post. Conta disparo e, depois, lead gerado.
  const auto = await prisma.smAutomacao.findUnique({ where: { usuarioId_tipo: { usuarioId, tipo: 'PALAVRA_CHAVE' } } })
  const palavra = auto?.palavra?.trim()
  const casou = !!(auto?.ativa && palavra && new RegExp(`(^|[^\\p{L}\\p{N}])${palavra.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\p{L}\\p{N}]|$)`, 'iu').test(v.text))
  if (casou && !v.parent_id) {
    const jaTem = await prisma.smConversa.findFirst({ where: { usuarioId, clienteIgId: v.from.id, canal: { in: ['DIRECT', 'COMENTARIO_AUTOMACAO', 'RESPOSTA_STORY'] } } })
    const conversa = jaTem ?? await conversaDe(usuarioId, 'COMENTARIO_AUTOMACAO', v.from.id, {
      clienteIgId: v.from.id, clienteUsuario: v.from.username ?? null, clienteNome: v.from.username ? `@${v.from.username}` : null,
      midiaIgId: v.media?.id ?? null, comentarioIgId: v.id, ...origem, ultimaMsgEm: instante,
    })
    if (!(await registrarEntrada(conversa, v.text, instante, v.id))) return
    const resposta = preencher(auto!.resposta, { nome: v.from.username ? `@${v.from.username}` : '', moto: origem.motoInteresse ?? origem.postTitulo ?? 'moto do post', codigo: origem.postCode ?? '' })
    try {
      const mid = await naApi(conta, () => enviarRespostaPrivada(remetenteDa(conta), conta.accessToken, v.id!, resposta))
      await registrarSaida(conversa, resposta, 'AUTOMACAO', mid, 'PALAVRA_CHAVE')
    } catch (e) {
      await notificar(usuarioId, 'SOCIAL_MEDIA', 'AUTOMACAO_FALHA', 'automacao-falha', 'A automação "Comente QUERO" não conseguiu responder', mensagemDeErroMeta(e))
    }
    return
  }

  // Comentário comum: um fio por comentário raiz, respondido no próprio post.
  const conversa = await conversaDe(usuarioId, 'COMENTARIO', raiz, {
    clienteIgId: v.from.id, clienteUsuario: v.from.username ?? null, clienteNome: v.from.username ? `@${v.from.username}` : null,
    midiaIgId: v.media?.id ?? null, comentarioIgId: raiz, ...origem, ultimaMsgEm: instante,
  })
  await registrarEntrada(conversa, v.text, instante, v.id)
}

/** Processa os eventos guardados pelo webhook (no próprio pedido e, de reserva, no job de minuto). */
export async function processarEventosPendentes(limite = 50) {
  const eventos = await prisma.smWebhookEvento.findMany({
    where: { processadoEm: null, campo: { in: ['messages', 'comments'] } },
    orderBy: { recebidoEm: 'asc' },
    take: limite,
    include: { conta: { select: { id: true, usuarioId: true, instagramUserId: true, accessToken: true, tipoConexao: true, paginaId: true, nomeUsuario: true, titular: true } } },
  })
  let processados = 0
  const configs = new Map<string, ConfigCalendario>()
  for (const ev of eventos) {
    try {
      const c = ev.conta
      // Só a conta da empresa (a do dono) tem Atendimento.
      if (c && c.titular.startsWith('dono:')) {
        await garantirPadroes(c.usuarioId)
        const config = configs.get(c.usuarioId) ?? await carregarConfig(c.usuarioId)
        configs.set(c.usuarioId, config)
        const p = ev.payload as { messaging?: MsgWebhook[]; changes?: Array<{ field?: string; value?: ComentarioWebhook }> }
        if (ev.campo === 'messages') for (const m of p.messaging ?? []) await processarMensagem(c, m, config)
        if (ev.campo === 'comments') for (const ch of p.changes ?? []) if (ch.value) await processarComentario(c, ch.value)
      }
      await prisma.smWebhookEvento.update({ where: { id: ev.id }, data: { processadoEm: new Date() } })
      processados++
    } catch (e) {
      // Fica para a próxima passada; registra o erro para diagnóstico.
      console.error('[atendimento] evento', ev.id, e instanceof Error ? e.message : e)
    }
  }
  return { pendentes: eventos.length, processados }
}

// ---------- Responder pelo sistema ----------

export function estadoJanela(c: Pick<SmConversa, 'canal' | 'ultimaEntradaEm'>, agora = new Date()) {
  if (c.canal === 'COMENTARIO' || !c.ultimaEntradaEm) return { aberta: true, horasRestantes: null as number | null }
  const restante = JANELA_HORAS - (agora.getTime() - c.ultimaEntradaEm.getTime()) / HORA_MS
  return { aberta: restante > 0, horasRestantes: Math.max(0, restante) }
}

export async function responderConversa(conversa: SmConversa, texto: string): Promise<void> {
  const conta = await contaDaOperacao(conversa.usuarioId)
  if (!conta) throw new Error('Instagram não conectado.')
  const janela = estadoJanela(conversa)
  if (!janela.aberta) throw new Error('Passou da janela de 24 h da Meta: só é possível responder quando o cliente mandar uma mensagem nova.')
  let id: string | null
  try {
    id = conversa.canal === 'COMENTARIO'
      ? await naApi(conta, () => responderComentario(conversa.comentarioIgId ?? conversa.chave, conta.accessToken, texto))
      : await naApi(conta, () => enviarMensagemDirect(remetenteDa(conta), conta.accessToken, conversa.clienteIgId, texto))
  } catch (e) {
    throw new Error(mensagemDeErroMeta(e))
  }
  await registrarSaida(conversa, texto, 'HUMANO', id)
}

// ---------- Indicadores (tela Atendimento, Hoje e menu) ----------

export function inicioDaSemana(agora = new Date()): Date {
  const local = new Date(agora.getTime() - OFFSET_MS)
  const dia = (local.getUTCDay() + 6) % 7
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - dia) + OFFSET_MS)
}

const mediana = (v: number[]) => {
  if (!v.length) return null
  const s = [...v].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** Mediana da 1ª resposta humana na semana (seção 12), em minutos. */
export async function tempoRespostaSemana(usuarioId: string, agora = new Date()) {
  const r = await prisma.smMensagem.findMany({
    where: { respostaMin: { not: null }, enviadaEm: { gte: inicioDaSemana(agora) }, conversa: { usuarioId } },
    select: { respostaMin: true },
  })
  const v = mediana(r.map(x => x.respostaMin!))
  return v == null ? null : Math.round(v)
}

/** Fila para a tela Hoje e o contador do menu. */
export async function filaAtendimento(usuarioId: string) {
  const esperando = await prisma.smConversa.findMany({
    where: { usuarioId, aguardandoDesde: { not: null }, status: { not: 'ARQUIVADA' } },
    select: { canal: true, aguardandoDesde: true, clienteNome: true, clienteUsuario: true, motoInteresse: true, mensagens: { where: { direcao: 'IN' }, orderBy: { enviadaEm: 'desc' }, take: 1, select: { texto: true } } },
    orderBy: { aguardandoDesde: 'asc' },
  })
  const antiga = esperando[0]
  return {
    dmsSemResposta: esperando.filter(c => c.canal !== 'COMENTARIO').length,
    comentariosSemResposta: esperando.filter(c => c.canal === 'COMENTARIO').length,
    maisAntiga: antiga ? {
      desde: antiga.aguardandoDesde!, nome: antiga.clienteNome ?? (antiga.clienteUsuario ? `@${antiga.clienteUsuario}` : 'Cliente'),
      texto: antiga.mensagens[0]?.texto ?? null, moto: antiga.motoInteresse,
    } : null,
  }
}

// ---------- Transformar em lead (rodízio, decisão P4) ----------

export async function proximoConsultor(usuarioId: string): Promise<{ id: string; nome: string } | null> {
  const consultores = await prisma.vendedor.findMany({
    where: { usuarioId, ativo: true, vende: true, email: { not: null }, senhaHash: { not: null } },
    select: { id: true, nome: true },
    orderBy: [{ criadoEm: 'asc' }, { id: 'asc' }],
  })
  if (!consultores.length) return null
  const config = await prisma.smConfig.findUnique({ where: { usuarioId }, select: { rodizioUltimoVendedorId: true } })
  const i = consultores.findIndex(c => c.id === config?.rodizioUltimoVendedorId)
  return consultores[(i + 1) % consultores.length]
}

const CANAL_LEAD: Record<string, string> = { DIRECT: 'DIRECT', COMENTARIO: 'COMENTARIO', COMENTARIO_AUTOMACAO: 'COMENTE_QUERO', RESPOSTA_STORY: 'RESPOSTA_STORY' }
const PAGAMENTO: Record<string, string> = { FINANCIAMENTO: 'Financiamento', A_VISTA: 'À vista', CONSORCIO: 'Consórcio' }

export async function transformarEmLead(conversa: SmConversa, d: { nome: string; whatsapp: string | null; moto: string | null; pagamento: keyof typeof PAGAMENTO }) {
  if (conversa.leadId) {
    const existente = await prisma.lead.findUnique({ where: { id: conversa.leadId }, select: { id: true } })
    if (existente) throw Object.assign(new Error('Esta conversa já virou lead.'), { status: 409 })
  }
  const consultor = await proximoConsultor(conversa.usuarioId)
  const origem = conversa.postCode ? `Instagram orgânico · ${conversa.postCode}` : 'Instagram orgânico'
  const lead = await prisma.$transaction(async tx => {
    const l = await tx.lead.create({
      data: {
        usuarioId: conversa.usuarioId, vendedorId: consultor?.id ?? null,
        nomeCliente: d.nome, telefone: d.whatsapp, modeloInteresse: d.moto,
        tipoLead: 'ORGANICO', valorNegociacao: 0,
        observacao: `${origem}. Forma de pagamento: ${PAGAMENTO[d.pagamento]}. Veio do ${conversa.canal === 'COMENTARIO' ? 'comentário' : 'direct'} ${conversa.clienteUsuario ? `de @${conversa.clienteUsuario}` : ''}`.trim(),
        origem: 'INSTAGRAM_ORGANICO', postCode: conversa.postCode, midiaId: conversa.midiaIgId,
        canalEntrada: CANAL_LEAD[conversa.canal] ?? 'DIRECT', conversaId: conversa.id,
      },
    })
    await tx.leadEstagioHistorico.create({ data: { leadId: l.id, estagioAnterior: null, estagioNovo: 'LEAD' } })
    await tx.smConversa.update({ where: { id: conversa.id }, data: { leadId: l.id, status: 'LEAD' } })
    if (consultor) {
      await tx.smConfig.upsert({ where: { usuarioId: conversa.usuarioId }, create: { usuarioId: conversa.usuarioId, rodizioUltimoVendedorId: consultor.id }, update: { rodizioUltimoVendedorId: consultor.id } })
    }
    return l
  })
  return { leadId: lead.id, consultor: consultor?.nome ?? null }
}
