// Uso do sistema mantém viva a visita do motor de saudação (seção 14): uma
// visita nova só começa depois de 30 min sem atividade. Vale para páginas
// abertas e ações (não para as atualizações automáticas das listas), com no
// máximo uma gravação por minuto por pessoa.
import { prisma } from './prisma'

export const INATIVIDADE_MS = 30 * 60_000
const ultimoToque = new Map<string, number>()

export function marcarAtividade(usuarioId: string, ator: string, agora = Date.now()) {
  const chave = `${usuarioId}:${ator}`
  if (agora - (ultimoToque.get(chave) ?? 0) < 60_000) return
  ultimoToque.set(chave, agora)
  prisma.smVisita.updateMany({ where: { usuarioId, ator, ultimaAtividadeEm: { gte: new Date(agora - INATIVIDADE_MS) } }, data: { ultimaAtividadeEm: new Date(agora) } }).catch(() => undefined)
}
