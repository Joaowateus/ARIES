// Fase 6 · Acervo de mídia por moto: os arquivos das pautas organizados pela
// moto do estoque. "Usar em uma pauta da moto" abre (ou cria) a pauta da
// moto já com o arquivo; anexar a uma pauta aberta fica na Produção.
import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { requireProLaboreAuth } from '../middleware/authProLabore'
import { contextoSM, requireModuloSM } from '../lib/smAcesso'
import { acervoPorMoto, arquivoDoAcervo } from '../lib/smAcervo'
import { ErroBusca, criarPautaDaMoto } from '../lib/smBusca'

const router = Router()
const autenticado = [requireProLaboreAuth, contextoSM]

router.get('/sm/acervo', ...autenticado, requireModuloSM('producao', 'LEITURA'), async (req: Request, res: Response) => {
  const moto = typeof req.query.moto === 'string' && req.query.moto ? req.query.moto : null
  res.json({ motos: await acervoPorMoto(req.sm!.usuarioId, moto), podeUsar: !req.sm!.somenteLeitura && req.sm!.pode('producao', 'COMPLETO') })
})

router.post('/sm/acervo/:midiaId/nova-pauta', ...autenticado, requireModuloSM('producao', 'COMPLETO'), async (req: Request, res: Response) => {
  const sm = req.sm!
  const arquivo = await arquivoDoAcervo(sm.usuarioId, String(req.params.midiaId))
  if (!arquivo) { res.status(404).json({ error: 'Arquivo não encontrado no acervo' }); return }
  try {
    const p = await criarPautaDaMoto(sm, arquivo.pauta.motoId!, sm.visao === 'GESTOR' ? 'GESTOR' : 'SOCIAL_MEDIA')
    const jaTem = await prisma.smPautaMidia.findFirst({ where: { pautaId: p.id, url: arquivo.url }, select: { id: true } })
    if (!jaTem) {
      const ordem = await prisma.smPautaMidia.count({ where: { pautaId: p.id } })
      await prisma.smPautaMidia.create({ data: { pautaId: p.id, tipo: arquivo.tipo, url: arquivo.url, ordem } })
    }
    res.status(p.criada ? 201 : 200).json(p)
  } catch (e) {
    if (e instanceof ErroBusca) { res.status(e.status).json({ error: e.message }); return }
    throw e
  }
})

export default router
