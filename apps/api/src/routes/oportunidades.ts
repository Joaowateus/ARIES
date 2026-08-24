import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'
import { ESTAGIOS, ESTAGIOS_FINAIS, ESTAGIO_VENDA_FECHADA, diasNaEtapaAtualPorOportunidade } from '../lib/funil'
import { escopoVisibilidade, escopoWhereDono } from '../lib/permissoes'

const router = Router()

const criarSchema = z.object({
  nomeCliente: z.string().min(2),
  telefone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  unidadeId: z.string().optional(),
  responsavelId: z.string().optional(),
  origem: z.string().default('MANUAL'),
  valor: z.number().positive().optional(),
  observacoes: z.string().optional(),
})

const editarSchema = criarSchema.partial().extend({
  proximaAcaoEm: z.coerce.date().nullable().optional(),
  proximaAcaoDescricao: z.string().nullable().optional(),
})

const atividadeSchema = z.object({
  tipo: z.enum(['LIGACAO', 'WHATSAPP', 'VISITA', 'SIMULACAO', 'EMAIL', 'OUTRO']),
  descricao: z.string().min(2),
  proximaAcaoEm: z.coerce.date().optional(),
  proximaAcaoDescricao: z.string().optional(),
})

const include = {
  responsavel: { select: { id: true, nome: true } },
  unidade: { select: { id: true, nome: true, marca: true, modelo: true, ano: true, cor: true, precoBase: true } },
}

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const estagio = typeof req.query.estagio === 'string' ? req.query.estagio : undefined
  const responsavelId = typeof req.query.responsavelId === 'string' ? req.query.responsavelId : undefined
  const escopo = await escopoVisibilidade(prisma, req.user!)

  const oportunidades = await prisma.oportunidade.findMany({
    where: {
      empresaId: req.user!.empresaId,
      ...escopoWhereDono(escopo, 'responsavelId'),
      ...(estagio ? { estagio } : {}),
      ...(responsavelId ? { responsavelId } : {}),
    },
    include,
    orderBy: { atualizadaEm: 'desc' },
  })

  const historico = await prisma.estagioHistorico.findMany({
    where: { oportunidadeId: { in: oportunidades.map(o => o.id) } },
    select: { oportunidadeId: true, estagioNovo: true, criadoEm: true },
  })
  const diasPorOportunidade = diasNaEtapaAtualPorOportunidade(historico)

  res.json(oportunidades.map(o => ({
    ...o,
    diasNaEtapaAtual: diasPorOportunidade.has(o.id) ? Math.round(diasPorOportunidade.get(o.id)! * 10) / 10 : null,
  })))
})

router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  const escopo = await escopoVisibilidade(prisma, req.user!)
  const oportunidade = await prisma.oportunidade.findFirst({
    where: { id: String(req.params.id), empresaId: req.user!.empresaId, ...escopoWhereDono(escopo, 'responsavelId') },
    include: {
      ...include,
      atividades: { orderBy: { criadoEm: 'desc' }, include: { usuario: { select: { id: true, nome: true } } } },
      historicoEstagio: { orderBy: { criadoEm: 'desc' } },
    },
  })
  if (!oportunidade) {
    res.status(404).json({ error: 'Oportunidade não encontrada' })
    return
  }
  res.json(oportunidade)
})

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const parse = criarSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const data = parse.data
  const empresaId = req.user!.empresaId
  const oportunidade = await prisma.oportunidade.create({
    data: {
      ...data,
      email: data.email || undefined,
      empresaId,
      responsavelId: data.responsavelId ?? req.user!.sub,
      estagio: 'NOVO_LEAD',
    },
    include,
  })
  await prisma.estagioHistorico.create({
    data: { empresaId, oportunidadeId: oportunidade.id, estagioAnterior: null, estagioNovo: 'NOVO_LEAD' },
  })
  res.status(201).json(oportunidade)
})

router.patch('/:id/estagio', requireAuth, async (req: Request, res: Response) => {
  const { estagio } = req.body
  if (!ESTAGIOS.includes(estagio)) {
    res.status(400).json({ error: 'Estágio inválido' })
    return
  }

  const escopo = await escopoVisibilidade(prisma, req.user!)
  const oportunidade = await prisma.oportunidade.findFirst({
    where: { id: String(req.params.id), empresaId: req.user!.empresaId, ...escopoWhereDono(escopo, 'responsavelId') },
  })
  if (!oportunidade) {
    res.status(404).json({ error: 'Oportunidade não encontrada' })
    return
  }

  const fechadaEm = ESTAGIOS_FINAIS.includes(estagio) ? new Date() : null
  const statusFinal = ESTAGIOS_FINAIS.includes(estagio) ? estagio : null

  // Se comprou e tem unidade, reservar a unidade
  if (estagio === ESTAGIO_VENDA_FECHADA && oportunidade.unidadeId) {
    await prisma.unidade.update({
      where: { id: oportunidade.unidadeId },
      data: { situacao: 'RESERVADA' },
    })
  }

  const atualizada = await prisma.oportunidade.update({
    where: { id: String(req.params.id) },
    data: { estagio, fechadaEm, statusFinal },
    include,
  })
  await prisma.estagioHistorico.create({
    data: {
      empresaId: req.user!.empresaId,
      oportunidadeId: atualizada.id,
      estagioAnterior: oportunidade.estagio,
      estagioNovo: estagio,
    },
  })
  res.json(atualizada)
})

router.patch('/:id', requireAuth, async (req: Request, res: Response) => {
  const parse = editarSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const escopo = await escopoVisibilidade(prisma, req.user!)
  const atualizada = await prisma.oportunidade.updateMany({
    where: { id: String(req.params.id), empresaId: req.user!.empresaId, ...escopoWhereDono(escopo, 'responsavelId') },
    data: parse.data,
  })
  if (!atualizada.count) {
    res.status(404).json({ error: 'Oportunidade não encontrada' })
    return
  }
  res.json({ ok: true })
})

// ---------------------------------------------------------------------------
// Atividades — log de interação/follow-up (ligação, WhatsApp, visita...).
// Registrar uma atividade atualiza ultimaInteracaoEm e, se informado, agenda
// a próxima ação — é o que alimenta "follow-ups pendentes" do Meu Painel.
// ---------------------------------------------------------------------------

router.post('/:id/atividades', requireAuth, async (req: Request, res: Response) => {
  const parse = atividadeSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const escopo = await escopoVisibilidade(prisma, req.user!)
  const oportunidade = await prisma.oportunidade.findFirst({
    where: { id: String(req.params.id), empresaId: req.user!.empresaId, ...escopoWhereDono(escopo, 'responsavelId') },
  })
  if (!oportunidade) {
    res.status(404).json({ error: 'Oportunidade não encontrada' })
    return
  }

  const { proximaAcaoEm, proximaAcaoDescricao, ...dadosAtividade } = parse.data
  const empresaId = req.user!.empresaId

  const [atividade] = await prisma.$transaction([
    prisma.atividadeOportunidade.create({
      data: { ...dadosAtividade, empresaId, oportunidadeId: oportunidade.id, usuarioId: req.user!.sub },
      include: { usuario: { select: { id: true, nome: true } } },
    }),
    prisma.oportunidade.update({
      where: { id: oportunidade.id },
      data: {
        ultimaInteracaoEm: new Date(),
        ...(proximaAcaoEm ? { proximaAcaoEm } : {}),
        ...(proximaAcaoDescricao ? { proximaAcaoDescricao } : {}),
      },
    }),
  ])

  res.status(201).json(atividade)
})

// ---------------------------------------------------------------------------
// Apagar em lote — o vendedor seleciona cards no CRM e apaga de uma vez, em
// vez de excluir um por um. Escopo de visibilidade já garante que ninguém
// apaga oportunidade de outra pessoa (mesmo filtro usado em toda leitura/
// escrita individual). Sem restrição por estágio: se o card tem contrato
// fechado, o contrato (e as contas a receber dele) são apagados junto.
// ---------------------------------------------------------------------------

const deletarLoteSchema = z.object({ ids: z.array(z.string()).min(1) })

router.delete('/', requireAuth, async (req: Request, res: Response) => {
  const parse = deletarLoteSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }

  const escopo = await escopoVisibilidade(prisma, req.user!)
  const oportunidades = await prisma.oportunidade.findMany({
    where: { id: { in: parse.data.ids }, empresaId: req.user!.empresaId, ...escopoWhereDono(escopo, 'responsavelId') },
    select: { id: true },
  })
  const ids = oportunidades.map(o => o.id)
  if (ids.length === 0) {
    res.json({ apagadas: 0 })
    return
  }

  const contratos = await prisma.contrato.findMany({ where: { oportunidadeId: { in: ids } }, select: { id: true } })
  const contratoIds = contratos.map(c => c.id)

  await prisma.$transaction([
    prisma.contaReceber.deleteMany({ where: { contratoId: { in: contratoIds } } }),
    prisma.contrato.deleteMany({ where: { oportunidadeId: { in: ids } } }),
    prisma.atividadeOportunidade.deleteMany({ where: { oportunidadeId: { in: ids } } }),
    prisma.estagioHistorico.deleteMany({ where: { oportunidadeId: { in: ids } } }),
    prisma.oportunidade.deleteMany({ where: { id: { in: ids } } }),
  ])

  res.json({ apagadas: ids.length })
})

export default router
