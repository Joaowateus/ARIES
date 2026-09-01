import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { requireAuth, requirePapel } from '../middleware/auth'
import { PAPEIS_GESTAO } from '../lib/permissoes'
import { cifrar, decifrar } from '../lib/crypto'
import { signEstadoOAuth, verifyEstadoOAuth } from '../lib/jwt'
import {
  configuracaoMetaAds,
  montarUrlAutorizacao,
  trocarCodigoPorToken,
  trocarPorTokenLongaDuracao,
  buscarContasAnuncio,
  buscarInsightsPorCampanha,
  converterInsightsParaLinhas,
} from '../lib/metaAds'

const router = Router()

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:3000'
const PLATAFORMA = 'META'

// ---------------------------------------------------------------------------
// Conexão com o Meta Ads — v1 do que estava desenhado como "elo automático"
// no Funil de Tráfego Pago (ver funilTrafego.ts): em vez de lançar os
// números manualmente, o gestor conecta a conta de anúncios uma vez e
// /sincronizar passa a preencher MetricaTrafegoPago sozinho, puxando da
// Insights API. Exige META_APP_ID/META_APP_SECRET/META_REDIRECT_URI no
// ambiente — sem isso, /iniciar responde com instrução em vez de token.
// ---------------------------------------------------------------------------

router.get('/meta-ads/status', requireAuth, async (req: Request, res: Response) => {
  const integracao = await prisma.integracaoAnuncio.findUnique({
    where: { empresaId_plataforma: { empresaId: req.user!.empresaId, plataforma: PLATAFORMA } },
    include: { conectadoPor: { select: { id: true, nome: true } } },
  })
  res.json({
    configurada: configuracaoMetaAds() !== null,
    status: integracao?.status ?? 'DESCONECTADO',
    contaAnuncioNome: integracao?.contaAnuncioNome ?? null,
    conectadoPor: integracao?.conectadoPor ?? null,
    ultimaSincronizacaoEm: integracao?.ultimaSincronizacaoEm ?? null,
    ultimoErro: integracao?.ultimoErro ?? null,
  })
})

// Devolve a URL de autorização em vez de redirecionar direto: o frontend
// guarda o token JWT no localStorage (não em cookie), então só uma chamada
// autenticada (fetch com Authorization) consegue provar quem está pedindo —
// a navegação de fato pro Meta acontece depois, via window.location.href.
router.get('/meta-ads/iniciar', requireAuth, requirePapel(...PAPEIS_GESTAO), async (req: Request, res: Response) => {
  const cfg = configuracaoMetaAds()
  if (!cfg) {
    res.status(400).json({ error: 'Integração com Meta Ads ainda não configurada — faltam META_APP_ID/META_APP_SECRET/META_REDIRECT_URI no servidor.' })
    return
  }
  const state = signEstadoOAuth({ empresaId: req.user!.empresaId, usuarioId: req.user!.sub })
  res.json({ url: montarUrlAutorizacao(cfg, state) })
})

// Rota pública (sem requireAuth): é o navegador do usuário voltando do
// diálogo de autorização do Meta, não um fetch nosso — a identidade vem do
// `state` assinado que /iniciar gerou, não de um header Authorization.
router.get('/meta-ads/callback', async (req: Request, res: Response) => {
  const code = typeof req.query.code === 'string' ? req.query.code : undefined
  const stateToken = typeof req.query.state === 'string' ? req.query.state : undefined

  if (!code || !stateToken) {
    res.redirect(`${FRONTEND_URL}/funil-trafego?integracao=erro`)
    return
  }

  let empresaId: string
  let usuarioId: string
  try {
    const estado = verifyEstadoOAuth(stateToken)
    empresaId = estado.empresaId
    usuarioId = estado.usuarioId
  } catch {
    res.redirect(`${FRONTEND_URL}/funil-trafego?integracao=erro`)
    return
  }

  const cfg = configuracaoMetaAds()
  if (!cfg) {
    res.redirect(`${FRONTEND_URL}/funil-trafego?integracao=erro`)
    return
  }

  try {
    const tokenCurto = await trocarCodigoPorToken(cfg, code)
    const tokenLongo = await trocarPorTokenLongaDuracao(cfg, tokenCurto.access_token)
    const contas = await buscarContasAnuncio(tokenLongo.access_token)
    const contaPrincipal = contas[0]
    if (!contaPrincipal) {
      throw new Error('Nenhuma conta de anúncios encontrada para este usuário do Meta Business.')
    }

    const tokenExpiraEm = tokenLongo.expires_in ? new Date(Date.now() + tokenLongo.expires_in * 1000) : null

    await prisma.integracaoAnuncio.upsert({
      where: { empresaId_plataforma: { empresaId, plataforma: PLATAFORMA } },
      update: {
        status: 'CONECTADO',
        contaAnuncioExternaId: contaPrincipal.id,
        contaAnuncioNome: contaPrincipal.name,
        accessTokenCifrado: cifrar(tokenLongo.access_token),
        tokenExpiraEm,
        conectadoPorId: usuarioId,
        ultimoErro: null,
      },
      create: {
        empresaId,
        plataforma: PLATAFORMA,
        status: 'CONECTADO',
        contaAnuncioExternaId: contaPrincipal.id,
        contaAnuncioNome: contaPrincipal.name,
        accessTokenCifrado: cifrar(tokenLongo.access_token),
        tokenExpiraEm,
        conectadoPorId: usuarioId,
      },
    })

    res.redirect(`${FRONTEND_URL}/funil-trafego?integracao=conectada`)
  } catch (err) {
    await prisma.integracaoAnuncio.upsert({
      where: { empresaId_plataforma: { empresaId, plataforma: PLATAFORMA } },
      update: { status: 'ERRO', ultimoErro: err instanceof Error ? err.message : 'Falha ao conectar com o Meta Ads' },
      create: {
        empresaId,
        plataforma: PLATAFORMA,
        status: 'ERRO',
        ultimoErro: err instanceof Error ? err.message : 'Falha ao conectar com o Meta Ads',
        conectadoPorId: usuarioId,
      },
    })
    res.redirect(`${FRONTEND_URL}/funil-trafego?integracao=erro`)
  }
})

router.post('/meta-ads/desconectar', requireAuth, requirePapel(...PAPEIS_GESTAO), async (req: Request, res: Response) => {
  await prisma.integracaoAnuncio.updateMany({
    where: { empresaId: req.user!.empresaId, plataforma: PLATAFORMA },
    data: { status: 'DESCONECTADO', accessTokenCifrado: null, tokenExpiraEm: null, ultimoErro: null },
  })
  res.json({ ok: true })
})

// Puxa Insights da Meta e grava em MetricaTrafegoPago — mesma tabela do
// lançamento manual (ver funilTrafego.ts), então o Funil de Tráfego Pago
// não precisa saber se o número veio de sync ou de digitação. Sem período
// informado, sincroniza a última semana (a Meta processa Insights com
// atraso de algumas horas, então "hoje" costuma vir incompleto de propósito).
router.post('/meta-ads/sincronizar', requireAuth, requirePapel(...PAPEIS_GESTAO), async (req: Request, res: Response) => {
  const empresaId = req.user!.empresaId
  const integracao = await prisma.integracaoAnuncio.findUnique({
    where: { empresaId_plataforma: { empresaId, plataforma: PLATAFORMA } },
  })

  if (!integracao || integracao.status !== 'CONECTADO' || !integracao.accessTokenCifrado || !integracao.contaAnuncioExternaId) {
    res.status(400).json({ error: 'Meta Ads não está conectado. Conecte a conta em Funil de Tráfego Pago antes de sincronizar.' })
    return
  }
  if (integracao.tokenExpiraEm && integracao.tokenExpiraEm < new Date()) {
    await prisma.integracaoAnuncio.update({
      where: { id: integracao.id },
      data: { status: 'ERRO', ultimoErro: 'Token de acesso expirado — reconecte a conta.' },
    })
    res.status(400).json({ error: 'Token de acesso expirado — reconecte a conta do Meta Ads.' })
    return
  }

  const hoje = new Date()
  const seteDiasAtras = new Date(hoje)
  seteDiasAtras.setDate(hoje.getDate() - 7)
  const inicio = typeof req.query.inicio === 'string' ? req.query.inicio : seteDiasAtras.toISOString().slice(0, 10)
  const fim = typeof req.query.fim === 'string' ? req.query.fim : hoje.toISOString().slice(0, 10)

  try {
    const accessToken = decifrar(integracao.accessTokenCifrado)
    const insights = await buscarInsightsPorCampanha(accessToken, integracao.contaAnuncioExternaId, { inicio, fim })
    const linhas = converterInsightsParaLinhas(insights)
    const usuarioId = integracao.conectadoPorId ?? req.user!.sub

    for (const linha of linhas) {
      await prisma.metricaTrafegoPago.upsert({
        where: {
          empresaId_usuarioId_plataforma_campanha_data: {
            empresaId,
            usuarioId,
            plataforma: PLATAFORMA,
            campanha: linha.campanha,
            data: new Date(linha.data),
          },
        },
        update: {
          impressoes: linha.impressoes,
          cliques: linha.cliques,
          visitasLp: linha.visitasLp,
          leadsCapturados: linha.leadsCapturados,
          valorInvestido: linha.valorInvestido,
        },
        create: {
          empresaId,
          usuarioId,
          plataforma: PLATAFORMA,
          campanha: linha.campanha,
          data: new Date(linha.data),
          impressoes: linha.impressoes,
          cliques: linha.cliques,
          visitasLp: linha.visitasLp,
          leadsCapturados: linha.leadsCapturados,
          valorInvestido: linha.valorInvestido,
        },
      })
    }

    await prisma.integracaoAnuncio.update({
      where: { id: integracao.id },
      data: { ultimaSincronizacaoEm: new Date(), ultimoErro: null },
    })

    res.json({ sincronizados: linhas.length, periodo: { inicio, fim } })
  } catch (err) {
    // Não derruba pra ERRO aqui: uma falha de sincronização (rate limit,
    // instabilidade da Graph API) não significa que o token está inválido —
    // só o caso de token expirado acima força reconexão. Assim
    // "Sincronizar agora" continua disponível pra tentar de novo.
    const mensagem = err instanceof Error ? err.message : 'Falha ao sincronizar com o Meta Ads'
    await prisma.integracaoAnuncio.update({ where: { id: integracao.id }, data: { ultimoErro: mensagem } })
    res.status(502).json({ error: mensagem })
  }
})

export default router
