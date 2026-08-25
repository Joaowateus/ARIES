import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'
import { ESTAGIOS_FINAIS, obterMetasFunil, montarConversaoFunil, contarLeadsRegistrados } from '../lib/funil'
import { obterMetasComerciais } from '../lib/metasComerciais'
import { calcularProgressoMetas } from './metas'

const router = Router()

const MESES_LABEL = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function inicioDoDia(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()) }
function inicioDaSemana(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay()) }
function inicioDoMes(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1) }
function inicioDoAno(d: Date) { return new Date(d.getFullYear(), 0, 1) }
function inicioDaQuinzena(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() <= 15 ? 1 : 16) }

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const empresaId = req.user!.empresaId
  const usuarioId = req.user!.sub
  const agora = new Date()
  const inicioMes = inicioDoMes(agora)
  const inicioAno = inicioDoAno(agora)
  const inicioQuinzena = inicioDaQuinzena(agora)

  const [
    metasAtivas,
    leadsAtivos,
    contratosMes,
    contratosAno,
    anunciosSemana,
    anunciosMesAgg,
    anunciosQuinzenaAgg,
    conteudosSemana,
    tarefasPendentes,
    metasComerciais,
    metasFunilEtapa,
    minhasOportunidades,
  ] = await Promise.all([
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
    prisma.contrato.findMany({
      where: { empresaId, vendedorId: usuarioId, status: { not: 'CANCELADO' }, criadoEm: { gte: inicioAno } },
      select: { valorTotal: true, criadoEm: true },
    }),
    prisma.anuncioProducao.count({
      where: { empresaId, usuarioId, data: { gte: inicioDaSemana(agora) } },
    }),
    prisma.anuncioProducao.aggregate({
      where: { empresaId, usuarioId, status: 'PUBLICADO', data: { gte: inicioMes } },
      _sum: { quantidade: true },
    }),
    prisma.anuncioProducao.aggregate({
      where: { empresaId, usuarioId, status: 'PUBLICADO', data: { gte: inicioQuinzena } },
      _sum: { quantidade: true },
    }),
    prisma.conteudoSocialMedia.count({
      where: { empresaId, usuarioId, data: { gte: inicioDaSemana(agora) } },
    }),
    prisma.tarefa.count({
      where: { empresaId, responsavelId: usuarioId, status: { in: ['PENDENTE', 'EM_ANDAMENTO', 'ATRASADA'] } },
    }),
    obterMetasComerciais(prisma, empresaId),
    obterMetasFunil(prisma, empresaId),
    prisma.oportunidade.findMany({ where: { empresaId, responsavelId: usuarioId }, select: { id: true } }),
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

  // Produção mensal (ano corrente) — um vendedor só, pra alimentar o gráfico
  // de barras do Meu Painel. Uma query anual só, bucket por mês em memória.
  const producaoMensal = MESES_LABEL.slice(0, agora.getMonth() + 1).map((label, mes) => {
    const doMes = contratosAno.filter(c => c.criadoEm.getMonth() === mes)
    return { mes, label, vendas: doMes.length, faturamento: doMes.reduce((s, c) => s + c.valorTotal, 0) }
  })

  const quinzenaAtual = agora.getDate() <= 15 ? 1 : 2

  // Funil de vendas do próprio vendedor — mesma lógica de conversão/semáforo
  // do Funil de Vendas da empresa, só que restrita aos leads dele.
  const meuHistorico = await prisma.estagioHistorico.findMany({
    where: { oportunidadeId: { in: minhasOportunidades.map(o => o.id) } },
    select: { oportunidadeId: true, estagioNovo: true, criadoEm: true },
  })
  const metaFunilPorEtapa = new Map(metasFunilEtapa.map(m => [m.etapa, m]))
  const meusLeadsRegistrados = await contarLeadsRegistrados(prisma, empresaId, { usuarioId })
  const funilProprio = montarConversaoFunil(meuHistorico, metaFunilPorEtapa, meusLeadsRegistrados)

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
    producaoMensal,
    metasComerciais: {
      supermetaVendasMes: metasComerciais.supermetaVendasMes,
      vendasMes: contratosMes.length,
      metaAnunciosMes: metasComerciais.metaAnunciosMes,
      anunciosMes: anunciosMesAgg._sum.quantidade ?? 0,
      metaAnunciosQuinzena: Math.round(metasComerciais.metaAnunciosMes / 2),
      anunciosQuinzenaAtual: anunciosQuinzenaAgg._sum.quantidade ?? 0,
      quinzenaAtual,
    },
    funilProprio,
  })
})

export default router
