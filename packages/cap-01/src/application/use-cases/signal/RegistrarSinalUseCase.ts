import { MarketSignal, MarketSignalProps } from '../../../domain/entities/MarketSignal'
import { ISignalRepository } from '../../ports/repositories'

export type RegistrarSinalInput = Omit<MarketSignalProps, 'id' | 'criadoEm' | 'atualizadoEm'> & {
  agora: string
}

export class RegistrarSinalUseCase {
  constructor(private readonly repo: ISignalRepository) {}

  async execute(input: RegistrarSinalInput): Promise<MarketSignalProps> {
    const signal = MarketSignal.create(input)
    await this.repo.save(signal)
    return signal.toObject()
  }
}
