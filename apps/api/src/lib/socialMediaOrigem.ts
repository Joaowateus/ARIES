// Orgânico x pago x total por post (seção 3.3 da especificação do Social
// Media). O pago vem do módulo Tráfego: anúncios cujo criativo usa um post
// do Instagram (`effective_instagram_media_id`, gravado na estrutura do
// anúncio como `igMidiaId`), com o resultado somado de todos os dias.
//
// Premissa (a conferir com dados reais assim que a conta da empresa
// estiver ligada): os insights de mídia do Instagram não incluem a
// atividade gerada por anúncios — então eles são o ORGÂNICO, o pago vem do
// Tráfego e o TOTAL é a soma. Interações e visualizações somam certinho;
// alcance não (a mesma pessoa pode ter visto pelos dois caminhos), por isso
// o alcance pago e o total ficam marcados como estimados.
import { prisma } from './prisma'

export type OrigemMetricas = 'ORGANICO' | 'PAGO' | 'TOTAL'

export interface PagoDaMidia {
  anuncios: number
  gasto: number
  alcance: number // soma do alcance diário dos anúncios: estimativa
  impressoes: number
  curtidas: number
  comentarios: number
  compartilhamentos: number
  salvamentos: number
  interacoes: number
}

export async function pagoPorMidia(usuarioId: string): Promise<Map<string, PagoDaMidia>> {
  const conta = await prisma.trafegoConta.findUnique({ where: { usuarioId }, select: { id: true } })
  if (!conta) return new Map()
  const anuncios = await prisma.trafegoEstrutura.findMany({ where: { contaId: conta.id, tipo: 'anuncio' }, select: { objetoId: true, dados: true } })
  const midiaDoAnuncio = new Map<string, string>()
  for (const a of anuncios) {
    const ig = (a.dados as { igMidiaId?: string | null } | null)?.igMidiaId
    if (ig) midiaDoAnuncio.set(a.objetoId, ig)
  }
  if (!midiaDoAnuncio.size) return new Map()
  const somas = await prisma.trafegoInsightDiario.groupBy({
    by: ['adId'],
    where: { contaId: conta.id, adId: { in: [...midiaDoAnuncio.keys()] } },
    _sum: { gasto: true, alcance: true, impressoes: true, reacoes: true, comentarios: true, compartilhamentos: true, salvamentos: true },
  })
  const porMidia = new Map<string, PagoDaMidia>()
  for (const s of somas) {
    const ig = midiaDoAnuncio.get(s.adId)!
    const atual = porMidia.get(ig) ?? { anuncios: 0, gasto: 0, alcance: 0, impressoes: 0, curtidas: 0, comentarios: 0, compartilhamentos: 0, salvamentos: 0, interacoes: 0 }
    const curtidas = s._sum.reacoes ?? 0, comentarios = s._sum.comentarios ?? 0, compartilhamentos = s._sum.compartilhamentos ?? 0, salvamentos = s._sum.salvamentos ?? 0
    porMidia.set(ig, {
      anuncios: atual.anuncios + 1,
      gasto: atual.gasto + (s._sum.gasto ?? 0),
      alcance: atual.alcance + (s._sum.alcance ?? 0),
      impressoes: atual.impressoes + (s._sum.impressoes ?? 0),
      curtidas: atual.curtidas + curtidas,
      comentarios: atual.comentarios + comentarios,
      compartilhamentos: atual.compartilhamentos + compartilhamentos,
      salvamentos: atual.salvamentos + salvamentos,
      interacoes: atual.interacoes + curtidas + comentarios + compartilhamentos + salvamentos,
    })
  }
  return porMidia
}
