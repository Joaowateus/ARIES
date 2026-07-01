import { z } from 'zod'

export const CAP03_EVENT_TYPES = {
  OPORTUNIDADE_GANHA: 'cap03.oportunidade.ganha',
  OPORTUNIDADE_PERDIDA: 'cap03.oportunidade.perdida',
  QUALIFICACAO_REGISTRADA: 'cap03.qualificacao.registrada',
} as const

/**
 * Payload enriquecido — ADR-0006.
 * Auto-contido: todos os consumidores (CAP-04, CAP-05) têm o que precisam
 * sem queries adicionais.
 */
export const OportunidadeGanhaPayload = z.object({
  oportunidade_id: z.string().uuid(),
  deal_close_id: z.string().uuid(),
  cliente_id: z.string(),
  valor_total: z.number().positive(),
  mrr: z.number().nonnegative(),
  segmento_id: z.string().optional(),
  ciclo_dias: z.number().nonnegative(),
  data_inicio: z.string(),
  data_fim: z.string(),
  forma_pagamento: z.enum(['MENSAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL', 'UNICO']),
  condicoes_json: z.record(z.unknown()),
  responsavel_cs_id: z.string(),
  fechado_por: z.string(),
  fechado_em: z.string(),
})

export const OportunidadePerdidaPayload = z.object({
  oportunidade_id: z.string().uuid(),
  cliente_id: z.string(),
  valor_estimado: z.number().nonnegative(),
  segmento_id: z.string().optional(),
  ciclo_dias: z.number().nonnegative(),
  motivo_perda: z.string(),
  concorrente_vencedor_id: z.string().optional(),
  fechado_por: z.string(),
  fechado_em: z.string(),
})

export const QualificacaoRegistradaPayload = z.object({
  qualification_id: z.string().uuid(),
  oportunidade_id: z.string().uuid(),
  status: z.enum(['QUALIFICADA', 'DESQUALIFICADA']),
  score: z.number().min(0).max(100),
  qualificado_por: z.string(),
})

export type OportunidadeGanhaPayloadType = z.infer<typeof OportunidadeGanhaPayload>
export type OportunidadePerdidaPayloadType = z.infer<typeof OportunidadePerdidaPayload>
