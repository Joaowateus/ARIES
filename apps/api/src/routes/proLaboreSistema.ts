// Saúde do sistema para o dono: o tamanho do banco contra o limite do plano
// (aviso no topo do painel a partir de 400 MB) e a importação do histórico do
// banco antigo (Neon), só do dono.
import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { requireDono, requireProLaboreAuth } from '../middleware/authProLabore'
import { tamanhoDoBanco } from '../lib/bancoDisponivel'
import { ErroEspaco, liberarEspaco, painelEspaco } from '../lib/espacoBanco'
import { ErroAuditoria, auditarDados, vendasDoMes, corrigirDados, desfazerCorrecao } from '../lib/auditoriaDados'
import { conferirMeses } from '../lib/conferenciaMensal'
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

// Conferência automática dos números, mês a mês (só lê).
router.get('/sistema/conferencia', ...dono, async (req: Request, res: Response) => {
  res.json(await conferirMeses(req.proLaboreUser!.sub))
})

// Auditoria dos dados: repetidos depois da importação, mês a mês (só lê).
router.get('/sistema/auditoria', ...dono, async (req: Request, res: Response) => {
  res.json(await auditarDados(req.proLaboreUser!.sub))
})

router.get('/sistema/auditoria/vendas', ...dono, async (req: Request, res: Response) => {
  try { res.json(await vendasDoMes(req.proLaboreUser!.sub, String(req.query.mes ?? ''))) } catch (e) {
    if (e instanceof ErroAuditoria) { res.status(e.status).json({ error: e.message }); return }
    throw e
  }
})

// Corrige os itens escolhidos (uma rodada com tempo limitado; a tela chama de novo enquanto houver restantes).
router.post('/sistema/auditoria/corrigir', ...dono, async (req: Request, res: Response) => {
  const chaves = Array.isArray(req.body?.chaves) ? req.body.chaves.filter((c: unknown) => typeof c === 'string').slice(0, 5000) : []
  const dataAntiga = Array.isArray(req.body?.dataAntiga) ? req.body.dataAntiga.filter((c: unknown) => typeof c === 'string') : []
  if (!chaves.length) { res.status(400).json({ error: 'Escolha ao menos um item' }); return }
  const correcaoId = typeof req.body?.correcaoId === 'string' ? req.body.correcaoId : null
  const inverter = Array.isArray(req.body?.inverter) ? req.body.inverter.filter((c: unknown) => typeof c === 'string') : []
  res.json(await corrigirDados(req.proLaboreUser!.sub, { chaves, dataAntiga, inverter, correcaoId }))
})

router.post('/sistema/auditoria/desfazer', ...dono, async (req: Request, res: Response) => {
  try { res.json(await desfazerCorrecao(req.proLaboreUser!.sub, String(req.body?.correcaoId ?? ''))) } catch (e) {
    if (e instanceof ErroAuditoria) { res.status(e.status).json({ error: e.message }); return }
    throw e
  }
})

export default router
