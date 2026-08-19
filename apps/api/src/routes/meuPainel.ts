import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'
import { ESTAGIOS_FINAIS } from '../lib/funil'
import { calcularProgressoMetas } from './metas'

const router = Router()

function inicioDoDia(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()) }
function inicioDaSemana(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay()) }
function inicioDoMes(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1) }

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const empresaId = req.user!.empresaId
  const usuarioId = req.user!.sub
  const agora = new Date()
  const inicioMes = inicioDoMes(agora)

  const [metasAtivas, leadsAtivos, contratosMes, anunciosSemana, conteudosSemana, tarefasPendentes] = await Promise.all([
    prisma.meta.findMany({
      where: { empresaId, status: 'ATIVA', OR: [{ usuarioId }, { usuarioId: null }] },
    }),
    prisma.oportunidade.findMany({
      where: { empresaId, responsavelId: usuarioId, estagio: { notIn: [...ESTAGIOS_FINAIS] } },
      select: { id: true, proximaAcaoEm: true, ultimaInteracaoEm: true, criadaEm: true },
    }),
    prisma.contrato.findMany({
      where: { empresaId, vendedorId: usuarioId, status: { not: 'CANCELADO' }, criadoEm: { gte: inicioMes } },
      select: { valorTotal: true },
    }),
    prisma.anuncioProducao.count({
      where: { empresaId, usuarioId, data: { gte: inicioDaSemana(agora) } },
    }),
    prisma.conteudoSocialMedia.count({
      where: { empresaId, usuarioId, data: { gte: inicioDaSemana(agora) } },
    }),
    prisma.tarefa.count({
      where: { empresaId, responsavelId: usuarioId, status: { in: ['PENDENTE', 'EM_ANDAMENTO', 'ATRASADA'] } },
    }),
  ])

  const ha24h = new Date(agora.getTime() - 24 * 60 * 60 * 1000)
  const followUpsPendentes = leadsAtivos.filter(
    o => (o.proximaAcaoEm && o.proximaAcaoEm < agora) || (!o.proximaAcaoEm && (o.ultimaInteracaoEm ?? o.criadaEm) < ha24h)
  ).length

  const progressoMetas = await calcularProgressoMetas(empresaId, metasAtivas)
  // Se existir meta individual e meta da empresa pro mesmo período, a
  // individual é a mais relevante pro colaborador ver primeiro.
  const preferindoIndividual = (a: (typeof progressoMetas)[number], b: (typeof progressoMetas)[number]) =>
    (a.usuarioId ? 0 : 1) - (b.usuarioId ? 0 : 1)
  const porPeriodo = (periodo: string) => progressoMetas.filter(m => m.periodo === periodo).sort(preferindoIndividual)

  res.json({
    metas: {
      dia: porPeriodo('DIARIA')[0] ?? null,
      semana: porPeriodo('SEMANAL')[0] ?? null,
      mes: porPeriodo('MENSAL'),
    },
    leadsPendentes: leadsAtivos.length,
    followUpsPendentes,
    vendas: contratosMes.length,
    faturamentoGerado: contratosMes.reduce((s, c) => s + c.valorTotal, 0),
    anunciosProduzidosSemana: anunciosSemana,
    conteudosProduzidosSemana: conteudosSemana,
    tarefasPendentes,
  })
})

export default router
