import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import compression from 'compression'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { pinoHttp } from 'pino-http'
import { prisma } from './lib/prisma'
import { logger } from './lib/logger'
import { requestId } from './middleware/requestId'
import { errorHandler, notFound } from './middleware/errorHandler'
import authRoutes from './routes/auth'
import empresaRoutes from './routes/empresa'
import usuariosRoutes from './routes/usuarios'
import produtosRoutes from './routes/produtos'
import oportunidadesRoutes from './routes/oportunidades'
import contratosRoutes from './routes/contratos'
import financeiroRoutes from './routes/financeiro'
import dashboardRoutes from './routes/dashboard'
import precificacaoRoutes from './routes/precificacao'
import protocolosRoutes from './routes/protocolos'
import metasRoutes from './routes/metas'
import metasComerciaisRoutes from './routes/metasComerciais'
import funilRoutes from './routes/funil'
import insightsRoutes from './routes/insights'
import meuPainelRoutes from './routes/meuPainel'
import rotinasRoutes from './routes/rotinas'
import tarefasRoutes from './routes/tarefas'
import marketplaceRoutes from './routes/marketplace'
import socialMediaRoutes from './routes/socialMedia'
import processosRoutes from './routes/processos'
import treinamentosRoutes from './routes/treinamentos'
import auditoriasRoutes from './routes/auditorias'
import gestaoRoutes from './routes/gestao'
import notificacoesRoutes from './routes/notificacoes'
import calendarioRoutes from './routes/calendario'
import relatoriosRoutes from './routes/relatorios'
import proLaboreRoutes from './routes/proLabore'
import proLaboreApresentacoesRoutes from './routes/proLaboreApresentacoes'
import proLaboreTrafegoRoutes from './routes/proLaboreTrafego'
import proLaboreComissoesRoutes from './routes/proLaboreComissoes'
import proLaboreSocialEmpresaRoutes from './routes/proLaboreSocialEmpresa'
import proLaboreImagensRoutes from './routes/proLaboreImagens'
import proLaborePreferenciasRoutes from './routes/proLaborePreferencias'
import proLaboreSmRoutes from './routes/proLaboreSm'
import proLaboreSmProducaoRoutes from './routes/proLaboreSmProducao'
import proLaboreSmCalendarioRoutes from './routes/proLaboreSmCalendario'
import proLaboreSmAtendimentoRoutes from './routes/proLaboreSmAtendimento'
import proLaboreSmAtribuicaoRoutes from './routes/proLaboreSmAtribuicao'
import proLaboreSmDesempenhoRoutes from './routes/proLaboreSmDesempenho'
import proLaboreSmTestesRoutes from './routes/proLaboreSmTestes'
import proLaboreSmAssistenteRoutes from './routes/proLaboreSmAssistente'
import proLaboreSmFocoRoutes from './routes/proLaboreSmFoco'
import proLaboreSmBuscaRoutes from './routes/proLaboreSmBusca'
import { guardaPapelSocialMedia } from './lib/smAcesso'

// Setup do Express isolado do listen() — assim o mesmo app serve tanto o
// servidor tradicional (src/index.ts, usado localmente e em hosts sempre
// ligados) quanto a função serverless da Vercel (api/index.ts, que nunca
// chama listen(), quem recebe a conexão HTTP é a própria plataforma).
const app = express()

// A Vercel entrega a requisição através do próprio proxy dela — sem isso,
// o express-rate-limit não confia no cabeçalho X-Forwarded-For e loga um
// ValidationError a cada requisição, além de arriscar tratar todo mundo
// como se viesse do mesmo IP.
app.set('trust proxy', 1)

// Security headers
app.use(helmet())

// Comprime toda resposta JSON (o /painel, em especial, manda um ano inteiro
// de dados mês a mês) — sem isso cada resposta trafega maior do que
// precisa, o que pesa mais ainda em conexões mais lentas.
app.use(compression())

// Request ID — must be first so all middleware/handlers can use it
app.use(requestId)

// Structured HTTP logging
app.use(pinoHttp({
  logger,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customProps: (req: any) => ({ traceId: req.requestId }),
  quietReqLogger: true,
}))

// CORS — maxAge faz o navegador guardar a resposta do preflight (OPTIONS)
// por 24h em vez de repeti-lo antes de cada chamada. Toda requisição daqui
// carrega Authorization (não é "simple request"), então sem isso cada ida
// à API — login, trocar de aba, salvar algo — pagava dois round-trips de
// rede (preflight + a requisição em si) em vez de um só.
app.use(cors({
  origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  credentials: true,
  maxAge: 86400,
}))

// Global rate limit — 200 req/min per IP
app.use(rateLimit({
  windowMs: 60_000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, code: 'RATE_LIMIT', message: 'Muitas requisições. Tente novamente em breve.' },
  // Webhook do WhatsApp chega sempre do mesmo IP (o servidor Evolution) e
  // em rajada quando vários leads escrevem juntos — é autenticado pelo
  // segredo na URL, não pelo limite.
  // Transmissão ao vivo das apresentações: numa sala/escritório todo mundo
  // sai pelo mesmo IP, e o apresentador manda o ponteiro várias vezes por
  // segundo — rotas autenticadas, fora do limite por IP.
  skip: req => req.path.startsWith('/pro-labore/assistente/webhook/')
    || /^\/pro-labore\/apresentacoes\/[^/]+\/(transmissao|estado|palco)$/.test(req.path),
}))

// Stricter rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, code: 'RATE_LIMIT_AUTH', message: 'Muitas tentativas de login. Aguarde 15 minutos.' },
})

// Guarda o corpo cru junto: o webhook da Meta assina os bytes exatos que
// enviou (X-Hub-Signature-256), e o JSON já interpretado não serve pra
// conferir a assinatura.
app.use(express.json({ limit: '1mb', verify: (req, _res, buf) => { (req as unknown as { rawBody?: Buffer }).rawBody = buf } }))

// Health check
const START_TIME = Date.now()
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({
      status: 'ok',
      database: 'ok',
      version: process.env.npm_package_version ?? '1.0.0',
      uptime: Math.floor((Date.now() - START_TIME) / 1000),
      ts: new Date().toISOString(),
    })
  } catch {
    res.status(503).json({
      status: 'degraded',
      database: 'error',
      version: process.env.npm_package_version ?? '1.0.0',
      uptime: Math.floor((Date.now() - START_TIME) / 1000),
      ts: new Date().toISOString(),
    })
  }
})

app.use('/auth', authLimiter, authRoutes)
app.use('/empresa', empresaRoutes)
app.use('/usuarios', usuariosRoutes)
app.use('/produtos', produtosRoutes)
app.use('/oportunidades', oportunidadesRoutes)
app.use('/contratos', contratosRoutes)
app.use('/financeiro', financeiroRoutes)
app.use('/dashboard', dashboardRoutes)
app.use('/precificacao', precificacaoRoutes)
app.use('/protocolos', protocolosRoutes)
app.use('/metas', metasRoutes)
app.use('/metas-comerciais', metasComerciaisRoutes)
app.use('/funil', funilRoutes)
app.use('/insights', insightsRoutes)
app.use('/meu-painel', meuPainelRoutes)
app.use('/rotinas', rotinasRoutes)
app.use('/tarefas', tarefasRoutes)
app.use('/marketplace', marketplaceRoutes)
app.use('/social-media', socialMediaRoutes)
app.use('/processos', processosRoutes)
app.use('/treinamentos', treinamentosRoutes)
app.use('/auditorias', auditoriasRoutes)
app.use('/gestao', gestaoRoutes)
app.use('/notificacoes', notificacoesRoutes)
app.use('/calendario', calendarioRoutes)
app.use('/relatorios', relatoriosRoutes)
app.use('/pro-labore/auth', authLimiter)
app.use('/pro-labore/sm/convite', authLimiter)
// Token do papel Social Media só passa no espaço dele (antes de qualquer rota).
app.use('/pro-labore', guardaPapelSocialMedia)
app.use('/pro-labore', proLaboreRoutes)
app.use('/pro-labore', proLaboreApresentacoesRoutes)
app.use('/pro-labore', proLaboreTrafegoRoutes)
app.use('/pro-labore', proLaboreComissoesRoutes)
app.use('/pro-labore', proLaboreSocialEmpresaRoutes)
app.use('/pro-labore', proLaboreImagensRoutes)
app.use('/pro-labore', proLaborePreferenciasRoutes)
app.use('/pro-labore', proLaboreSmRoutes)
app.use('/pro-labore', proLaboreSmProducaoRoutes)
app.use('/pro-labore', proLaboreSmCalendarioRoutes)
app.use('/pro-labore', proLaboreSmAtendimentoRoutes)
app.use('/pro-labore', proLaboreSmAtribuicaoRoutes)
app.use('/pro-labore', proLaboreSmDesempenhoRoutes)
app.use('/pro-labore', proLaboreSmTestesRoutes)
app.use('/pro-labore', proLaboreSmAssistenteRoutes)
app.use('/pro-labore', proLaboreSmFocoRoutes)
app.use('/pro-labore', proLaboreSmBuscaRoutes)

// 404 and error handlers must be last
app.use(notFound)
app.use(errorHandler)

export default app
