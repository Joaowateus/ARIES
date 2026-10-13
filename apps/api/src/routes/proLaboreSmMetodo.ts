// Método do Social Media: a cadência (três posts, três vezes ao dia) com as
// vagas do dia preenchidas pelas pautas e posts, e a escada do desejo, cujo
// degrau atual o gestor define. A hierarquia das métricas vem do Desempenho.
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireProLaboreAuth } from '../middleware/authProLabore'
import { contextoSM, requireGestorSM, requireModuloSM } from '../lib/smAcesso'
import { carregarConfig } from '../lib/smCalendario'
import { DEGRAUS_ESCADA, cadenciaDoPerfil } from '../lib/smMetodo'

const router = Router()
const autenticado = [requireProLaboreAuth, contextoSM]
/** Três rodadas de Topo, Meio e Fundo por dia. */
const POSTS_DIA_METODO = 9

async function escada(usuarioId: string) {
  const c = await prisma.smConfig.findUnique({ where: { usuarioId }, select: { escadaDegrau: true, escadaNota: true, escadaDefinidaEm: true } })
  return { degraus: DEGRAUS_ESCADA, atual: c?.escadaDegrau ?? null, nota: c?.escadaNota ?? null, definidaEm: c?.escadaDefinidaEm ?? null }
}

router.get('/sm/metodo', ...autenticado, requireModuloSM('producao', 'LEITURA'), async (req: Request, res: Response) => {
  const sm = req.sm!
  const [cadencia, esc, config] = await Promise.all([cadenciaDoPerfil(sm.usuarioId), escada(sm.usuarioId), carregarConfig(sm.usuarioId)])
  res.json({
    cadencia: { ...cadencia, maxPostsDiaRegra: config.maxPostsDia, postsDiaMetodo: POSTS_DIA_METODO },
    escada: esc,
    souGestor: sm.visao === 'GESTOR' && !sm.verComo,
    podeEditarPauta: sm.pode('producao', 'COMPLETO') && !sm.somenteLeitura,
  })
})

const escadaSchema = z.object({
  degrau: z.number().int().min(1).max(6).nullable(),
  nota: z.string().trim().max(500).nullable().optional(),
})

router.put('/sm/metodo/escada', ...autenticado, requireGestorSM, async (req: Request, res: Response) => {
  const parse = escadaSchema.safeParse(req.body)
  if (!parse.success) { res.status(400).json({ error: 'Escolha um degrau de 1 a 6' }); return }
  const usuarioId = req.sm!.usuarioId
  const dados = { escadaDegrau: parse.data.degrau, escadaNota: parse.data.nota || null, escadaDefinidaEm: parse.data.degrau ? new Date() : null }
  await prisma.smConfig.upsert({ where: { usuarioId }, create: { usuarioId, ...dados }, update: dados })
  res.json(await escada(usuarioId))
})

// As regras do Calendário vêm de antes do método (máx. 2 posts por dia):
// o gestor alinha o limite com a cadência de 9 por dia.
router.post('/sm/metodo/aplicar-cadencia', ...autenticado, requireGestorSM, async (req: Request, res: Response) => {
  const usuarioId = req.sm!.usuarioId
  await prisma.smConfig.upsert({ where: { usuarioId }, create: { usuarioId, maxPostsDia: POSTS_DIA_METODO }, update: { maxPostsDia: POSTS_DIA_METODO } })
  res.json({ maxPostsDia: POSTS_DIA_METODO })
})

export default router
