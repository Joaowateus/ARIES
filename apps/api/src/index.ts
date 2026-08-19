import 'dotenv/config'
import express from 'express'
import cors from 'cors'
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

const app = express()

// Security headers
app.use(helmet())

// Request ID — must be first so all middleware/handlers can use it
app.use(requestId)

// Structured HTTP logging
app.use(pinoHttp({
  logger,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customProps: (req: any) => ({ traceId: req.requestId }),
  quietReqLogger: true,
}))

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  credentials: true,
}))

// Global rate limit — 200 req/min per IP
app.use(rateLimit({
  windowMs: 60_000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, code: 'RATE_LIMIT', message: 'Muitas requisições. Tente novamente em breve.' },
}))

// Stricter rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, code: 'RATE_LIMIT_AUTH', message: 'Muitas tentativas de login. Aguarde 15 minutos.' },
})

app.use(express.json({ limit: '1mb' }))

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

// 404 and error handlers must be last
app.use(notFound)
app.use(errorHandler)

const PORT = Number(process.env.PORT ?? 3001)
app.listen(PORT, () => {
  logger.info({ port: PORT }, 'API ARIES iniciada')
})

export default app
