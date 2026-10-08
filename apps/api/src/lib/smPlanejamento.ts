// Fase 6 · Planejamento do mês seguinte (ritual do dia 25, seção 11.1): as
// datas comerciais do próximo mês entram sozinhas no Calendário como pautas
// em Ideias, no dia certo e no horário da melhor janela daquele dia da
// semana. Uma vez por mês: o que for apagado não volta.
import { prisma } from './prisma'
import { carregarPermissoes } from './smAcesso'
import { diaLocal } from './smCalendario'
import { datasComerciaisDoMes } from './smDatasComerciais'
import { melhoresJanelas } from './smJanelas'
import { gerarCodigo, notificar } from './smPautas'

const OFF = 3 * 3600e3
const DIA_MS = 864e5
export const DIA_DO_PLANEJAMENTO = 25
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
export const nomeDoMes = (mes: string) => MESES[Number(mes.slice(5, 7)) - 1]

// Pilar de cada data (seção 6: Estoque, Prova social, Educação, Bastidores).
const PILAR: Record<string, 'ESTOQUE' | 'PROVA' | 'EDUCACAO' | 'BASTIDORES'> = {
  'Dia do Consumidor': 'ESTOQUE', 'Dia do Trabalhador': 'EDUCACAO', 'Dia das Mães': 'PROVA', 'Dia do Motociclista': 'BASTIDORES',
  'Dia dos Pais': 'PROVA', 'Dia do Cliente': 'PROVA', 'Dia das Crianças': 'EDUCACAO', 'Black Friday': 'ESTOQUE', 'Natal': 'BASTIDORES', 'Ano Novo': 'ESTOQUE',
}

export function mesSeguinte(hoje: string): string {
  const a = Number(hoje.slice(0, 4)), m = Number(hoje.slice(5, 7))
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}`
}
const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)
const emLocal = (dia: string, hora: number) => new Date(Date.parse(`${dia}T${String(hora).padStart(2, '0')}:00:00Z`) + OFF)

/** Situação do planejamento de um mês: datas, quais já viraram pauta e se o mês já foi pré-carregado. */
export async function situacaoDoPlanejamento(usuarioId: string, mes: string) {
  const datas = datasComerciaisDoMes(mes)
  const [registro, pautas] = await Promise.all([
    prisma.smPlanejamento.findUnique({ where: { usuarioId_mes: { usuarioId, mes } } }),
    prisma.smPauta.findMany({ where: { usuarioId, origemRef: { in: datas.map(d => `data-comercial:${d.data}`) } }, select: { id: true, origemRef: true, agendadoPara: true, status: true } }),
  ])
  const porRef = new Map(pautas.map(p => [p.origemRef, p]))
  return {
    mes, nomeMes: nomeDoMes(mes), planejadoEm: registro?.criadoEm ?? null,
    datas: datas.map(d => ({ ...d, pautaId: porRef.get(`data-comercial:${d.data}`)?.id ?? null })),
  }
}

/** Pré-carrega o mês: uma pauta por data comercial (em Ideias, já com data e hora). */
export async function planejarMes(usuarioId: string, mes: string, criadoPor: 'GESTOR' | 'SOCIAL_MEDIA' | string, agora = new Date()) {
  const ja = await prisma.smPlanejamento.findUnique({ where: { usuarioId_mes: { usuarioId, mes } } })
  if (ja) return { criadas: 0, jaPlanejado: true }
  const perm = await carregarPermissoes(usuarioId)
  if (perm.niveis.producao === 'SEM_ACESSO') return { criadas: 0, jaPlanejado: false }
  const janelas = await melhoresJanelas(usuarioId, agora)
  const hora = (dia: string) => {
    const semana = new Date(`${dia}T12:00:00Z`).getUTCDay()
    const w = janelas.janelas.find(x => x.dia === semana) ?? (janelas.base === 'SEGUIDORES_ONLINE' ? janelas.janelas[0] : undefined)
    return w ? w.inicioHora + 1 : 18
  }
  const hoje = diaLocal(agora)
  let criadas = 0
  const nomes: string[] = []
  for (const d of datasComerciaisDoMes(mes)) {
    if (d.data < hoje) continue
    const origemRef = `data-comercial:${d.data}`
    if (await prisma.smPauta.findFirst({ where: { usuarioId, origemRef }, select: { id: true } })) continue
    const agendadoPara = emLocal(d.data, hora(d.data))
    const p = await prisma.smPauta.create({
      data: {
        usuarioId, titulo: `${d.nome}: ${d.dica}`, pilar: PILAR[d.nome] ?? 'ESTOQUE', formato: 'REELS', status: 'IDEIA', origem: 'CALENDARIO', origemRef,
        agendadoPara, prazo: new Date(emLocal(d.data, 12).getTime() - 3 * DIA_MS), ordem: Date.now(), criadoPor,
        gancho: `${maiuscula(d.dica)}: comece pelo que a data pede, sem narração nos 2 primeiros segundos.`,
      },
      select: { id: true, formato: true, titulo: true, agendadoPara: true },
    })
    await prisma.smPauta.update({ where: { id: p.id }, data: { codigo: await gerarCodigo(usuarioId, { ...p, agendadoPara }) } })
    criadas++
    nomes.push(d.nome)
  }
  await prisma.smPlanejamento.create({ data: { usuarioId, mes, pautas: criadas } })
  if (criadas) {
    await notificar(usuarioId, 'SOCIAL_MEDIA', 'PLANEJAMENTO', `planejamento:${mes}`, `Planejamento de ${nomeDoMes(mes)}: ${criadas === 1 ? '1 data comercial' : `${criadas} datas comerciais`} no calendário`,
      `${nomes.join(', ')} já estão no Calendário, em Ideias, com data e hora da melhor janela. Ajuste o que precisar.`, { href: '/pro-labore/sm/calendario' })
  }
  return { criadas, jaPlanejado: false }
}

/** Job do dia: do dia 25 em diante, o mês seguinte de cada operação com Social Media. */
export async function rodarPlanejamento(agora = new Date()) {
  const hoje = diaLocal(agora)
  if (Number(hoje.slice(8, 10)) < DIA_DO_PLANEJAMENTO) return { planejamento: 0 }
  const mes = mesSeguinte(hoje)
  const operacoes = await prisma.smMembro.findMany({ where: { usuario: { smPlanejamentos: { none: { mes } } } }, select: { usuarioId: true } })
  let criadas = 0
  for (const o of operacoes) criadas += (await planejarMes(o.usuarioId, mes, 'GESTOR', agora)).criadas
  return { planejamento: criadas }
}
