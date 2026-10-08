// Fase 6 · Acervo de mídia por moto (seção 18): todos os arquivos enviados
// nas pautas (fotos, vídeos, tomadas da captura e capas), organizados pela
// moto do estoque e reaproveitáveis em pautas novas. O termo de autorização
// de imagem fica de fora: é documento do cliente, não conteúdo.
import { prisma } from './prisma'
import { listarEstoque } from './smEstoque'

export const TIPOS_DO_ACERVO = ['IMAGEM', 'VIDEO', 'TOMADA', 'CAPA'] as const

export async function acervoPorMoto(usuarioId: string, motoId?: string | null) {
  const [midias, estoque] = await Promise.all([
    prisma.smPautaMidia.findMany({
      where: { tipo: { in: [...TIPOS_DO_ACERVO] }, pauta: { usuarioId, motoId: motoId ? motoId : { not: null } } },
      select: { id: true, tipo: true, url: true, tomada: true, criadoEm: true, pauta: { select: { id: true, titulo: true, status: true, motoId: true, permalink: true } } },
      orderBy: { criadoEm: 'desc' },
    }),
    listarEstoque(usuarioId),
  ])
  const motos = new Map(estoque.map(m => [m.id, m]))
  const grupos = new Map<string, { arquivos: Map<string, { id: string; tipo: string; url: string; tomada: number | null; criadoEm: Date; pautas: Array<{ id: string; titulo: string; status: string; permalink: string | null }> }> }>()
  for (const m of midias) {
    const moto = m.pauta.motoId!
    if (!grupos.has(moto)) grupos.set(moto, { arquivos: new Map() })
    const g = grupos.get(moto)!
    // O mesmo arquivo usado em várias pautas aparece uma vez, com as pautas em que entrou.
    const a = g.arquivos.get(m.url) ?? { id: m.id, tipo: m.tipo, url: m.url, tomada: m.tomada, criadoEm: m.criadoEm, pautas: [] }
    if (!a.pautas.some(p => p.id === m.pauta.id)) a.pautas.push({ id: m.pauta.id, titulo: m.pauta.titulo, status: m.pauta.status, permalink: m.pauta.permalink })
    if (m.criadoEm < a.criadoEm) { a.criadoEm = m.criadoEm; a.id = m.id }
    g.arquivos.set(m.url, a)
  }
  return [...grupos.entries()]
    .map(([id, g]) => {
      const m = motos.get(id)
      const arquivos = [...g.arquivos.values()].sort((a, b) => b.criadoEm.getTime() - a.criadoEm.getTime())
      return {
        moto: m ? { id, modelo: m.modelo, ano: m.ano, cor: m.cor, situacao: m.situacao, diasEmEstoque: m.diasEmEstoque } : { id, modelo: 'Moto removida do estoque', ano: null, cor: null, situacao: null, diasEmEstoque: null },
        fotos: arquivos.filter(a => a.tipo === 'IMAGEM' || a.tipo === 'CAPA').length,
        videos: arquivos.filter(a => a.tipo === 'VIDEO' || a.tipo === 'TOMADA').length,
        ultimoEm: arquivos[0]?.criadoEm ?? null,
        arquivos,
      }
    })
    .sort((a, b) => (b.ultimoEm?.getTime() ?? 0) - (a.ultimoEm?.getTime() ?? 0))
}

/** Arquivo do acervo da operação (para reaproveitar). */
export async function arquivoDoAcervo(usuarioId: string, midiaId: string) {
  return prisma.smPautaMidia.findFirst({
    where: { id: midiaId, tipo: { in: [...TIPOS_DO_ACERVO] }, pauta: { usuarioId, motoId: { not: null } } },
    select: { id: true, tipo: true, url: true, pauta: { select: { motoId: true } } },
  })
}
