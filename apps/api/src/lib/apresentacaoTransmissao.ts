// Transmissão ao vivo das apresentações (aba Reuniões).
//
// A API roda em função serverless (sem WebSocket nem processo fixo), então
// "ao vivo" funciona assim: cada espectador mantém uma conexão de eventos
// (SSE) aberta por ~25s e reabre em seguida; enquanto ela está aberta, o
// servidor confere o banco a cada ~300ms e empurra o que mudou. Um
// "observador" só por apresentação e por instância da função atende todos
// os espectadores conectados nela — com 10 pessoas assistindo, é uma
// consulta a cada 300ms, não dez.

import { prisma } from './prisma'
import { logger } from './logger'

export const INTERVALO_OBSERVACAO_MS = 150
// Sem sinal do apresentador (a tela dele manda um a cada ~15s) por mais
// que isso, a transmissão conta como encerrada — cobre fechar a aba sem
// clicar em "Encerrar".
export const SINAL_APRESENTADOR_MS = 90_000

export interface ConteudoApresentacao {
  titulo: string
  descricao: string | null
  icone: string | null
  arvore: unknown
  configuracao: unknown
  notas: unknown
  lembretes: unknown
}

export type EventoTransmissao =
  | { tipo: 'conteudo'; versao: number; conteudo: ConteudoApresentacao }
  | { tipo: 'palco'; palcoVersao: number; palco: unknown }
  | { tipo: 'status'; aoVivo: boolean }

export function aoVivoEfetivo(a: { aoVivo: boolean; apresentadorSinalEm: Date | null }): boolean {
  return a.aoVivo && !!a.apresentadorSinalEm && Date.now() - a.apresentadorSinalEm.getTime() < SINAL_APRESENTADOR_MS
}

export const CONTEUDO_SELECT = { titulo: true, descricao: true, icone: true, arvore: true, configuracao: true, notas: true, lembretes: true } as const

interface Inscrito {
  versao: number
  palcoVersao: number
  aoVivo: boolean
  enviar: (e: EventoTransmissao) => void
}

interface Sala {
  inscritos: Set<Inscrito>
  timer: ReturnType<typeof setInterval> | null
  ocupado: boolean
  // Chegou aviso de mudança enquanto uma consulta já estava em andamento:
  // roda de novo assim que ela terminar, sem esperar o próximo ciclo.
  deNovo: boolean
}

const salas = new Map<string, Sala>()

async function observar(id: string, sala: Sala) {
  if (sala.ocupado || sala.inscritos.size === 0) return
  sala.ocupado = true
  try {
    const atual = await prisma.apresentacao.findUnique({
      where: { id },
      select: { versao: true, palcoVersao: true, palco: true, aoVivo: true, apresentadorSinalEm: true },
    })
    if (!atual) return
    const inscritos = [...sala.inscritos]
    const aoVivo = aoVivoEfetivo(atual)

    if (inscritos.some(i => i.versao < atual.versao)) {
      const c = await prisma.apresentacao.findUnique({ where: { id }, select: { ...CONTEUDO_SELECT, versao: true } })
      if (c) {
        const { versao, ...conteudo } = c
        for (const i of inscritos) {
          if (i.versao < versao) { i.versao = versao; i.enviar({ tipo: 'conteudo', versao, conteudo }) }
        }
      }
    }
    for (const i of inscritos) {
      if (i.palcoVersao < atual.palcoVersao) { i.palcoVersao = atual.palcoVersao; i.enviar({ tipo: 'palco', palcoVersao: atual.palcoVersao, palco: atual.palco }) }
      if (i.aoVivo !== aoVivo) { i.aoVivo = aoVivo; i.enviar({ tipo: 'status', aoVivo }) }
    }
  } catch (e) {
    logger.warn({ err: e, apresentacaoId: id }, 'apresentação: falha ao observar')
  } finally {
    sala.ocupado = false
    if (sala.deNovo) { sala.deNovo = false; void observar(id, sala) }
  }
}

// Chamado logo depois que o apresentador grava algo: se espectadores
// dessa apresentação estão conectados nesta mesma instância da função,
// eles recebem na hora, sem esperar o próximo ciclo de observação.
export function sinalizarMudanca(id: string): void {
  const sala = salas.get(id)
  if (!sala) return
  if (sala.ocupado) { sala.deNovo = true; return }
  void observar(id, sala)
}

// Inscreve um espectador. `inicial` é o que ele já recebeu (lido do banco
// na conexão) — só chega evento mais novo que isso. Devolve a função que
// cancela a inscrição.
export function inscreverEspectador(id: string, inicial: Omit<Inscrito, 'enviar'>, enviar: Inscrito['enviar']): () => void {
  let sala = salas.get(id)
  if (!sala) {
    sala = { inscritos: new Set(), timer: null, ocupado: false, deNovo: false }
    salas.set(id, sala)
  }
  const inscrito: Inscrito = { ...inicial, enviar }
  sala.inscritos.add(inscrito)
  const s = sala
  if (!s.timer) s.timer = setInterval(() => { void observar(id, s) }, INTERVALO_OBSERVACAO_MS)
  return () => {
    s.inscritos.delete(inscrito)
    if (s.inscritos.size === 0) {
      if (s.timer) clearInterval(s.timer)
      salas.delete(id)
    }
  }
}

// Presença: renovada a cada conexão/consulta, no máximo a cada 15s por
// pessoa (evita uma escrita no banco a cada consulta do modo reserva).
const ultimoSinalRegistrado = new Map<string, number>()

export async function registrarPresenca(apresentacaoId: string, pessoa: string, nome: string): Promise<void> {
  const chave = `${apresentacaoId}|${pessoa}`
  const agora = Date.now()
  if (agora - (ultimoSinalRegistrado.get(chave) ?? 0) < 15_000) return
  ultimoSinalRegistrado.set(chave, agora)
  try {
    await prisma.apresentacaoEspectador.upsert({
      where: { apresentacaoId_pessoa: { apresentacaoId, pessoa } },
      update: { ultimoSinalEm: new Date(), nome },
      create: { apresentacaoId, pessoa, nome },
    })
  } catch (e) {
    ultimoSinalRegistrado.delete(chave)
    logger.warn({ err: e }, 'apresentação: falha ao registrar presença')
  }
}
