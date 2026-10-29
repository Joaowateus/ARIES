// Referências (aba do Social Media, benchmark): vídeos públicos do Instagram
// com mais engajamento por moto do estoque e os perfis de referência. Ver
// é de quem tem Produção; mudar (perfis, hashtags, atualizar) é de quem tem
// Produção completa (o gestor sempre).
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { requireProLaboreAuth } from '../middleware/authProLabore'
import { contextoSM, requireModuloSM } from '../lib/smAcesso'
import { ErroReferencia, adicionarPerfil, atualizarReferencias, painelReferencias, removerPerfil, salvarHashtags } from '../lib/smReferencias'

const router = Router()
const autenticado = [requireProLaboreAuth, contextoSM]
const editar = [...autenticado, requireModuloSM('producao', 'COMPLETO')]

async function responder(req: Request, res: Response, status = 200) {
  const sm = req.sm!
  res.status(status).json({ ...(await painelReferencias(sm.usuarioId)), podeEditar: sm.pode('producao', 'COMPLETO') && !sm.verComo })
}
function falha(res: Response, e: unknown) {
  if (e instanceof ErroReferencia) { res.status(e.status).json({ error: e.message }); return }
  throw e
}

router.get('/sm/referencias', ...autenticado, requireModuloSM('producao', 'LEITURA'), (req: Request, res: Response) => responder(req, res))

router.post('/sm/referencias/perfis', ...editar, async (req: Request, res: Response) => {
  const p = z.object({ usuario: z.string().trim().min(1, 'Informe o @ do perfil').max(120) }).safeParse(req.body)
  if (!p.success) { res.status(400).json({ error: p.error.issues[0].message }); return }
  try { await adicionarPerfil(req.sm!.usuarioId, p.data.usuario); await responder(req, res, 201) } catch (e) { falha(res, e) }
})

router.delete('/sm/referencias/perfis/:id', ...editar, async (req: Request, res: Response) => {
  try { await removerPerfil(req.sm!.usuarioId, String(req.params.id)); await responder(req, res) } catch (e) { falha(res, e) }
})

router.put('/sm/referencias/motos/:chave/hashtags', ...editar, async (req: Request, res: Response) => {
  const p = z.object({ hashtags: z.array(z.string().max(80)).max(5) }).safeParse(req.body)
  if (!p.success) { res.status(400).json({ error: 'Lista de hashtags inválida' }); return }
  try { await salvarHashtags(req.sm!.usuarioId, String(req.params.chave), p.data.hashtags); await responder(req, res) } catch (e) { falha(res, e) }
})

// "Atualizar agora": perfis e as motos sem busca recente (respeita o limite semanal de hashtags).
router.post('/sm/referencias/atualizar', ...editar, async (req: Request, res: Response) => {
  await atualizarReferencias(req.sm!.usuarioId, { prazoMs: 20_000 })
  await responder(req, res)
})

export default router
