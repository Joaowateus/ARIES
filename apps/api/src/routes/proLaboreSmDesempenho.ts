// Tela 05 · Desempenho (seção 8). Pede o módulo Análise em Leitura. A análise
// é a mesma da aba Social Media do painel (lib/socialMediaResumo), filtrada
// pelo que o papel pode ver: sem gasto de anúncio, R$ só com "Mostrar
// valores", leads e vendas só com CRM e Vendas liberados.
import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { requireProLaboreAuth } from '../middleware/authProLabore'
import { contextoSM, requireModuloSM } from '../lib/smAcesso'
import { carregarConfig } from '../lib/smCalendario'
import { analisarContaSocialMedia } from '../lib/socialMediaResumo'
import { diagnosticoDosReels, filtrarParaOPapel, sinaisDoPeriodo } from '../lib/smDesempenho'

const router = Router()
const autenticado = [requireProLaboreAuth, contextoSM]

router.get('/sm/desempenho', ...autenticado, requireModuloSM('analise', 'LEITURA'), async (req: Request, res: Response) => {
  const sm = req.sm!
  const usuarioId = sm.usuarioId
  const conta = await prisma.socialMediaConta.findUnique({ where: { titular: `dono:${usuarioId}` } })
  if (!conta) { res.json({ conectado: false }); return }
  const [analise, config] = await Promise.all([
    analisarContaSocialMedia({
      usuarioId, conta, vendedorTitular: null,
      inicio: typeof req.query.inicio === 'string' ? req.query.inicio : null,
      fim: typeof req.query.fim === 'string' ? req.query.fim : null,
      origem: typeof req.query.origem === 'string' ? req.query.origem : null,
    }),
    carregarConfig(usuarioId),
  ])
  res.json({
    ...filtrarParaOPapel(analise, sm),
    sinais: sinaisDoPeriodo(analise, config),
    reelsDiagnostico: diagnosticoDosReels(analise),
    // Testes A/B (seção 13.3) entram na Fase 3c.
    testeEmAndamento: null,
    metas: { metaRetencao: config.metaRetencao, metaPuloPct: config.metaPuloPct, metaEnviosMil: config.metaEnviosMil, metaSalvosMil: config.metaSalvosMil, metaCurtidasPct: config.metaCurtidasPct },
    souGestor: sm.visao === 'GESTOR' && !sm.verComo,
    verCrm: sm.pode('crm', 'LEITURA'),
    verVendas: sm.pode('vendas', 'LEITURA'),
  })
})

export default router
