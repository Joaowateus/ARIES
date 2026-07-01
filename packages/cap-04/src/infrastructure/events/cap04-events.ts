import { z } from 'zod'

export const CAP04_EVENT_TYPES = {
  CONTRATO_CRIADO: 'cap04.contrato.criado',
  RECEITA_REGISTRADA: 'cap04.receita.registrada',
  FORECAST_ATUALIZADO: 'cap04.forecast.atualizado',
  CONTRATO_ENCERRADO: 'cap04.contrato.encerrado',
  CONTRATO_CANCELADO: 'cap04.contrato.cancelado',
} as const

/** CUE: cap04.contrato.criado */
export const ContratoCriadoPayload = z.object({
  contrato_id: z.string().uuid(),
  oportunidade_id: z.string(),
  cliente_id: z.string(),
  valor_total: z.number().positive(),
  mrr: z.number().min(0),
  arr: z.number().min(0),
  segmento_id: z.string().optional(),
  data_inicio: z.string(),
  data_fim: z.string(),
  forma_pagamento: z.enum(['MENSAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL', 'UNICO']),
})

/** CUE: cap04.receita.registrada */
export const ReceitaRegistradaPayload = z.object({
  receita_id: z.string().uuid(),
  contrato_id: z.string().uuid(),
  cliente_id: z.string(),
  tipo: z.enum(['RECORRENTE', 'UNICA']),
  valor: z.number().positive(),
  periodo: z.string().regex(/^\d{4}-\d{2}$/),
  reconhecido_em: z.string(),
})

/** CUE: cap04.forecast.atualizado */
export const ForecastAtualizadoPayload = z.object({
  forecast_id: z.string().uuid(),
  periodo: z.string().regex(/^\d{4}-\d{2}$/),
  mrr_ativo: z.number().min(0),
  arr_ativo: z.number().min(0),
  quantidade_contratos: z.number().int().min(0),
  calculado_em: z.string(),
})

/** CUE: cap04.contrato.encerrado */
export const ContratoEncerradoPayload = z.object({
  contrato_id: z.string().uuid(),
  oportunidade_id: z.string(),
  cliente_id: z.string(),
  encerrado_em: z.string(),
})

/** CUE: cap04.contrato.cancelado */
export const ContratoCanceladoPayload = z.object({
  contrato_id: z.string().uuid(),
  oportunidade_id: z.string(),
  cliente_id: z.string(),
  motivo: z.string().min(1),
  cancelado_em: z.string(),
})

export type ContratoCriadoPayload = z.infer<typeof ContratoCriadoPayload>
export type ReceitaRegistradaPayload = z.infer<typeof ReceitaRegistradaPayload>
export type ForecastAtualizadoPayload = z.infer<typeof ForecastAtualizadoPayload>
export type ContratoEncerradoPayload = z.infer<typeof ContratoEncerradoPayload>
export type ContratoCanceladoPayload = z.infer<typeof ContratoCanceladoPayload>
