// Ligações auditáveis: cadências (passos que viram lembretes), quando cada
// passo cai, aplicação no lead (à mão ou sozinha no lead novo), os alertas
// calculados no registro e o cancelamento quando o lead sai do funil.
//
// O que o sistema consegue provar sem uma central telefônica: que a pessoa
// tocou em "Ligar" (abre o discador) e quando, quantas vezes, quando
// registrou e o que registrou. Os alertas apontam o que não fecha (registro
// sem discar, duração maior que o tempo desde a discagem, "atendeu" segundos
// depois de discar, vários registros em sequência, fora do horário).
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from './prisma'

const MIN = 60e3, HORA = 3600e3, DIA = 864e5
const OFFSET_BR = 3 * HORA // Brasília, sem horário de verão

export const RESULTADOS = ['ATENDEU', 'NAO_ATENDEU', 'CAIXA_POSTAL', 'OCUPADO', 'NUMERO_ERRADO', 'PEDIU_RETORNO'] as const
export type Resultado = (typeof RESULTADOS)[number]
export const GATILHOS = ['LEAD_NOVO', 'LEAD_ANUNCIO', 'LEAD_WHATSAPP'] as const
// Depois do horário marcado, quanto tempo ainda conta como "no prazo".
export const TOLERANCIA_MS = 2 * HORA
// Janela de ligação para os passos "X minutos depois de entrar".
const INICIO_DIA = 8, FIM_DIA = 20, HORA_RETOMA = 9

export const passoSchema = z.object({
  aposMinutos: z.number().int().min(0).max(24 * 60).nullable().default(null),
  dia: z.number().int().min(0).max(90).default(0),
  hora: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido (use HH:MM)').nullable().default(null),
  instrucao: z.string().trim().max(1000).default(''),
}).refine(p => p.aposMinutos != null || p.hora != null, 'Cada passo precisa de "minutos depois" ou de um horário')
export type PassoCadencia = z.infer<typeof passoSchema>

const horaBR = (t: Date) => new Date(t.getTime() - OFFSET_BR).getUTCHours() + new Date(t.getTime() - OFFSET_BR).getUTCMinutes() / 60
/** Meia-noite (Brasília) do dia de `t`, como instante UTC. */
const inicioDiaBR = (t: Date) => new Date(Math.floor((t.getTime() - OFFSET_BR) / DIA) * DIA + OFFSET_BR)

/** Quando o passo cai, contando a partir de `base` (o lead entrou / a cadência começou). */
export function quandoDoPasso(base: Date, p: PassoCadencia): Date {
  if (p.aposMinutos != null && p.hora == null) {
    const t = new Date(base.getTime() + p.aposMinutos * MIN)
    const h = horaBR(t)
    if (h >= INICIO_DIA && h < FIM_DIA) return t
    // Fora do horário: vai para as 9h do próximo dia útil de ligação (mesmo dia se for de madrugada).
    const dia = h < INICIO_DIA ? inicioDiaBR(t) : new Date(inicioDiaBR(t).getTime() + DIA)
    return new Date(dia.getTime() + HORA_RETOMA * HORA)
  }
  const [hh, mm] = (p.hora ?? '09:00').split(':').map(Number)
  const t = new Date(inicioDiaBR(base).getTime() + p.dia * DIA + hh * HORA + mm * MIN)
  return t.getTime() < base.getTime() ? new Date(base.getTime() + MIN) : t
}

type Cliente = Prisma.TransactionClient | typeof prisma

/** Cria os lembretes da cadência para o lead. Não duplica uma cadência que já está rodando no lead. */
export async function aplicarCadencia(db: Cliente, cadencia: { id: string; usuarioId: string; passos: Prisma.JsonValue }, lead: { id: string; vendedorId: string | null }, criadoPor: string | null, base = new Date()): Promise<number> {
  const passos = z.array(passoSchema).safeParse(cadencia.passos)
  if (!passos.success || !passos.data.length) return 0
  const jaRoda = await db.ligacaoTarefa.count({ where: { leadId: lead.id, cadenciaId: cadencia.id, status: 'PENDENTE' } })
  if (jaRoda) return 0
  await db.ligacaoTarefa.createMany({
    data: passos.data.map((p, i) => ({
      usuarioId: cadencia.usuarioId, leadId: lead.id, vendedorId: lead.vendedorId, cadenciaId: cadencia.id,
      passo: i + 1, totalPassos: passos.data.length, instrucao: p.instrucao || null, agendadaPara: quandoDoPasso(base, p), criadoPor,
    })),
  })
  return passos.data.length
}

/** Lead novo: aplica as cadências ativas cujo gatilho combina com a origem do lead. */
export async function aplicarCadenciasDoLeadNovo(db: Cliente, lead: { id: string; usuarioId: string; vendedorId: string | null; tipoLead?: string | null; origemCadastro?: string | null; veioDeAnuncio?: boolean }): Promise<number> {
  const cadencias = await db.cadenciaLigacao.findMany({ where: { usuarioId: lead.usuarioId, ativa: true, gatilho: { not: null } } })
  let n = 0
  for (const c of cadencias) {
    const combina = c.gatilho === 'LEAD_NOVO'
      || (c.gatilho === 'LEAD_ANUNCIO' && (lead.tipoLead === 'TRAFEGO' || !!lead.veioDeAnuncio))
      || (c.gatilho === 'LEAD_WHATSAPP' && lead.origemCadastro === 'WHATSAPP')
    if (combina) n += await aplicarCadencia(db, c, lead, 'Cadência automática')
  }
  return n
}

/** Lead fechado, perdido ou fora do funil: as ligações pendentes param. */
export async function cancelarLigacoesDoLead(db: Cliente, leadId: string, motivo: string): Promise<void> {
  await db.ligacaoTarefa.updateMany({ where: { leadId, status: 'PENDENTE' }, data: { status: 'CANCELADA', motivoCancelada: motivo } })
}

/** Alertas do registro (gravados junto, para a auditoria). */
export function alertasDoRegistro(
  t: { agendadaPara: Date; discadaEm: Date | null },
  r: { resultado: Resultado; duracaoSeg: number | null },
  agora: Date,
  registroAnteriorEm: Date | null,
): string[] {
  const a: string[] = []
  if (!t.discadaEm) a.push('SEM_DISCAR')
  else {
    const desde = (agora.getTime() - t.discadaEm.getTime()) / 1000
    if (r.resultado === 'ATENDEU' && r.duracaoSeg != null && r.duracaoSeg > desde + 60) a.push('DURACAO_INCOERENTE')
    if (r.resultado === 'ATENDEU' && desde < 20) a.push('REGISTRO_RAPIDO')
    const h = horaBR(t.discadaEm)
    if (h < 7 || h >= 21) a.push('FORA_DO_HORARIO')
  }
  if (registroAnteriorEm && agora.getTime() - registroAnteriorEm.getTime() < 45_000 && r.resultado !== 'NUMERO_ERRADO') a.push('EM_SERIE')
  if (agora.getTime() - t.agendadaPara.getTime() > TOLERANCIA_MS) a.push('ATRASADA')
  return a
}
