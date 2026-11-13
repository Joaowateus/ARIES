// PDF 06 · correção 9: atividades criadas por detector ou por decisão vencem no
// fim do expediente do dia escolhido, nunca de madrugada. O expediente é da loja
// (Configurações) e toda mudança fica no histórico de parâmetros.
import { Prisma } from '@prisma/client'
import { prisma } from './prisma'

export interface Expediente { inicio: string; fim: string; dias: number[] } // dias: 0 = domingo … 6 = sábado
export const EXPEDIENTE_PADRAO: Expediente = { inicio: '08:00', fim: '18:00', dias: [1, 2, 3, 4, 5, 6] }
const BRT = 3 * 3_600_000 // São Paulo, sem horário de verão
const DIA = 86_400_000
const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/

export async function lerExpediente(usuarioId: string): Promise<Expediente> {
  const p = await prisma.parametroLiquidez.findUnique({ where: { usuarioId }, select: { expediente: true } }).catch(() => null)
  const e = p?.expediente as Partial<Expediente> | null | undefined
  if (!e || !hhmm.test(e.inicio ?? '') || !hhmm.test(e.fim ?? '') || !Array.isArray(e.dias) || !e.dias.length) return EXPEDIENTE_PADRAO
  return { inicio: e.inicio!, fim: e.fim!, dias: e.dias.filter(d => d >= 0 && d <= 6) }
}

export async function salvarExpediente(usuarioId: string, novo: Expediente, justificativa: string, autorId: string) {
  if (!hhmm.test(novo.inicio) || !hhmm.test(novo.fim)) throw new Error('Use o formato 08:00')
  if (novo.inicio >= novo.fim) throw new Error('O fim do expediente precisa ser depois do início')
  const dias = [...new Set((novo.dias ?? []).filter(d => Number.isInteger(d) && d >= 0 && d <= 6))].sort()
  if (!dias.length) throw new Error('Escolha ao menos um dia de trabalho')
  const antes = await lerExpediente(usuarioId)
  const limpo = { inicio: novo.inicio, fim: novo.fim, dias }
  await prisma.parametroLiquidez.upsert({ where: { usuarioId }, create: { usuarioId, expediente: limpo }, update: { expediente: limpo } })
  await prisma.parametroHistorico.create({ data: { usuarioId, nome: 'expediente', valorAnterior: antes as unknown as Prisma.InputJsonValue, valorNovo: limpo as unknown as Prisma.InputJsonValue, origem: 'MANUAL', justificativa, autorId } })
  return limpo
}

const diaBrt = (t: number) => new Date(t - BRT).toISOString().slice(0, 10)
const emBrt = (dia: string, hora: string) => new Date(`${dia}T${hora}:00.000Z`).getTime() + BRT

/** Fim do expediente de um dia (AAAA-MM-DD, horário de São Paulo); dia sem expediente vai para o próximo dia de trabalho. */
export function fimDoExpediente(dia: string, e: Expediente = EXPEDIENTE_PADRAO): Date {
  let t = new Date(`${dia}T12:00:00.000Z`).getTime()
  for (let i = 0; i < 7 && !e.dias.includes(new Date(t).getUTCDay()); i++) t += DIA
  return new Date(emBrt(new Date(t).toISOString().slice(0, 10), e.fim))
}

/**
 * Prazo de uma atividade criada pelo sistema: o fim do expediente do dia que fica
 * `dias` dias depois de `agora`. Com dias = 0 e o expediente de hoje já encerrado, vai para o próximo dia de trabalho.
 */
export function prazoNoExpediente(agora: Date, dias: number, e: Expediente = EXPEDIENTE_PADRAO): Date {
  const alvo = diaBrt(agora.getTime() + dias * DIA)
  const p = fimDoExpediente(alvo, e)
  if (p.getTime() > agora.getTime()) return p
  return fimDoExpediente(diaBrt(agora.getTime() + DIA), e)
}

/** Prazo escolhido na tela (só a data, ou uma data e hora qualquer): passa para o fim do expediente daquele dia. */
export function prazoDoDiaEscolhido(escolhido: string | Date, e: Expediente = EXPEDIENTE_PADRAO): Date {
  const s = typeof escolhido === 'string' ? escolhido : escolhido.toISOString()
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : diaBrt(new Date(s).getTime())
  return fimDoExpediente(dia, e)
}
