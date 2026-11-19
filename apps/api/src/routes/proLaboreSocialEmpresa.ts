// Conta do Instagram da EMPRESA (Fase 0 do módulo Social Media com acesso
// isolado — seção 3.2 da especificação): conexão pelo usuário do sistema
// do Business Manager, diagnóstico, histórico de sincronizações, avisos,
// jobs do cron e webhook da Meta.
//
// A conta da empresa é a mesma linha de SocialMediaConta do dono (titular
// `dono:<id>`), com `tipoConexao = EMPRESA`: converter uma conta pessoal
// mantém todo o histórico sincronizado.
import { orcamento } from '../lib/cronOrcamento'
import { cargaInicial as cargaInicialCentral, conferir as conferirCentral, processarEventos as processarEventosCentral } from '../lib/centralConhecimento/rotinas'
import { reverMetaEmRiscoTodas } from '../lib/metaCoerente'
import { faltasVencidas } from '../lib/jornadaAtividades'
import { Router, Request, Response } from 'express'
import { aprenderTodas } from '../lib/assistenteAprendizado'
import { verificarAvancos } from '../lib/assistenteRespostas'
import { atualizarEtiquetasRecentes, avisarLeadsEsperando, enviarResumosDaManha, higienizarObservacoes, recalcularEtiquetasAbertas, retomarRoteiros, rodarCadencias, rodarFollows, varrerConversasRecentes } from '../lib/assistenteMotor'
import { rodarAgente } from '../lib/agenteMotor'
import { z } from 'zod'
import crypto from 'crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { avisarLigacoes } from '../lib/ligacoesAviso'
import { gerarOcorrenciasDeRotina, rodarRegua } from '../lib/atividades'
import { guardarRetratos } from '../lib/metricas'
import { avaliarTodas } from '../lib/qualidade'
import { rodarDetectoresTodas } from '../lib/recomendacoes'
import { DETECTORES_ONDA4 } from '../lib/detectoresOnda4'
import { ajusteMensalTodas } from '../lib/ajusteMensal'
import { avisarFollowsCredito } from '../lib/followCredito'
import { rodarReferencias } from '../lib/smReferencias'
import { limparEventosAntigos } from '../lib/espacoBanco'
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
import { gerarPautasDeVendas } from '../lib/smPautasAuto'
import { processarEventosPendentes } from '../lib/smAtendimento'
import { rodarJobSocialMedia, sincronizarContaSocialMedia } from '../lib/socialMediaSync'
import { rodarCentral } from '../lib/smCentral'
import { rodarCopiloto } from '../lib/copiloto'
import { listarTestes } from '../lib/smTestes'
import { rodarRetrospectivas } from '../lib/smRetrospectiva'
import { rodarPulso } from '../lib/smPulso'
import { MENSAGEM_APP_BLOQUEADO, PASSOS_APP_BLOQUEADO, TITULO_APP_BLOQUEADO, causaDoErroMeta, lembretesAnuais } from '../lib/metaConexao'
import { recuperarConexoesMeta } from '../lib/metaTeste'
import { rodarConcorrentes } from '../lib/smConcorrentes'
import { rodarPlanejamento } from '../lib/smPlanejamento'
import { pularHora, pularMinuto } from '../lib/cronEconomia'
import { sincronizarTrafegoPendentes } from '../lib/trafegoSync'

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
    if (causaDoErroMeta(e.codigo, e.message) === 'APP_BLOQUEADO') return MENSAGEM_APP_BLOQUEADO
    if (e.codigo === 10 || e.codigo === 200) return `A Meta recusou o acesso: ${e.message} Confira as permissões do app e do usuário do sistema.`
    return `A Meta respondeu: ${e.message}`
  }
  return e instanceof Error ? e.message : 'Falha ao falar com a Meta'
}

// --- Conectar a conta da empresa ---

const conectarSchema = z.object({
  accessToken: z.string().min(20, 'Token inválido').optional(),
  // O mesmo token do usuário do sistema que o Tráfego já usa: um token só,
  // que não expira, para os dois módulos (precisa das permissões do Instagram).
  usarTokenDoTrafego: z.boolean().optional(),
  // Quando o usuário do sistema enxerga mais de uma conta do Instagram.
  instagramUserId: z.string().min(1).optional(),
}).refine(d => d.accessToken || d.usarTokenDoTrafego, 'Cole o token do usuário do sistema')

router.post('/social-media/conectar-empresa', requireProLaboreAuth, requireDono, async (req: Request, res: Response) => {
  const parse = conectarSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0].message })
    return
  }
  const usuarioId = req.proLaboreUser!.sub
  const titular = titularDono(req)
  let token = parse.data.accessToken?.trim() ?? ''
  if (parse.data.usarTokenDoTrafego) {
    const t = await prisma.trafegoConta.findUnique({ where: { usuarioId }, select: { accessToken: true } })
    if (!t) { res.status(400).json({ error: 'O Tráfego ainda não está conectado: cole o token do usuário do sistema.' }); return }
    token = t.accessToken
  }
  try {
    const dono = await verificarTokenEmpresa(token)
    const faltando = PERMISSOES_EMPRESA_ESSENCIAIS.filter(p => !dono.concedidas.includes(p))
    if (faltando.length) {
      res.status(400).json({ error: parse.data.usarTokenDoTrafego
        ? `O token do Tráfego ainda não lê o Instagram: falta ${faltando.join(', ')}. No Business Manager, gere um token novo do usuário do sistema com ads_read e essas permissões, e troque nos dois lugares (Tráfego e aqui).`
        : `O token não tem as permissões para ler o Instagram: falta ${faltando.join(', ')}. Gere um token novo marcando essas permissões.`, faltando })
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
  if (erro && causaDoErroMeta(undefined, erro.detalhe) === 'APP_BLOQUEADO') return { titulo: TITULO_APP_BLOQUEADO, passos: PASSOS_APP_BLOQUEADO }
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

// O horário pode vir no cabeçalho só fora de produção (testes da sexta e da segunda).
function agoraDoCron(req: Request): Date {
  const pedido = process.env.NODE_ENV !== 'production' ? Date.parse(String(req.header('x-cron-agora') ?? '')) : NaN
  return Number.isNaN(pedido) ? new Date() : new Date(pedido)
}

router.post('/sm/cron/hora', async (req: Request, res: Response) => {
  if (!cronAutorizado(req, res)) return
  // Madrugada: o banco descansa (ver lib/cronEconomia.ts).
  const pausa = pularHora(agoraDoCron(req))
  if (pausa) { res.json({ pausado: pausa }); return }
  const agora = agoraDoCron(req)
  // Pente fino: dentro dos 30 s da função, as tarefas centrais primeiro; as demais com o tempo que sobrar.
  const o = orcamento(25_000)
  // PDF 06 · correção 4: revê as RECs de meta abertas com a previsão de agora; depois, o detector de meta.
  const metaRevista = await o.rodar('meta revista', () => reverMetaEmRiscoTodas(agora), { encerradas: 0 })
  const metaRisco = await o.rodar('meta em risco', () => rodarDetectoresTodas(agora, ['meta_em_risco']), { recsCriadas: 0 })
  // Jornada: visita que passou da hora sem check-in conta como falta.
  const faltas = await o.rodar('faltas', () => faltasVencidas(100, agora), { faltasAutomaticas: 0 })
  // Assistente pessoal: o resumo da manhã no chat "Você" de cada vendedor.
  const manha = await o.rodar('resumo da manhã', () => enviarResumosDaManha(agora), { resumosManha: 0 })
  const sincronizacao = await o.rodar('social media', () => rodarJobSocialMedia('HORA'), {} as Awaited<ReturnType<typeof rodarJobSocialMedia>>)
  const retros = await o.rodar('retrospectivas', () => rodarRetrospectivas(agora), {} as Awaited<ReturnType<typeof rodarRetrospectivas>>)
  // App da Meta bloqueado: testa de novo e, liberado, o Tráfego e o Instagram voltam sozinhos.
  const meta = await o.rodar('conexões Meta', () => recuperarConexoesMeta(agora), { metaTestadas: 0, metaLiberadas: 0 })
  // Central de Conteúdo: no começo do mês, o calendário novo (em rascunho, para aprovação).
  const central = await o.rodar('central', () => rodarCentral(agora), { centralGerados: 0 })
  // Desenvolvimento (antes Copiloto): o dia de cada pessoa (regras para todos; a IA no tempo que sobrar).
  const copiloto = await o.rodar('desenvolvimento', lim => rodarCopiloto(agora, Math.min(10_000, lim)), { copilotoDias: 0, copilotoIA: 0, copilotoWhatsapp: 0 })
  // Aprende com as conversas da última hora (dúvidas e objeções dos clientes).
  const aprendizado = await o.rodar('aprendizado', lim => aprenderTodas(Math.min(5000, lim)), { aprendizadoContas: 0, aprendizadoReconhecidas: 0 })
  // Placar da base: a resposta usada fez o lead andar no funil?
  const avancos = await o.rodar('avanços', () => verificarAvancos(), { usosVerificados: 0, usosComAvanco: 0 })
  // Etiquetas que mudam com o tempo ("sumiu há 24h") e as dos leads abertos (as mais antigas primeiro).
  const etiquetas = await o.rodar('etiquetas', () => atualizarEtiquetasRecentes(300, agora), { etiquetasConversas: 0 })
  const abertas = await o.rodar('etiquetas abertas', () => recalcularEtiquetasAbertas(200, agora), { etiquetasAbertas: 0 })
  // CPF, nascimento e e-mail escritos na observação de leads antigos: para os campos, mascarados no texto.
  const higiene = await o.rodar('higiene', () => higienizarObservacoes(300), { observacoesLimpas: 0 })
  res.json({ ...sincronizacao, ...retros, ...meta, ...central, ...copiloto, ...aprendizado, ...avancos, ...etiquetas, ...abertas, ...higiene, ...manha, ...faltas, metaEmRisco: metaRisco.recsCriadas, metaEmRiscoEncerradas: metaRevista.encerradas, adiadas: o.adiadas, tempos: o.tempos })
})
router.post('/sm/cron/dia', async (req: Request, res: Response) => {
  if (!cronAutorizado(req, res)) return
  const agora = agoraDoCron(req)
  // Pente fino: qualidade e detectores primeiro (antes ficavam no fim e não cabiam nos 30 s depois das chamadas à Meta).
  const o = orcamento(25_000)
  // PDF 02 · 4.8: camada de qualidade (abre e resolve as correções pendentes).
  const qualidade = await o.rodar('qualidade', () => avaliarTodas(agora), { qualidadeAbertas: 0, qualidadeResolvidas: 0 })
  // PDF 03 e PDF 05 (só as áreas ligadas): os detectores rodam depois da qualidade (para juntar o que ela já apontou), uma vez por dia.
  const detectores = await o.rodar('detectores', () => rodarDetectoresTodas(agora, ['resposta_lenta', 'funil_parado', 'etapa_travando', 'atividades_acumuladas', 'credito_emperrado', 'anuncio_encarecendo', ...DETECTORES_ONDA4.map(d => d.chave)]), { recsCriadas: 0 })
  // PDF 03 · 4.4: no dia 1º, as sugestões de ajuste do mês que fechou (só valem com a aprovação do dono).
  const ajuste = await o.rodar('ajuste mensal', () => ajusteMensalTodas(agora), { sugestoesAjuste: 0 })
  // PDF 02 · dicionário de métricas: retrato do dia das métricas de "agora" (base das faixas).
  const retratos = await o.rodar('retratos', () => guardarRetratos(agora), { retratosMetricas: 0 })
  const lembretes = await o.rodar('lembretes', () => lembretesAnuais(agora), { lembretesMeta: 0 })
  const sincronizacao = await o.rodar('social media', () => rodarJobSocialMedia('DIA'), {} as Awaited<ReturnType<typeof rodarJobSocialMedia>>)
  // Vendas fechadas no CRM viram pautas de entrega (seção 6), mesmo sem ninguém abrir a tela.
  const pautasDeEntrega = await o.rodar('pautas de entrega', async () => {
    let n = 0
    for (const op of await prisma.smMembro.findMany({ select: { usuarioId: true } })) n += await gerarPautasDeVendas(op.usuarioId)
    return n
  }, 0)
  // Testes A/B com a amostra completa são concluídos sem ninguém abrir a tela.
  const testesConcluidos = await o.rodar('testes A/B', async () => {
    let n = 0
    for (const op of await prisma.smTeste.findMany({ where: { status: 'ATIVO' }, distinct: ['usuarioId'], select: { usuarioId: true } })) {
      const antes = await prisma.smTeste.count({ where: { usuarioId: op.usuarioId, status: 'CONCLUIDO' } })
      await listarTestes(op.usuarioId)
      n += (await prisma.smTeste.count({ where: { usuarioId: op.usuarioId, status: 'CONCLUIDO' } })) - antes
    }
    return n
  }, 0)
  // Fase 6: o retrato do dia dos concorrentes e, do dia 25 em diante, o planejamento do mês seguinte.
  const concorrentes = await o.rodar('concorrentes', () => rodarConcorrentes(agora), { concorrentes: 0 })
  const planejamento = await o.rodar('planejamento', () => rodarPlanejamento(agora), { planejamento: 0 })
  // Referências: vídeos dos perfis (todo dia) e das hashtags das motos (a cada 3 dias, no limite semanal).
  const referencias = await o.rodar('referências', () => rodarReferencias(agora), { referenciasPerfis: 0, referenciasMotos: 0 })
  // Os eventos brutos do Instagram já processados não ficam para sempre (espaço do banco).
  const eventosLimpos = await o.rodar('limpeza de eventos', () => limparEventosAntigos(agora), { eventosApagados: 0 })
  // PDF 07 · conferência diária da Central (fontes x índice); o que diverge vai à Saúde e é corrigido sozinho.
  const centralConferencia = await o.rodar('central: conferência', lim => conferirCentral(Math.min(15_000, lim), agora), { centralConferidas: 0, centralDivergencias: 0 })
  res.json({ ...centralConferencia, ...qualidade, ...detectores, ...ajuste, ...sincronizacao, pautasDeEntrega, testesConcluidos, ...concorrentes, ...planejamento, ...lembretes, ...referencias, ...eventosLimpos, ...retratos, adiadas: o.adiadas, tempos: o.tempos })
})
// Chamado a cada 5 min: novas tentativas vencidas, a publicação das pautas
// agendadas que já chegaram no horário, a fila do webhook e o Pulso. Em
// produção trabalha a cada 15 min e descansa de madrugada, para o banco
// poder desligar entre as rodadas (lib/cronEconomia.ts). O Copiloto roda só
// no job da hora.
router.post('/sm/cron/minuto', async (req: Request, res: Response) => {
  if (!cronAutorizado(req, res)) return
  const pausa = pularMinuto(agoraDoCron(req))
  if (pausa) { res.json({ pausado: pausa }); return }
  const agora = agoraDoCron(req)
  // Pente fino: a régua e as rotinas de atividade primeiro (antes ficavam no fim e não cabiam nos 30 s);
  // as tarefas com limite de tempo próprio recebem só o que sobrar.
  const o = orcamento(25_000)
  // PDF 02 · ATV: as ocorrências de hoje das rotinas e a régua de cobrança.
  const rotinas = await o.rodar('rotinas', () => gerarOcorrenciasDeRotina(agora), { ocorrenciasRotina: 0 })
  const regua = await o.rodar('régua', () => rodarRegua(agora), { reguaRegistros: 0, reguaEnviados: 0 })
  // PDF 07 · Central de Conhecimento: os eventos gravados pelo banco vão para o índice (frescor de 15 min).
  const centralEventos = await o.rodar('central de conhecimento', lim => processarEventosCentral(Math.min(6000, lim), agora), { centralProcessados: 0, centralFalhas: 0 })
  // Ligações: aviso na hora e lembrete 30 min depois para quem liga (Aries ou chat "Você").
  const ligacoes = await o.rodar('ligações', () => avisarLigacoes(agora), { avisosLigacao: 0 })
  // Avisa o vendedor de lead esperando resposta (pelo Aries, quando vinculado).
  const espera = await o.rodar('espera', () => avisarLeadsEsperando(agora), { avisosEspera: 0 })
  // Follow de crédito recusado: avisa o vendedor no dia da nova análise.
  const credito = await o.rodar('follow de crédito', () => avisarFollowsCredito(agora), { avisosCredito: 0 })
  // As imagens da pauta são servidas pela própria API: a Meta precisa da URL completa.
  const baseApi = process.env.API_PUBLIC_URL ?? `${req.protocol}://${req.get('host')}`
  const [sincronizacao, publicacao, atendimento] = await o.rodar('social media', () => Promise.all([rodarJobSocialMedia('RETENTATIVA'), publicarPautasVencidas(baseApi), processarEventosPendentes(100)]), [{}, null, null] as unknown as [Awaited<ReturnType<typeof rodarJobSocialMedia>>, Awaited<ReturnType<typeof publicarPautasVencidas>>, Awaited<ReturnType<typeof processarEventosPendentes>>])
  // Seção 11.5: gatilhos do Pulso e a entrega agrupada no celular.
  const pulso = await o.rodar('pulso', () => rodarPulso(agora), { pulsoNovos: 0, pulsoPush: 0 })
  // Follow automático e a varredura dos leads cujo aviso do WhatsApp se perdeu, em paralelo.
  const [follow, varredura] = await o.rodar('follow e varredura', lim => Promise.all([
    rodarFollows(agora, Math.min(8000, lim)).catch(e => { console.error('[assistente] follow', e); return { followsEnviados: 0, followsParaVendedor: 0 } }),
    varrerConversasRecentes(agora, Math.min(6000, lim)).catch(e => { console.error('[assistente] varredura', e); return { varreduras: 0, mensagensVarridas: 0 } }),
  ]), [{ followsEnviados: 0, followsParaVendedor: 0 }, { varreduras: 0, mensagensVarridas: 0 }] as const)
  // Pré-venda do robô (Ajuste 3): cadências escolhidas pelo vendedor e retomada do roteiro parado.
  const cadencias = await o.rodar('cadências', lim => rodarCadencias(agora, Math.min(6000, lim)), { cadenciasEnviadas: 0, cadenciasConcluidas: 0 })
  const retomada = await o.rodar('retomada', lim => retomarRoteiros(agora, Math.min(5000, lim)), { retomadas: 0, entreguesPorSilencio: 0 })
  // Aries no WhatsApp: o resumo da manhã no horário escolhido pelo gestor.
  const agente = await o.rodar('Aries manhã', lim => rodarAgente(agora, Math.min(5000, lim)), { manhaAgente: 0 })
  // Tráfego: completa o histórico e mantém os totais da conta em dia (no máximo 1 vez por hora quando já está completo).
  const trafego = await o.rodar('tráfego', lim => sincronizarTrafegoPendentes(Math.min(10_000, lim)), { trafegoSincronizadas: 0, trafegoFalhas: 0 })
  // Carga inicial da Central em rodadas, com o tempo que sobrar (para no ponto e continua na próxima).
  const centralCarga = await o.rodar('central: carga inicial', lim => cargaInicialCentral(Math.min(8000, lim)), { centralCarga: 0 }, 3000)
  res.json({ ...centralEventos, ...centralCarga, ...sincronizacao, publicacao, atendimento, ...pulso, ...trafego, ...follow, ...cadencias, ...retomada, ...varredura, ...espera, ...agente, ...ligacoes, ...credito, ...rotinas, ...regua, adiadas: o.adiadas, tempos: o.tempos })
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
  // Processa na hora (conversas, "Comente QUERO", fora do horário). O que
  // não der tempo fica na fila e o job de minuto termina.
  const processamento = eventos.length ? await processarEventosPendentes(20).catch(() => null) : null
  res.status(200).json({ recebidos: eventos.length, processados: processamento?.processados ?? 0 })
})

export default router
