import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireAuth, requirePapel } from '../middleware/auth'
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
  tipoLead: z.enum(['TRAFEGO', 'ORGANICO']).optional(),
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
  const tipoLead = typeof req.query.tipoLead === 'string' ? req.query.tipoLead : undefined
  const escopo = await escopoVisibilidade(prisma, req.user!)

  const oportunidades = await prisma.oportunidade.findMany({
    where: {
      empresaId: req.user!.empresaId,
      ...escopoWhereDono(escopo, 'responsavelId'),
      ...(estagio ? { estagio } : {}),
      ...(responsavelId ? { responsavelId } : {}),
      ...(tipoLead ? { tipoLead } : {}),
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
  const diasPorOportunidade = diasNaEtapaAtualPorOportunidade(
    oportunidade.historicoEstagio.map(h => ({ oportunidadeId: oportunidade.id, estagioNovo: h.estagioNovo, criadoEm: h.criadoEm }))
  )
  res.json({
    ...oportunidade,
    diasNaEtapaAtual: diasPorOportunidade.has(oportunidade.id) ? Math.round(diasPorOportunidade.get(oportunidade.id)! * 10) / 10 : null,
  })
})

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const parse = criarSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const data = parse.data
  const empresaId = req.user!.empresaId
  const responsavelId = data.responsavelId ?? req.user!.sub

  const oportunidade = await prisma.$transaction(async tx => {
    const nova = await tx.oportunidade.create({
      data: {
        ...data,
        email: data.email || undefined,
        empresaId,
        responsavelId,
        estagio: 'NOVO_LEAD',
      },
      include,
    })
    await tx.estagioHistorico.create({
      data: { empresaId, oportunidadeId: nova.id, estagioAnterior: null, estagioNovo: 'NOVO_LEAD' },
    })
    // Contador permanente — nunca apagado, mesmo se este card for excluído
    // do CRM depois (ver DELETE /oportunidades e lib/funil.ts).
    await tx.leadRegistrado.create({ data: { empresaId, usuarioId: responsavelId, tipoLead: data.tipoLead } })
    return nova
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

// ---------------------------------------------------------------------------
// Limpar histórico — reset total do CRM e do Funil de Vendas, pra quando for
// preciso reorganizar tudo do zero. Diferente do apagar em lote (que só
// remove o que foi selecionado), aqui é literalmente tudo: toda oportunidade
// do usuário, contrato, contas a receber, atividade, histórico de estágio E
// o contador permanente de leads (LeadRegistrado) — inclusive vendas já
// fechadas. Sempre escopado ao próprio usuário que chama, mesmo pra quem tem
// visão de equipe/empresa, pra um gestor nunca apagar sem querer o CRM de
// outra pessoa.
// ---------------------------------------------------------------------------

router.delete('/limpar-historico', requireAuth, async (req: Request, res: Response) => {
  const empresaId = req.user!.empresaId
  const usuarioId = req.user!.sub

  const minhasOportunidades = await prisma.oportunidade.findMany({
    where: { empresaId, responsavelId: usuarioId },
    select: { id: true },
  })
  const ids = minhasOportunidades.map(o => o.id)

  const meusContratos = await prisma.contrato.findMany({
    where: { empresaId, OR: [{ oportunidadeId: { in: ids } }, { vendedorId: usuarioId }] },
    select: { id: true },
  })
  const contratoIds = meusContratos.map(c => c.id)

  const [, contratosApagados, , , oportunidadesApagadas, leadsApagados] = await prisma.$transaction([
    prisma.contaReceber.deleteMany({ where: { contratoId: { in: contratoIds } } }),
    prisma.contrato.deleteMany({ where: { id: { in: contratoIds } } }),
    prisma.atividadeOportunidade.deleteMany({ where: { oportunidadeId: { in: ids } } }),
    prisma.estagioHistorico.deleteMany({ where: { oportunidadeId: { in: ids } } }),
    prisma.oportunidade.deleteMany({ where: { id: { in: ids } } }),
    prisma.leadRegistrado.deleteMany({ where: { empresaId, usuarioId } }),
  ])

  res.json({
    oportunidadesApagadas: oportunidadesApagadas.count,
    contratosApagados: contratosApagados.count,
    leadsApagados: leadsApagados.count,
  })
})

// ---------------------------------------------------------------------------
// Importação pontual do histórico de vendas do Wanderson (relatório de
// balanceamento comercial, jan-jul/2026). Feita via API em vez de migração
// de banco porque a migração equivalente (rodada no boot do container em
// produção) não deixou o histórico visível pro vendedor — usar o mesmo
// Prisma client que já serve o resto do app garante que grava exatamente
// onde a tela lê. Só gestão pode disparar (afeta a conta de outra pessoa).
// Idempotente: pula qualquer venda que já exista pro vendedor (mesmo nome +
// mesma data), então pode ser chamada de novo sem duplicar nada.
// ---------------------------------------------------------------------------

const HISTORICO_WANDERSON: { data: string; modelo: string; valor: number; banco: string }[] = [
  { data: '2026-01-04', modelo: 'CB 250', valor: 23900, banco: 'PAN' },
  { data: '2026-01-09', modelo: 'R15', valor: 18533, banco: 'PAN' },
  { data: '2026-01-14', modelo: '500 F', valor: 40900, banco: 'SANTANDER' },
  { data: '2026-01-19', modelo: 'BROS 2020', valor: 22600, banco: 'PAN' },
  { data: '2026-02-03', modelo: 'XRE 2015', valor: 15900, banco: 'PAN' },
  { data: '2026-02-10', modelo: 'MT 03', valor: 27900, banco: 'SANTANDER' },
  { data: '2026-02-25', modelo: 'TITAN 160', valor: 20000, banco: 'SANTANDER' },
  { data: '2026-03-02', modelo: 'LANDER 250 AZUL', valor: 26900, banco: 'BV' },
  { data: '2026-03-05', modelo: 'PCX 2024', valor: 24500, banco: 'A VISTA' },
  { data: '2026-03-08', modelo: 'FZ 25 AZUL', valor: 25900, banco: 'BV' },
  { data: '2026-03-11', modelo: 'START VERMELHA', valor: 16000, banco: 'PAN' },
  { data: '2026-03-14', modelo: 'CB 250 TW BRANCA', valor: 24000, banco: 'PAN' },
  { data: '2026-03-17', modelo: 'CB 300F VERMELHA', valor: 28000, banco: 'BV' },
  { data: '2026-03-20', modelo: 'R15', valor: 24900, banco: 'BV' },
  { data: '2026-03-23', modelo: 'CB 300F VERMELHA 2', valor: 27000, banco: 'PAN' },
  { data: '2026-04-02', modelo: 'FAN 150 2021', valor: 18000, banco: 'PAN' },
  { data: '2026-04-07', modelo: 'TITAN LARANJA', valor: 26000, banco: 'SANTANDER' },
  { data: '2026-04-12', modelo: 'MT 03', valor: 26000, banco: 'BV' },
  { data: '2026-04-17', modelo: 'LANDER 250 PRETA', valor: 26000, banco: 'BV' },
  { data: '2026-04-22', modelo: 'TITAN AZUL 2021', valor: 21000, banco: 'SANTANDER' },
  { data: '2026-04-27', modelo: 'FZ 15 VERMELHA', valor: 26000, banco: 'PAN' },
  { data: '2026-05-08', modelo: 'BROS PRETA 2021', valor: 23900, banco: 'SANTANDER' },
  { data: '2026-05-22', modelo: 'CB TWISTER 250', valor: 21000, banco: 'SANTANDER' },
  { data: '2026-06-15', modelo: 'BROS AZUL 2021', valor: 22900, banco: 'PAN' },
  { data: '2026-07-15', modelo: 'CB 300F', valor: 28900, banco: 'PAN' },
]

router.post(
  '/importar-historico-wanderson',
  requireAuth,
  requirePapel('ADMINISTRADOR', 'DIRETOR_COMERCIAL', 'GERENTE_COMERCIAL'),
  async (req: Request, res: Response) => {
    const empresaId = req.user!.empresaId
    const vendedor = await prisma.usuario.findFirst({
      where: { empresaId, email: 'consultorwandersonmmnegocios@gmail.com' },
      select: { id: true },
    })
    if (!vendedor) {
      res.status(404).json({ error: 'Conta do Wanderson não encontrada nesta empresa' })
      return
    }

    let importadas = 0
    let jaExistiam = 0
    let valorTotal = 0

    for (const venda of HISTORICO_WANDERSON) {
      const nomeCliente = `Venda histórica — ${venda.modelo}`
      const criadaEm = new Date(`${venda.data}T00:00:00`)

      const existente = await prisma.oportunidade.findFirst({
        where: { empresaId, responsavelId: vendedor.id, nomeCliente, criadaEm },
        select: { id: true },
      })
      if (existente) {
        jaExistiam++
        continue
      }

      const observacoes = `Importado do relatório de balanceamento comercial (histórico, sem jornada detalhada no CRM). Modelo: ${venda.modelo} · Banco: ${venda.banco}`

      await prisma.$transaction(async (tx) => {
        const oportunidade = await tx.oportunidade.create({
          data: {
            empresaId,
            responsavelId: vendedor.id,
            nomeCliente,
            estagio: 'COMPRADO',
            origem: 'SDR',
            valor: venda.valor,
            statusFinal: 'COMPRADO',
            fechadaEm: criadaEm,
            criadaEm,
            observacoes,
          },
        })
        await tx.contrato.create({
          data: {
            empresaId,
            oportunidadeId: oportunidade.id,
            vendedorId: vendedor.id,
            nomeCliente,
            valorTotal: venda.valor,
            status: 'ATIVO',
            processoAdministrativoStatus: 'CONCLUIDO',
            criadoEm: criadaEm,
            observacoes: `Importado do relatório de balanceamento comercial. Modelo: ${venda.modelo} · Banco: ${venda.banco}`,
          },
        })
      })
      importadas++
      valorTotal += venda.valor
    }

    res.json({ importadas, jaExistiam, valorTotal })
  }
)

export default router
