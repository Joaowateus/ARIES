// Follow automático do Assistente (aba "Follow"): as mensagens da cadência,
// a chave (começa desligada, para o dono revisar antes) e a fila do que vai
// sair. Mudar é da gestão; o vendedor vê a própria fila.
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { requireProLaboreAuth } from '../middleware/authProLabore'
import { requireModulo } from '../lib/acessos'
import { MIDIAS_FOLLOW, dentroDoHorario, inicioDoDiaBrt, lerConfigFollow } from '../lib/assistenteFollow'
import { filaDeFollow } from '../lib/assistenteMotor'

const router = Router()
const ver = [requireProLaboreAuth, requireModulo('assistente', 'VER')]
const editar = [requireProLaboreAuth, requireModulo('assistente', 'EDITAR')]
const daGestao = (req: Request) => req.proLaboreUser!.papel === 'DONO' || req.proLaboreUser!.papel === 'SUPERVISOR'

router.get('/assistente/follow', ...ver, async (req: Request, res: Response) => {
  const { sub: usuarioId, vendedorId } = req.proLaboreUser!
  const gestao = daGestao(req)
  const agora = new Date()
  const loja = await prisma.assistenteLoja.findUnique({ where: { usuarioId } })
  const config = lerConfigFollow(loja?.followConfig)
  const doVendedor = gestao ? null : vendedorId ?? '-'
  const [fila, enviadosHoje, ultimos] = await Promise.all([
    filaDeFollow(usuarioId, doVendedor, agora),
    prisma.assistenteMensagem.count({ where: { origem: 'FOLLOW', criadoEm: { gte: inicioDoDiaBrt(agora) }, conversa: { assistente: { vendedor: { usuarioId, ...(doVendedor && { id: doVendedor }) } } } } }),
    prisma.assistenteMensagem.findMany({
      where: { origem: 'FOLLOW', conversa: { assistente: { vendedor: { usuarioId, ...(doVendedor && { id: doVendedor }) } } } },
      orderBy: { criadoEm: 'desc' }, take: 10,
      select: { id: true, texto: true, midiaUrl: true, criadoEm: true, conversa: { select: { id: true, nomeContato: true } } },
    }),
  ])
  res.json({ ativo: loja?.followAtivo ?? false, config, podeEditar: gestao, noHorario: dentroDoHorario(agora, config), enviadosHoje, fila, ultimos })
})

const salvarSchema = z.object({
  ativo: z.boolean().optional(),
  config: z.object({
    passos: z.array(z.object({ dias: z.number().int().min(1).max(30), texto: z.string().trim().min(5, 'Escreva a mensagem do passo').max(600), midia: z.enum(MIDIAS_FOLLOW as [string, ...string[]]) })).min(1).max(5),
    tetoDiario: z.number().int().min(1).max(100),
    horaInicio: z.number().int().min(7).max(20),
    horaFim: z.number().int().min(8).max(21),
  }).optional(),
})

router.put('/assistente/follow', ...editar, async (req: Request, res: Response) => {
  if (!daGestao(req)) { res.status(403).json({ error: 'Só o dono ou o supervisor muda o follow automático' }); return }
  const p = salvarSchema.safeParse(req.body)
  if (!p.success) { res.status(400).json({ error: p.error.issues[0].message }); return }
  if (p.data.config) {
    const dias = p.data.config.passos.map(x => x.dias)
    if (dias.some((d, i) => i > 0 && d <= dias[i - 1])) { res.status(400).json({ error: 'Os passos precisam estar em dias crescentes (ex.: 1, 3, 7)' }); return }
    if (p.data.config.horaFim <= p.data.config.horaInicio) { res.status(400).json({ error: 'O horário final precisa ser depois do inicial' }); return }
  }
  const usuarioId = req.proLaboreUser!.sub
  const dados = {
    ...(p.data.ativo !== undefined && { followAtivo: p.data.ativo }),
    ...(p.data.config && { followConfig: lerConfigFollow(p.data.config) as unknown as Prisma.InputJsonValue }),
  }
  const loja = await prisma.assistenteLoja.upsert({ where: { usuarioId }, update: dados, create: { usuarioId, ...dados } })
  res.json({ ativo: loja.followAtivo, config: lerConfigFollow(loja.followConfig) })
})

export default router
