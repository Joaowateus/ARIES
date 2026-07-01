import { z } from 'zod'

export const ConfiguracaoCriadaPayload = z.object({
  configuracaoId: z.string().uuid(),
  categoria: z.enum(['PIPELINE', 'PROPOSTAS', 'METAS', 'DIAGNOSTICO', 'NOTIFICACOES']),
  chave: z.string(),
  critica: z.boolean(),
  criadoEm: z.string(),
})

export const ConfiguracaoAtualizadaPayload = z.object({
  configuracaoId: z.string().uuid(),
  chave: z.string(),
  alteradoPor: z.string(),
  motivo: z.string(),
  atualizadoEm: z.string(),
})

export const RegraGovernancaCriadaPayload = z.object({
  regraId: z.string().uuid(),
  tipo: z.enum(['LIMIAR_ANOMALIA', 'CLASSIFICACAO', 'PESO_MUP', 'ALCADA_APROVACAO', 'ALERTA_PERFORMANCE']),
  nome: z.string(),
  criadoEm: z.string(),
})

export const AuditoriaRegistradaPayload = z.object({
  auditoriaId: z.string().uuid(),
  categoria: z.enum(['CONFIGURACAO', 'GOVERNANCA', 'ACESSO', 'DADO_SENSIVEL']),
  acao: z.string(),
  entidadeTipo: z.string(),
  entidadeId: z.string(),
  realizadoPor: z.string(),
  ocorridoEm: z.string(),
})

export type ConfiguracaoCriadaPayload = z.infer<typeof ConfiguracaoCriadaPayload>
export type ConfiguracaoAtualizadaPayload = z.infer<typeof ConfiguracaoAtualizadaPayload>
export type RegraGovernancaCriadaPayload = z.infer<typeof RegraGovernancaCriadaPayload>
export type AuditoriaRegistradaPayload = z.infer<typeof AuditoriaRegistradaPayload>
