import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'

const router = Router()

const criarContratoSchema = z.object({
  oportunidadeId: z.string(),
  nomeCliente: z.string().min(2),
  cpfCliente: z.string().optional(),
  telefoneCliente: z.string().optional(),
  valorTotal: z.number().positive(),
  entrada: z.number().min(0).default(0),
  parcelas: z.number().int().min(1).max(60).default(1),
  observacoes: z.string().optional(),
})

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const contratos = await prisma.contrato.findMany({
    where: { empresaId: req.user!.empresaId, status: { not: 'CANCELADO' } },
    include: {
      unidade: { select: { id: true, nome: true, marca: true, modelo: true } },
      vendedor: { select: { id: true, nome: true } },
      contasReceber: true,
    },
    orderBy: { criadoEm: 'desc' },
  })
  res.json(contratos)
})

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const parse = criarContratoSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }

  const { oportunidadeId, valorTotal, entrada, parcelas, ...resto } = parse.data

  // Verificar que a oportunidade existe e pertence à empresa
  const oportunidade = await prisma.oportunidade.findFirst({
    where: { id: oportunidadeId, empresaId: req.user!.empresaId },
  })
  if (!oportunidade) {
    res.status(404).json({ error: 'Oportunidade não encontrada' })
    return
  }
  if (oportunidade.statusFinal === 'GANHO') {
    // já tem contrato — checar
    const existente = await prisma.contrato.findUnique({ where: { oportunidadeId } })
    if (existente) {
      res.status(409).json({ error: 'Esta oportunidade já possui contrato' })
      return
    }
  }

  // Calcular parcelas
  const valorFinanciado = valorTotal - (entrada ?? 0)
  const valorParcela = parcelas > 0 ? valorFinanciado / parcelas : valorFinanciado
  const hoje = new Date()

  const contasReceber: {
    empresaId: string
    descricao: string
    valor: number
    vencimento: Date
  }[] = []

  if ((entrada ?? 0) > 0) {
    contasReceber.push({
      empresaId: req.user!.empresaId,
      descricao: 'Entrada',
      valor: entrada ?? 0,
      vencimento: hoje,
    })
  }

  for (let i = 1; i <= (parcelas ?? 1); i++) {
    const vencimento = new Date(hoje)
    vencimento.setMonth(vencimento.getMonth() + i)
    contasReceber.push({
      empresaId: req.user!.empresaId,
      descricao: parcelas === 1 ? 'Pagamento à vista' : `Parcela ${i}/${parcelas}`,
      valor: Math.round(valorParcela * 100) / 100,
      vencimento,
    })
  }

  const contrato = await prisma.$transaction(async tx => {
    // Criar contrato com contas a receber
    const c = await tx.contrato.create({
      data: {
        empresaId: req.user!.empresaId,
        oportunidadeId,
        unidadeId: oportunidade.unidadeId,
        vendedorId: oportunidade.responsavelId ?? req.user!.sub,
        valorTotal,
        entrada: entrada ?? 0,
        parcelas: parcelas ?? 1,
        ...resto,
        contasReceber: { create: contasReceber },
      },
      include: { contasReceber: true, unidade: { select: { id: true, nome: true } } },
    })

    // Mover oportunidade para GANHO
    await tx.oportunidade.update({
      where: { id: oportunidadeId },
      data: { estagio: 'GANHO', statusFinal: 'GANHO', fechadaEm: new Date() },
    })

    // Marcar unidade como VENDIDA
    if (oportunidade.unidadeId) {
      await tx.unidade.update({
        where: { id: oportunidade.unidadeId },
        data: { situacao: 'VENDIDA' },
      })
    }

    return c
  })

  res.status(201).json(contrato)
})

router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  const contrato = await prisma.contrato.findFirst({
    where: { id: String(req.params.id), empresaId: req.user!.empresaId },
    include: {
      unidade: true,
      vendedor: { select: { id: true, nome: true } },
      contasReceber: { orderBy: { vencimento: 'asc' } },
      oportunidade: { select: { id: true, nomeCliente: true, origem: true } },
    },
  })
  if (!contrato) {
    res.status(404).json({ error: 'Contrato não encontrado' })
    return
  }
  res.json(contrato)
})

export default router
