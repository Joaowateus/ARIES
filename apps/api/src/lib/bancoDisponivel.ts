// Banco fora do ar (cota de computação do Neon esgotada, servidor inacessível,
// pool sem conexão): a API responde 503 com uma mensagem clara em vez do
// "Erro interno do servidor" genérico, e o /health diz o motivo.
import { Prisma } from '@prisma/client'

const CODIGOS = new Set(['P1001', 'P1002', 'P1008', 'P1017', 'P2024'])
const TEXTOS = /quota|Can't reach database server|Timed out fetching a new connection|Connection terminated|Server has closed the connection|ECONNREFUSED|ETIMEDOUT|endpoint (is|has been) (disabled|suspended)/i

export function bancoIndisponivel(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  if (err instanceof Prisma.PrismaClientInitializationError || err instanceof Prisma.PrismaClientRustPanicError) return true
  const e = err as { code?: unknown; errorCode?: unknown; message?: unknown }
  if (typeof e.code === 'string' && CODIGOS.has(e.code)) return true
  if (typeof e.errorCode === 'string' && CODIGOS.has(e.errorCode)) return true
  return typeof e.message === 'string' && TEXTOS.test(e.message)
}

/** Motivo curto, sem endereço nem credencial, para o /health. */
export function motivoDoBanco(err: unknown): string {
  const msg = String((err as { message?: unknown })?.message ?? '')
  if (/quota/i.test(msg)) return 'Cota mensal de computação do banco esgotada (Neon).'
  if (/Can't reach database server|ECONNREFUSED|ETIMEDOUT/i.test(msg)) return 'Servidor do banco inacessível.'
  if (/Timed out|P1002|P2024/i.test(msg)) return 'Tempo esgotado ao conectar no banco.'
  if (/endpoint (is|has been) (disabled|suspended)/i.test(msg)) return 'Banco suspenso pelo provedor.'
  return 'Erro ao consultar o banco.'
}

export const MENSAGEM_BANCO_INDISPONIVEL = 'O sistema está sem acesso ao banco de dados no momento. Tente de novo em alguns minutos; se continuar, avise o responsável pelo sistema.'

// Tamanho do banco: no plano gratuito do Supabase o limite é 500 MB e, ao
// passar, o banco fica só de leitura. O aviso aparece para o dono a partir
// de BANCO_ALERTA_MB (padrão 400) e fica crítico perto do limite.
export const LIMITE_BANCO_MB = () => Number(process.env.BANCO_LIMITE_MB) || 500
export const ALERTA_BANCO_MB = () => Number(process.env.BANCO_ALERTA_MB) || 400
export type NivelBanco = 'OK' | 'ALERTA' | 'CRITICO'

export function nivelDoBanco(usadoMB: number, limiteMB = LIMITE_BANCO_MB(), alertaMB = ALERTA_BANCO_MB()): NivelBanco {
  if (usadoMB >= limiteMB * 0.95) return 'CRITICO'
  if (usadoMB >= alertaMB) return 'ALERTA'
  return 'OK'
}

let cache: { em: number; usadoMB: number } | null = null
/** Mede com pg_database_size, guardando a medida por 10 minutos (não acorda o banco à toa). */
export async function tamanhoDoBanco(consultar: () => Promise<number>, agora = Date.now()) {
  if (!cache || agora - cache.em > 10 * 60_000) cache = { em: agora, usadoMB: Math.round((await consultar()) / 1024 / 1024 * 10) / 10 }
  const limiteMB = LIMITE_BANCO_MB(), alertaMB = ALERTA_BANCO_MB()
  return { usadoMB: cache.usadoMB, limiteMB, alertaMB, nivel: nivelDoBanco(cache.usadoMB, limiteMB, alertaMB), medidoEm: new Date(cache.em).toISOString() }
}
export function limparCacheDoBanco() { cache = null }
