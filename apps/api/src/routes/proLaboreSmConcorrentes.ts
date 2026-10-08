// Fase 6 · Concorrentes (subseção do Desempenho, decisão P12): a lista é do
// gestor (adicionar, remover, atualizar agora); o Social Media vê a
// comparação com o módulo Análise. Dados públicos pela Business Discovery API.
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireProLaboreAuth } from '../middleware/authProLabore'
import { contextoSM, requireGestorSM, requireModuloSM } from '../lib/smAcesso'
import { ErroConcorrente, adicionarConcorrente, painelConcorrentes, removerConcorrente, retratar } from '../lib/smConcorrentes'

const router = Router()
const autenticado = [requireProLaboreAuth, contextoSM]

async function responder(req: Request, res: Response, status = 200) {
  const sm = req.sm!
  res.status(status).json({ ...(await painelConcorrentes(sm.usuarioId)), podeEditar: sm.visao === 'GESTOR' && !sm.verComo })
}
function falha(res: Response, e: unknown) {
  if (e instanceof ErroConcorrente) { res.status(e.status).json({ error: e.message }); return }
  throw e
}

router.get('/sm/concorrentes', ...autenticado, requireModuloSM('analise', 'LEITURA'), (req: Request, res: Response) => responder(req, res))

router.post('/sm/concorrentes', ...autenticado, requireGestorSM, async (req: Request, res: Response) => {
  const parse = z.object({ usuario: z.string().trim().min(1, 'Informe o @ do perfil').max(120) }).safeParse(req.body)
  if (!parse.success) { res.status(400).json({ error: parse.error.issues[0].message }); return }
  try { await adicionarConcorrente(req.sm!.usuarioId, parse.data.usuario); await responder(req, res, 201) } catch (e) { falha(res, e) }
})

router.delete('/sm/concorrentes/:id', ...autenticado, requireGestorSM, async (req: Request, res: Response) => {
  try { await removerConcorrente(req.sm!.usuarioId, String(req.params.id)); await responder(req, res) } catch (e) { falha(res, e) }
})

router.post('/sm/concorrentes/atualizar', ...autenticado, requireGestorSM, async (req: Request, res: Response) => {
  const usuarioId = req.sm!.usuarioId
  const lista = await prisma.smConcorrente.findMany({ where: { usuarioId }, select: { id: true } })
  for (const c of lista) await retratar(usuarioId, c.id)
  await responder(req, res)
})

export default router
