import { prisma } from './prisma'

export async function criarNotificacao(args: {
  empresaId: string
  usuarioId: string
  tipo: string
  titulo: string
  mensagem: string
  entidadeTipo?: string
  entidadeId?: string
}) {
  await prisma.notificacao.create({ data: args })
}
