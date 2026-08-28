import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireAuth, requirePapel } from '../middleware/auth'
import { escopoVisibilidade, veEquipe } from '../lib/permissoes'
import { ESTAGIOS_FINAIS } from '../lib/funil'
import { obterMetasComerciais } from '../lib/metasComerciais'
import { calcularProducaoVendedor } from '../lib/producaoVendedor'

const router = Router()

function apenasEquipe(req: Request, res: Response, next: NextFunction) {
  if (!veEquipe(req.user!.papel)) {
    res.status(403).json({ error: 'Permissão insuficiente' })
    return
  }
  next()
}

function inicioDoMes(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1) }
function inicioDoDia(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()) }
function diasAtras(d: Date, n: number) { return new Date(d.getTime() - n * 24 * 60 * 60 * 1000) }

async function usuariosDaEquipe(req: Request) {
  const escopo = await escopoVisibilidade(prisma, req.user!)
  const usuarioIds = escopo.tipo === 'equipe' ? escopo.usuarioIds : undefined
  return prisma.usuario.findMany({
    where: { empresaId: req.user!.empresaId, status: 'ATIVO', ...(usuarioIds ? { id: { in: usuarioIds } } : {}) },
    select: { id: true, nome: true, papel: true },
  })
}

// ---------------------------------------------------------------------------
// Painel Gerencial — rollup por colaborador da equipe visível ao usuário
// logado (via hierarquia gestorId).
// ---------------------------------------------------------------------------

router.get('/equipe', requireAuth, apenasEquipe, async (req: Request, res: Response) => {
  const empresaId = req.user!.empresaId
  const agora = new Date()
  const inicioMes = inicioDoMes(agora)
  const hoje = inicioDoDia(agora)

  const usuarios = await usuariosDaEquipe(req)

  const equipe = await Promise.all(
    usuarios.map(async u => {
      const [vendas, leadsAtivos, rotinaHoje, tarefasPendentes] = await Promise.all([
        prisma.contrato.findMany({ where: { empresaId, vendedorId: u.id, status: { not: 'CANCELADO' }, criadoEm: { gte: inicioMes } }, select: { valorTotal: true } }),
        prisma.oportunidade.count({ where: { empresaId, responsavelId: u.id, estagio: { notIn: [...ESTAGIOS_FINAIS] } } }),
        prisma.rotinaExecucao.findMany({ where: { empresaId, usuarioId: u.id, data: hoje } }),
        prisma.tarefa.count({ where: { empresaId, responsavelId: u.id, status: { in: ['PENDENTE', 'EM_ANDAMENTO', 'ATRASADA'] } } }),
      ])

      const itensRotinaHoje = rotinaHoje.flatMap(r => r.itensStatus as { status: string }[])
      const rotinaCumprida = itensRotinaHoje.length > 0
        ? itensRotinaHoje.filter(i => i.status === 'CONCLUIDO').length / itensRotinaHoje.length
        : null

      return {
        usuario: u,
        vendasNoMes: vendas.length,
        faturamentoNoMes: vendas.reduce((s, c) => s + c.valorTotal, 0),
        leadsAtivos,
        tarefasPendentes,
        rotinaCumpridaHoje: rotinaCumprida,
      }
    })
  )

  res.json(equipe)
})

// ---------------------------------------------------------------------------
// Painel de Produção da Equipe — mesmo painel de produção do vendedor (Meu
// Painel), só que somando todo mundo visível ao gestor de uma vez, com a
// opção de filtrar por um vendedor específico (?vendedorId=). Sem filtro, a
// meta mensal escala pelo número de gente ativa na equipe (supermeta ×
// quantidade), já que não existe uma "meta da empresa" separada — cada
// vendedor tem a mesma meta individual, e a soma delas é a meta do time.
// ---------------------------------------------------------------------------

router.get('/producao', requireAuth, apenasEquipe, async (req: Request, res: Response) => {
  const empresaId = req.user!.empresaId
  const agora = new Date()
  const inicioAno = new Date(agora.getFullYear(), 0, 1)

  const escopo = await escopoVisibilidade(prisma, req.user!)
  const usuarios = await usuariosDaEquipe(req)

  const vendedorIdParam = typeof req.query.vendedorId === 'string' ? req.query.vendedorId : undefined
  const vendedorIdValido = !!vendedorIdParam && usuarios.some(u => u.id === vendedorIdParam)
  const vendedorIds = vendedorIdValido ? [vendedorIdParam as string] : usuarios.map(u => u.id)

  const [contratosAno, oportunidadesEscopo, metasComerciais] = await Promise.all([
    prisma.contrato.findMany({
      where: { empresaId, vendedorId: { in: vendedorIds }, status: { not: 'CANCELADO' }, criadoEm: { gte: inicioAno } },
      select: { valorTotal: true, criadoEm: true },
    }),
    prisma.oportunidade.findMany({
      where: { empresaId, responsavelId: { in: vendedorIds } },
      select: { id: true },
    }),
    obterMetasComerciais(prisma, empresaId),
  ])

  const historico = await prisma.estagioHistorico.findMany({
    where: { oportunidadeId: { in: oportunidadesEscopo.map(o => o.id) }, estagioNovo: 'NOVO_LEAD', criadoEm: { gte: inicioAno } },
    select: { criadoEm: true },
  })
  const leadsPorMes = new Array(12).fill(0)
  for (const h of historico) leadsPorMes[h.criadoEm.getMonth()]++

  const metaMensal = vendedorIdValido
    ? metasComerciais.supermetaFaturamentoMes
    : metasComerciais.supermetaFaturamentoMes * Math.max(1, vendedorIds.length)

  const producaoDashboard = calcularProducaoVendedor(contratosAno, leadsPorMes, metaMensal, agora)

  res.json({
    producaoDashboard,
    vendedores: usuarios,
    vendedorSelecionado: vendedorIdValido ? vendedorIdParam : null,
    escopoTodos: escopo.tipo === 'todos',
  })
})

// ---------------------------------------------------------------------------
// Score de Performance — combina 7 dimensões normalizadas (0-1), com pesos
// configuráveis. Nunca é só volume de vendas (ver Pilar 7 do manual de
// precificação / seção 25 do desenho original).
// ---------------------------------------------------------------------------

const PESOS_PADRAO = {
  pesoComercial: 0.4, pesoProdutividade: 0.2, pesoProcessos: 0.15,
  pesoCrm: 0.1, pesoConteudo: 0.05, pesoTreinamentos: 0.05, pesoRotinas: 0.05,
}

async function obterScoreConfig(empresaId: string) {
  const existente = await prisma.scoreConfig.findUnique({ where: { empresaId } })
  if (existente) return existente
  return prisma.scoreConfig.create({ data: { empresaId, ...PESOS_PADRAO } })
}

router.get('/score-config', requireAuth, async (req: Request, res: Response) => {
  res.json(await obterScoreConfig(req.user!.empresaId))
})

const scoreConfigSchema = z.object({
  pesoComercial: z.number().min(0).max(1),
  pesoProdutividade: z.number().min(0).max(1),
  pesoProcessos: z.number().min(0).max(1),
  pesoCrm: z.number().min(0).max(1),
  pesoConteudo: z.number().min(0).max(1),
  pesoTreinamentos: z.number().min(0).max(1),
  pesoRotinas: z.number().min(0).max(1),
})

router.put('/score-config', requireAuth, requirePapel('ADMINISTRADOR'), async (req: Request, res: Response) => {
  const parse = scoreConfigSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const config = await prisma.scoreConfig.upsert({
    where: { empresaId: req.user!.empresaId },
    update: parse.data,
    create: { empresaId: req.user!.empresaId, ...parse.data },
  })
  res.json(config)
})

router.get('/score', requireAuth, apenasEquipe, async (req: Request, res: Response) => {
  const empresaId = req.user!.empresaId
  const agora = new Date()
  const inicioMes = inicioDoMes(agora)
  const ha30dias = diasAtras(agora, 30)
  const ha7dias = diasAtras(agora, 7)

  const [config, usuarios] = await Promise.all([obterScoreConfig(empresaId), usuariosDaEquipe(req)])

  const brutos = await Promise.all(
    usuarios.map(async u => {
      const [vendas, tarefas, execucoesRotina, leadsAtivos, atividades, conteudos, treinamentos] = await Promise.all([
        prisma.contrato.count({ where: { empresaId, vendedorId: u.id, status: { not: 'CANCELADO' }, criadoEm: { gte: inicioMes } } }),
        prisma.tarefa.findMany({ where: { empresaId, responsavelId: u.id, criadoEm: { gte: ha30dias } }, select: { status: true } }),
        prisma.rotinaExecucao.findMany({ where: { empresaId, usuarioId: u.id, data: { gte: ha30dias } }, select: { itensStatus: true } }),
        prisma.oportunidade.findMany({ where: { empresaId, responsavelId: u.id, estagio: { notIn: [...ESTAGIOS_FINAIS] } }, select: { id: true } }),
        prisma.atividadeOportunidade.findMany({ where: { empresaId, usuarioId: u.id, criadoEm: { gte: ha30dias } }, select: { oportunidadeId: true } }),
        prisma.conteudoSocialMedia.count({ where: { empresaId, usuarioId: u.id, data: { gte: ha7dias } } }),
        prisma.treinamentoProgresso.findMany({ where: { empresaId, usuarioId: u.id }, select: { status: true } }),
      ])

      const tarefasConcluidas = tarefas.filter(t => t.status === 'CONCLUIDA').length
      const itensRotina = execucoesRotina.flatMap(e => e.itensStatus as { status: string }[])
      const itensRotinaConcluidos = itensRotina.filter(i => i.status === 'CONCLUIDO').length
      const leadsComAtividade = new Set(atividades.map(a => a.oportunidadeId)).size
      const treinamentosConcluidos = treinamentos.filter(t => t.status === 'CONCLUIDO').length

      return {
        usuario: u,
        vendas,
        produtividade: tarefas.length > 0 ? tarefasConcluidas / tarefas.length : 0,
        processos: itensRotina.length > 0 ? itensRotinaConcluidos / itensRotina.length : 0,
        crm: leadsAtivos.length > 0 ? Math.min(1, leadsComAtividade / leadsAtivos.length) : 0,
        conteudo: conteudos,
        treinamentos: treinamentos.length > 0 ? treinamentosConcluidos / treinamentos.length : 0,
      }
    })
  )

  const maiorVendas = Math.max(1, ...brutos.map(b => b.vendas))
  const maiorConteudo = Math.max(1, ...brutos.map(b => b.conteudo))

  const resultado = brutos
    .map(b => {
      const comercial = b.vendas / maiorVendas
      const conteudoNorm = b.conteudo / maiorConteudo
      const score =
        comercial * config.pesoComercial +
        b.produtividade * config.pesoProdutividade +
        b.processos * config.pesoProcessos +
        b.crm * config.pesoCrm +
        conteudoNorm * config.pesoConteudo +
        b.treinamentos * config.pesoTreinamentos +
        b.processos * config.pesoRotinas // rotina cumprida usa a mesma métrica de processos (checklist diário)
      return {
        usuario: b.usuario,
        dimensoes: { comercial, produtividade: b.produtividade, processos: b.processos, crm: b.crm, conteudo: conteudoNorm, treinamentos: b.treinamentos },
        score,
      }
    })
    .sort((a, b) => b.score - a.score)

  res.json(resultado)
})

export default router
