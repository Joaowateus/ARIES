import { z } from 'zod'

export const CAP02_EVENT_TYPES = {
  OPORTUNIDADE_CRIADA: 'cap02.oportunidade.criada',
  OPORTUNIDADE_ESTAGIO_AVANCOU: 'cap02.oportunidade.estagio_avancou',
  OPORTUNIDADE_ENCERRADA: 'cap02.oportunidade.encerrada',
} as const

export const OportunidadeCriadaPayload = z.object({
  oportunidade_id: z.string().uuid(),
  titulo: z.string(),
  cliente_id: z.string(),
  responsavel_id: z.string(),
  valor_estimado: z.number(),
  segmento_id: z.string().optional(),
  estagio: z.literal('PROSPECCAO'),
})

export const OportunidadeEstagioAvancouPayload = z.object({
  oportunidade_id: z.string().uuid(),
  estagio_anterior: z.string(),
  estagio_novo: z.string(),
})

export const OportunidadeEncerradaPayload = z.object({
  oportunidade_id: z.string().uuid(),
  resultado: z.enum(['ganha', 'perdida', 'cancelada']),
  motivo: z.string(),
  valor_estimado: z.number(),
  ciclo_dias: z.number(),
  segmento_id: z.string().optional(),
  concorrente_vencedor_id: z.string().optional(),
})
