// Comemorações discretas (seção 15, item 7): só em marcos reais (meta da
// semana batida, conquista desbloqueada, venda creditada a um post), uma vez
// por marco e por pessoa. Nada de festa a cada clique.
import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import type { ContextoSM } from './smAcesso'
import { carregarConfig, diaLocal } from './smCalendario'
import { atorDe } from './smInsights'
import { filtrar, semanaPadrao, segundaDe, type DadosRetro } from './smRetrospectiva'

const DIA_MS = 864e5
const OFF = 3 * 3600e3
const LIMITE_GUARDADOS = 200
const inicioDoDia = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) + OFF)

export interface Marco { chave: string; tipo: 'META' | 'CONQUISTA' | 'VENDA'; titulo: string; texto: string; href: string | null }

async function jaComemorados(sm: ContextoSM): Promise<Set<string>> {
  const p = await prisma.smPreferencia.findUnique({ where: { usuarioId_ator: { usuarioId: sm.usuarioId, ator: atorDe(sm) } }, select: { comemorados: true } })
  return new Set((p?.comemorados as string[] | null) ?? [])
}

/** Marcos ainda não comemorados por esta pessoa (o mais recente primeiro). Na pré-visualização, nenhum. */
export async function marcosPendentes(sm: ContextoSM, agora = new Date()): Promise<Marco[]> {
  if (sm.somenteLeitura) return []
  const u = sm.usuarioId
  const hoje = diaLocal(agora)
  const segunda = segundaDe(hoje)
  const de = inicioDoDia(segunda)
  const [config, conta, vistos] = await Promise.all([
    carregarConfig(u),
    prisma.socialMediaConta.findUnique({ where: { titular: `dono:${u}` }, select: { id: true } }),
    jaComemorados(sm),
  ])
  const marcos: Marco[] = []

  // Venda creditada a um post do Instagram (últimos 7 dias).
  if (sm.pode('vendas', 'LEITURA') && sm.pode('crm', 'LEITURA')) {
    const vendas = await prisma.venda.findMany({
      where: { usuarioId: u, origem: 'INSTAGRAM_ORGANICO', data: { gte: new Date(agora.getTime() - 7 * DIA_MS), lte: agora } },
      select: { id: true, postCode: true, lead: { select: { modeloInteresse: true } } }, orderBy: { data: 'desc' }, take: 5,
    })
    for (const v of vendas) {
      const modelo = v.lead?.modeloInteresse?.trim()
      marcos.push({
        chave: `venda:${v.id}`, tipo: 'VENDA', titulo: 'Venda creditada',
        texto: `${modelo ? `A ${modelo} vendida` : 'Uma venda'} veio do Instagram${v.postCode ? `, pelo post ${v.postCode}` : ''}.`,
        href: '/pro-labore/sm/vendas-por-post',
      })
    }
  }

  // Conquistas da retrospectiva mais recente (da sexta até a semana seguinte).
  const semanaRetro = semanaPadrao(agora)
  const retro = await prisma.smRetrospectiva.findUnique({ where: { usuarioId_semana: { usuarioId: u, semana: semanaRetro } }, select: { dados: true } })
  if (retro) {
    const v = filtrar(retro.dados as unknown as DadosRetro, m => sm.pode(m, 'LEITURA'))
    for (const c of v.conquistas.filter(x => x.desbloqueada)) {
      marcos.push({ chave: `conquista:${semanaRetro}:${c.chave}`, tipo: 'CONQUISTA', titulo: `Conquista: ${c.titulo}`, texto: `${c.detalhe}.`, href: `/pro-labore/sm/retrospectiva?semana=${semanaRetro}` })
    }
  }

  // Metas da semana batidas.
  if (conta) {
    const feed = await prisma.socialMediaMidia.findMany({ where: { contaId: conta.id, publicadoEm: { gte: de, lte: agora }, NOT: { formato: { in: ['STORY', 'AD'] } } }, select: { publicadoEm: true } })
    const dias = new Set(feed.map(m => diaLocal(m.publicadoEm))).size
    if (dias >= config.minDiasSemana) {
      marcos.push({ chave: `meta-dias:${segunda}`, tipo: 'META', titulo: 'Meta da semana batida', texto: `${dias === config.minDiasSemana ? `${dias} de ${dias}` : `${dias}`} dias com post${dias > config.minDiasSemana ? ` (meta ${config.minDiasSemana})` : ''}. A constância da semana está garantida.`, href: null })
    }
  }
  if (sm.pode('crm', 'LEITURA')) {
    const leads = await prisma.lead.count({ where: { usuarioId: u, tipoLead: 'ORGANICO', criadoEm: { gte: de, lte: agora } } })
    if (leads >= config.metaLeadsSemana) {
      marcos.push({ chave: `meta-leads:${segunda}`, tipo: 'META', titulo: 'Meta de leads batida', texto: `${leads} leads orgânicos na semana (meta ${config.metaLeadsSemana}).`, href: null })
    }
  }
  return marcos.filter(m => !vistos.has(m.chave))
}

/** Marca o marco como comemorado (não volta a aparecer). */
export async function marcarComemorado(sm: ContextoSM, chave: string) {
  const ator = atorDe(sm)
  const vistos = [...(await jaComemorados(sm))].filter(c => c !== chave)
  const lista = [...vistos, chave].slice(-LIMITE_GUARDADOS) as unknown as Prisma.InputJsonValue
  await prisma.smPreferencia.upsert({
    where: { usuarioId_ator: { usuarioId: sm.usuarioId, ator } },
    create: { usuarioId: sm.usuarioId, ator, comemorados: lista },
    update: { comemorados: lista },
  })
}
