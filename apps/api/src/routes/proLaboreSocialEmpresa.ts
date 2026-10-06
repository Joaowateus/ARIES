// Conta do Instagram da EMPRESA (Fase 0 do módulo Social Media com acesso
// isolado — seção 3.2 da especificação): conexão pelo usuário do sistema
// do Business Manager, diagnóstico, histórico de sincronizações, avisos,
// jobs do cron e webhook da Meta.
//
// A conta da empresa é a mesma linha de SocialMediaConta do dono (titular
// `dono:<id>`), com `tipoConexao = EMPRESA`: converter uma conta pessoal
// mantém todo o histórico sincronizado.
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import crypto from 'crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { requireProLaboreAuth, requireDono } from '../middleware/authProLabore'
import {
  ErroGraphApi,
  PERMISSOES_EMPRESA_COMPLETAS,
  PERMISSOES_EMPRESA_ESSENCIAIS,
  buscarContaInstagramPorId,
  comApiDaEmpresa,
  listarContasInstagramDaEmpresa,
  verificarTokenEmpresa,
} from '../lib/instagramGraph'
import { publicarPautasVencidas } from '../lib/smPublicacao'
import { rodarJobSocialMedia, sincronizarContaSocialMedia } from '../lib/socialMediaSync'

const router = Router()

// Token de usuário do sistema não expira por padrão: guarda uma data bem
// distante só porque a coluna é obrigatória (a renovação automática vale
// só para o login do Instagram).
const TOKEN_SEM_VALIDADE = new Date('2100-01-01T00:00:00Z')

const SELECT_CONTA = {
  id: true, instagramUserId: true, nomeUsuario: true, nomeExibicao: true, fotoUrl: true,
  biografia: true, site: true, tipoConta: true,
  seguidores: true, seguindo: true, publicacoesTotal: true, conectadoEm: true, atualizadoEm: true,
  tokenExpiraEm: true, ultimaSincronizacaoEm: true, ultimoErroSync: true,
  tipoConexao: true, paginaNome: true, falhasSeguidas: true, proximaTentativaEm: true,
} as const

const titularDono = (req: Request) => `dono:${req.proLaboreUser!.sub}`

function mensagemGraph(e: unknown): string {
  if (e instanceof ErroGraphApi) {
    if (e.codigo === 190) return 'O token não é válido (expirou, foi revogado ou foi colado incompleto). Gere um novo no Business Manager.'
    if (e.codigo === 10 || e.codigo === 200) return `A Meta recusou o acesso: ${e.message} Confira as permissões do app e do usuário do sistema.`
    return `A Meta respondeu: ${e.message}`
  }
  return e instanceof Error ? e.message : 'Falha ao falar com a Meta'
}

// --- Conectar a conta da empresa ---

const conectarSchema = z.object({
  accessToken: z.string().min(20, 'Token inválido'),
  // Quando o usuário do sistema enxerga mais de uma conta do Instagram.
  instagramUserId: z.string().min(1).optional(),
})

router.post('/social-media/conectar-empresa', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const parse = conectarSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const usuarioId = req.proLaboreUser!.sub
  const titular = titularDono(req)
  const token = parse.data.accessToken.trim()
  try {
    const dono = await verificarTokenEmpresa(token)
    const faltando = PERMISSOES_EMPRESA_ESSENCIAIS.filter(p => !dono.concedidas.includes(p))
    if (faltando.length) {
      res.status(400).json({ error: `O token não tem as permissões para ler o Instagram: falta ${faltando.join(', ')}. Gere um token novo marcando essas permissões.`, faltando })
      return
    }
    const contas = await listarContasInstagramDaEmpresa(token)
    if (contas.length === 0) {
      res.status(400).json({ error: 'Esse usuário do sistema não enxerga nenhuma conta do Instagram. No Business Manager, dê a ele acesso à Página do Facebook ligada ao Instagram da empresa (e à conta do Instagram).' })
      return
    }
    const escolhida = parse.data.instagramUserId
      ? contas.find(c => c.instagramUserId === parse.data.instagramUserId)
      : contas.length === 1 ? contas[0] : undefined
    if (!escolhida) {
      res.status(409).json({ error: 'Esse token enxerga mais de uma conta do Instagram. Escolha qual é a da empresa.', contas })
      return
    }

    // Um Instagram só pode estar ligado a uma pessoa/conta do sistema.
    const jaLigada = await prisma.socialMediaConta.findUnique({ where: { instagramUserId: escolhida.instagramUserId }, select: { titular: true } })
    if (jaLigada && jaLigada.titular !== titular) {
      res.status(409).json({ error: `O Instagram @${escolhida.nomeUsuario} está conectado por outra pessoa da equipe. Peça para ela desconectar antes.` })
      return
    }

    const info = await comApiDaEmpresa(() => buscarContaInstagramPorId(escolhida.instagramUserId, token))
    const atual = await prisma.socialMediaConta.findUnique({ where: { titular } })
    // Trocou de Instagram: o histórico era da conta anterior. Mesma conta
    // (de pessoal para empresa): o histórico continua.
    if (atual && atual.instagramUserId !== info.instagramUserId) {
      await prisma.$transaction([
        prisma.socialMediaMidia.deleteMany({ where: { contaId: atual.id } }),
        prisma.socialMediaSnapshotDiario.deleteMany({ where: { contaId: atual.id } }),
        prisma.socialMediaAlcancePeriodo.deleteMany({ where: { contaId: atual.id } }),
        prisma.socialMediaConta.update({
          where: { id: atual.id },
          data: { ultimaSincronizacaoEm: null, demografia: Prisma.DbNull, seguidoresOnline: Prisma.DbNull, distribuicaoAlcance: Prisma.DbNull, conectadoEm: new Date() },
        }),
      ])
    }
    const dados = {
      ...info,
      accessToken: token,
      tokenExpiraEm: TOKEN_SEM_VALIDADE,
      tipoConexao: 'EMPRESA',
      paginaId: escolhida.paginaId,
      paginaNome: escolhida.paginaNome,
      ultimoErroSync: null,
      falhasSeguidas: 0,
      proximaTentativaEm: null,
    }
    const conta = await prisma.socialMediaConta.upsert({
      where: { titular },
      update: dados,
      create: { ...dados, usuarioId, titular },
    })

    // Primeira sincronização já pela empresa. Se falhar, a conexão fica
    // salva e o erro aparece na tela (com nova tentativa automática).
    let erroSync: string | null = null
    try {
      await sincronizarContaSocialMedia(conta, 'CONEXAO')
    } catch (e) {
      erroSync = e instanceof Error ? e.message : 'Falha na primeira sincronização'
    }
    const final = await prisma.socialMediaConta.findUnique({ where: { id: conta.id }, select: SELECT_CONTA })
    res.status(201).json({ conta: final, erroSync, permissoesFaltando: PERMISSOES_EMPRESA_COMPLETAS.filter(p => !dono.concedidas.includes(p)) })
  } catch (e) {
    res.status(400).json({ error: mensagemGraph(e) })
  }
})

// --- Diagnóstico da conexão da empresa ---

interface PassoDiagnostico { chave: string; titulo: string; nivel: 'ok' | 'aviso' | 'erro'; detalhe: string }

router.post('/social-media/diagnostico-empresa', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const conta = await prisma.socialMediaConta.findUnique({ where: { titular: titularDono(req) } })
  const token = (typeof req.body?.accessToken === 'string' && req.body.accessToken.trim()) || (conta?.tipoConexao === 'EMPRESA' ? conta.accessToken : null)
  if (!token) {
    res.status(400).json({ error: 'A conta da empresa ainda não está conectada. Cole o token do usuário do sistema para testar.' })
    return
  }
  const passos: PassoDiagnostico[] = []
  try {
    const dono = await verificarTokenEmpresa(token)
    passos.push({ chave: 'token', titulo: 'Token do usuário do sistema', nivel: 'ok', detalhe: `Válido · ${dono.nome}` })
    const faltaEssencial = PERMISSOES_EMPRESA_ESSENCIAIS.filter(p => !dono.concedidas.includes(p))
    passos.push(faltaEssencial.length
      ? { chave: 'permissoes', titulo: 'Permissões para ler o Instagram', nivel: 'erro', detalhe: `Falta: ${faltaEssencial.join(', ')}` }
      : { chave: 'permissoes', titulo: 'Permissões para ler o Instagram', nivel: 'ok', detalhe: PERMISSOES_EMPRESA_ESSENCIAIS.join(', ') })
    const faltaExtra = PERMISSOES_EMPRESA_COMPLETAS.filter(p => !PERMISSOES_EMPRESA_ESSENCIAIS.includes(p) && !dono.concedidas.includes(p))
    passos.push(faltaExtra.length
      ? { chave: 'permissoes-extras', titulo: 'Permissões de atendimento e publicação', nivel: 'aviso', detalhe: `Ainda sem: ${faltaExtra.join(', ')}. Sem elas, o Atendimento e a publicação agendada não funcionam (dependem da revisão do app pela Meta).` }
      : { chave: 'permissoes-extras', titulo: 'Permissões de atendimento e publicação', nivel: 'ok', detalhe: 'Todas concedidas' })
    if (faltaEssencial.length) {
      res.json({ passos, resolver: resolver(passos) })
      return
    }
    const contas = await listarContasInstagramDaEmpresa(token)
    const alvo = conta?.tipoConexao === 'EMPRESA' ? contas.find(c => c.instagramUserId === conta.instagramUserId) : contas[0]
    passos.push(alvo
      ? { chave: 'conta', titulo: 'Conta do Instagram visível', nivel: 'ok', detalhe: `@${alvo.nomeUsuario} · Página ${alvo.paginaNome}` }
      : { chave: 'conta', titulo: 'Conta do Instagram visível', nivel: 'erro', detalhe: contas.length ? `O token enxerga ${contas.map(c => '@' + c.nomeUsuario).join(', ')}, mas não a conta conectada.` : 'Nenhuma conta do Instagram ligada às Páginas que o usuário do sistema enxerga.' })
    if (alvo) {
      try {
        const info = await comApiDaEmpresa(() => buscarContaInstagramPorId(alvo.instagramUserId, token))
        passos.push({ chave: 'leitura', titulo: 'Leitura de dados da conta', nivel: 'ok', detalhe: `${info.seguidores.toLocaleString('pt-BR')} seguidores · ${info.publicacoesTotal.toLocaleString('pt-BR')} publicações` })
      } catch (e) {
        passos.push({ chave: 'leitura', titulo: 'Leitura de dados da conta', nivel: 'erro', detalhe: mensagemGraph(e) })
      }
    }
  } catch (e) {
    passos.push({ chave: 'token', titulo: 'Token do usuário do sistema', nivel: 'erro', detalhe: mensagemGraph(e) })
  }
  const webhookOk = !!process.env.META_WEBHOOK_VERIFY_TOKEN && !!process.env.META_APP_SECRET
  passos.push(webhookOk
    ? { chave: 'webhook', titulo: 'Webhook (comentários e mensagens em tempo real)', nivel: 'ok', detalhe: 'Configurado no servidor' }
    : { chave: 'webhook', titulo: 'Webhook (comentários e mensagens em tempo real)', nivel: 'aviso', detalhe: 'Falta configurar META_WEBHOOK_VERIFY_TOKEN e META_APP_SECRET na Vercel e assinar o webhook no app da Meta.' })
  res.json({ passos, resolver: resolver(passos) })
})

// Passo a passo para o primeiro problema encontrado.
function resolver(passos: PassoDiagnostico[]): { titulo: string; passos: string[] } {
  const erro = passos.find(p => p.nivel === 'erro')
  if (!erro) {
    const aviso = passos.find(p => p.nivel === 'aviso')
    return aviso
      ? { titulo: 'A leitura do Instagram está funcionando. Falta liberar o resto.', passos: aviso.chave === 'webhook'
          ? ['Na Vercel, cadastre META_APP_SECRET (Chave Secreta do app) e META_WEBHOOK_VERIFY_TOKEN (uma senha qualquer, a mesma que vai no app da Meta).', 'No app da Meta: Webhooks → Instagram → URL de callback `https://<api>/pro-labore/sm/webhook/instagram` e o mesmo token de verificação.', 'Assine os campos comments, mentions, messages e story_insights.']
          : ['No app da Meta, em Revisão do app, peça acesso avançado a instagram_manage_comments, instagram_manage_messages e instagram_content_publish.', 'Depois da aprovação, gere um token novo do usuário do sistema com essas permissões e cole em "Trocar token".'] }
      : { titulo: 'A conexão com o Instagram da empresa está funcionando.', passos: [] }
  }
  if (erro.chave === 'token' || erro.chave === 'permissoes') {
    return {
      titulo: 'Gere um token novo do usuário do sistema',
      passos: [
        'Abra business.facebook.com → Configurações do negócio → Usuários → Usuários do sistema.',
        'Escolha o usuário do sistema do ARIES → Gerar novo token → app da Meta do ARIES.',
        `Marque: ${PERMISSOES_EMPRESA_COMPLETAS.join(', ')}.`,
        'Copie o token e cole aqui, em "Conectar pela empresa". Nunca mande o token por mensagem.',
      ],
    }
  }
  if (erro.chave === 'conta') {
    return {
      titulo: 'Dê ao usuário do sistema acesso ao Instagram da empresa',
      passos: [
        'No Business Manager, confira se o Instagram da empresa está ligado a uma Página do Facebook do mesmo negócio.',
        'Configurações do negócio → Usuários do sistema → usuário do ARIES → Atribuir ativos.',
        'Em Páginas, marque a Página da empresa; em Contas do Instagram, marque a conta. Salve e teste de novo.',
      ],
    }
  }
  return { titulo: 'A Meta recusou a leitura', passos: ['Confira se o app da Meta está em modo Live e com as permissões aprovadas.', 'Teste de novo em alguns minutos: bloqueios temporários da Meta costumam passar sozinhos.'] }
}

// --- Histórico e avisos ---

router.get('/social-media/sincronizacoes', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const conta = await prisma.socialMediaConta.findUnique({ where: { titular: titularDono(req) }, select: { id: true } })
  if (!conta) {
    res.json([])
    return
  }
  res.json(await prisma.smSincronizacao.findMany({ where: { contaId: conta.id }, orderBy: { iniciadoEm: 'desc' }, take: 15 }))
})

router.get('/social-media/avisos', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  res.json(await prisma.smNotificacao.findMany({
    where: { usuarioId: req.proLaboreUser!.sub, destinatario: 'GESTOR' },
    orderBy: [{ lidaEm: { sort: 'desc', nulls: 'first' } }, { atualizadoEm: 'desc' }],
    take: 20,
  }))
})

router.post('/social-media/avisos/:id/lida', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  await prisma.smNotificacao.updateMany({ where: { id: String(req.params.id), usuarioId: req.proLaboreUser!.sub, lidaEm: null }, data: { lidaEm: new Date() } })
  res.json({ ok: true })
})

// --- Jobs do cron (cron-job.org, autenticado por segredo) ---

function cronAutorizado(req: Request, res: Response): boolean {
  const segredo = req.header('x-cron-secret')
  if (!process.env.SOCIAL_MEDIA_CRON_SECRET || segredo !== process.env.SOCIAL_MEDIA_CRON_SECRET) {
    res.status(401).json({ error: 'Não autorizado' })
    return false
  }
  return true
}

router.post('/sm/cron/hora', async (req: Request, res: Response) => {
  if (cronAutorizado(req, res)) res.json(await rodarJobSocialMedia('HORA'))
})
router.post('/sm/cron/dia', async (req: Request, res: Response) => {
  if (cronAutorizado(req, res)) res.json(await rodarJobSocialMedia('DIA'))
})
// A cada 5 min: novas tentativas vencidas e a publicação das pautas
// agendadas que já chegaram no horário.
router.post('/sm/cron/minuto', async (req: Request, res: Response) => {
  if (!cronAutorizado(req, res)) return
  // As imagens da pauta são servidas pela própria API: a Meta precisa da URL completa.
  const baseApi = process.env.API_PUBLIC_URL ?? `${req.protocol}://${req.get('host')}`
  const [sincronizacao, publicacao] = await Promise.all([rodarJobSocialMedia('RETENTATIVA'), publicarPautasVencidas(baseApi)])
  res.json({ ...sincronizacao, publicacao })
})

// --- Webhook da Meta (comentários, menções, mensagens, insights de story) ---

// Verificação da assinatura: o Meta assina o corpo cru com a Chave Secreta
// do app (HMAC SHA-256) no cabeçalho X-Hub-Signature-256.
function assinaturaValida(req: Request): boolean {
  const segredo = process.env.META_APP_SECRET
  const assinatura = req.header('x-hub-signature-256') ?? ''
  const corpo = (req as Request & { rawBody?: Buffer }).rawBody
  if (!segredo || !corpo || !assinatura.startsWith('sha256=')) return false
  const esperado = crypto.createHmac('sha256', segredo).update(corpo).digest('hex')
  const recebido = assinatura.slice(7)
  return recebido.length === esperado.length && crypto.timingSafeEqual(Buffer.from(recebido), Buffer.from(esperado))
}

router.get('/sm/webhook/instagram', (req: Request, res: Response) => {
  const token = process.env.META_WEBHOOK_VERIFY_TOKEN
  if (token && req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === token) {
    res.status(200).send(String(req.query['hub.challenge'] ?? ''))
    return
  }
  res.status(403).end()
})

type EntradaWebhook = { id?: string; time?: number; changes?: Array<{ field: string; value: unknown }>; messaging?: unknown[] }

router.post('/sm/webhook/instagram', async (req: Request, res: Response) => {
  if (!assinaturaValida(req)) {
    res.status(401).end()
    return
  }
  const corpo = req.body as { object?: string; entry?: EntradaWebhook[] }
  const objeto = corpo.object ?? 'instagram'
  const ids = [...new Set((corpo.entry ?? []).map(e => e.id).filter((x): x is string => !!x))]
  const contas = ids.length ? await prisma.socialMediaConta.findMany({ where: { instagramUserId: { in: ids } }, select: { id: true, instagramUserId: true } }) : []
  const contaPorIg = new Map(contas.map(c => [c.instagramUserId, c.id]))
  const eventos: Prisma.SmWebhookEventoCreateManyInput[] = []
  for (const entrada of corpo.entry ?? []) {
    const contaId = entrada.id ? contaPorIg.get(entrada.id) ?? null : null
    for (const mudanca of entrada.changes ?? []) {
      eventos.push({ contaId, objeto, campo: mudanca.field, payload: { ...entrada, changes: [mudanca] } as unknown as Prisma.InputJsonValue })
    }
    for (const msg of entrada.messaging ?? []) {
      eventos.push({ contaId, objeto, campo: 'messages', payload: { id: entrada.id, time: entrada.time, messaging: [msg] } as unknown as Prisma.InputJsonValue })
    }
  }
  if (eventos.length) await prisma.smWebhookEvento.createMany({ data: eventos })
  // A Meta reenvia se não receber 200 rápido: responde já, o processamento
  // (Atendimento) lê a fila depois.
  res.status(200).json({ recebidos: eventos.length })
})

export default router
