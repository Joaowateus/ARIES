import { ResultadoDecisao, AprendizadoGerado } from '../../domain/entities/DecisaoRecord'
import { IDiagnosticoRepository, IActionPlanRepository, IDecisaoRecordRepository } from '../ports/repositories'

export interface RegistrarResultadoInput {
  decisaoRecordId: string
  resultadoReal: string
  resultado: ResultadoDecisao
  aprendizado: AprendizadoGerado
  agora: string
}

export interface RegistrarResultadoOutput {
  decisaoRecordId: string
  resultado: ResultadoDecisao
  aprendizado: AprendizadoGerado
  diagnosticoResolvido: boolean
}

export class RegistrarResultadoUseCase {
  constructor(
    private readonly diagnosticoRepo: IDiagnosticoRepository,
    private readonly planoRepo: IActionPlanRepository,
    private readonly decisaoRepo: IDecisaoRecordRepository,
  ) {}

  async execute(input: RegistrarResultadoInput): Promise<RegistrarResultadoOutput> {
    const record = await this.decisaoRepo.findById(input.decisaoRecordId)
    if (!record) throw new Error(`DecisaoRecord ${input.decisaoRecordId} não encontrado`)

    record.registrarResultado(input.resultadoReal, input.resultado, input.aprendizado, input.agora)
    await this.decisaoRepo.save(record)

    let diagnosticoResolvido = false
    if (input.resultado === 'EFETIVO') {
      const diagnostico = await this.diagnosticoRepo.findById(record.diagnosticoId)
      if (diagnostico) {
        diagnostico.resolver(input.agora)
        await this.diagnosticoRepo.save(diagnostico)
        diagnosticoResolvido = true
      }
    }

    return {
      decisaoRecordId: record.id,
      resultado: record.resultado!,
      aprendizado: record.aprendizado!,
      diagnosticoResolvido,
    }
  }
}
