// ARIES DISPARO — travas com prazo e o registro da última rodada do motor.
//
// Por que não pg_advisory_lock: na produção o banco passa pelo pooler de transação do Supabase
// (porta 6543, pgbouncer). Cada comando pode cair numa conexão diferente, então o "unlock" ia para
// outra conexão e a trava ficava presa para sempre na primeira — a campanha podia parar na fila.
// Aqui a trava é uma linha com prazo: pega quem conseguir gravar enquanto o prazo da anterior já
// passou (um único comando, atômico em qualquer conexão); se o processo cair, ela vence sozinha.
import { Prisma } from '@prisma/client'
import { prisma } from '../prisma'

export async function pegarTrava(chave: string, duracaoMs: number, agora = new Date()): Promise<boolean> {
  const ate = new Date(agora.getTime() + Math.max(1000, duracaoMs))
  const r = await prisma.$queryRaw<Array<{ chave: string }>>`
    INSERT INTO pro_labore_disparo_travas (chave, ate, "atualizadoEm") VALUES (${chave}, ${ate}, ${agora})
    ON CONFLICT (chave) DO UPDATE SET ate = EXCLUDED.ate, "atualizadoEm" = EXCLUDED."atualizadoEm"
    WHERE pro_labore_disparo_travas.ate <= ${agora}
    RETURNING chave`
  return r.length > 0
}

/** Solta a trava (o prazo vira "já passou"); a linha fica, só muda o prazo. */
export async function soltarTrava(chave: string): Promise<void> {
  await prisma.disparoTrava.updateMany({ where: { chave }, data: { ate: new Date(0) } }).catch(() => undefined)
}

export async function comTrava<T>(chave: string, duracaoMs: number, fn: () => Promise<T>): Promise<{ ok: true; valor: T } | { ok: false }> {
  if (!(await pegarTrava(chave, duracaoMs))) return { ok: false }
  try { return { ok: true, valor: await fn() } } finally { await soltarTrava(chave) }
}

// ---------- Última rodada do motor (para a tela saber se o envio automático está vivo) ----------

const CHAVE_RODADA = 'motor:ultima-rodada'
export type OrigemRodada = 'ROTINA' | 'TELA'
export interface UltimaRodada { em: string; origem: OrigemRodada; resultado: Record<string, number> }

export async function registrarRodada(origem: OrigemRodada, resultado: Record<string, number>, agora = new Date()) {
  const dados = { em: agora.toISOString(), origem, resultado } as unknown as Prisma.InputJsonValue
  // Guarda também a última vinda da rotina automática: a tela avisa quando só a tela está enviando.
  const extras = origem === 'ROTINA' ? [prisma.disparoTrava.upsert({ where: { chave: `${CHAVE_RODADA}:rotina` }, create: { chave: `${CHAVE_RODADA}:rotina`, ate: agora, dados }, update: { ate: agora, dados } })] : []
  await Promise.all([prisma.disparoTrava.upsert({ where: { chave: CHAVE_RODADA }, create: { chave: CHAVE_RODADA, ate: agora, dados }, update: { ate: agora, dados } }), ...extras]).catch(() => undefined)
}

export async function ultimasRodadas(): Promise<{ qualquer: UltimaRodada | null; rotina: UltimaRodada | null }> {
  const linhas = await prisma.disparoTrava.findMany({ where: { chave: { in: [CHAVE_RODADA, `${CHAVE_RODADA}:rotina`] } }, select: { chave: true, dados: true } })
  const de = (k: string) => (linhas.find(l => l.chave === k)?.dados ?? null) as unknown as UltimaRodada | null
  return { qualquer: de(CHAVE_RODADA), rotina: de(`${CHAVE_RODADA}:rotina`) }
}
