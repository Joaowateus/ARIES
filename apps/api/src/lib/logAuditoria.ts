import { prisma } from './prisma'

/**
 * Trilha genérica de alteração — quem, quando, o quê, valor anterior/novo.
 * Chamada explicitamente nos pontos de mutação que mais importam auditar
 * (não é um hook global do Prisma: preferi handful de call sites claros a um
 * middleware que intercepta toda escrita do banco sem eu conseguir validar
 * cada um). Preço e estágio do funil já têm trilha própria e mais rica
 * (HistoricoPrecificacao / EstagioHistorico) — este cobre o resto.
 */
export async function registrarLog(args: {
  empresaId: string
  entidadeTipo: string
  entidadeId: string
  usuarioId?: string
  acao: 'CREATE' | 'UPDATE' | 'DELETE'
  campoAlterado?: string
  valorAnterior?: unknown
  valorNovo?: unknown
}) {
  await prisma.logAuditoria.create({
    data: {
      empresaId: args.empresaId,
      entidadeTipo: args.entidadeTipo,
      entidadeId: args.entidadeId,
      usuarioId: args.usuarioId,
      acao: args.acao,
      campoAlterado: args.campoAlterado,
      valorAnterior: args.valorAnterior != null ? String(args.valorAnterior) : undefined,
      valorNovo: args.valorNovo != null ? String(args.valorNovo) : undefined,
    },
  })
}
