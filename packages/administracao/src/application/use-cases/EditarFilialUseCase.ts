import { IFilialRepository, ITimeRepository, IAuditLog } from '../ports/Repositories'

export interface EditarFilialInput {
  filialId: string
  nome?: string
  cidade?: string
  estado?: string
  vincularEquipes?: string[]
  desvincularEquipes?: string[]
  atorId: string
  agora: string
}

export class EditarFilialUseCase {
  constructor(
    private readonly filialRepo: IFilialRepository,
    private readonly timeRepo: ITimeRepository,
    private readonly audit: IAuditLog,
  ) {}

  async execute(input: EditarFilialInput): Promise<void> {
    const filial = await this.filialRepo.findById(input.filialId)
    if (!filial) throw new Error(`EditarFilial: filial ${input.filialId} não encontrada`)

    filial.editar({ nome: input.nome, cidade: input.cidade, estado: input.estado }, input.agora)

    for (const equipeId of input.vincularEquipes ?? []) {
      const time = await this.timeRepo.findById(equipeId)
      if (!time) throw new Error(`EditarFilial: time ${equipeId} não encontrado`)
      filial.vincularEquipe(equipeId, input.agora)
    }
    for (const equipeId of input.desvincularEquipes ?? []) {
      filial.desvincularEquipe(equipeId, input.agora)
    }

    await this.filialRepo.save(filial)

    await this.audit.registrar({
      tipo: 'filial.editada',
      empresaId: filial.empresaId,
      atorId: input.atorId,
      alvoId: filial.id,
      ocorridoEm: input.agora,
    })
  }
}
