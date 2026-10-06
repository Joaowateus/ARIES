// Estoque leve do Social Media (decisão P3): dias na loja, posts e status
// para as pautas de estoque. Nunca custo nem margem.
import { prisma } from './prisma'

const DIA_MS = 24 * 3600 * 1000
const SELECT_MOTO = { id: true, modelo: true, marca: true, ano: true, cor: true, entradaEm: true, situacao: true, saidaEm: true, observacao: true } as const

export function statusEstoque(dias: number, posts: number): 'PARADA' | 'ATENCAO' | 'OK' {
  if (dias >= 30 && posts === 0) return 'PARADA'
  if (dias >= 20) return 'ATENCAO'
  return 'OK'
}

export async function listarEstoque(usuarioId: string, agora = new Date()) {
  const motos = await prisma.smMotoEstoque.findMany({
    where: { usuarioId },
    select: { ...SELECT_MOTO, pautas: { select: { status: true } } },
    orderBy: { entradaEm: 'asc' },
  })
  return motos.map(({ pautas, ...m }) => {
    const fim = m.saidaEm ?? agora
    const dias = Math.max(0, Math.floor((fim.getTime() - m.entradaEm.getTime()) / DIA_MS))
    const posts = pautas.filter(p => p.status === 'PUBLICADO').length
    const emProducao = pautas.filter(p => p.status !== 'PUBLICADO').length
    return { ...m, diasEmEstoque: dias, posts, emProducao, status: statusEstoque(dias, posts) }
  })
}

