// Referências (aba do Social Media, benchmark): vídeos públicos do Instagram
// com mais engajamento por moto do estoque e os perfis de referência. Ver
// é de quem tem Produção; mudar (perfis, hashtags, atualizar) é de quem tem
// Produção completa (o gestor sempre).
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { requireProLaboreAuth } from '../middleware/authProLabore'
import { contextoSM, requireModuloSM } from '../lib/smAcesso'
import {
  ErroReferencia, STATUS_SALVA, TIPOS_PERFIL, adicionarPerfil, atualizarReferencias, atualizarSalva, criarPautaDaSalva, definirTipoPerfil,
  importarConcorrentes, painelReferencias, removerPerfil, removerSalva, salvarHashtags, salvarReferencia,
} from '../lib/smReferencias'

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
  const p = z.object({ usuario: z.string().trim().min(1, 'Informe o @ do perfil').max(120), tipo: z.enum(TIPOS_PERFIL).optional() }).safeParse(req.body)
  if (!p.success) { res.status(400).json({ error: p.error.issues[0].message }); return }
  try { await adicionarPerfil(req.sm!.usuarioId, p.data.usuario, p.data.tipo); await responder(req, res, 201) } catch (e) { falha(res, e) }
})

// Concorrente (espionar) ou referência (inspiração).
router.put('/sm/referencias/perfis/:id/tipo', ...editar, async (req: Request, res: Response) => {
  const p = z.object({ tipo: z.enum(TIPOS_PERFIL) }).safeParse(req.body)
  if (!p.success) { res.status(400).json({ error: 'Tipo inválido' }); return }
  try { await definirTipoPerfil(req.sm!.usuarioId, String(req.params.id), p.data.tipo); await responder(req, res) } catch (e) { falha(res, e) }
})

// Os concorrentes já acompanhados no Desempenho.
router.post('/sm/referencias/perfis/importar', ...editar, async (req: Request, res: Response) => {
  try { await importarConcorrentes(req.sm!.usuarioId); await responder(req, res, 201) } catch (e) { falha(res, e) }
})

router.delete('/sm/referencias/perfis/:id', ...editar, async (req: Request, res: Response) => {
  try { await removerPerfil(req.sm!.usuarioId, String(req.params.id)); await responder(req, res) } catch (e) { falha(res, e) }
})

router.put('/sm/referencias/motos/:chave/hashtags', ...editar, async (req: Request, res: Response) => {
  const p = z.object({ hashtags: z.array(z.string().max(80)).max(5) }).safeParse(req.body)
  if (!p.success) { res.status(400).json({ error: 'Lista de hashtags inválida' }); return }
  try { await salvarHashtags(req.sm!.usuarioId, String(req.params.chave), p.data.hashtags); await responder(req, res) } catch (e) { falha(res, e) }
})

// Salvos: o banco de referências da equipe (anotação, andamento e pauta).
router.post('/sm/referencias/salvos', ...editar, async (req: Request, res: Response) => {
  const p = z.object({ postId: z.string().min(1), nota: z.string().max(1000).nullable().optional() }).safeParse(req.body)
  if (!p.success) { res.status(400).json({ error: 'Post inválido' }); return }
  try { await salvarReferencia(req.sm!.usuarioId, p.data.postId, p.data.nota); await responder(req, res, 201) } catch (e) { falha(res, e) }
})

router.patch('/sm/referencias/salvos/:id', ...editar, async (req: Request, res: Response) => {
  const p = z.object({ status: z.enum(STATUS_SALVA).optional(), nota: z.string().max(1000).nullable().optional() }).safeParse(req.body)
  if (!p.success) { res.status(400).json({ error: 'Dados inválidos' }); return }
  try { await atualizarSalva(req.sm!.usuarioId, String(req.params.id), p.data); await responder(req, res) } catch (e) { falha(res, e) }
})

router.delete('/sm/referencias/salvos/:id', ...editar, async (req: Request, res: Response) => {
  try { await removerSalva(req.sm!.usuarioId, String(req.params.id)); await responder(req, res) } catch (e) { falha(res, e) }
})

// A referência vira pauta (Ideia) na Produção.
router.post('/sm/referencias/salvos/:id/pauta', ...editar, async (req: Request, res: Response) => {
  try {
    const pautaId = await criarPautaDaSalva(req.sm!.usuarioId, String(req.params.id), req.sm!.visao === 'GESTOR' ? 'GESTOR' : 'SOCIAL_MEDIA')
    res.status(201).json({ ...(await painelReferencias(req.sm!.usuarioId)), podeEditar: true, pautaId })
  } catch (e) { falha(res, e) }
})

// "Atualizar agora": perfis e as motos sem busca recente (respeita o limite semanal de hashtags).
router.post('/sm/referencias/atualizar', ...editar, async (req: Request, res: Response) => {
  const rodada = await atualizarReferencias(req.sm!.usuarioId, { prazoMs: 20_000 })
  res.json({ ...(await painelReferencias(req.sm!.usuarioId)), podeEditar: true, rodada })
})

export default router
