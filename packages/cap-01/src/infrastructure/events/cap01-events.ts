import { z } from 'zod'

export const CAP01_EVENT_TYPES = {
  ICP_ATIVADO: 'cap01.icp.ativado',
  ICP_DESCONTINUADO: 'cap01.icp.descontinuado',
  WIN_LOSS_REGISTRADA: 'cap01.win_loss.registrada',
  WIN_LOSS_ANALISADA: 'cap01.win_loss.analisada',
  WIN_LOSS_INSIGHTS_PUBLICADOS: 'cap01.win_loss.insights_publicados',
  SINAL_CRITICO_DETECTADO: 'cap01.sinal.critico_detectado',
  CONCORRENTE_DESATUALIZADO: 'cap01.concorrente.desatualizado',
  ALERTA_COBERTURA_WIN_LOSS: 'cap01.alerta.cobertura_win_loss',
} as const

export const IcpAtivadoPayload = z.object({
  icpId: z.string().uuid(),
  versao: z.string(),
  versaoAnteriorId: z.string().uuid().optional(),
  ativadoPor: z.string(),
})

export const WinLossRegistradaPayload = z.object({
  analiseId: z.string().uuid(),
  oportunidadeId: z.string(),
  segmentoId: z.string().optional(),
  valorEstimado: z.number().optional(),
})

export const WinLossAnalisadaPayload = z.object({
  analiseId: z.string().uuid(),
  oportunidadeId: z.string(),
  resultado: z.enum(['won', 'lost']),
  razaoPrincipal: z.string(),
  validadoPor: z.string(),
})

export const SinalCriticoPayload = z.object({
  sinalId: z.string().uuid(),
  tipo: z.string(),
  urgencia: z.enum(['alta', 'critica']),
  elementosImpactados: z.array(z.string()),
})

export const ConcorrenteDesatualizadoPayload = z.object({
  concorrenteId: z.string().uuid(),
  nome: z.string(),
  diasSemAtualizacao: z.number(),
})

export const AlertaCoberturaPayload = z.object({
  oportunidadesSemAnalise: z.array(z.string()),
  quantidade: z.number(),
})
