import { RegistrarWinLossUseCase } from '../../application/use-cases/win-loss/RegistrarWinLossUseCase'

export interface OportunidadeEncerradaPayload {
  oportunidade_id: string
  resultado: 'ganha' | 'perdida'
  segmento_id?: string
  valor_estimado?: number
  ciclo_dias?: number
  event_id: string
}

/**
 * Consome cap03.oportunidade.encerrada e dispara RegistrarWinLossUseCase.
 * RN-03: toda oportunidade encerrada gera análise Win/Loss.
 */
export class OportunidadeEncerradaHandler {
  constructor(
    private readonly registrarWinLoss: RegistrarWinLossUseCase,
  ) {}

  async handle(payload: OportunidadeEncerradaPayload, agora: string): Promise<void> {
    await this.registrarWinLoss.execute({
      oportunidadeId: payload.oportunidade_id,
      segmentoId: payload.segmento_id,
      valorEstimado: payload.valor_estimado,
      cicloDias: payload.ciclo_dias,
      eventoOrigemId: payload.event_id,
      agora,
    })
  }
}
