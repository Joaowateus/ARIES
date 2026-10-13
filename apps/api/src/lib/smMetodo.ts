// Método do Social Media: a cadência "três posts, três vezes ao dia" (Topo,
// Meio e Fundo em cada turno: manhã, tarde e noite) e a escada do desejo.
// Horário de Brasília/Belém (UTC-3). Aqui entram todos os formatos, stories
// inclusive: a cadência do método conta cada publicação do dia.
import { prisma } from './prisma'
import { FORMATO_DO_INSTAGRAM, diaLocal } from './smCalendario'

const OFFSET_MS = 3 * 3600 * 1000
const DIA_MS = 24 * 3600 * 1000

export const ETAPAS_FUNIL = ['TOPO', 'MEIO', 'FUNDO'] as const
export type EtapaFunil = (typeof ETAPAS_FUNIL)[number]
export const TURNOS = ['MANHA', 'TARDE', 'NOITE'] as const
export type Turno = (typeof TURNOS)[number]

/** Pauta sem etapa marcada: a etapa mais provável pelo pilar. */
export const ETAPA_DO_PILAR: Record<string, EtapaFunil> = { EDUCACAO: 'TOPO', BASTIDORES: 'MEIO', PROVA: 'MEIO', ESTOQUE: 'FUNDO' }

/** Manhã até 11h59, tarde até 17h59, noite das 18h às 4h59 (madrugada conta como a noite). */
export function turnoDoInstante(instante: Date): Turno {
  const h = new Date(instante.getTime() - OFFSET_MS).getUTCHours()
  if (h >= 5 && h < 12) return 'MANHA'
  if (h >= 12 && h < 18) return 'TARDE'
  return 'NOITE'
}

const inicioDoDia = (dia: string) => new Date(Date.parse(`${dia}T00:00:00Z`) + OFFSET_MS)
const somarDias = (dia: string, n: number) => new Date(Date.parse(`${dia}T00:00:00Z`) + n * DIA_MS).toISOString().slice(0, 10)

export interface PostDaCadencia {
  id: string
  tipo: 'PAUTA' | 'INSTAGRAM'
  titulo: string
  formato: string
  status: string
  hora: string
  turno: Turno
  /** null: post do Instagram sem pauta, sem como saber a etapa. */
  etapa: EtapaFunil | null
  /** A etapa veio do pilar, não foi marcada na pauta. */
  estimada: boolean
}

export interface DiaDaCadencia {
  data: string
  hoje: boolean
  passado: boolean
  /** Turno × etapa com pelo menos um post (de 0 a 9). */
  preenchidos: number
  posts: number
  /** Cada turno com as três etapas: os posts que ocupam a vaga. */
  turnos: Array<{ turno: Turno; etapas: Record<EtapaFunil, PostDaCadencia[]>; semEtapa: PostDaCadencia[] }>
}

/** Monta os dias com as vagas preenchidas (função pura, testável sem banco). */
export function montarCadencia(posts: Array<PostDaCadencia & { data: string }>, dias: string[], hoje: string): DiaDaCadencia[] {
  return dias.map(data => {
    const doDia = posts.filter(p => p.data === data)
    const turnos = TURNOS.map(turno => {
      const noTurno: PostDaCadencia[] = doDia.filter(p => p.turno === turno).map(({ data: _data, ...p }) => p)
      const etapas: Record<EtapaFunil, PostDaCadencia[]> = { TOPO: [], MEIO: [], FUNDO: [] }
      for (const p of noTurno) if (p.etapa) etapas[p.etapa].push(p)
      return { turno, etapas, semEtapa: noTurno.filter(p => p.etapa == null) }
    })
    const preenchidos = turnos.reduce((s, t) => s + ETAPAS_FUNIL.filter(e => t.etapas[e].length > 0).length, 0)
    return { data, hoje: data === hoje, passado: data < hoje, preenchidos, posts: doDia.length, turnos }
  })
}

const horaLocal = (d: Date) => new Date(d.getTime() - OFFSET_MS).toISOString().slice(11, 16)

/** Cadência dos últimos 7 dias, hoje e os próximos 7. */
export async function cadenciaDoPerfil(usuarioId: string, agora = new Date()) {
  const hoje = diaLocal(agora)
  const dias = Array.from({ length: 15 }, (_, i) => somarDias(hoje, i - 7))
  const inicio = inicioDoDia(dias[0])
  const fim = inicioDoDia(somarDias(dias[dias.length - 1], 1))
  const conta = await prisma.socialMediaConta.findUnique({ where: { titular: `dono:${usuarioId}` }, select: { id: true } })
  const [pautas, midias] = await Promise.all([
    prisma.smPauta.findMany({
      where: { usuarioId, OR: [{ agendadoPara: { gte: inicio, lt: fim } }, { publicadaEm: { gte: inicio, lt: fim } }] },
      select: { id: true, titulo: true, pilar: true, formato: true, status: true, etapaFunil: true, agendadoPara: true, publicadaEm: true, igMediaId: true },
    }),
    conta
      ? prisma.socialMediaMidia.findMany({
        where: { contaId: conta.id, publicadoEm: { gte: inicio, lt: fim }, NOT: { formato: 'AD' } },
        select: { id: true, instagramMediaId: true, legenda: true, formato: true, tipo: true, publicadoEm: true },
      })
      : Promise.resolve([]),
  ])
  const daPauta = new Set(pautas.map(p => p.igMediaId).filter(Boolean))
  const posts: Array<PostDaCadencia & { data: string }> = [
    ...pautas.flatMap(p => {
      const quando = (p.status === 'PUBLICADO' ? p.publicadaEm : p.agendadoPara) ?? p.agendadoPara ?? p.publicadaEm
      if (!quando || quando < inicio || quando >= fim) return []
      const etapa = (p.etapaFunil as EtapaFunil | null) ?? ETAPA_DO_PILAR[p.pilar] ?? null
      return [{ id: p.id, tipo: 'PAUTA' as const, titulo: p.titulo, formato: p.formato, status: p.status, hora: horaLocal(quando), turno: turnoDoInstante(quando), etapa, estimada: !p.etapaFunil, data: diaLocal(quando) }]
    }),
    ...midias.filter(m => !daPauta.has(m.instagramMediaId)).map(m => {
      const legenda = (m.legenda ?? '').replace(/\s+/g, ' ').trim()
      return {
        id: m.id, tipo: 'INSTAGRAM' as const, titulo: legenda ? (legenda.length > 60 ? `${legenda.slice(0, 57)}…` : legenda) : 'Post sem legenda',
        formato: FORMATO_DO_INSTAGRAM(m.formato, m.tipo),
        status: 'PUBLICADO', hora: horaLocal(m.publicadoEm), turno: turnoDoInstante(m.publicadoEm), etapa: null, estimada: false, data: diaLocal(m.publicadoEm),
      }
    }),
  ].sort((a, b) => a.data.localeCompare(b.data) || a.hora.localeCompare(b.hora))
  const lista = montarCadencia(posts, dias, hoje)
  const passados = lista.filter(d => d.passado)
  return {
    hoje,
    dias: lista,
    /** Últimos 7 dias: quantas das 63 vagas (7 × 9) foram ocupadas. */
    aderencia7d: { preenchidos: passados.reduce((s, d) => s + d.preenchidos, 0), total: passados.length * 9, diasCompletos: passados.filter(d => d.preenchidos === 9).length },
  }
}

export const DEGRAUS_ESCADA = [
  { n: 1, nome: 'Conhecido', texto: 'Todo mundo te conhece.' },
  { n: 2, nome: 'Reconhecido', texto: 'As pessoas te reconhecem por algo.' },
  { n: 3, nome: 'Respeitado', texto: 'A opinião do perfil começa a pesar.' },
  { n: 4, nome: 'Admirado', texto: 'Quem admira esse estilo ainda é muito pouca gente.' },
  { n: 5, nome: 'Desejado', texto: 'A barreira para vender mais e converter mais.' },
  { n: 6, nome: 'Idolatrado', texto: 'O risco: herói por tanto tempo até virar vilão.' },
] as const
