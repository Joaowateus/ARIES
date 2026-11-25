// Saúde da conexão do WhatsApp de cada vendedor (Evolution/Baileys).
//
// Antes o ARIES só olhava "open"/"close" e alternava CONECTADO/DESCONECTADO a cada aviso: com a sessão
// corrompida ou o número aberto em dois lugares, o servidor fica caindo e religando sozinho, a tela
// pisca entre conectado e caído e nada sai. Agora cada aviso é guardado com o MOTIVO da queda
// (statusReason do Baileys) e o estado só muda quando o motivo pede:
//   401 desconectado pelo celular · 403 bloqueado · 411/500 sessão inválida  → SESSAO_CAIDA (precisa QR)
//   440 o número foi aberto em outro lugar (conflito), repetido              → SESSAO_CAIDA (CONFLITO)
//   quedas seguidas (6 em 30 min) mesmo que "passageiras"                    → SESSAO_CAIDA (INSTAVEL)
//   428/408/515/503 queda passageira: o servidor religa sozinho              → só registra
import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { logger } from './logger'

export interface EventoConexao { em: string; estado: string; motivo: number | null }
const MAX_EVENTOS = 30
const MIN = 60_000

export const MOTIVOS_QUEDA: Record<number, { texto: string; precisaQr: boolean }> = {
  401: { texto: 'desconectado pelo celular (o aparelho conectado foi removido no WhatsApp)', precisaQr: true },
  403: { texto: 'o WhatsApp recusou este número (pode estar bloqueado)', precisaQr: true },
  411: { texto: 'sessão incompatível com o aparelho', precisaQr: true },
  500: { texto: 'sessão corrompida no servidor', precisaQr: true },
  440: { texto: 'o número foi aberto em outro lugar (outra conexão derrubou esta)', precisaQr: false },
  428: { texto: 'a conexão fechou (o servidor religa sozinho)', precisaQr: false },
  408: { texto: 'a conexão caiu por falta de resposta (internet do celular ou do servidor)', precisaQr: false },
  515: { texto: 'reinício pedido pelo WhatsApp (normal; religa sozinho)', precisaQr: false },
  503: { texto: 'o WhatsApp ficou indisponível por um momento', precisaQr: false },
}
export const textoDoMotivo = (m: number | null | undefined) => (m != null && MOTIVOS_QUEDA[m] ? MOTIVOS_QUEDA[m].texto : m != null ? `queda com código ${m}` : 'queda sem motivo informado')
export const ROTULO_MOTIVO_QUEDA: Record<string, string> = {
  CONFLITO: 'O número está aberto em outra conexão ao mesmo tempo (outro WhatsApp Web/servidor): uma derruba a outra. Desconecte os outros aparelhos no celular e leia o QR de novo.',
  INSTAVEL: 'A conexão caiu e religou várias vezes seguidas: a sessão está instável. Leia o QR de novo.',
  ENVIO_FALHOU: 'O número aparecia conectado, mas não enviava (Connection Closed) mesmo depois de reiniciar.',
}

/** Registra um aviso de conexão e decide o estado. Devolve 'CONECTAR' quando é para marcar conectado. */
export async function registrarEventoConexao(a: { id: string; status: string; eventosConexao: Prisma.JsonValue | null }, estado: string, motivo: number | null): Promise<'CONECTAR' | 'NADA'> {
  const agora = new Date()
  const eventos = [...((a.eventosConexao as unknown as EventoConexao[] | null) ?? []), { em: agora.toISOString(), estado, motivo }].slice(-MAX_EVENTOS)
  const dados: Prisma.AssistenteComercialUpdateInput = { eventosConexao: eventos as unknown as Prisma.InputJsonValue }
  let decisao: 'CONECTAR' | 'NADA' = 'NADA'
  if (estado === 'open') {
    // "Precisa reconectar" só sai com QR novo (AGUARDANDO_QR → open), não com o servidor religando sozinho.
    if (a.status !== 'SESSAO_CAIDA') decisao = 'CONECTAR'
  } else if (estado === 'close') {
    const desde = agora.getTime() - 30 * MIN
    const recentes = eventos.filter(e => e.estado === 'close' && new Date(e.em).getTime() >= desde)
    const conflitos = recentes.filter(e => e.motivo === 440 && new Date(e.em).getTime() >= agora.getTime() - 15 * MIN).length
    let queda: string | null = null
    if (motivo != null && MOTIVOS_QUEDA[motivo]?.precisaQr) queda = String(motivo)
    else if (conflitos >= 2) queda = 'CONFLITO'
    else if (recentes.length >= 6) queda = 'INSTAVEL'
    if (queda && ['CONECTADO', 'DESCONECTADO'].includes(a.status)) { dados.status = 'SESSAO_CAIDA'; dados.motivoQueda = queda }
    else if (queda && a.status === 'SESSAO_CAIDA') dados.motivoQueda = queda
  }
  await prisma.assistenteComercial.update({ where: { id: a.id }, data: dados }).catch(e => logger.warn({ err: e }, 'whatsapp: não gravou o evento de conexão'))
  return decisao
}

/** Texto do motivo da queda guardado (código do WhatsApp ou um dos rótulos). */
export function explicarQueda(motivo: string | null | undefined): string | null {
  if (!motivo) return null
  if (ROTULO_MOTIVO_QUEDA[motivo]) return ROTULO_MOTIVO_QUEDA[motivo]
  const n = Number(motivo)
  return Number.isFinite(n) ? `Caiu: ${textoDoMotivo(n)}.` : motivo
}

/** Resumo dos últimos eventos: quantas quedas, quantas reconexões e o motivo mais comum. */
export function resumoEventos(eventos: EventoConexao[] | null | undefined, agora = new Date(), janelaMin = 60) {
  const lista = (eventos ?? []).filter(e => new Date(e.em).getTime() >= agora.getTime() - janelaMin * MIN)
  const quedas = lista.filter(e => e.estado === 'close')
  const motivos = new Map<number | null, number>()
  for (const q of quedas) motivos.set(q.motivo, (motivos.get(q.motivo) ?? 0) + 1)
  const comum = [...motivos.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  return { quedas: quedas.length, aberturas: lista.filter(e => e.estado === 'open').length, motivoComum: quedas.length ? comum : null }
}
