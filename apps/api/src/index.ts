import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import authRoutes from './routes/auth'
import empresaRoutes from './routes/empresa'
import usuariosRoutes from './routes/usuarios'
import produtosRoutes from './routes/produtos'
import oportunidadesRoutes from './routes/oportunidades'
import contratosRoutes from './routes/contratos'
import financeiroRoutes from './routes/financeiro'
import dashboardRoutes from './routes/dashboard'

const app = express()

app.use(cors({
  origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  credentials: true,
}))
app.use(express.json())

app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }))

app.use('/auth', authRoutes)
app.use('/empresa', empresaRoutes)
app.use('/usuarios', usuariosRoutes)
app.use('/produtos', produtosRoutes)
app.use('/oportunidades', oportunidadesRoutes)
app.use('/contratos', contratosRoutes)
app.use('/financeiro', financeiroRoutes)
app.use('/dashboard', dashboardRoutes)

const PORT = Number(process.env.PORT ?? 3001)
app.listen(PORT, () => {
  console.log(`API ARIES rodando em http://localhost:${PORT}`)
})

export default app
