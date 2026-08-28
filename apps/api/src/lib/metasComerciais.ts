/** Padrão comercial único da empresa: supermeta de vendas, meta de
 * faturamento mensal (base do painel de produção — trimestre e ano derivam
 * daqui, ×3 e ×12) e meta de anúncios orgânicos, aplicados a qualquer
 * vendedor (ver Meu Painel). */
export const METAS_COMERCIAIS_PADRAO = {
  supermetaVendasMes: 10,
  supermetaFaturamentoMes: 150000,
  metaAnunciosMes: 2000,
}

type PrismaClient = import('@prisma/client').PrismaClient

export async function obterMetasComerciais(prisma: PrismaClient, empresaId: string) {
  const existente = await prisma.metaComercialPadrao.findUnique({ where: { empresaId } })
  if (existente) return existente
  return prisma.metaComercialPadrao.create({ data: { empresaId, ...METAS_COMERCIAIS_PADRAO } })
}
