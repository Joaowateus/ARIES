// PDF 02 · 4.2 Dicionário de métricas: fichas (consulta e versões), leitura
// dos números com a comparação padrão e as faixas. Toda tela que mostra um
// número lê daqui; tocar no número abre a ficha.
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { requireProLaboreAuth, requireDono } from '../middleware/authProLabore'
import { papelDoUsuario, veLoja } from '../lib/papelHoje'
import { CHAVES, fichas, historicoDaFicha, ler, mesCorrente, novaVersao, podeVer, type Escopo, type Papel, type Periodo } from '../lib/metricas'

const router = Router()

const papelDe = (req: Request): Papel => papelDoUsuario(req.proLaboreUser!)
function escopoDe(req: Request): Escopo {
  const papel = papelDe(req)
  const vejaEquipe = veLoja(papel)
  const filtro = typeof req.query.vendedorId === 'string' && req.query.vendedorId ? req.query.vendedorId : null
  // Vendedor e SDR veem só a própria produção; dono e supervisor, a loja ou um vendedor escolhido.
  return { usuarioId: req.proLaboreUser!.sub, papel, vendedorId: vejaEquipe ? filtro : req.proLaboreUser!.vendedorId ?? '__nenhum__' }
}
const DIA = /^\d{4}-\d{2}-\d{2}$/
function periodoDe(req: Request): Periodo | null {
  const { inicio, fim } = req.query
  if (inicio == null && fim == null) return mesCorrente()
  if (typeof inicio !== 'string' || typeof fim !== 'string' || !DIA.test(inicio) || !DIA.test(fim) || inicio > fim) return null
  return { inicio, fim }
}

router.get('/metricas/fichas', requireProLaboreAuth, async (req: Request, res: Response) => {
  const papel = papelDe(req)
  res.json((await fichas(req.proLaboreUser!.sub)).filter(f => podeVer(f, papel)))
})

router.get('/metricas/fichas/:chave', requireProLaboreAuth, async (req: Request, res: Response) => {
  const ficha = (await fichas(req.proLaboreUser!.sub)).find(f => f.chave === req.params.chave)
  if (!ficha || !podeVer(ficha, papelDe(req))) { res.status(404).json({ error: 'Métrica não encontrada' }); return }
  res.json({ ficha, versoes: await historicoDaFicha(req.proLaboreUser!.sub, ficha.chave) })
})

const versaoSchema = z.object({
  nome: z.string().trim().min(2).max(80).optional(),
  definicao: z.string().trim().min(2).max(400).optional(),
  responsavel: z.string().trim().min(2).max(80).optional(),
  quemVe: z.array(z.enum(['DONO', 'SUPERVISOR', 'SDR', 'VENDEDOR', 'SOCIAL_MEDIA', 'TRAFEGO', 'FINANCEIRO'])).min(1).optional(),
  faixas: z.object({ bom: z.number(), critico: z.number() }).nullable().optional(),
  justificativa: z.string().trim().min(5, 'Escreva por que mudou').max(500),
})
// Mudança na ficha: nova versão, aprovada pelo dono (a fórmula é a do PDF e não muda por aqui).
router.put('/metricas/fichas/:chave', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  if (!CHAVES.includes(String(req.params.chave))) { res.status(404).json({ error: 'Métrica não encontrada' }); return }
  const p = versaoSchema.safeParse(req.body)
  if (!p.success) { res.status(400).json({ error: p.error.issues[0].message }); return }
  const { justificativa, ...mudanca } = p.data
  if (!mudanca.quemVe || mudanca.quemVe.includes('DONO')) {
    await novaVersao(req.proLaboreUser!.sub, String(req.params.chave), mudanca, justificativa, req.proLaboreUser!.sub)
  } else { res.status(400).json({ error: 'O dono sempre vê a métrica' }); return }
  const ficha = (await fichas(req.proLaboreUser!.sub)).find(f => f.chave === req.params.chave)
  res.json({ ficha, versoes: await historicoDaFicha(req.proLaboreUser!.sub, String(req.params.chave)) })
})

// Leitura: ?chaves=a,b&inicio=AAAA-MM-DD&fim=AAAA-MM-DD[&vendedorId=][&faixas=0]
router.get('/metricas', requireProLaboreAuth, async (req: Request, res: Response) => {
  const periodo = periodoDe(req)
  if (!periodo) { res.status(400).json({ error: 'Período inválido' }); return }
  const papel = papelDe(req)
  const lista = await fichas(req.proLaboreUser!.sub)
  const pedidas = typeof req.query.chaves === 'string' && req.query.chaves ? req.query.chaves.split(',') : lista.filter(f => f.lote === 1).map(f => f.chave)
  const visiveis = pedidas.filter(c => { const f = lista.find(x => x.chave === c); return f && podeVer(f, papel) })
  const escopo = escopoDe(req)
  const faixas = req.query.faixas !== '0'
  const leituras = await Promise.all(visiveis.map(c => ler(c, escopo, periodo, new Date(), { faixas }).catch(e => ({ chave: c, erro: String(e?.message ?? e) }))))
  res.json({ periodo, leituras })
})

export default router
