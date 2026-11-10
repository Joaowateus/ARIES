// Conversão por etapa da jornada (PDF 01, seções 6 e 8): pelo histórico de
// etapas, contada pela data em que o lead chegou à etapa. Cliente à vista fica
// fora de MQL e SQL; venda sem visita fica fora de Agendamento e Visita.
// Meses anteriores à migração continuam nas 5 etapas (decisão aprovada).
import { prisma } from './prisma'
import { ETAPAS, type Etapa } from './etapasJornada'

export async function conversaoPorEtapa(where: Record<string, unknown>, inicio: Date, fim: Date) {
  const leads = await prisma.lead.findMany({
    where: { ...where, etapa: { not: null }, historico: { some: { criadoEm: { gte: inicio, lt: fim } } } },
    select: { id: true, formaPagamento: true, vendaSemVisita: true, historico: { select: { estagioNovo: true, criadoEm: true } } },
  })
  const idx = (e: string) => ETAPAS.indexOf(e as Etapa)
  return ETAPAS.filter(e => e !== 'VENDA').map(e => {
    const i = idx(e)
    const fora = (l: typeof leads[number]) => ((e === 'MQL' || e === 'SQL') && l.formaPagamento === 'A_VISTA') || ((e === 'AGENDAMENTO' || e === 'VISITA') && l.vendaSemVisita)
    const noPeriodo = (l: typeof leads[number]) => l.historico.some(h => h.estagioNovo === e && h.criadoEm >= inicio && h.criadoEm < fim)
    const chegaram = leads.filter(l => !fora(l) && noPeriodo(l))
    // Ajuste 1: as exclusões aprovadas (à vista fora de MQL/SQL; venda sem visita fora de Agendamento/Visita) contadas para o aviso.
    const excluidos = leads.filter(l => fora(l) && noPeriodo(l)).length
    const seguiram = chegaram.filter(l => {
      const chegou = Math.min(...l.historico.filter(h => h.estagioNovo === e && h.criadoEm >= inicio && h.criadoEm < fim).map(h => h.criadoEm.getTime()))
      return l.historico.some(h => idx(h.estagioNovo) > i && h.criadoEm.getTime() >= chegou)
    })
    return { etapa: e, chegaram: chegaram.length, seguiram: seguiram.length, excluidos, ids: chegaram.map(l => l.id), conversao: chegaram.length ? Math.round((seguiram.length / chegaram.length) * 1000) / 10 : null }
  })
}
