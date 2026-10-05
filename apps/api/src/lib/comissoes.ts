import type { Prisma } from '@prisma/client'

const arred = (v: number) => Math.round(v * 100) / 100

// Recalcula o total de um pagamento de comissão depois que uma venda saiu
// dele. Se não sobrou nenhuma, o pagamento vira cancelado (não é apagado:
// o número já pode estar num comprovante impresso e nunca é reaproveitado).
export async function recalcularPagamentoComissao(tx: Prisma.TransactionClient, pagamentoId: string) {
  const vendas = await tx.venda.findMany({ where: { pagamentoComissaoId: pagamentoId }, select: { valorComissao: true } })
  await tx.pagamentoComissao.update({
    where: { id: pagamentoId },
    data: vendas.length
      ? { valorTotal: arred(vendas.reduce((s, v) => s + (v.valorComissao ?? 0), 0)), canceladoEm: null }
      : { valorTotal: 0, canceladoEm: new Date() },
  })
}
