import { z } from 'zod'

export const DiagnosticoGeradoPayload = z.object({
  diagnosticoId: z.string().uuid(),
  periodo: z.string(),
  classificacao: z.enum(['DEMANDA', 'PRECO', 'NEGOCIACAO', 'ICP', 'EXECUCAO', 'MERCADO', 'RETENCAO']),
  kpisAfetados: z.array(z.string()).min(1),
  hipotesePrincipal: z.string(),
  impactoFinanceiroEstimado: z.number().nonnegative(),
  mupTotal: z.number(),
  geradoEm: z.string(),
})

export const PlanoCriadoPayload = z.object({
  planoId: z.string().uuid(),
  diagnosticoId: z.string().uuid(),
  titulo: z.string(),
  totalAcoes: z.number().int().positive(),
  criadoPor: z.string(),
  criadoEm: z.string(),
})

export const DecisaoRegistradaPayload = z.object({
  decisaoRecordId: z.string().uuid(),
  diagnosticoId: z.string().uuid(),
  planoAcaoId: z.string().uuid(),
  classificacao: z.enum(['DEMANDA', 'PRECO', 'NEGOCIACAO', 'ICP', 'EXECUCAO', 'MERCADO', 'RETENCAO']),
  decisaoTomada: z.string(),
  registradoEm: z.string(),
})

export const AprendizadoRegistradoPayload = z.object({
  decisaoRecordId: z.string().uuid(),
  diagnosticoId: z.string().uuid(),
  classificacao: z.enum(['DEMANDA', 'PRECO', 'NEGOCIACAO', 'ICP', 'EXECUCAO', 'MERCADO', 'RETENCAO']),
  resultado: z.enum(['EFETIVO', 'PARCIAL', 'INEFETIVO']),
  insight: z.string(),
  recomendacao: z.string(),
  alterarPlaybook: z.boolean(),
  alteracaoSugerida: z.string().optional(),
  fechadoEm: z.string(),
})

export type DiagnosticoGeradoPayload = z.infer<typeof DiagnosticoGeradoPayload>
export type PlanoCriadoPayload = z.infer<typeof PlanoCriadoPayload>
export type DecisaoRegistradaPayload = z.infer<typeof DecisaoRegistradaPayload>
export type AprendizadoRegistradoPayload = z.infer<typeof AprendizadoRegistradoPayload>
