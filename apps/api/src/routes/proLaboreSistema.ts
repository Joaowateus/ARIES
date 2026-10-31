// Saúde do sistema para o dono: o tamanho do banco contra o limite do plano
// (aviso no topo do painel a partir de 400 MB) e a importação do histórico do
// banco antigo (Neon), só do dono.
import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { requireDono, requireProLaboreAuth } from '../middleware/authProLabore'
import { tamanhoDoBanco } from '../lib/bancoDisponivel'
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
