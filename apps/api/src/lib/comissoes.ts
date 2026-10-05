import type { Prisma } from '@prisma/client'

// Pagamentos registrados a partir das vendas: comissão do vendedor ou
// retirada do pró-labore do dono. Cada tipo usa um campo da venda pra ligar
// a venda ao pagamento e um valor da venda pra somar.
export const TIPOS_PAGAMENTO = ['COMISSAO', 'PROLABORE'] as const
export type TipoPagamento = (typeof TIPOS_PAGAMENTO)[number]

export const CAMPO_PAGAMENTO = {
  COMISSAO: 'pagamentoComissaoId',
  PROLABORE: 'pagamentoProLaboreId',
} as const satisfies Record<TipoPagamento, keyof Prisma.VendaWhereInput>

// Valor da venda que entra no pagamento.
export function valorDoPagamento(tipo: TipoPagamento, v: { valorComissao: number | null; valorProLabore: number }) {
  return tipo === 'COMISSAO' ? v.valorComissao ?? 0 : v.valorProLabore
}

const arred = (v: number) => Math.round(v * 100) / 100

// Recalcula o total de um pagamento depois que uma venda saiu dele. Se não
// sobrou nenhuma, o pagamento vira cancelado (não é apagado: o número já
// pode estar num comprovante impresso e nunca é reaproveitado).
export async function recalcularPagamentoComissao(tx: Prisma.TransactionClient, pagamentoId: string) {
  const pagamento = await tx.pagamentoComissao.findUnique({ where: { id: pagamentoId }, select: { tipo: true } })
  if (!pagamento) return
  const tipo = pagamento.tipo as TipoPagamento
  const vendas = await tx.venda.findMany({
    where: { [CAMPO_PAGAMENTO[tipo]]: pagamentoId },
    select: { valorComissao: true, valorProLabore: true },
  })
  await tx.pagamentoComissao.update({
    where: { id: pagamentoId },
    data: vendas.length
      ? { valorTotal: arred(vendas.reduce((s, v) => s + valorDoPagamento(tipo, v), 0)), canceladoEm: null }
      : { valorTotal: 0, canceladoEm: new Date() },
  })
}
