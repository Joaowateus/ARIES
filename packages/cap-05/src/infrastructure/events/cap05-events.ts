import { z } from 'zod'

export const CAP05_EVENT_TYPES = {
  CLIENTE_CRIADO: 'cap05.cliente.criado',
  ONBOARDING_INICIADO: 'cap05.onboarding.iniciado',
  ONBOARDING_CONCLUIDO: 'cap05.onboarding.concluido',
  HEALTH_ALTERADO: 'cap05.health.alterado',
} as const

/** CUE: cap05.cliente.criado */
export const ClienteCriadoPayload = z.object({
  customer_id: z.string().uuid(),
  cliente_id: z.string(),
  oportunidade_id: z.string(),
  nome: z.string().min(1),
  responsavel_cs_id: z.string(),
  health_score: z.number().int().min(0).max(100),
  criado_em: z.string(),
})

/** CUE: cap05.onboarding.iniciado */
export const OnboardingIniciadoPayload = z.object({
  onboarding_id: z.string().uuid(),
  customer_id: z.string().uuid(),
  oportunidade_id: z.string(),
  responsavel_cs_id: z.string(),
  iniciado_em: z.string(),
})

/** CUE: cap05.onboarding.concluido */
export const OnboardingConcluidoPayload = z.object({
  onboarding_id: z.string().uuid(),
  customer_id: z.string().uuid(),
  oportunidade_id: z.string(),
  concluido_em: z.string(),
})

/** CUE: cap05.health.alterado */
export const HealthAlteradoPayload = z.object({
  customer_id: z.string().uuid(),
  score_anterior: z.number().int().min(0).max(100),
  score_novo: z.number().int().min(0).max(100),
  nivel: z.enum(['CRITICO', 'BAIXO', 'MEDIO', 'ALTO', 'EXCELENTE']),
  avaliado_em: z.string(),
})

export type ClienteCriadoPayload = z.infer<typeof ClienteCriadoPayload>
export type OnboardingIniciadoPayload = z.infer<typeof OnboardingIniciadoPayload>
export type OnboardingConcluidoPayload = z.infer<typeof OnboardingConcluidoPayload>
export type HealthAlteradoPayload = z.infer<typeof HealthAlteradoPayload>
