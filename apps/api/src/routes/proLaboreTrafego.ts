// Aba Tráfego: conexão com o Gerenciador de Anúncios da Meta, sincronização
// diária e a análise do funil do anúncio até o lead no CRM. Só o dono.
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { requireProLaboreAuth, requireDono } from '../middleware/authProLabore'
import { listarContasDeAnuncio, ErroMetaAds, erroDeToken, diagnosticarConexao, type PassoDiagnostico } from '../lib/metaAds'
import { sincronizarTrafego, DIAS_HISTORICO, VERSAO_DADOS, hojeNoFuso, somarDias } from '../lib/trafegoSync'
import { analisarTrafego, ETAPAS_TRAFEGO, type ConfiguracaoTrafego } from '../lib/trafegoAnalytics'
import { analisarPublicos } from '../lib/trafegoPublicos'

const router = Router()

function resumoConta(c: NonNullable<Awaited<ReturnType<typeof prisma.trafegoConta.findUnique>>>) {
  const hoje = hojeNoFuso(c.fuso)
  return {
    adAccountId: c.adAccountId, nome: c.nome, moeda: c.moeda, fuso: c.fuso,
    conectadoEm: c.conectadoEm, ultimaSincronizacaoEm: c.ultimaSincronizacaoEm, ultimoErroSync: c.ultimoErroSync,
    historicoDesde: c.historicoDesde ? c.historicoDesde.toISOString().slice(0, 10) : null,
    historicoCompleto: !!c.historicoDesde && c.historicoDesde.toISOString().slice(0, 10) <= somarDias(hoje, -(DIAS_HISTORICO - 1)),
    hoje,
    configuracao: (c.configuracao ?? {}) as ConfiguracaoTrafego,
    acoesMeta: (c.acoesMeta ?? null) as { desde: string; ate: string; totais: Record<string, number> } | null,
  }
}

// Dados guardados fora da conta (sem relação em cascata).
async function limparCaches(contaId: string) {
  await prisma.$transaction([
    prisma.trafegoAlcance.deleteMany({ where: { contaId } }),
    prisma.trafegoEstrutura.deleteMany({ where: { contaId } }),
    prisma.trafegoPublicoCache.deleteMany({ where: { contaId } }),
  ])
}

function erroMeta(res: Response, e: unknown) {
  res.status(e instanceof ErroMetaAds ? 400 : 502).json({ error: e instanceof Error ? e.message : 'Falha ao falar com a Meta' })
}

router.get('/trafego/conta', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const c = await prisma.trafegoConta.findUnique({ where: { usuarioId: req.proLaboreUser!.sub } })
  res.json(c ? { conectada: true, conta: resumoConta(c) } : { conectada: false })
})

const tokenSchema = z.string().trim().min(20, 'Cole o token completo').max(1000)

// Passo 1 da conexão: confere o token e mostra as contas de anúncio que ele enxerga.
router.post('/trafego/contas-disponiveis', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const parse = z.object({ token: tokenSchema }).safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  try {
    const contas = await listarContasDeAnuncio(parse.data.token)
    if (contas.length === 0) {
      res.status(400).json({ error: 'Esse token não enxerga nenhuma conta de anúncios. Dê acesso à conta pro usuário do sistema (ou pra você) e gere o token de novo.' })
      return
    }
    res.json(contas)
  } catch (e) {
    erroMeta(res, e)
  }
})

// Passo 2: escolhe a conta e já puxa os primeiros dias.
router.post('/trafego/conectar', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const parse = z.object({ token: tokenSchema, adAccountId: z.string().regex(/^act_\d+$/, 'Conta de anúncios inválida') }).safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const usuarioId = req.proLaboreUser!.sub
  let escolhida
  try {
    escolhida = (await listarContasDeAnuncio(parse.data.token)).find(c => c.id === parse.data.adAccountId)
  } catch (e) {
    erroMeta(res, e)
    return
  }
  if (!escolhida) {
    res.status(400).json({ error: 'Esse token não tem acesso a essa conta de anúncios' })
    return
  }
  const atual = await prisma.trafegoConta.findUnique({ where: { usuarioId } })
  const dados = { adAccountId: escolhida.id, nome: escolhida.nome, moeda: escolhida.moeda, fuso: escolhida.fuso, accessToken: parse.data.token }
  let conta
  if (atual && atual.adAccountId === escolhida.id) {
    // Mesma conta, token novo (ex.: o anterior expirou): mantém o histórico.
    conta = await prisma.trafegoConta.update({ where: { id: atual.id }, data: { ...dados, ultimoErroSync: null } })
  } else {
    if (atual) {
      await limparCaches(atual.id)
      await prisma.trafegoConta.delete({ where: { id: atual.id } })
    }
    conta = await prisma.trafegoConta.create({ data: { ...dados, usuarioId, versaoDados: VERSAO_DADOS } })
  }
  let aviso: string | null = null
  try {
    await sincronizarTrafego(conta)
  } catch (e) {
    aviso = e instanceof Error ? e.message : 'A primeira sincronização falhou — tente "Sincronizar agora".'
  }
  const final = await prisma.trafegoConta.findUniqueOrThrow({ where: { id: conta.id } })
  res.json({ conta: resumoConta(final), aviso })
})

router.delete('/trafego/conta', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const c = await prisma.trafegoConta.findUnique({ where: { usuarioId: req.proLaboreUser!.sub } })
  if (c) {
    await limparCaches(c.id)
    await prisma.trafegoConta.delete({ where: { id: c.id } })
  }
  res.status(204).end()
})

router.post('/trafego/sincronizar', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const c = await prisma.trafegoConta.findUnique({ where: { usuarioId: req.proLaboreUser!.sub } })
  if (!c) {
    res.status(404).json({ error: 'Nenhuma conta de anúncios conectada' })
    return
  }
  try {
    const resultado = await sincronizarTrafego(c, { forcarEstrutura: true })
    res.json({ conta: resumoConta(await prisma.trafegoConta.findUniqueOrThrow({ where: { id: c.id } })), resultado })
  } catch (e) {
    erroMeta(res, e)
  }
})

// O que fazer, pelo primeiro passo que falhou no diagnóstico.
function comoResolver(passos: PassoDiagnostico[], nomeConta: string) {
  const falha = passos.find(p => !p.ok)
  const gerarToken = [
    'No Facebook, abra Configurações do negócio → Usuários → Usuários do sistema → ARIES.',
    'Clique em "Gerar novo token", escolha o app ARIES Tráfego, marque a permissão ads_read e gere.',
    'Copie o token e, aqui na aba, clique em "Trocar token/conta" e cole (não mande o token por mensagem).',
  ]
  const atribuir = [
    'No Facebook, abra Configurações do negócio → Usuários → Usuários do sistema → ARIES.',
    `Clique em "Atribuir ativos" → Contas de anúncios → ${nomeConta} → ligue "Ver desempenho" (ou "Gerenciar campanhas") e salve.`,
    'Volte aqui e clique em "Atualizar agora". Se continuar, gere um token novo (mesmo caminho, "Gerar novo token" com ads_read) e cole em "Trocar token/conta".',
  ]
  if (!falha) return { titulo: 'A conexão com a Meta está funcionando', passos: ['Clique em "Atualizar agora". Se o erro voltar, provavelmente foi uma instabilidade momentânea da Meta.'] }
  switch (falha.chave) {
    case 'token': return { titulo: 'O token salvo não vale mais (expirou ou foi revogado)', passos: gerarToken }
    case 'permissoes': return { titulo: 'O token foi gerado sem a permissão ads_read', passos: gerarToken }
    case 'acesso': return { titulo: `O usuário do sistema perdeu o acesso à conta ${nomeConta}`, passos: atribuir }
    case 'status': return { titulo: 'A conta de anúncios está com restrição na Meta', passos: ['Abra o Gerenciador de Anúncios → Faturamento e pagamentos (ou a Central de qualidade da conta) e resolva a pendência indicada.', 'Depois volte aqui e clique em "Atualizar agora".'] }
    case 'insights': return { titulo: 'A Meta bloqueou a leitura dos resultados dessa conta', passos: atribuir }
    default: return { titulo: 'Parte dos dados está bloqueada', passos: ['Os números principais continuam sincronizando; só essa parte fica de fora.', ...atribuir] }
  }
}

// Testa a conexão passo a passo e diz o que resolver.
router.post('/trafego/diagnostico', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const c = await prisma.trafegoConta.findUnique({ where: { usuarioId: req.proLaboreUser!.sub } })
  if (!c) {
    res.status(404).json({ error: 'Nenhuma conta de anúncios conectada' })
    return
  }
  try {
    const passos = await diagnosticarConexao(c.adAccountId, c.accessToken)
    res.json({ passos, resolver: comoResolver(passos, c.nome) })
  } catch (e) {
    erroMeta(res, e)
  }
})

// Rodada automática (cron externo, como o do Social Media): segredo
// compartilhado no cabeçalho, sem login.
router.post('/trafego/sincronizar-cron', async (req: Request, res: Response) => {
  const segredo = req.header('x-cron-secret')
  const aceitos = [process.env.TRAFEGO_CRON_SECRET, process.env.SOCIAL_MEDIA_CRON_SECRET].filter(Boolean)
  if (!segredo || !aceitos.includes(segredo)) {
    res.status(401).json({ error: 'Não autorizado' })
    return
  }
  const contas = await prisma.trafegoConta.findMany()
  const r = await Promise.allSettled(contas.map(c => sincronizarTrafego(c)))
  res.json({ total: contas.length, sucesso: r.filter(x => x.status === 'fulfilled').length, falhas: r.filter(x => x.status === 'rejected').length })
})

const dataSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

router.get('/trafego/analise', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const parse = z.object({
    inicio: dataSchema, fim: dataSchema,
    campanhaId: z.string().max(40).optional(), adsetId: z.string().max(40).optional(),
  }).safeParse(req.query)
  if (!parse.success || parse.data.inicio > parse.data.fim) {
    res.status(400).json({ error: 'Período inválido' })
    return
  }
  const c = await prisma.trafegoConta.findUnique({ where: { usuarioId: req.proLaboreUser!.sub } })
  if (!c) {
    res.status(404).json({ error: 'Nenhuma conta de anúncios conectada' })
    return
  }
  const { inicio, fim, campanhaId, adsetId } = parse.data
  const dias = (Date.parse(fim) - Date.parse(inicio)) / 86_400_000 + 1
  if (dias > DIAS_HISTORICO) {
    res.status(400).json({ error: `O período vai até ${DIAS_HISTORICO} dias` })
    return
  }
  res.json({ conta: resumoConta(c), ...(await analisarTrafego(c, inicio, fim, { campanhaId, adsetId })) })
})

// Públicos (idade/gênero, região, posicionamento, dispositivo, horário):
// vem da Meta sob demanda e fica guardado por período.
router.get('/trafego/publicos', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const parse = z.object({
    inicio: dataSchema, fim: dataSchema,
    campanhaId: z.string().max(40).optional(), adsetId: z.string().max(40).optional(), forcar: z.enum(['1']).optional(),
  }).safeParse(req.query)
  if (!parse.success || parse.data.inicio > parse.data.fim) {
    res.status(400).json({ error: 'Período inválido' })
    return
  }
  const c = await prisma.trafegoConta.findUnique({ where: { usuarioId: req.proLaboreUser!.sub } })
  if (!c) {
    res.status(404).json({ error: 'Nenhuma conta de anúncios conectada' })
    return
  }
  const { inicio, fim, campanhaId, adsetId, forcar } = parse.data
  if ((Date.parse(fim) - Date.parse(inicio)) / 86_400_000 + 1 > DIAS_HISTORICO) {
    res.status(400).json({ error: `O período vai até ${DIAS_HISTORICO} dias` })
    return
  }
  try {
    res.json(await analisarPublicos(c, inicio, fim, { campanhaId, adsetId }, forcar === '1'))
  } catch (e) {
    if (erroDeToken(e)) await prisma.trafegoConta.update({ where: { id: c.id }, data: { ultimoErroSync: e instanceof Error ? e.message : 'Token inválido' } })
    erroMeta(res, e)
  }
})

const metaSchema = z.object({ tipo: z.enum(['CONV_MIN', 'CUSTO_MAX']), valor: z.number().nonnegative().max(1_000_000) }).nullable()
const configSchema = z.object({
  etapas: z.partialRecord(z.enum(ETAPAS_TRAFEGO), z.enum(['auto', 'sim', 'nao'])).optional(),
  metas: z.partialRecord(z.enum(ETAPAS_TRAFEGO), metaSchema).optional(),
  crmSomenteTrafego: z.boolean().optional(),
})

// Ajustes do funil (etapas visíveis, metas, contagem do CRM) — mescla com o que já existe.
router.put('/trafego/configuracao', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const parse = configSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: 'Configuração inválida' })
    return
  }
  const c = await prisma.trafegoConta.findUnique({ where: { usuarioId: req.proLaboreUser!.sub } })
  if (!c) {
    res.status(404).json({ error: 'Nenhuma conta de anúncios conectada' })
    return
  }
  const atual = (c.configuracao ?? {}) as ConfiguracaoTrafego
  const nova: ConfiguracaoTrafego = {
    ...atual,
    ...(parse.data.crmSomenteTrafego !== undefined && { crmSomenteTrafego: parse.data.crmSomenteTrafego }),
    etapas: { ...atual.etapas, ...parse.data.etapas },
    metas: { ...atual.metas, ...parse.data.metas },
  }
  const r = await prisma.trafegoConta.update({ where: { id: c.id }, data: { configuracao: nova as unknown as Prisma.InputJsonValue } })
  res.json(resumoConta(r))
})

export default router
