import { z } from 'zod'

export const VendedorCadastradoPayload = z.object({
  vendedorId: z.string().uuid(),
  nome: z.string(),
  email: z.string().email(),
  cargo: z.enum(['SDR', 'AE', 'CSM', 'GERENTE', 'DIRETOR']),
  criadoEm: z.string(),
})

export const MetaDefinidaPayload = z.object({
  metaEquipeId: z.string().uuid(),
  periodo: z.string(),
  metaTotalReceita: z.number().positive(),
  vendedoresAtualizados: z.number().int().nonnegative(),
  criadoEm: z.string(),
})

export const PerformanceRegistradaPayload = z.object({
  vendedorId: z.string().uuid(),
  periodo: z.string(),
  taxaAtingimentoMeta: z.number().nonnegative(),
  classificacao: z.enum(['ABAIXO', 'DENTRO', 'ACIMA']),
  alertaBaixaPerformance: z.boolean(),
  registradoEm: z.string(),
})

export const PlanoAtribuidoPayload = z.object({
  atribuicaoId: z.string().uuid(),
  planoAcaoId: z.string().uuid(),
  acaoId: z.string(),
  vendedorId: z.string().uuid(),
  prazoIso: z.string(),
  criadoEm: z.string(),
})

export type VendedorCadastradoPayload = z.infer<typeof VendedorCadastradoPayload>
export type MetaDefinidaPayload = z.infer<typeof MetaDefinidaPayload>
export type PerformanceRegistradaPayload = z.infer<typeof PerformanceRegistradaPayload>
export type PlanoAtribuidoPayload = z.infer<typeof PlanoAtribuidoPayload>
