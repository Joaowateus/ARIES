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
