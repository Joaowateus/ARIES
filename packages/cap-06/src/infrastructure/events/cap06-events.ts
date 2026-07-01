import { z } from 'zod'

export const CAP06_EVENT_TYPES = {
  PROPOSTA_CRIADA: 'cap06.proposta.criada',
  PROPOSTA_APROVADA: 'cap06.proposta.aprovada',
  PROPOSTA_REPROVADA: 'cap06.proposta.reprovada',
  PROPOSTA_ENVIADA: 'cap06.proposta.enviada',
  VIOLACAO_DETECTADA: 'cap06.violacao.detectada',
} as const

const NivelAlcadaEnum = z.enum(['N1', 'N2', 'N3', 'N4'])

/** CUE: cap06.proposta.criada — inclui resultado da validação de política */
export const PropostaCriadaPayload = z.object({
  proposta_id: z.string().uuid(),
  oportunidade_id: z.string(),
  status: z.enum(['RASCUNHO', 'EM_APROVACAO', 'APROVADA', 'REPROVADA', 'ENVIADA', 'CANCELADA']),
  valor_liquido: z.number().positive(),
  percentual_desconto: z.number().min(0).max(99.99),
  conforme: z.boolean(),
  violacoes: z.array(z.string()),
  exige_aprovacao: z.boolean(),
  criado_em: z.string(),
})

/** CUE: cap06.proposta.aprovada */
export const PropostaAprovadaPayload = z.object({
  proposta_id: z.string().uuid(),
  oportunidade_id: z.string(),
  aprovado_por: z.string(),
  alcada_aprovador: NivelAlcadaEnum,
  aprovado_em: z.string(),
})

/** CUE: cap06.proposta.reprovada */
export const PropostaReprovadaPayload = z.object({
  proposta_id: z.string().uuid(),
  oportunidade_id: z.string(),
  reprovado_por: z.string(),
  motivo: z.string().min(1),
  reprovado_em: z.string(),
})

/** CUE: cap06.proposta.enviada */
export const PropostaEnviadaPayload = z.object({
  proposta_id: z.string().uuid(),
  oportunidade_id: z.string(),
  cliente_id: z.string(),
  valor_liquido: z.number().positive(),
  percentual_desconto: z.number().min(0),
  enviada_em: z.string(),
})

/** CUE: cap06.violacao.detectada — publicado quando proposta viola a política */
export const ViolacaoDetectadaPayload = z.object({
  proposta_id: z.string().uuid(),
  oportunidade_id: z.string(),
  violacoes: z.array(z.string()).min(1),
  alcada_necessaria: NivelAlcadaEnum,
  alcada_responsavel: NivelAlcadaEnum,
  detectado_em: z.string(),
})

export type PropostaCriadaPayload = z.infer<typeof PropostaCriadaPayload>
export type PropostaAprovadaPayload = z.infer<typeof PropostaAprovadaPayload>
export type PropostaReprovadaPayload = z.infer<typeof PropostaReprovadaPayload>
export type PropostaEnviadaPayload = z.infer<typeof PropostaEnviadaPayload>
export type ViolacaoDetectadaPayload = z.infer<typeof ViolacaoDetectadaPayload>
