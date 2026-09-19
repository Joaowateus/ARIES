import app from './app'
import { logger } from './lib/logger'

// Entry point pra rodar como servidor tradicional (local, ou qualquer host
// sempre-ligado) — a função serverless da Vercel usa api/index.ts, que
// importa o mesmo app.ts mas nunca chama listen() (quem recebe a conexão
// HTTP ali é a própria plataforma).
const PORT = Number(process.env.PORT ?? 3001)
app.listen(PORT, () => {
  logger.info({ port: PORT }, 'API ARIES iniciada')
})

export default app
