// Melhores janelas de publicação (seções 5 e 6 da especificação): dia da
// semana + faixa de 3 h, horário de Brasília, a partir do alcance dos posts
// do feed nos últimos 90 dias. Usado no checklist da Produção ("horário
// dentro da janela") e no painel do Calendário.
//
// Regras de qualidade (seção 13.2): uma janela só entra com 3 posts ou mais;
// com 5 ou mais é "Comprovada". Sem posts suficientes, cai para o pico de
// seguidores online que o próprio Instagram informa, marcado como tal.
import { prisma } from './prisma'
import { horasEmTeste } from './smTestes'

const OFFSET_BRASILIA_MS = 3 * 60 * 60 * 1000
const DIAS_HISTORICO = 90
export const MIN_POSTS_JANELA = 3
export const POSTS_COMPROVADA = 5
const MAX_JANELAS = 5

export interface Janela {
  dia: number // 0 = domingo
  bloco: number // 0 = 0h-3h ... 7 = 21h-24h
  inicioHora: number
  fimHora: number
  posts: number
  alcanceMedio: number
  indice: number // alcance médio da janela / mediana dos posts
  status: 'COMPROVADA' | 'PROMISSORA' | 'SEGUIDORES_ONLINE'
  /** Há um teste A/B de horário em andamento com uma hora nesta janela (seção 5). */
  emTeste?: boolean
}

export interface JanelasResultado {
  base: 'POSTS' | 'SEGUIDORES_ONLINE' | 'SEM_DADOS'
  amostra: number
  janelas: Janela[]
}

export function diaEBloco(instante: Date): { dia: number; bloco: number } {
  const local = new Date(instante.getTime() - OFFSET_BRASILIA_MS)
  return { dia: local.getUTCDay(), bloco: Math.floor(local.getUTCHours() / 3) }
}

const mediana = (v: number[]) => {
  if (!v.length) return 0
  const s = [...v].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export async function melhoresJanelas(usuarioId: string, agora = new Date()): Promise<JanelasResultado> {
  const [r, horas] = await Promise.all([calcularJanelas(usuarioId, agora), horasEmTeste(usuarioId)])
  if (!horas.length) return r
  return { ...r, janelas: r.janelas.map(j => ({ ...j, emTeste: horas.some(h => h >= j.inicioHora && h < j.fimHora) })) }
}

async function calcularJanelas(usuarioId: string, agora: Date): Promise<JanelasResultado> {
  const conta = await prisma.socialMediaConta.findUnique({ where: { titular: `dono:${usuarioId}` }, select: { id: true, seguidoresOnline: true } })
  if (!conta) return { base: 'SEM_DADOS', amostra: 0, janelas: [] }
  const desde = new Date(agora.getTime() - DIAS_HISTORICO * 24 * 3600 * 1000)
  const posts = await prisma.socialMediaMidia.findMany({
    where: { contaId: conta.id, publicadoEm: { gte: desde }, NOT: { formato: { in: ['STORY', 'AD'] } }, alcance: { gt: 0 } },
    select: { publicadoEm: true, alcance: true },
  })
  const med = mediana(posts.map(p => p.alcance))
  const grupos = new Map<string, { dia: number; bloco: number; alcances: number[] }>()
  for (const p of posts) {
    const { dia, bloco } = diaEBloco(p.publicadoEm)
    const k = `${dia}-${bloco}`
    const g = grupos.get(k) ?? { dia, bloco, alcances: [] }
    g.alcances.push(p.alcance)
    grupos.set(k, g)
  }
  const janelas = [...grupos.values()]
    .filter(g => g.alcances.length >= MIN_POSTS_JANELA)
    .map(g => {
      const alcanceMedio = g.alcances.reduce((s, x) => s + x, 0) / g.alcances.length
      return {
        dia: g.dia, bloco: g.bloco, inicioHora: g.bloco * 3, fimHora: g.bloco * 3 + 3,
        posts: g.alcances.length, alcanceMedio: Math.round(alcanceMedio),
        indice: med > 0 ? alcanceMedio / med : 0,
        status: g.alcances.length >= POSTS_COMPROVADA ? 'COMPROVADA' as const : 'PROMISSORA' as const,
      }
    })
    .filter(j => j.indice >= 1)
    .sort((a, b) => b.indice - a.indice || b.posts - a.posts)
    .slice(0, MAX_JANELAS)
  if (janelas.length) return { base: 'POSTS', amostra: posts.length, janelas }

  // Sem histórico suficiente: o pico de seguidores online (média por hora,
  // horário de Brasília) vale para todos os dias, marcado como tal.
  const online = conta.seguidoresOnline as Record<string, number> | null
  if (online && typeof online === 'object') {
    const porBloco = Array.from({ length: 8 }, (_, b) => [0, 1, 2].reduce((s, i) => s + (Number(online[String(b * 3 + i)]) || 0), 0))
    const melhor = porBloco.indexOf(Math.max(...porBloco))
    if (porBloco[melhor] > 0) {
      return {
        base: 'SEGUIDORES_ONLINE',
        amostra: posts.length,
        janelas: [1, 2, 3, 4, 5].map(dia => ({ dia, bloco: melhor, inicioHora: melhor * 3, fimHora: melhor * 3 + 3, posts: 0, alcanceMedio: 0, indice: 0, status: 'SEGUIDORES_ONLINE' as const })),
      }
    }
  }
  return { base: 'SEM_DADOS', amostra: posts.length, janelas: [] }
}

export function dentroDaJanela(instante: Date, j: JanelasResultado): boolean | null {
  if (j.base === 'SEM_DADOS') return null
  const { dia, bloco } = diaEBloco(instante)
  return j.janelas.some(x => x.dia === dia && x.bloco === bloco)
}
