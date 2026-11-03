// Saúde do sistema para o dono: o tamanho do banco contra o limite do plano
// (aviso no topo do painel a partir de 400 MB) e a importação do histórico do
// banco antigo (Neon), só do dono.
import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { requireDono, requireProLaboreAuth } from '../middleware/authProLabore'
import { tamanhoDoBanco } from '../lib/bancoDisponivel'
import { ErroEspaco, liberarEspaco, painelEspaco } from '../lib/espacoBanco'
import { ErroImportacao, descartarImportacao, rodarImportacao, simularImportacao, statusImportacao } from '../lib/importacaoNeon'

const router = Router()

router.get('/sistema/banco', requireProLaboreAuth, requireDono, async (_req: Request, res: Response) => {
  const r = await tamanhoDoBanco(async () => {
    const [{ bytes }] = await prisma.$queryRaw<Array<{ bytes: bigint }>>`SELECT pg_database_size(current_database()) AS bytes`
    return Number(bytes)
  })
  res.json(r)
})

const dono = [requireProLaboreAuth, requireDono]

// Espaço do banco: o que mais ocupa e o que dá para liberar sem perder nada.
router.get('/sistema/espaco', ...dono, async (_req: Request, res: Response) => {
  res.json(await painelEspaco())
})

// Uma rodada (tempo limitado): a tela chama de novo enquanto houver restantes.
router.post('/sistema/espaco/liberar', ...dono, async (req: Request, res: Response) => {
  const acao = String(req.body?.acao ?? '')
  if (!['eventos', 'imagens', 'midias', 'compactar', 'vercel'].includes(acao)) { res.status(400).json({ error: 'Ação inválida' }); return }
  try {
    const rodada = await liberarEspaco(acao as 'eventos' | 'imagens' | 'midias' | 'compactar' | 'vercel')
    res.json({ rodada, ...(await painelEspaco()) })
  } catch (e) {
    if (e instanceof ErroEspaco) { res.status(e.status).json({ error: e.message }); return }
    throw e
  }
})
function falha(res: Response, e: unknown) {
  if (e instanceof ErroImportacao) { res.status(e.status).json({ error: e.message }); return }
  throw e
}

router.get('/sistema/importacao-neon', ...dono, async (req: Request, res: Response) => {
  res.json(await statusImportacao(req.proLaboreUser!.sub))
})

// Simulação: lê o banco antigo e mostra o que entraria (nada é gravado nas tabelas da conta).
router.post('/sistema/importacao-neon/simular', ...dono, async (req: Request, res: Response) => {
  try { res.json(await simularImportacao(req.proLaboreUser!.sub)) } catch (e) { falha(res, e) }
})

// Uma rodada da importação (tempo limitado): a tela chama de novo até concluir.
router.post('/sistema/importacao-neon/importar', ...dono, async (req: Request, res: Response) => {
  try { res.json(await rodarImportacao(req.proLaboreUser!.sub)) } catch (e) { falha(res, e) }
})

router.delete('/sistema/importacao-neon', ...dono, async (req: Request, res: Response) => {
  await descartarImportacao(req.proLaboreUser!.sub)
  res.json(await statusImportacao(req.proLaboreUser!.sub))
})

export default router
