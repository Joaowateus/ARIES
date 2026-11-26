// ARIES DISPARO — motor de campanhas (filas, envio, retentativas, reconciliação, respostas).
//
// Nada de laço de envio dentro de um pedido HTTP: o pedido só muda o estado da campanha; o trabalho
// roda na rotina de cada minuto (/sm/cron/minuto), em rodadas com prazo, e continua na próxima.
// As "filas" são estados no banco (persistentes, sobrevivem a qualquer queda):
//   preparação ......... campanhas VALIDATING → destinatários (snapshot) e totais
//   agendamento ........ SCHEDULED na hora → QUEUED
//   distribuição ....... QUEUED → mensagens do 1º passo (AGENDADA) → RUNNING
//   envio .............. DisparoMensagem AGENDADA (trava por linha: FOR UPDATE SKIP LOCKED)
//   retentativa ........ AGENDADA com proximaTentativaEm (espera exponencial com variação)
//   reconciliação ...... DESCONHECIDO (o pedido saiu, a resposta não voltou) e ENVIANDO travada
//   fila morta ......... FALHOU com erroClasse ESGOTOU (reprocessamento controlado pela tela)
// Idempotência: chave única campanha:destinatário:passo; o envio só acontece depois de trocar
// AGENDADA→ENVIANDO numa atualização condicional; resultado desconhecido nunca é repetido às cegas.
import { Prisma } from '@prisma/client'
import { prisma } from '../prisma'
import { logger } from '../logger'
import { comAutor } from '../autorAuditoria'
import { avisarNoWhatsapp } from '../ligacoesAviso'
import {
  CONFIG_PADRAO, esperaDaTentativa, dentroDaJanela, lerConfigEnvio, lerConfigLoja, normalizarTelefone, chaveTelefone, pedeParaSair, podeIr, renderizar,
  type ConfigEnvio, type ConfigLoja, type Conteudo, type Passo, type StatusCampanha, type ValoresVariaveis, type Finalidade,
} from './regras'
import { leitorDaCampanha, lerLeadsPorId, passaGrupo, resolverPublico, valoresDoContato, type DefinicaoPublico } from './publico'
import { registrarAutorizacao, situacaoDe } from './autorizacao'
import { provedor, type Remetente } from './provedor'
import { arquivoParaEnvio } from './midias'
import { comTrava, pegarTrava, registrarRodada, soltarTrava, ultimasRodadas, type OrigemRodada } from './travas'
import { alvoDoEnvio, contaInstagramDaLoja, ehRemetenteInstagram, enviarPeloInstagram, MAX_POR_HORA_INSTAGRAM, reconciliarInstagram, remetenteInstagram, type DadosIg } from './instagram'

const MIN = 60_000
const TRAVA_MAX_MS = 3 * MIN
const ENVIO_MIN_MS = 9_000 // tempo mínimo que precisa sobrar na rodada para começar um envio // ENVIANDO há mais que isso = o processo caiu no meio do envio
const RECONCILIAR_ATE_MS = 30 * MIN
const LOTE_CRIACAO = 1000

export class ErroDisparo extends Error { constructor(msg: string, readonly status = 400) { super(msg) } }

// ---------- Configuração da loja ----------

export async function configDaLoja(usuarioId: string): Promise<ConfigLoja> {
  const c = await prisma.disparoConfig.findUnique({ where: { usuarioId }, select: { config: true } })
  return lerConfigLoja(c?.config ?? {})
}

export async function evento(e: { usuarioId: string; campanhaId?: string | null; destinatarioId?: string | null; mensagemId?: string | null; tipo: string; descricao?: string | null; dados?: Prisma.InputJsonValue; autorNome?: string | null }) {
  await prisma.disparoEvento.create({ data: { usuarioId: e.usuarioId, campanhaId: e.campanhaId ?? null, destinatarioId: e.destinatarioId ?? null, mensagemId: e.mensagemId ?? null, tipo: e.tipo, descricao: e.descricao ?? null, dados: e.dados, autorNome: e.autorNome ?? null } })
    .catch(err => logger.warn({ err }, 'disparo: não gravou o evento'))
}

/** Troca o estado só se ele ainda for o esperado (duas ações ao mesmo tempo não passam juntas). */
export async function transicionar(campanhaId: string, para: StatusCampanha, opcoes: { de?: StatusCampanha[]; autorNome?: string | null; motivo?: string; dados?: Prisma.DisparoCampanhaUpdateManyMutationInput } = {}): Promise<boolean> {
  const c = await prisma.disparoCampanha.findUnique({ where: { id: campanhaId }, select: { status: true, usuarioId: true } })
  if (!c) throw new ErroDisparo('Campanha não encontrada', 404)
  if (opcoes.de && !opcoes.de.includes(c.status as StatusCampanha)) return false
  if (!podeIr(c.status, para)) throw new ErroDisparo(`Não dá para passar de "${c.status}" para "${para}"`, 409)
  const agora = new Date()
  const marcas: Prisma.DisparoCampanhaUpdateManyMutationInput = {
    ...(para === 'RUNNING' ? { pausadaEm: null } : {}), ...(para === 'PAUSED' ? { pausadaEm: agora } : {}),
    ...(para === 'CANCELLED' ? { canceladaEm: agora } : {}), ...(para === 'COMPLETED' || para === 'COMPLETED_WITH_ERRORS' ? { concluidaEm: agora } : {}),
  }
  const r = await prisma.disparoCampanha.updateMany({ where: { id: campanhaId, status: c.status }, data: { status: para, ...marcas, ...opcoes.dados } })
  if (!r.count) return false
  await evento({ usuarioId: c.usuarioId, campanhaId, tipo: `STATUS_${para}`, descricao: opcoes.motivo ?? `${c.status} → ${para}`, autorNome: opcoes.autorNome })
  return true
}

/** Cancelamento: impede novos envios e cancela, na mesma transação, o que ainda não saiu. */
export async function cancelarCampanha(campanhaId: string, autorNome: string | null) {
  await prisma.$transaction(async tx => {
    const c = await tx.disparoCampanha.findUnique({ where: { id: campanhaId }, select: { status: true, usuarioId: true } })
    if (!c) throw new ErroDisparo('Campanha não encontrada', 404)
    if (!podeIr(c.status, 'CANCELLED')) throw new ErroDisparo('Esta campanha não pode mais ser cancelada', 409)
    await tx.disparoCampanha.update({ where: { id: campanhaId }, data: { status: 'CANCELLED', canceladaEm: new Date() } })
    await tx.disparoMensagem.updateMany({ where: { campanhaId, status: 'AGENDADA' }, data: { status: 'CANCELADA', ultimoErro: 'Campanha cancelada' } })
    await tx.disparoDestinatario.updateMany({ where: { campanhaId, status: { in: ['ELEGIVEL', 'EM_ANDAMENTO'] } }, data: { status: 'INTERROMPIDO', interrompidoPor: 'CANCELAMENTO' } })
    await tx.disparoEvento.create({ data: { usuarioId: c.usuarioId, campanhaId, tipo: 'STATUS_CANCELLED', descricao: `${c.status} → CANCELLED: envios pendentes cancelados`, autorNome } })
  })
}

// ---------- Preparação (snapshot dos destinatários) ----------

interface Preparo { leitor: { usuarioId: string; papel: string; vendedorId: string | null; sdr?: boolean }; aprovacao?: boolean }

export async function prepararCampanha(campanhaId: string, agora = new Date()): Promise<{ elegiveis: number; excluidos: number } | null> {
  const c = await prisma.disparoCampanha.findUnique({ where: { id: campanhaId }, include: { assistente: { select: { numeroWhatsapp: true } } } })
  if (!c || c.status !== 'VALIDATING') return null
  const preparo = (c.preparo ?? {}) as unknown as Preparo
  if (!preparo.leitor) throw new ErroDisparo('Campanha sem o contexto de quem a montou')
  const config = await configDaLoja(c.usuarioId)
  const conteudo = c.conteudo as unknown as Conteudo
  // Sempre a carteira de quem criou a campanha (mesmo que outra pessoa da gestão a prepare).
  const r = await resolverPublico(await leitorDaCampanha(c.usuarioId, c.criadoPorId), c.publico as unknown as DefinicaoPublico, { finalidade: c.finalidade as Finalidade, config, conteudo, remetenteNumero: c.assistente?.numeroWhatsapp ?? null }, agora)
  const loja = (await prisma.proLaboreUsuario.findUnique({ where: { id: c.usuarioId }, select: { nome: true } }))?.nome ?? ''
  const linhas: Prisma.DisparoDestinatarioCreateManyInput[] = []
  for (const x of [...r.elegiveis.map(e => ({ contato: e, motivo: null as string | null })), ...r.excluidos]) {
    linhas.push({
      campanhaId, versao: c.versao, usuarioId: c.usuarioId, telefone: x.contato.telefone!, nome: x.contato.nome?.slice(0, 160) ?? null,
      leadId: x.contato.leadId, clienteId: x.contato.clienteId, conversaId: x.contato.conversaId, vendedorId: x.contato.vendedorId,
      dados: (await valoresDoContato(x.contato, loja)) as unknown as Prisma.InputJsonValue,
      status: x.motivo ? 'EXCLUIDO' : 'ELEGIVEL', motivoExclusao: x.motivo,
    })
  }
  // Versão anterior (campanha editada antes de sair): os destinatários antigos ficam como histórico.
  await prisma.disparoDestinatario.updateMany({ where: { campanhaId, versao: { lt: c.versao }, status: { in: ['ELEGIVEL', 'EXCLUIDO'] } }, data: { status: 'DESCARTADO' } })
  for (let i = 0; i < linhas.length; i += LOTE_CRIACAO) await prisma.disparoDestinatario.createMany({ data: linhas.slice(i, i + LOTE_CRIACAO), skipDuplicates: true })
  const totais = { selecionados: r.selecionados, elegiveis: r.elegiveis.length, excluidos: r.selecionados - r.elegiveis.length, porMotivo: r.porMotivo }
  const proximo: StatusCampanha = preparo.aprovacao ? 'NEEDS_REVIEW' : 'READY'
  await transicionar(campanhaId, proximo, { de: ['VALIDATING'], motivo: `Público preparado: ${totais.elegiveis} elegíveis de ${totais.selecionados}`, dados: { totais: totais as unknown as Prisma.InputJsonValue, preparadaEm: new Date(), erro: null } })
  return { elegiveis: totais.elegiveis, excluidos: totais.excluidos }
}

// ---------- Distribuição: cria as mensagens do 1º passo ----------

export async function distribuir(campanhaId: string, agora = new Date()): Promise<number> {
  const c = await prisma.disparoCampanha.findUnique({ where: { id: campanhaId }, select: { id: true, usuarioId: true, versao: true, status: true, assistenteId: true, conteudo: true, config: true, canal: true } })
  if (!c || c.status !== 'QUEUED') return 0
  // Duas rodadas ao mesmo tempo (rotina e tela): só uma distribui (a outra encontra a trava e sai).
  const r = await comTrava(`distribuir:${campanhaId}`, 2 * MIN, () => distribuirComTrava(c, campanhaId, agora))
  return r.ok ? r.valor : 0
}
async function distribuirComTrava(c: { id: string; usuarioId: string; versao: number; assistenteId: string | null; conteudo: Prisma.JsonValue; config?: Prisma.JsonValue; canal?: string }, campanhaId: string, agora: Date): Promise<number> {
  // Instagram: quem envia é a conta da empresa ("ig:<conta>"), no lugar do número do WhatsApp.
  const instagram = c.canal === 'INSTAGRAM'
  const contaIg = instagram ? await contaInstagramDaLoja(c.usuarioId) : null
  if (instagram && !contaIg) { await prisma.disparoCampanha.update({ where: { id: c.id }, data: { erro: 'O Instagram da empresa não está conectado: conecte em Social Media › Conexão' } }); return 0 }
  const remetentePadrao = instagram ? remetenteInstagram(contaIg!.id) : c.assistenteId
  if (!remetentePadrao) { await prisma.disparoCampanha.update({ where: { id: c.id }, data: { erro: 'Escolha o número que vai enviar a campanha' } }); return 0 }
  const passos = (c.conteudo as unknown as Conteudo).passos ?? []
  if (!passos.length) throw new ErroDisparo('Campanha sem mensagem')
  // "Pelo WhatsApp do vendedor de cada contato": o lead recebe de quem já fala com ele (se conectado).
  const porVendedor = !instagram && lerConfigEnvio(c.config ?? {}).remetentePorVendedor
  const numeroDoVendedor = porVendedor
    ? new Map((await prisma.assistenteComercial.findMany({ where: { vendedor: { usuarioId: c.usuarioId }, status: 'CONECTADO', instancia: { not: null } }, select: { id: true, vendedorId: true } })).map(a => [a.vendedorId, a.id]))
    : new Map<string, string>()
  let criadas = 0
  for (;;) {
    const lote = await prisma.disparoDestinatario.findMany({ where: { campanhaId, versao: c.versao, status: 'ELEGIVEL' }, select: { id: true, vendedorId: true }, take: LOTE_CRIACAO, orderBy: { criadoEm: 'asc' } })
    if (!lote.length) break
    await prisma.$transaction([
      prisma.disparoMensagem.createMany({ data: lote.map(d => ({ campanhaId, destinatarioId: d.id, passo: 0, chave: `${campanhaId}:${d.id}:0`, assistenteId: (d.vendedorId && numeroDoVendedor.get(d.vendedorId)) || remetentePadrao, tipo: passos[0].tipo, midiaId: passos[0].midiaId ?? null, enviarApos: agora })), skipDuplicates: true }),
      prisma.disparoDestinatario.updateMany({ where: { id: { in: lote.map(d => d.id) }, status: 'ELEGIVEL' }, data: { status: 'EM_ANDAMENTO' } }),
    ])
    criadas += lote.length
  }
  await transicionar(campanhaId, 'RUNNING', { de: ['QUEUED'], motivo: `${criadas} destinatário(s) na fila de envio`, dados: { iniciadaEm: agora } })
  return criadas
}

// ---------- Estratégias contínuas: quem entra no público entra na campanha ----------

const ALIMENTAR_A_CADA_MS = 10 * MIN
/**
 * Para cada estratégia contínua em andamento (no máximo a cada 10 min): avalia o público de novo e
 * coloca na fila quem passou a se encaixar (ex.: lead que entrou na etapa no CRM). Cada contato entra
 * uma vez; quem sai do público para na hora do próximo envio (pararAoSairDoPublico).
 */
export async function alimentarContinuas(fim: number, agora = new Date()): Promise<number> {
  let novos = 0
  const cs = await prisma.disparoCampanha.findMany({ where: { status: 'RUNNING' }, select: { id: true, usuarioId: true, versao: true, assistenteId: true, canal: true, criadoPorId: true, conteudo: true, config: true, publico: true, finalidade: true, preparo: true, totais: true, assistente: { select: { numeroWhatsapp: true } } } })
  for (const c of cs) {
    if (!lerConfigEnvio(c.config).continua) continue
    if (Date.now() > fim - 5000) break
    if (!(await pegarTrava(`alimentar:${c.id}`, ALIMENTAR_A_CADA_MS))) continue // trava sem soltar = no máximo 1 vez a cada 10 min
    try {
      const preparo = (c.preparo ?? {}) as unknown as Preparo
      if (!preparo.leitor) continue
      const config = await configDaLoja(c.usuarioId)
      const conteudo = c.conteudo as unknown as Conteudo
      // Carteira de quem criou (vale também para estratégias criadas antes da regra de carteira).
      const r = await resolverPublico(await leitorDaCampanha(c.usuarioId, c.criadoPorId), c.publico as unknown as DefinicaoPublico, { finalidade: c.finalidade as Finalidade, config, conteudo, remetenteNumero: c.assistente?.numeroWhatsapp ?? null }, agora)
      const ja = new Set((await prisma.disparoDestinatario.findMany({ where: { campanhaId: c.id, versao: c.versao }, select: { telefone: true } })).map(x => x.telefone))
      const novosContatos = r.elegiveis.filter(e => e.telefone && !ja.has(e.telefone))
      if (!novosContatos.length) continue
      const loja = (await prisma.proLaboreUsuario.findUnique({ where: { id: c.usuarioId }, select: { nome: true } }))?.nome ?? ''
      const linhas: Prisma.DisparoDestinatarioCreateManyInput[] = []
      for (const x of novosContatos) {
        linhas.push({ campanhaId: c.id, versao: c.versao, usuarioId: c.usuarioId, telefone: x.telefone!, nome: x.nome?.slice(0, 160) ?? null, leadId: x.leadId, clienteId: x.clienteId, conversaId: x.conversaId, vendedorId: x.vendedorId, dados: (await valoresDoContato(x, loja)) as unknown as Prisma.InputJsonValue, status: 'ELEGIVEL' })
      }
      for (let i = 0; i < linhas.length; i += LOTE_CRIACAO) await prisma.disparoDestinatario.createMany({ data: linhas.slice(i, i + LOTE_CRIACAO), skipDuplicates: true })
      await comTrava(`distribuir:${c.id}`, 2 * MIN, () => distribuirComTrava(c, c.id, agora))
      const t = (c.totais ?? {}) as { selecionados?: number; elegiveis?: number }
      await prisma.disparoCampanha.update({ where: { id: c.id }, data: { totais: { ...(c.totais as object ?? {}), selecionados: (t.selecionados ?? 0) + linhas.length, elegiveis: (t.elegiveis ?? 0) + linhas.length } as unknown as Prisma.InputJsonValue } })
      await evento({ usuarioId: c.usuarioId, campanhaId: c.id, tipo: 'ENTRARAM', descricao: `${linhas.length} contato(s) entraram na estratégia (passaram a fazer parte do público)` })
      novos += linhas.length
    } catch (e) { logger.error({ err: e, campanhaId: c.id }, 'disparo: falha ao alimentar a estratégia') }
  }
  return novos
}

// ---------- Envio ----------

interface MensagemTravada {
  id: string; campanhaId: string; destinatarioId: string; passo: number; assistenteId: string; tipo: string; midiaId: string | null; tentativas: number; travadaEm: Date
}

/** Trava uma mensagem pronta deste número remetente (outra rotina rodando ao mesmo tempo pula as travadas). */
async function travarProxima(assistenteId: string, agora: Date): Promise<MensagemTravada | null> {
  const r = await prisma.$queryRaw<MensagemTravada[]>`
    UPDATE pro_labore_disparo_mensagens SET status = 'ENVIANDO', "travadaEm" = ${agora}, "atualizadoEm" = ${agora}
    WHERE id = (
      SELECT m.id FROM pro_labore_disparo_mensagens m JOIN pro_labore_disparo_campanhas c ON c.id = m."campanhaId"
      WHERE m."assistenteId" = ${assistenteId} AND m.status = 'AGENDADA' AND m."enviarApos" <= ${agora}
        AND (m."proximaTentativaEm" IS NULL OR m."proximaTentativaEm" <= ${agora}) AND c.status = 'RUNNING'
      ORDER BY m."enviarApos", m.passo LIMIT 1 FOR UPDATE OF m SKIP LOCKED)
    AND status = 'AGENDADA'
    RETURNING id, "campanhaId", "destinatarioId", passo, "assistenteId", tipo, "midiaId", tentativas, "travadaEm"`
  return r[0] ?? null
}

/** Motivo para não mandar agora (revalidado na hora de cada mensagem), ou null. */
async function motivoParaInterromper(m: MensagemTravada, c: { usuarioId: string; finalidade: string; iniciadaEm: Date | null; cfg: ConfigEnvio; publico?: Prisma.JsonValue; preparo?: Prisma.JsonValue; criadoPorId?: string | null }, d: { telefone: string; status: string; leadId: string | null; respondeuEm: Date | null; dados?: Prisma.JsonValue }): Promise<string | null> {
  if (d.status === 'INTERROMPIDO' || d.status === 'FALHOU') return d.status
  if (c.cfg.pararAoResponder && d.respondeuEm) return 'RESPONDEU'
  if (ehRemetenteInstagram(m.assistenteId)) return motivoInstagram(m, c, d)
  // Saiu do público (ex.: o lead mudou de etapa no CRM): a sequência para. Conferido na hora de cada envio.
  if (c.cfg.pararAoSairDoPublico && d.leadId && c.publico) {
    const def = c.publico as unknown as DefinicaoPublico
    // Carteira de quem criou: lead passado para outro vendedor também sai do público.
    const leitor = await leitorDaCampanha(c.usuarioId, c.criadoPorId ?? null)
    const [atual] = await lerLeadsPorId(leitor, [d.leadId])
    if (!atual || !passaGrupo(atual, def.filtros, new Date())) return 'SAIU_DO_PUBLICO'
  }
  const aut = await situacaoDe(c.usuarioId, d.telefone)
  if (aut?.situacao === 'BLOQUEADO') return 'BLOQUEADO'
  if (c.finalidade === 'MARKETING' && aut?.situacao === 'REVOGADO') return 'DESCADASTRADO'
  if (c.finalidade === 'MARKETING') {
    const cfgLoja = await configDaLoja(c.usuarioId)
    if (aut?.situacao !== 'AUTORIZADO' && !(cfgLoja.baseMarketing === 'RELACAO' && d.leadId)) {
      // Sem relação nem autorização registrada (ex.: a autorização foi apagada da base): não sai.
      const temCliente = await prisma.disparoDestinatario.count({ where: { id: m.destinatarioId, clienteId: { not: null } } })
      if (!(cfgLoja.baseMarketing === 'RELACAO' && temCliente)) return 'SEM_AUTORIZACAO'
    }
  }
  const desde = c.iniciadaEm ?? new Date(0)
  if (c.cfg.pararAoComprar && d.leadId) {
    const comprou = await prisma.lead.count({ where: { id: d.leadId, estagio: 'FECHADO', fechadoEm: { gte: desde } } })
    if (comprou) return 'COMPROU'
  }
  if (c.cfg.pararSeVendedorAssumir && m.passo > 0) {
    const assumiu = await prisma.assistenteMensagem.count({ where: { remetente: 'VENDEDOR', criadoEm: { gte: desde }, conversa: { assistenteId: m.assistenteId, numeroContato: { endsWith: chaveTelefone(d.telefone) } } } })
    if (assumiu) return 'VENDEDOR_ASSUMIU'
  }
  return null
}

/**
 * Instagram: bloqueado/descadastrado (pediu SAIR no direct), alguém da loja já respondeu a pessoa e,
 * principalmente, a janela da Meta (24 h desde a última mensagem dela; resposta privada a comentário
 * só no 1º passo, em até 7 dias). A pessoa falou com a conta: é o consentimento que a Meta exige.
 */
async function motivoInstagram(m: MensagemTravada, c: { usuarioId: string; finalidade: string; iniciadaEm: Date | null; cfg: ConfigEnvio }, d: { telefone: string; leadId: string | null; dados?: Prisma.JsonValue }): Promise<string | null> {
  const aut = await situacaoDe(c.usuarioId, d.telefone)
  if (aut?.situacao === 'BLOQUEADO') return 'BLOQUEADO'
  if (c.finalidade === 'MARKETING' && aut?.situacao === 'REVOGADO') return 'DESCADASTRADO'
  const dados = (d.dados ?? {}) as DadosIg
  const desde = c.iniciadaEm ?? new Date(0)
  if (c.cfg.pararAoComprar && d.leadId) {
    const comprou = await prisma.lead.count({ where: { id: d.leadId, estagio: 'FECHADO', fechadoEm: { gte: desde } } })
    if (comprou) return 'COMPROU'
  }
  if (c.cfg.pararSeVendedorAssumir && m.passo > 0 && dados._igId) {
    const assumiu = await prisma.smMensagem.count({ where: { direcao: 'OUT', autor: 'HUMANO', enviadaEm: { gte: desde }, conversa: { usuarioId: c.usuarioId, clienteIgId: dados._igId } } })
    if (assumiu) return 'VENDEDOR_ASSUMIU'
  }
  const alvo = await alvoDoEnvio(c.usuarioId, dados, m.passo)
  return alvo.modo === 'FECHADA' ? 'JANELA_FECHADA' : null
}

async function arquivoDaMidia(midiaId: string) {
  return arquivoParaEnvio(midiaId)
}

/** Depois de um passo aceito: agenda o próximo ou conclui o destinatário. */
async function avancarSequencia(m: MensagemTravada, passos: Passo[], agora: Date) {
  const prox = passos[m.passo + 1]
  if (!prox) { await prisma.disparoDestinatario.updateMany({ where: { id: m.destinatarioId, status: 'EM_ANDAMENTO' }, data: { status: 'CONCLUIDO', passoAtual: m.passo } }); return }
  await prisma.disparoDestinatario.update({ where: { id: m.destinatarioId }, data: { passoAtual: m.passo } })
  await prisma.disparoMensagem.createMany({
    data: [{ campanhaId: m.campanhaId, destinatarioId: m.destinatarioId, passo: m.passo + 1, chave: `${m.campanhaId}:${m.destinatarioId}:${m.passo + 1}`, assistenteId: m.assistenteId, tipo: prox.tipo, midiaId: prox.midiaId ?? null, enviarApos: new Date(agora.getTime() + Math.max(0, prox.esperarMin ?? 0) * MIN) }],
    skipDuplicates: true,
  })
}

/** Envia uma mensagem já travada. Devolve se o número remetente deve parar nesta rodada (sem conexão). */
async function enviarTravada(m: MensagemTravada, remetente: Remetente | null, agora: Date, prazo = Date.now() + 20_000): Promise<'ENVIADA' | 'PULADA' | 'SEM_CONEXAO' | 'FALHOU' | 'LIMITE'> {
  const c = await prisma.disparoCampanha.findUnique({ where: { id: m.campanhaId }, select: { usuarioId: true, nome: true, finalidade: true, iniciadaEm: true, config: true, conteudo: true, publico: true, preparo: true, criadoPorId: true } })
  const d = await prisma.disparoDestinatario.findUnique({ where: { id: m.destinatarioId }, select: { telefone: true, status: true, leadId: true, respondeuEm: true, dados: true } })
  if (!c || !d) { await prisma.disparoMensagem.update({ where: { id: m.id }, data: { status: 'CANCELADA', ultimoErro: 'Campanha ou destinatário não encontrado' } }); return 'PULADA' }
  const cfgLoja = await configDaLoja(c.usuarioId)
  const cfg = lerConfigEnvio(c.config, cfgLoja.envio)
  const conteudo = c.conteudo as unknown as Conteudo
  const passo = conteudo.passos?.[m.passo]
  const motivo = passo ? await motivoParaInterromper(m, { usuarioId: c.usuarioId, finalidade: c.finalidade, iniciadaEm: c.iniciadaEm, cfg, publico: c.publico, preparo: c.preparo, criadoPorId: c.criadoPorId }, d) : 'PASSO_REMOVIDO'
  if (motivo) {
    await prisma.disparoMensagem.update({ where: { id: m.id }, data: { status: 'PULADA', ultimoErro: motivo, travadaEm: null } })
    await prisma.disparoDestinatario.updateMany({ where: { id: m.destinatarioId, status: { in: ['EM_ANDAMENTO', 'ELEGIVEL'] } }, data: { status: motivo === 'RESPONDEU' ? 'RESPONDEU' : 'INTERROMPIDO', interrompidoPor: motivo } })
    await evento({ usuarioId: c.usuarioId, campanhaId: m.campanhaId, destinatarioId: m.destinatarioId, mensagemId: m.id, tipo: 'SEQUENCIA_INTERROMPIDA', descricao: `Passo ${m.passo + 1} não enviado: ${motivo}` })
    return 'PULADA'
  }
  // Texto final: variáveis do snapshot; o rodapé de saída nas promocionais.
  const rend = renderizar(passo!.texto ?? '', (d.dados ?? {}) as ValoresVariaveis, conteudo.fallbacks ?? {})
  if (rend.faltando.length) {
    await prisma.disparoMensagem.update({ where: { id: m.id }, data: { status: 'FALHOU', erroClasse: 'VARIAVEL_SEM_VALOR', ultimoErro: `Sem valor para: ${rend.faltando.join(', ')}`, falhouEm: agora, travadaEm: null } })
    await prisma.disparoDestinatario.update({ where: { id: m.destinatarioId }, data: { status: 'FALHOU' } })
    return 'FALHOU'
  }
  const rodape = c.finalidade === 'MARKETING' && conteudo.rodapeSair !== false && m.passo === (conteudo.passos.length - 1) ? `\n\n${cfgLoja.rodapeSair}` : ''
  const texto = `${rend.texto}${rodape}`.trim()
  const midia = passo!.midiaId ? await arquivoDaMidia(passo!.midiaId) : null
  if (passo!.midiaId && !midia) {
    await prisma.disparoMensagem.update({ where: { id: m.id }, data: { status: 'FALHOU', erroClasse: 'MIDIA_INDISPONIVEL', ultimoErro: 'O arquivo da biblioteca não foi encontrado', falhouEm: agora, travadaEm: null } })
    return 'FALHOU'
  }
  await prisma.disparoMensagem.update({ where: { id: m.id }, data: { texto } })
  const numero = m.tentativas + 1
  const tentativa = await prisma.disparoTentativa.create({ data: { mensagemId: m.id, numero, inicio: new Date(), resultado: 'EM_ANDAMENTO' } })
  let providerId: string | null = null
  try {
    const prazoMs = Math.max(5000, Math.min(15_000, prazo - Date.now() - 1500))
    providerId = ehRemetenteInstagram(m.assistenteId)
      ? (await enviarPeloInstagram(m.assistenteId, c.usuarioId, (d.dados ?? {}) as DadosIg, m.passo, { tipo: passo!.tipo ?? 'TEXTO', texto, midia: midia ? { url: midia.url } : null, prazoMs })).providerId
      : (await provedor().enviar(remetente!, d.telefone, { tipo: (passo!.tipo ?? 'TEXTO'), texto, midia, digitandoMs: Math.min(4000, 800 + texto.length * 25), prazoMs })).providerId
  } catch (e) {
    const err = e as { message?: string; classe?: string; codigo?: string | null }
    const classe = err.classe ?? 'TEMPORARIO'
    const fim = new Date()
    const msg = (err.message ?? String(e)).slice(0, 500)
    await prisma.disparoTentativa.update({ where: { id: tentativa.id }, data: { fim, resultado: classe === 'DEFINITIVO' ? 'FALHA_DEFINITIVA' : classe === 'DESCONHECIDO' ? 'DESCONHECIDO' : classe === 'CONEXAO' ? 'SEM_CONEXAO' : 'FALHA_TEMPORARIA', erro: msg, codigo: err.codigo ?? null } })
    if (classe === 'CONEXAO') {
      // Não gasta tentativa: volta para a fila e o número para nesta rodada.
      await prisma.disparoMensagem.update({ where: { id: m.id }, data: { status: 'AGENDADA', travadaEm: null, ultimoErro: msg, erroClasse: 'CONEXAO' } })
      return 'SEM_CONEXAO'
    }
    if (classe === 'LIMITE') {
      // Limite da Meta: não gasta tentativa; volta para a fila daqui a 15 min e a conta para nesta rodada.
      await prisma.disparoMensagem.update({ where: { id: m.id }, data: { status: 'AGENDADA', travadaEm: null, ultimoErro: msg, erroClasse: 'LIMITE', proximaTentativaEm: new Date(fim.getTime() + 15 * MIN) } })
      return 'LIMITE'
    }
    if (classe === 'DESCONHECIDO') {
      await prisma.disparoMensagem.update({ where: { id: m.id }, data: { status: 'DESCONHECIDO', tentativas: numero, travadaEm: null, ultimoErro: msg, erroClasse: 'DESCONHECIDO' } })
      await evento({ usuarioId: c.usuarioId, campanhaId: m.campanhaId, destinatarioId: m.destinatarioId, mensagemId: m.id, tipo: 'RESULTADO_DESCONHECIDO', descricao: 'O pedido saiu, mas a resposta do WhatsApp não voltou: será conferido antes de qualquer nova tentativa' })
      return 'FALHOU'
    }
    if (classe === 'DEFINITIVO' || numero >= cfg.maxTentativas) {
      await prisma.disparoMensagem.update({ where: { id: m.id }, data: { status: 'FALHOU', tentativas: numero, travadaEm: null, ultimoErro: msg, erroClasse: classe === 'DEFINITIVO' ? 'DEFINITIVO' : 'ESGOTOU', falhouEm: fim } })
      await prisma.disparoDestinatario.updateMany({ where: { id: m.destinatarioId, status: 'EM_ANDAMENTO' }, data: { status: 'FALHOU' } })
      await evento({ usuarioId: c.usuarioId, campanhaId: m.campanhaId, destinatarioId: m.destinatarioId, mensagemId: m.id, tipo: 'FALHA', descricao: classe === 'DEFINITIVO' ? `Falha definitiva: ${msg}` : `Tentativas esgotadas (${numero}): ${msg}` })
      return 'FALHOU'
    }
    await prisma.disparoMensagem.update({ where: { id: m.id }, data: { status: 'AGENDADA', tentativas: numero, travadaEm: null, ultimoErro: msg, erroClasse: 'TEMPORARIO', proximaTentativaEm: new Date(fim.getTime() + esperaDaTentativa(numero)) } })
    return 'FALHOU'
  }
  // O WhatsApp aceitou. Daqui em diante, um erro do banco nunca pode virar reenvio: fica "desconhecido"
  // (com o id do WhatsApp, quando houver) e a reconciliação confirma sem mandar de novo.
  const fim = new Date()
  try {
    await prisma.$transaction([
      prisma.disparoMensagem.update({ where: { id: m.id }, data: { status: 'ACEITA', providerId, aceitaEm: fim, tentativas: numero, travadaEm: null, ultimoErro: null, erroClasse: null } }),
      prisma.disparoTentativa.update({ where: { id: tentativa.id }, data: { fim, resultado: 'ACEITA' } }),
    ])
  } catch (e) {
    logger.error({ err: e, mensagemId: m.id }, 'disparo: enviada, mas não gravou o resultado')
    await prisma.disparoMensagem.updateMany({ where: { id: m.id }, data: { status: 'DESCONHECIDO', tentativas: numero, travadaEm: null, erroClasse: 'DESCONHECIDO', ultimoErro: `Enviada (id ${providerId ?? '?'}), mas o resultado não foi gravado` } }).catch(() => undefined)
    return 'FALHOU'
  }
  await avancarSequencia(m, conteudo.passos, fim)
  return 'ENVIADA'
}

/** Já mandou o bastante agora? (intervalo mínimo, limite por hora e por dia do número remetente) */
async function folgaDoRemetente(assistenteId: string, cfg: ConfigEnvio, agora: Date): Promise<{ podeAgora: boolean; esperarMs: number }> {
  const [ultima, hora, dia] = await Promise.all([
    prisma.disparoMensagem.findFirst({ where: { assistenteId, aceitaEm: { not: null } }, orderBy: { aceitaEm: 'desc' }, select: { aceitaEm: true } }),
    prisma.disparoMensagem.count({ where: { assistenteId, aceitaEm: { gte: new Date(agora.getTime() - 60 * MIN) } } }),
    prisma.disparoMensagem.count({ where: { assistenteId, aceitaEm: { gte: new Date(agora.getTime() - 24 * 60 * MIN) } } }),
  ])
  if (hora >= cfg.maxPorHora || dia >= cfg.maxPorDia) return { podeAgora: false, esperarMs: Infinity }
  const desde = ultima?.aceitaEm ? agora.getTime() - ultima.aceitaEm.getTime() : Infinity
  const espera = cfg.intervaloSeg * 1000 - desde
  return { podeAgora: espera <= 0, esperarMs: Math.max(0, espera) }
}

/**
 * Prioridade do atendimento: houve mensagem de atendimento neste número há pouco? Devolve até quando
 * esperar (8 s depois da última), ou null. O laço espera e tenta de novo na mesma rodada, em vez de
 * desistir: com o WhatsApp do vendedor movimentado, desistir fazia a campanha nunca sair.
 */
export const SILENCIO_ATENDIMENTO_MS = 8_000
async function atendimentoOcupadoAte(assistenteId: string, agora: Date): Promise<number | null> {
  const ultima = await prisma.assistenteMensagem.findFirst({ where: { criadoEm: { gte: new Date(agora.getTime() - SILENCIO_ATENDIMENTO_MS) }, remetente: { in: ['ASSISTENTE', 'VENDEDOR', 'CONTATO'] }, OR: [{ origem: null }, { origem: { not: 'DISPARO' } }], conversa: { assistenteId, tipo: 'LEAD' } }, orderBy: { criadoEm: 'desc' }, select: { criadoEm: true } })
  return ultima ? ultima.criadoEm.getTime() + SILENCIO_ATENDIMENTO_MS : null
}

/** Por que o laço de um número parou na última rodada (a tela mostra). */
export type ParadaRemetente = 'SEM_CONEXAO' | 'SEM_CAMPANHA' | 'FORA_DA_JANELA' | 'LIMITE' | 'INTERVALO' | 'ATENDIMENTO' | 'SEM_MENSAGEM' | 'PRAZO' | 'ERRO' | 'OCUPADO'
async function gravarEstadoRemetente(assistenteId: string, motivo: ParadaRemetente, extra: Record<string, unknown> = {}) {
  const agora = new Date()
  const dados = { motivo, em: agora.toISOString(), ...extra } as Prisma.InputJsonValue
  await prisma.disparoTrava.upsert({ where: { chave: `estado:remetente:${assistenteId}` }, create: { chave: `estado:remetente:${assistenteId}`, ate: agora, dados }, update: { ate: agora, dados } }).catch(() => undefined)
}

const espera = (ms: number) => new Promise(ok => setTimeout(ok, ms))

const MSG_RECONECTAR = (nome: string) => `O WhatsApp de ${nome.split(/\s+/)[0]} precisa ser reconectado: o número não está enviando (sessão caída no servidor). Abra Conversas › Conexão e leia o QR Code no celular dele(a). As mensagens esperam na fila e saem sozinhas depois.`

/** Sessão que não envia mesmo depois de reiniciar: "precisa reconectar" + aviso (no máximo a cada 6 h). */
async function marcarPrecisaReconectar(a: { id: string; vendedorId: string; vendedor: { usuarioId: string; nome: string } }) {
  await prisma.assistenteComercial.updateMany({ where: { id: a.id, status: 'CONECTADO' }, data: { status: 'SESSAO_CAIDA', motivoQueda: 'ENVIO_FALHOU' } })
  await prisma.disparoCampanha.updateMany({ where: { assistenteId: a.id, status: 'RUNNING' }, data: { erro: MSG_RECONECTAR(a.vendedor.nome) } })
  if (await pegarTrava(`aviso-reconectar:${a.id}`, 6 * 60 * MIN)) {
    const texto = `⚠️ ${MSG_RECONECTAR(a.vendedor.nome)}`
    await avisarNoWhatsapp(a.vendedor.usuarioId, a.vendedorId, texto).catch(e => logger.warn({ err: e }, 'disparo: aviso de reconexão ao vendedor'))
    await avisarNoWhatsapp(a.vendedor.usuarioId, null, texto).catch(e => logger.warn({ err: e }, 'disparo: aviso de reconexão ao dono'))
  }
}

/** Envia pelo número remetente até o prazo, respeitando ritmo, limites, janela e o atendimento. */
async function rodarRemetente(assistenteId: string, prazo: number): Promise<{ enviadas: number; falhas: number; puladas: number; semConexao: boolean }> {
  if (ehRemetenteInstagram(assistenteId)) return rodarRemetenteInstagram(assistenteId, prazo)
  const out = { enviadas: 0, falhas: 0, puladas: 0, semConexao: false }
  const a = await prisma.assistenteComercial.findUnique({ where: { id: assistenteId }, select: { id: true, instancia: true, status: true, vendedorId: true, vendedor: { select: { usuarioId: true, nome: true } } } })
  if (!a) return out
  // Só envia por número CONECTADO. Desconectado, aguardando QR ou "precisa reconectar": não tenta
  // nada (nem envio, nem reinício) — o ARIES nunca religa sozinho um número que alguém desconectou.
  if (a.status !== 'CONECTADO') {
    out.semConexao = true
    const nome = a.vendedor.nome.split(/\s+/)[0]
    const msg = a.status === 'SESSAO_CAIDA' ? MSG_RECONECTAR(a.vendedor.nome) : a.status === 'AGUARDANDO_QR' ? `O WhatsApp de ${nome} está esperando a leitura do QR Code: a campanha continua quando conectar.` : `O WhatsApp de ${nome} está desconectado: conecte em Conversas › Conexão e a campanha continua sozinha.`
    await prisma.disparoCampanha.updateMany({ where: { assistenteId, status: 'RUNNING' }, data: { erro: msg } })
    await gravarEstadoRemetente(assistenteId, 'SEM_CONEXAO', { erro: msg })
    return out
  }
  // Um laço por número de cada vez (rotina e tela juntas não podem furar o intervalo entre mensagens).
  const chave = `remetente:${assistenteId}`
  if (!(await pegarTrava(chave, prazo - Date.now() + 5000))) return out
  let parada: ParadaRemetente = 'PRAZO'
  let erro: string | null = null
  try {
    const r = await rodarRemetenteComTrava(a, prazo, out)
    parada = r.parada
    return r.out
  } catch (e) {
    parada = 'ERRO'; erro = String((e as Error)?.message ?? e).slice(0, 300)
    throw e
  } finally {
    await soltarTrava(chave)
    await gravarEstadoRemetente(assistenteId, parada, { enviadas: out.enviadas, falhas: out.falhas, ...(erro ? { erro } : {}) })
  }
}
async function rodarRemetenteComTrava(a: { id: string; instancia: string | null; vendedorId: string; vendedor: { usuarioId: string; nome: string } }, prazo: number, out: { enviadas: number; falhas: number; puladas: number; semConexao: boolean }): Promise<{ out: typeof out; parada: ParadaRemetente }> {
  const assistenteId = a.id
  const remetente: Remetente = { assistenteId: a.id, instancia: a.instancia }
  const estado = await provedor().verificarConexao(remetente)
  if (estado !== 'CONECTADO') {
    out.semConexao = true
    await prisma.disparoCampanha.updateMany({ where: { assistenteId, status: 'RUNNING', erro: null }, data: { erro: estado === 'SEM_SERVIDOR' ? 'O servidor do WhatsApp não está configurado' : estado === 'ERRO' ? 'O servidor do WhatsApp não respondeu: a campanha tenta de novo na próxima rodada' : 'O número remetente está desconectado: a campanha espera a conexão voltar' } })
    return { out, parada: 'SEM_CONEXAO' }
  }
  await prisma.disparoCampanha.updateMany({ where: { assistenteId, status: 'RUNNING', erro: { not: null } }, data: { erro: null } })
  // Uma vez a cada 6 h por número: confere se o aviso de entregue/lida está ligado na instância.
  if (await pegarTrava(`preparar-remetente:${assistenteId}`, 6 * 60 * MIN)) await provedor().prepararRemetente(remetente).catch(() => undefined)
  const cfgLoja = await configDaLoja(a.vendedor.usuarioId)
  let parada: ParadaRemetente = 'PRAZO'
  let reconectou = false
  // Rodadas curtas (testes, sobras de tempo) usam uma folga proporcional.
  const envioMin = Math.min(ENVIO_MIN_MS, Math.max(0, prazo - Date.now()) * 0.4)
  while (Date.now() < prazo - 2000) {
    const agora = new Date()
    // A janela e o ritmo vêm da campanha da próxima mensagem; o número usa o ritmo mais lento entre as campanhas ativas dele.
    const ativas = await prisma.disparoCampanha.findMany({ where: { status: 'RUNNING', OR: [{ assistenteId }, { mensagens: { some: { assistenteId, status: 'AGENDADA' } } }] }, select: { id: true, config: true } })
    if (!ativas.length) { parada = 'SEM_CAMPANHA'; break }
    const cfgs = ativas.map(c => ({ id: c.id, cfg: lerConfigEnvio(c.config, cfgLoja.envio) }))
    const naJanela = cfgs.filter(x => dentroDaJanela(x.cfg.janela, agora))
    if (!naJanela.length) { parada = 'FORA_DA_JANELA'; break }
    const lento: ConfigEnvio = { ...naJanela[0].cfg, intervaloSeg: Math.max(...naJanela.map(x => x.cfg.intervaloSeg)), maxPorHora: Math.min(...naJanela.map(x => x.cfg.maxPorHora)), maxPorDia: Math.min(...naJanela.map(x => x.cfg.maxPorDia)) }
    const folga = await folgaDoRemetente(assistenteId, lento, agora)
    if (!folga.podeAgora) {
      // Variação de até 30% no intervalo: ritmo menos mecânico.
      const pausa = folga.esperarMs + Math.round(lento.intervaloSeg * 1000 * Math.random() * 0.3)
      if (!Number.isFinite(pausa)) { parada = 'LIMITE'; break }
      if (Date.now() + pausa > prazo - 3000) { parada = 'INTERVALO'; break }
      await espera(pausa)
      continue
    }
    const ocupadoAte = await atendimentoOcupadoAte(assistenteId, agora)
    if (ocupadoAte) {
      // Atendimento acontecendo agora: espera o silêncio e tenta de novo nesta mesma rodada.
      const w = ocupadoAte - Date.now() + 250
      if (Date.now() + w > prazo - 3000) { parada = 'ATENDIMENTO'; break }
      await espera(Math.max(250, w))
      continue
    }
    // Só começa um envio se ele cabe no tempo da rodada (a função na Vercel tem limite de 30 s):
    // um envio cortado no meio vira "sem confirmação" e exige conferência.
    if (Date.now() > prazo - envioMin) { parada = 'PRAZO'; break }
    const m = await travarProxima(assistenteId, agora)
    if (!m) { parada = 'SEM_MENSAGEM'; break }
    if (!naJanela.some(x => x.id === m.campanhaId)) { await prisma.disparoMensagem.update({ where: { id: m.id }, data: { status: 'AGENDADA', travadaEm: null } }); parada = 'FORA_DA_JANELA'; break }
    const r = await enviarTravada(m, remetente, agora, prazo).catch(async e => {
      // Erro do próprio sistema (banco): a mensagem fica DESCONHECIDO se já tinha começado a tentativa.
      logger.error({ err: e, mensagemId: m.id }, 'disparo: falha inesperada no envio')
      await prisma.disparoMensagem.updateMany({ where: { id: m.id, status: 'ENVIANDO' }, data: { status: 'DESCONHECIDO', travadaEm: null, erroClasse: 'DESCONHECIDO', ultimoErro: String((e as Error)?.message ?? e).slice(0, 300) } })
      return 'FALHOU' as const
    })
    if (r === 'ENVIADA') out.enviadas += 1
    else if (r === 'PULADA') out.puladas += 1
    else if (r === 'SEM_CONEXAO') {
      // "Connection Closed": o servidor diz conectado, mas a sessão caiu. Religa uma vez (no máximo a
      // cada 5 min por número) e tenta de novo. Se já religou e continua recusando, a sessão está
      // corrompida: marca "precisa reconectar" (a tela pede o QR direto), para de tentar e avisa.
      let reiniciadoHaPouco = false
      if (!reconectou && Date.now() < prazo - 13_000) {
        if (await pegarTrava(`reiniciar:${assistenteId}`, 5 * MIN)) {
          reconectou = true
          const ok = await provedor().reconectar(remetente, 9000).catch(() => false)
          await prisma.disparoCampanha.findMany({ where: { assistenteId, status: 'RUNNING' }, select: { id: true, usuarioId: true } }).then(cs => Promise.all(cs.map(c => evento({ usuarioId: c.usuarioId, campanhaId: c.id, tipo: 'RECONEXAO', descricao: ok ? 'A conexão do WhatsApp tinha caído ("Connection Closed"): o ARIES religou a sessão e vai tentar de novo' : 'A conexão do WhatsApp caiu ("Connection Closed") e não voltou ao religar' }))))
          if (ok) continue
        } else reiniciadoHaPouco = true
      }
      out.semConexao = true; parada = 'SEM_CONEXAO'
      if (reconectou || reiniciadoHaPouco) await marcarPrecisaReconectar(a)
      else await prisma.disparoCampanha.updateMany({ where: { assistenteId, status: 'RUNNING' }, data: { erro: 'A conexão do WhatsApp deste número caiu no servidor (Connection Closed). O ARIES está tentando religar sozinho.' } })
      break
    }
    else out.falhas += 1
  }
  return { out, parada }
}

/** Laço do Instagram da empresa: mesmo ritmo, limites e horário; a janela da Meta é conferida por mensagem. */
async function rodarRemetenteInstagram(remetenteId: string, prazo: number): Promise<{ enviadas: number; falhas: number; puladas: number; semConexao: boolean }> {
  const out = { enviadas: 0, falhas: 0, puladas: 0, semConexao: false }
  const daConta = { status: 'RUNNING', mensagens: { some: { assistenteId: remetenteId, status: 'AGENDADA' } } } as const
  const conta = await prisma.socialMediaConta.findUnique({ where: { id: remetenteId.slice(3) }, select: { id: true, usuarioId: true } })
  if (!conta) {
    out.semConexao = true
    const msg = 'O Instagram da empresa não está conectado: conecte em Social Media › Conexão e a campanha continua sozinha'
    await prisma.disparoCampanha.updateMany({ where: daConta, data: { erro: msg } })
    await gravarEstadoRemetente(remetenteId, 'SEM_CONEXAO', { erro: msg })
    return out
  }
  const chave = `remetente:${remetenteId}`
  if (!(await pegarTrava(chave, prazo - Date.now() + 5000))) return out
  let parada: ParadaRemetente = 'PRAZO'
  let erro: string | null = null
  try {
    const cfgLoja = await configDaLoja(conta.usuarioId)
    const envioMin = Math.min(ENVIO_MIN_MS, Math.max(0, prazo - Date.now()) * 0.4)
    let limpou = false
    while (Date.now() < prazo - 2000) {
      const agora = new Date()
      const ativas = await prisma.disparoCampanha.findMany({ where: daConta, select: { id: true, config: true, erro: true } })
      if (!ativas.length) { parada = 'SEM_CAMPANHA'; break }
      if (!limpou && ativas.some(a => a.erro)) { await prisma.disparoCampanha.updateMany({ where: { id: { in: ativas.map(a => a.id) }, erro: { not: null } }, data: { erro: null } }); limpou = true }
      const cfgs = ativas.map(c => ({ id: c.id, cfg: lerConfigEnvio(c.config, cfgLoja.envio) }))
      const naJanela = cfgs.filter(x => dentroDaJanela(x.cfg.janela, agora))
      if (!naJanela.length) { parada = 'FORA_DA_JANELA'; break }
      const lento: ConfigEnvio = { ...naJanela[0].cfg, intervaloSeg: Math.max(...naJanela.map(x => x.cfg.intervaloSeg)), maxPorHora: Math.min(MAX_POR_HORA_INSTAGRAM, ...naJanela.map(x => x.cfg.maxPorHora)), maxPorDia: Math.min(...naJanela.map(x => x.cfg.maxPorDia)) }
      const folga = await folgaDoRemetente(remetenteId, lento, agora)
      if (!folga.podeAgora) {
        const pausa = folga.esperarMs + Math.round(lento.intervaloSeg * 1000 * Math.random() * 0.3)
        if (!Number.isFinite(pausa)) { parada = 'LIMITE'; break }
        if (Date.now() + pausa > prazo - 3000) { parada = 'INTERVALO'; break }
        await espera(pausa)
        continue
      }
      if (Date.now() > prazo - envioMin) { parada = 'PRAZO'; break }
      const m = await travarProxima(remetenteId, agora)
      if (!m) { parada = 'SEM_MENSAGEM'; break }
      if (!naJanela.some(x => x.id === m.campanhaId)) { await prisma.disparoMensagem.update({ where: { id: m.id }, data: { status: 'AGENDADA', travadaEm: null } }); parada = 'FORA_DA_JANELA'; break }
      const r = await enviarTravada(m, null, agora, prazo).catch(async e => {
        logger.error({ err: e, mensagemId: m.id }, 'disparo: falha inesperada no envio pelo Instagram')
        await prisma.disparoMensagem.updateMany({ where: { id: m.id, status: 'ENVIANDO' }, data: { status: 'DESCONHECIDO', travadaEm: null, erroClasse: 'DESCONHECIDO', ultimoErro: String((e as Error)?.message ?? e).slice(0, 300) } })
        return 'FALHOU' as const
      })
      if (r === 'ENVIADA') out.enviadas += 1
      else if (r === 'PULADA') out.puladas += 1
      else if (r === 'LIMITE') { parada = 'LIMITE'; break }
      else if (r === 'SEM_CONEXAO') {
        // Token vencido ou permissão retirada: para e mostra o motivo na campanha (nada se perde).
        out.semConexao = true; parada = 'SEM_CONEXAO'
        const motivo = (await prisma.disparoMensagem.findUnique({ where: { id: m.id }, select: { ultimoErro: true } }))?.ultimoErro ?? 'O Instagram da empresa recusou o envio'
        erro = motivo
        await prisma.disparoCampanha.updateMany({ where: daConta, data: { erro: motivo } })
        break
      }
      else out.falhas += 1
    }
    return out
  } catch (e) {
    parada = 'ERRO'; erro = String((e as Error)?.message ?? e).slice(0, 300)
    throw e
  } finally {
    await soltarTrava(chave)
    await gravarEstadoRemetente(remetenteId, parada, { enviadas: out.enviadas, falhas: out.falhas, ...(erro ? { erro } : {}) })
  }
}

// ---------- Reconciliação ----------

export async function reconciliar(agora = new Date(), limite = 20): Promise<{ reconciliadas: number; recuperadas: number }> {
  // Processo caiu no meio do envio: não se sabe se saiu.
  const presas = await prisma.disparoMensagem.updateMany({ where: { status: 'ENVIANDO', travadaEm: { lt: new Date(agora.getTime() - TRAVA_MAX_MS) } }, data: { status: 'DESCONHECIDO', erroClasse: 'DESCONHECIDO', ultimoErro: 'O envio foi interrompido no meio (o processo caiu)', travadaEm: null } })
  let reconciliadas = 0
  const pendentes = await prisma.disparoMensagem.findMany({ where: { status: 'DESCONHECIDO', erroClasse: 'DESCONHECIDO' }, take: limite, orderBy: { atualizadoEm: 'asc' }, include: { destinatario: { select: { telefone: true, dados: true } }, campanha: { select: { usuarioId: true, conteudo: true } } } })
  for (const m of pendentes) {
    const ig = ehRemetenteInstagram(m.assistenteId)
    const a = ig ? null : await prisma.assistenteComercial.findUnique({ where: { id: m.assistenteId }, select: { id: true, instancia: true } })
    const tentativa = await prisma.disparoTentativa.findFirst({ where: { mensagemId: m.id }, orderBy: { numero: 'desc' }, select: { inicio: true } })
    const desde = tentativa?.inicio ?? m.atualizadoEm
    if (!ig && !a) {
      // Número removido: não há onde conferir. Vai para a decisão de uma pessoa (não trava a fila).
      if (agora.getTime() - desde.getTime() > RECONCILIAR_ATE_MS) await prisma.disparoMensagem.update({ where: { id: m.id }, data: { erroClasse: 'DECIDIR', ultimoErro: 'Não confirmada: decida na tela se reenvia ou considera enviada' } })
      else await prisma.disparoMensagem.update({ where: { id: m.id }, data: { atualizadoEm: agora } })
      continue
    }
    let id: string | null = null
    try {
      id = ig
        ? await reconciliarInstagram(m.campanha.usuarioId, ((m.destinatario.dados ?? {}) as DadosIg)._igId ?? null, m.texto ?? '', desde)
        : await provedor().reconciliar({ assistenteId: a!.id, instancia: a!.instancia }, m.destinatario.telefone, m.texto ?? '', desde)
    } catch (e) { logger.warn({ err: e }, 'disparo: reconciliação indisponível') }
    if (id) {
      await prisma.disparoMensagem.update({ where: { id: m.id }, data: { status: 'ACEITA', providerId: id, aceitaEm: desde, erroClasse: null, ultimoErro: null } }).catch(() => undefined)
      await prisma.disparoTentativa.create({ data: { mensagemId: m.id, numero: m.tentativas, inicio: agora, fim: new Date(), resultado: 'RECONCILIADA', erro: `Encontrada no ${ig ? 'Instagram' : 'WhatsApp'}: tinha saído` } })
      await avancarSequencia({ id: m.id, campanhaId: m.campanhaId, destinatarioId: m.destinatarioId, passo: m.passo, assistenteId: m.assistenteId, tipo: m.tipo, midiaId: m.midiaId, tentativas: m.tentativas, travadaEm: agora }, (m.campanha.conteudo as unknown as Conteudo).passos ?? [], agora)
      await evento({ usuarioId: m.campanha.usuarioId, campanhaId: m.campanhaId, destinatarioId: m.destinatarioId, mensagemId: m.id, tipo: 'RECONCILIADA', descricao: `A mensagem tinha saído: confirmada no ${ig ? 'Instagram' : 'WhatsApp'}, sem reenviar` })
      reconciliadas += 1
    } else if (agora.getTime() - desde.getTime() > RECONCILIAR_ATE_MS) {
      // Não achou depois de 30 min: fica para decisão de uma pessoa (reenviar ou considerar enviada). Nunca repete sozinho.
      await prisma.disparoMensagem.update({ where: { id: m.id }, data: { erroClasse: 'DECIDIR', ultimoErro: `Não confirmada no ${ig ? 'Instagram' : 'WhatsApp'}: decida na tela se reenvia ou considera enviada` } })
      await evento({ usuarioId: m.campanha.usuarioId, campanhaId: m.campanhaId, destinatarioId: m.destinatarioId, mensagemId: m.id, tipo: 'DECIDIR_REENVIO', descricao: 'Resultado do envio não confirmado: precisa de decisão' })
    }
  }
  return { reconciliadas, recuperadas: presas.count }
}

/** Decisão de uma pessoa sobre uma mensagem de resultado desconhecido ou da fila morta. */
export async function decidirMensagem(mensagemId: string, decisao: 'REENVIAR' | 'CONSIDERAR_ENVIADA', autorNome: string | null) {
  const m = await prisma.disparoMensagem.findUnique({ where: { id: mensagemId }, include: { campanha: { select: { usuarioId: true, status: true, conteudo: true } } } })
  if (!m) throw new ErroDisparo('Mensagem não encontrada', 404)
  const podeDecidir = m.status === 'DESCONHECIDO' || (m.status === 'FALHOU' && m.erroClasse === 'ESGOTOU')
  if (!podeDecidir) throw new ErroDisparo('Só mensagens sem confirmação ou com as tentativas esgotadas podem ser decididas aqui', 409)
  if (decisao === 'REENVIAR') {
    await prisma.disparoMensagem.update({ where: { id: m.id }, data: { status: 'AGENDADA', erroClasse: null, ultimoErro: null, proximaTentativaEm: null, enviarApos: new Date(), tentativas: 0 } })
    await prisma.disparoDestinatario.updateMany({ where: { id: m.destinatarioId, status: 'FALHOU' }, data: { status: 'EM_ANDAMENTO' } })
  } else {
    await prisma.disparoMensagem.update({ where: { id: m.id }, data: { status: 'ACEITA', aceitaEm: m.aceitaEm ?? new Date(), erroClasse: null, ultimoErro: 'Considerada enviada por decisão manual' } })
    await avancarSequencia({ id: m.id, campanhaId: m.campanhaId, destinatarioId: m.destinatarioId, passo: m.passo, assistenteId: m.assistenteId, tipo: m.tipo, midiaId: m.midiaId, tentativas: m.tentativas, travadaEm: new Date() }, (m.campanha.conteudo as unknown as Conteudo).passos ?? [], new Date())
  }
  await evento({ usuarioId: m.campanha.usuarioId, campanhaId: m.campanhaId, destinatarioId: m.destinatarioId, mensagemId: m.id, tipo: decisao === 'REENVIAR' ? 'REENVIO_MANUAL' : 'CONSIDERADA_ENVIADA', autorNome })
}

// ---------- Conclusão e recorrência ----------

async function concluirTerminadas(agora: Date): Promise<number> {
  const ativas = await prisma.disparoCampanha.findMany({ where: { status: 'RUNNING' }, select: { id: true, usuarioId: true, recorrencia: true, config: true } })
  let n = 0
  for (const c of ativas) {
    // Estratégia contínua não "termina": fica aberta recebendo quem entra no público (até pausar/cancelar).
    if (lerConfigEnvio(c.config).continua) continue
    const pendentes = await prisma.disparoMensagem.count({ where: { campanhaId: c.id, status: { in: ['AGENDADA', 'ENVIANDO', 'DESCONHECIDO'] } } })
    if (pendentes) continue
    const falhas = await prisma.disparoMensagem.count({ where: { campanhaId: c.id, status: 'FALHOU' } })
    await prisma.disparoDestinatario.updateMany({ where: { campanhaId: c.id, status: 'EM_ANDAMENTO' }, data: { status: 'CONCLUIDO' } })
    if (await transicionar(c.id, falhas ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED', { de: ['RUNNING'], motivo: falhas ? `Concluída com ${falhas} falha(s)` : 'Todos os envios terminaram' })) {
      n += 1
      await agendarRecorrencia(c.id, agora).catch(e => logger.warn({ err: e }, 'disparo: recorrência não agendada'))
    }
  }
  return n
}

/** Campanha recorrente: ao concluir, cria a próxima execução (público avaliado de novo na data). */
async function agendarRecorrencia(campanhaId: string, agora: Date) {
  const c = await prisma.disparoCampanha.findUnique({ where: { id: campanhaId } })
  const rec = (c?.recorrencia ?? null) as { tipo?: 'DIARIA' | 'SEMANAL' | 'MENSAL'; ate?: string } | null
  if (!c || !rec?.tipo) return
  const base = c.agendadaPara ?? c.iniciadaEm ?? agora
  const prox = new Date(base)
  if (rec.tipo === 'DIARIA') prox.setUTCDate(prox.getUTCDate() + 1)
  else if (rec.tipo === 'SEMANAL') prox.setUTCDate(prox.getUTCDate() + 7)
  else prox.setUTCMonth(prox.getUTCMonth() + 1)
  if (rec.ate && prox > new Date(`${rec.ate}T23:59:59Z`)) return
  const nova = await prisma.disparoCampanha.create({
    data: {
      usuarioId: c.usuarioId, nome: c.nome, descricao: c.descricao, objetivo: c.objetivo, finalidade: c.finalidade, canal: c.canal, assistenteId: c.assistenteId, publicoId: c.publicoId,
      publico: c.publico as Prisma.InputJsonValue, conteudo: c.conteudo as Prisma.InputJsonValue, config: c.config as Prisma.InputJsonValue, recorrencia: c.recorrencia as Prisma.InputJsonValue,
      agendadaPara: prox, status: 'VALIDATING', responsavelId: c.responsavelId, responsavelNome: c.responsavelNome, criadoPorId: c.criadoPorId, criadoPorNome: c.criadoPorNome,
      aprovadoPorNome: c.aprovadoPorNome, aprovadoEm: c.aprovadoEm, origemId: c.id, preparo: { ...(c.preparo as object), aprovacao: false, agendarDepois: true } as Prisma.InputJsonValue,
    },
  })
  await prisma.disparoCampanhaVersao.create({ data: { campanhaId: nova.id, versao: 1, nome: nova.nome, publico: nova.publico as Prisma.InputJsonValue, conteudo: nova.conteudo as Prisma.InputJsonValue, config: nova.config as Prisma.InputJsonValue, motivo: `Recorrência de ${c.id}` } })
  await evento({ usuarioId: c.usuarioId, campanhaId: nova.id, tipo: 'RECORRENCIA', descricao: `Próxima execução da campanha recorrente em ${prox.toISOString().slice(0, 10)}` })
}

// ---------- Rodada (chamada pela rotina de cada minuto) ----------

export interface ResultadoRodada { disparoPreparadas: number; disparoIniciadas: number; disparoEnviadas: number; disparoFalhas: number; disparoReconciliadas: number; disparoConcluidas: number }

/** Há trabalho do Disparo agora? (preparar, agendada que chegou na hora, na fila, enviando ou sem confirmação) */
export async function disparoAtivo(agora = new Date()): Promise<boolean> {
  const n = await prisma.disparoCampanha.count({ where: { OR: [{ status: { in: ['VALIDATING', 'QUEUED', 'RUNNING'] } }, { status: 'SCHEDULED', agendadaPara: { lte: agora } }] } })
  return n > 0
}

export async function rodarDisparo(prazoMs = 15_000, agora = new Date(), origem: OrigemRodada = 'ROTINA'): Promise<ResultadoRodada> {
  const fim = Date.now() + prazoMs
  const out: ResultadoRodada = { disparoPreparadas: 0, disparoIniciadas: 0, disparoEnviadas: 0, disparoFalhas: 0, disparoReconciliadas: 0, disparoConcluidas: 0 }
  return comAutor({ origem: 'AUTOMACAO', nome: 'ARIES Disparo' }, async () => {
    // 1) Preparação dos públicos.
    for (const c of await prisma.disparoCampanha.findMany({ where: { status: 'VALIDATING' }, select: { id: true, preparo: true }, take: 3, orderBy: { atualizadoEm: 'asc' } })) {
      if (Date.now() > fim - 4000) break
      try {
        const prep = await comTrava(`preparar:${c.id}`, 2 * MIN, () => prepararCampanha(c.id, agora))
        if (prep.ok && prep.valor) {
          out.disparoPreparadas += 1
          // Recorrência: a execução nova já aprovada volta agendada sozinha.
          if ((c.preparo as { agendarDepois?: boolean } | null)?.agendarDepois) await transicionar(c.id, 'SCHEDULED', { de: ['READY'], motivo: 'Execução recorrente agendada' })
        }
      } catch (e) {
        logger.error({ err: e, campanhaId: c.id }, 'disparo: falha ao preparar')
        await prisma.disparoCampanha.update({ where: { id: c.id }, data: { erro: `Não foi possível preparar o público: ${String((e as Error)?.message ?? e).slice(0, 200)}` } })
        await transicionar(c.id, 'DRAFT', { de: ['VALIDATING'], motivo: 'Falha na preparação' }).catch(() => undefined)
      }
    }
    // 2) Agendadas que chegaram na hora.
    for (const c of await prisma.disparoCampanha.findMany({ where: { status: 'SCHEDULED', agendadaPara: { lte: agora } }, select: { id: true } })) await transicionar(c.id, 'QUEUED', { de: ['SCHEDULED'], motivo: 'Chegou a hora agendada' })
    // 3) Distribuição (fila → mensagens do 1º passo).
    for (const c of await prisma.disparoCampanha.findMany({ where: { status: 'QUEUED' }, select: { id: true }, orderBy: { atualizadoEm: 'asc' }, take: 50 })) {
      if (Date.now() > fim - 4000) break
      try { if (await distribuir(c.id, agora)) out.disparoIniciadas += 1 } catch (e) { logger.error({ err: e, campanhaId: c.id }, 'disparo: falha ao distribuir') }
    }
    // 3b) Estratégias contínuas: quem entrou no público (ex.: mudou de etapa no CRM) entra na fila.
    await alimentarContinuas(fim, agora).catch(e => logger.error({ err: e }, 'disparo: estratégias contínuas'))
    // 4) Reconciliação do que ficou sem resposta.
    const rec = await comTrava('reconciliar', 60_000, () => reconciliar(agora))
    out.disparoReconciliadas = rec.ok ? rec.valor.reconciliadas : 0
    // 5) Envio, um laço por número remetente, em paralelo (cada número tem o próprio ritmo).
    const remetentes = await prisma.disparoMensagem.findMany({ where: { status: 'AGENDADA', enviarApos: { lte: new Date() }, campanha: { status: 'RUNNING' } }, distinct: ['assistenteId'], select: { assistenteId: true }, take: 20 })
    const rs = await Promise.all(remetentes.map(r => rodarRemetente(r.assistenteId, fim).catch(e => { logger.error({ err: e }, 'disparo: falha no remetente'); return { enviadas: 0, falhas: 1, puladas: 0, semConexao: false } })))
    for (const r of rs) { out.disparoEnviadas += r.enviadas; out.disparoFalhas += r.falhas }
    // 6) Conclusão.
    out.disparoConcluidas = await concluirTerminadas(new Date())
    await registrarRodada(origem, { ...out })
    return out
  })
}

// ---------- Webhook: entregue, lida ----------

const ORDEM = ['ACEITA', 'ENTREGUE', 'LIDA']
/** Atualização de status vinda do provedor (só avança: aceita → entregue → lida). */
export async function atualizarStatusDoProvedor(itens: Array<{ providerId: string; status: string; instanteMs?: number | null }>): Promise<number> {
  let n = 0
  for (const it of itens) {
    const s = it.status.toUpperCase()
    const novo = s === 'DELIVERY_ACK' || s === 'DELIVERED' ? 'ENTREGUE' : s === 'READ' || s === 'PLAYED' ? 'LIDA' : null
    if (!novo) continue
    const m = await prisma.disparoMensagem.findUnique({ where: { providerId: it.providerId }, select: { id: true, status: true, entregueEm: true, campanhaId: true, destinatarioId: true, campanha: { select: { usuarioId: true } } } })
    if (!m || !ORDEM.includes(m.status) || ORDEM.indexOf(novo) <= ORDEM.indexOf(m.status)) continue
    const quando = it.instanteMs ? new Date(it.instanteMs) : new Date()
    await prisma.disparoMensagem.update({ where: { id: m.id }, data: { status: novo, ...(novo === 'ENTREGUE' ? { entregueEm: quando } : { lidaEm: quando, entregueEm: m.entregueEm ?? quando }) } })
    n += 1
  }
  return n
}

// ---------- Integração com o atendimento (eco e respostas) ----------

/** A mensagem "minha" que chegou pelo webhook foi o Disparo que mandou? (não é o vendedor escrevendo) */
export async function ehEcoDoDisparo(assistenteId: string, numero: string, texto: string, providerId: string | null): Promise<boolean> {
  if (providerId && await prisma.disparoMensagem.count({ where: { providerId } })) return true
  const tel = normalizarTelefone(numero)
  if (!tel) return false
  const recente = await prisma.disparoMensagem.findFirst({
    where: { assistenteId, status: { in: ['ENVIANDO', 'ACEITA', 'DESCONHECIDO'] }, atualizadoEm: { gte: new Date(Date.now() - 3 * MIN) }, destinatario: { telefone: tel } },
    select: { id: true, texto: true, providerId: true },
  })
  if (!recente) return false
  const igual = !texto.trim() || (recente.texto ?? '').trim().startsWith(texto.trim().slice(0, 60))
  if (igual && providerId && !recente.providerId) await prisma.disparoMensagem.update({ where: { id: recente.id }, data: { providerId } }).catch(() => undefined)
  return igual
}

/** Destinatário de campanha recente deste número (para a resposta entrar no CRM pelo caminho normal). */
export async function destinatarioRecente(assistenteId: string, numero: string) {
  const tel = normalizarTelefone(numero)
  if (!tel) return null
  return prisma.disparoDestinatario.findFirst({
    where: { telefone: tel, campanha: { assistenteId, iniciadaEm: { gte: new Date(Date.now() - 30 * 24 * 60 * MIN) } }, mensagens: { some: { status: { in: ['ACEITA', 'ENTREGUE', 'LIDA'] } } } },
    orderBy: { criadoEm: 'desc' },
    select: { id: true, campanhaId: true, usuarioId: true, leadId: true, vendedorId: true, nome: true, respondeuEm: true, status: true, campanha: { select: { nome: true, config: true, finalidade: true, criadoPorId: true } } },
  })
}

/**
 * Resposta de um contato que recebeu campanha: liga à campanha, para a sequência (padrão), põe as
 * mensagens da campanha no histórico da conversa do ARIES, cria o follow para o vendedor e avisa.
 * "SAIR" vira descadastro (revoga as promocionais). O lead e a conversa vêm do fluxo normal do ARIES.
 */
export async function registrarResposta(assistenteId: string, numero: string, texto: string, conversaId: string | null): Promise<boolean> {
  const d = await destinatarioRecente(assistenteId, numero)
  if (!d) return false
  const cfgLoja = await configDaLoja(d.usuarioId)
  const cfg = lerConfigEnvio(d.campanha.config, cfgLoja.envio)
  const agora = new Date()
  const conversa = conversaId ? await prisma.assistenteConversa.findUnique({ where: { id: conversaId }, select: { id: true, leadId: true } }) : null
  const primeira = !d.respondeuEm
  if (primeira) {
    await prisma.disparoDestinatario.update({ where: { id: d.id }, data: { respondeuEm: agora, respostaConversaId: conversa?.id ?? null, ...(cfg.pararAoResponder ? { status: 'RESPONDEU' } : {}), ...(conversa?.leadId && !d.leadId ? { leadId: conversa.leadId } : {}) } })
    if (cfg.pararAoResponder) await prisma.disparoMensagem.updateMany({ where: { destinatarioId: d.id, status: 'AGENDADA' }, data: { status: 'PULADA', ultimoErro: 'RESPONDEU' } })
  }
  await evento({ usuarioId: d.usuarioId, campanhaId: d.campanhaId, destinatarioId: d.id, tipo: 'RESPOSTA', descricao: texto.slice(0, 280), dados: { conversaId: conversa?.id ?? null } })
  // Histórico: as mensagens da campanha entram na conversa (antes da resposta), sem repetir.
  if (conversa) {
    const enviadas = await prisma.disparoMensagem.findMany({ where: { destinatarioId: d.id, status: { in: ['ACEITA', 'ENTREGUE', 'LIDA'] } }, select: { texto: true, providerId: true, aceitaEm: true, tipo: true } })
    if (enviadas.length) await prisma.assistenteMensagem.createMany({ data: enviadas.map(e => ({ conversaId: conversa.id, remetente: 'ASSISTENTE', origem: 'DISPARO', texto: `${e.texto ?? ''}${e.tipo !== 'TEXTO' ? ' [arquivo da campanha]' : ''}`.trim() || '[mensagem da campanha]', providerId: e.providerId, criadoEm: e.aceitaEm ?? agora, enviadaEm: e.aceitaEm ?? agora })), skipDuplicates: true }).catch(e => logger.warn({ err: e }, 'disparo: histórico da conversa'))
  }
  if (pedeParaSair(texto, cfgLoja.palavrasSair)) {
    await registrarAutorizacao({ usuarioId: d.usuarioId, telefone: numero, situacao: 'REVOGADO', origem: 'RESPOSTA_SAIR', evidencia: `Respondeu "${texto.slice(0, 120)}" à campanha "${d.campanha.nome}"`, leadId: conversa?.leadId ?? d.leadId, autorNome: 'Contato' })
    await evento({ usuarioId: d.usuarioId, campanhaId: d.campanhaId, destinatarioId: d.id, tipo: 'DESCADASTRO', descricao: 'Pediu para não receber mais mensagens promocionais' })
    return true
  }
  if (primeira) {
    const leadId = conversa?.leadId ?? d.leadId
    if (leadId) {
      const jaTem = await prisma.leadFollow.count({ where: { leadId, status: 'PENDENTE', tipo: 'CONTATO' } })
      if (!jaTem) await prisma.leadFollow.create({ data: { usuarioId: d.usuarioId, leadId, vendedorId: d.vendedorId, agendadoPara: agora, canal: 'WHATSAPP', nota: `Respondeu à campanha "${d.campanha.nome}": responder no WhatsApp`, contexto: { origem: 'DISPARO', campanhaId: d.campanhaId }, criadoPor: 'ARIES Disparo' } }).catch(e => logger.warn({ err: e }, 'disparo: follow da resposta'))
    }
    // A resposta é de quem fez a campanha e de quem recebeu no WhatsApp (o número que enviou).
    const dono = await prisma.assistenteComercial.findUnique({ where: { id: assistenteId }, select: { vendedorId: true } })
    for (const quem of avisadosDaResposta(d.campanha.criadoPorId, dono?.vendedorId ?? null)) {
      await avisarNoWhatsapp(d.usuarioId, quem, `💬 ${d.nome ?? 'Um contato'} respondeu à campanha "${d.campanha.nome}": "${texto.slice(0, 160)}"`).catch(e => logger.warn({ err: e }, 'disparo: aviso da resposta'))
    }
  }
  return true
}

/** Quem é avisado de uma resposta: o criador da campanha (null = dono) e quem recebeu no WhatsApp, sem repetir. */
export function avisadosDaResposta(criadoPorId: string | null, recebeuVendedorId: string | null): Array<string | null> {
  return [...new Set<string | null>([criadoPorId ?? null, ...(recebeuVendedorId && recebeuVendedorId !== criadoPorId ? [recebeuVendedorId] : [])])]
}

export const PADRAO = CONFIG_PADRAO

// ---------- Situação do envio agora (para a tela explicar o que está acontecendo) ----------

export type MotivoSituacao =
  | 'PREPARANDO' | 'AGENDADA' | 'NA_HORA' | 'NA_FILA' | 'ENVIANDO' | 'INTERVALO' | 'LIMITE_HORA' | 'LIMITE_DIA'
  | 'FORA_DA_JANELA' | 'SEM_CONEXAO' | 'ATENDIMENTO' | 'PAUSADA' | 'TERMINADA' | 'PARADA'
export interface SituacaoEnvio {
  motivo: MotivoSituacao
  titulo: string
  texto: string
  /** Quando a próxima mensagem deve sair (estimativa), se der para saber. */
  proximoEnvioEm: string | null
  motor: { ultimaRodadaEm: string | null; origem: OrigemRodada | null; ultimaRotinaEm: string | null; rotinaParada: boolean }
  /** Para os cronômetros da tela. */
  tempos: { iniciadaEm: string | null; primeiraEnviadaEm: string | null; ultimaEnviadaEm: string | null; enviadas: number; intervaloSeg: number | null }
  /** Como terminou a última rodada do número remetente. */
  remetente: { motivo: ParadaRemetente; em: string; erro?: string } | null
}

/** Primeiro minuto dentro da janela de envio a partir de agora (até 8 dias). */
export function proximaAbertura(j: ConfigEnvio['janela'], agora: Date): Date | null {
  const t = new Date(Math.ceil(agora.getTime() / MIN) * MIN)
  for (let i = 0; i < 8 * 24 * 60; i += 1) { if (dentroDaJanela(j, t)) return t; t.setTime(t.getTime() + MIN) }
  return null
}
const quando = (d: Date) => d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', hour: '2-digit', minute: '2-digit' })

export async function situacaoDoEnvio(campanhaId: string, agora = new Date()): Promise<SituacaoEnvio | null> {
  const c0 = await prisma.disparoCampanha.findUnique({ where: { id: campanhaId }, select: { usuarioId: true, status: true, agendadaPara: true, assistenteId: true, config: true, erro: true, iniciadaEm: true, canal: true } })
  if (!c0) return null
  // Instagram: o "remetente" é a conta da empresa.
  const ig = c0.canal === 'INSTAGRAM'
  const contaIg = ig ? await contaInstagramDaLoja(c0.usuarioId) : null
  const c = { ...c0, assistenteId: ig ? (contaIg ? remetenteInstagram(contaIg.id) : null) : c0.assistenteId }
  const quem = ig ? 'Esta conta do Instagram' : 'Este número'
  const [rod, prim, ult, enviadas, est, cfgLoja0] = await Promise.all([
    ultimasRodadas(),
    prisma.disparoMensagem.findFirst({ where: { campanhaId, aceitaEm: { not: null } }, orderBy: { aceitaEm: 'asc' }, select: { aceitaEm: true } }),
    prisma.disparoMensagem.findFirst({ where: { campanhaId, aceitaEm: { not: null } }, orderBy: { aceitaEm: 'desc' }, select: { aceitaEm: true } }),
    prisma.disparoMensagem.count({ where: { campanhaId, aceitaEm: { not: null } } }),
    c.assistenteId ? prisma.disparoTrava.findUnique({ where: { chave: `estado:remetente:${c.assistenteId}` }, select: { dados: true } }) : null,
    configDaLoja(c.usuarioId),
  ])
  const tempos = { iniciadaEm: c.iniciadaEm?.toISOString() ?? null, primeiraEnviadaEm: prim?.aceitaEm?.toISOString() ?? null, ultimaEnviadaEm: ult?.aceitaEm?.toISOString() ?? null, enviadas, intervaloSeg: lerConfigEnvio(c.config, cfgLoja0.envio).intervaloSeg }
  const remetente = (est?.dados ?? null) as SituacaoEnvio['remetente']
  const ultimaRotinaEm = rod.rotina?.em ?? null
  // Rotina automática parada: nenhuma rodada da rotina nos últimos 10 min.
  const rotinaParada = !ultimaRotinaEm || agora.getTime() - new Date(ultimaRotinaEm).getTime() > 10 * MIN
  const motor = { ultimaRodadaEm: rod.qualquer?.em ?? null, origem: rod.qualquer?.origem ?? null, ultimaRotinaEm, rotinaParada }
  const s = (motivo: MotivoSituacao, titulo: string, texto: string, proximo: Date | null = null): SituacaoEnvio => ({ motivo, titulo, texto, proximoEnvioEm: proximo?.toISOString() ?? null, motor, tempos, remetente })
  const st = c.status as StatusCampanha
  if (st === 'PAUSED') return s('PAUSADA', 'Pausada', 'Nenhuma mensagem nova sai até você clicar em “Retomar”.')
  if (['COMPLETED', 'COMPLETED_WITH_ERRORS', 'CANCELLED', 'ARCHIVED'].includes(st)) return s('TERMINADA', 'Terminada', 'Esta campanha não envia mais nada.')
  if (['DRAFT', 'NEEDS_REVIEW', 'READY'].includes(st)) return s('PARADA', 'Ainda não começou', st === 'READY' ? 'Pronta: clique em “Iniciar agora” ou confirme o agendamento.' : st === 'NEEDS_REVIEW' ? 'Esperando a aprovação do dono ou de um supervisor.' : 'Rascunho: prepare o público para revisar.')
  if (st === 'VALIDATING') return s('PREPARANDO', 'Preparando o público', 'O ARIES está montando a lista de quem recebe. Leva segundos.')
  if (st === 'SCHEDULED') {
    if (c.agendadaPara && c.agendadaPara > agora) return s('AGENDADA', 'Agendada', `Começa ${quando(c.agendadaPara)}.`, c.agendadaPara)
    return s('NA_HORA', 'Chegou a hora', 'Entra na fila na próxima rodada do envio.', agora)
  }
  if (st === 'QUEUED') return s('NA_FILA', 'Na fila', 'As mensagens são criadas na próxima rodada do envio e a primeira sai em seguida.', agora)
  // RUNNING
  const cfgLoja = await configDaLoja(c.usuarioId)
  const cfg = lerConfigEnvio(c.config, cfgLoja.envio)
  if (c.erro) return ig
    ? s('SEM_CONEXAO', 'Parada: Instagram sem acesso', `${c.erro}. Reconecte o Instagram da empresa em Social Media › Conexão; o envio continua sozinho quando o acesso voltar.`)
    : s('SEM_CONEXAO', 'Parada: número sem conexão', `${c.erro}. Conecte o WhatsApp do remetente em Conversas › Conexão; o envio continua sozinho quando a conexão voltar.`)
  if (!dentroDaJanela(cfg.janela, agora)) {
    const abre = proximaAbertura(cfg.janela, agora)
    return s('FORA_DA_JANELA', 'Fora do horário de envio', `A campanha só envia ${cfg.janela.inicio}–${cfg.janela.fim} (horário de Brasília) nos dias escolhidos.${abre ? ` Volta ${quando(abre)}.` : ''}`, abre)
  }
  if (!c.assistenteId) return ig ? s('SEM_CONEXAO', 'Instagram não conectado', 'Conecte o Instagram da empresa em Social Media › Conexão.') : s('SEM_CONEXAO', 'Sem número remetente', 'Escolha o número que vai enviar a campanha.')
  // O que aconteceu na última rodada deste número (últimos 2 min).
  const recente = remetente && agora.getTime() - new Date(remetente.em).getTime() < 2 * MIN
  if (recente && remetente!.motivo === 'ERRO') return s('SEM_CONEXAO', 'Erro na última tentativa', `O envio deu erro: ${remetente!.erro ?? 'sem detalhe'}. O ARIES tenta de novo na próxima rodada.`)
  if (recente && remetente!.motivo === 'SEM_CONEXAO' && ig) return s('SEM_CONEXAO', 'Instagram sem acesso', `${remetente!.erro ?? 'A Meta recusou o envio'}. Nenhuma mensagem foi perdida: elas esperam na fila.`)
  if (recente && remetente!.motivo === 'LIMITE' && ig) return s('LIMITE_HORA', 'Limite da Meta', `O Instagram limita mensagens automáticas por hora: o Disparo continua sozinho em alguns minutos (até ${MAX_POR_HORA_INSTAGRAM} por hora).`)
  if (recente && remetente!.motivo === 'SEM_CONEXAO') return s('SEM_CONEXAO', 'WhatsApp do remetente sem conexão', 'A conexão do WhatsApp deste número caiu no servidor (Connection Closed). O ARIES tenta religar sozinho (no máximo a cada 5 min) e continua de onde parou. Se não voltar, reconecte o número em Conversas › Conexão (ler o QR de novo). Nenhuma mensagem foi perdida: elas esperam na fila.')
  if (recente && remetente!.motivo === 'ATENDIMENTO') return s('ATENDIMENTO', 'Esperando o atendimento', `O WhatsApp deste número está em conversa com cliente agora. O disparo espera ${SILENCIO_ATENDIMENTO_MS / 1000} s sem mensagens de atendimento e envia em seguida (o atendimento tem prioridade).`, new Date(agora.getTime() + SILENCIO_ATENDIMENTO_MS))
  const pendentes = await prisma.disparoMensagem.findFirst({ where: { campanhaId, status: 'AGENDADA' }, orderBy: { enviarApos: 'asc' }, select: { enviarApos: true, proximaTentativaEm: true } })
  if (!pendentes) return s('ENVIANDO', 'Finalizando', 'Não há mais mensagens na fila: a campanha conclui na próxima rodada.')
  const [ultima, hora, dia] = await Promise.all([
    prisma.disparoMensagem.findFirst({ where: { assistenteId: c.assistenteId, aceitaEm: { not: null } }, orderBy: { aceitaEm: 'desc' }, select: { aceitaEm: true } }),
    prisma.disparoMensagem.count({ where: { assistenteId: c.assistenteId, aceitaEm: { gte: new Date(agora.getTime() - 60 * MIN) } } }),
    prisma.disparoMensagem.count({ where: { assistenteId: c.assistenteId, aceitaEm: { gte: new Date(agora.getTime() - 24 * 60 * MIN) } } }),
  ])
  if (dia >= cfg.maxPorDia) return s('LIMITE_DIA', 'Limite do dia atingido', `${quem} já enviou ${dia} mensagens nas últimas 24 h (limite ${cfg.maxPorDia}). Continua sozinho quando o limite liberar.`)
  const maxHora = ig ? Math.min(cfg.maxPorHora, MAX_POR_HORA_INSTAGRAM) : cfg.maxPorHora
  if (hora >= maxHora) return s('LIMITE_HORA', 'Limite da hora atingido', `${quem} já enviou ${hora} mensagens na última hora (limite ${maxHora}). Continua sozinho em alguns minutos.`)
  const proximoPorRitmo = ultima?.aceitaEm ? new Date(ultima.aceitaEm.getTime() + cfg.intervaloSeg * 1000) : agora
  const prox = new Date(Math.max(proximoPorRitmo.getTime(), pendentes.enviarApos.getTime(), pendentes.proximaTentativaEm?.getTime() ?? 0, agora.getTime()))
  if (prox.getTime() - agora.getTime() > 1000) return s('INTERVALO', 'Enviando com intervalo', `Uma mensagem de cada vez, com pelo menos ${cfg.intervaloSeg} s entre elas, para proteger ${ig ? 'a conta' : 'o número'}.${ig ? ' Cada pessoa só recebe dentro da janela da Meta.' : ''}`, prox)
  return s('ENVIANDO', 'Enviando', 'A próxima mensagem sai na próxima rodada do envio.', prox)
}
