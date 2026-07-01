import { RevenueRecord, RevenueRecordProps } from '../../domain/entities/RevenueRecord'
import { rn_r06_contratoAtivo } from '../../domain/rules/BusinessRules'
import { IContractRepository, IRevenueRepository } from '../ports/repositories'

export interface RegistrarReceitaUnicaInput {
  contratoId: string
  clienteId: string
  valor: number
  descricao: string
  agora: string
}

export interface RegistrarReceitaUnicaOutput {
  record: RevenueRecordProps
  eventPayload: {
    receita_id: string
    contrato_id: string
    cliente_id: string
    tipo: 'UNICA'
    valor: number
    periodo: string
    reconhecido_em: string
  }
}

export class RegistrarReceitaUnicaUseCase {
  constructor(
    private readonly contratoRepo: IContractRepository,
    private readonly revenueRepo: IRevenueRepository,
  ) {}

  async execute(input: RegistrarReceitaUnicaInput): Promise<RegistrarReceitaUnicaOutput> {
    const contract = await this.contratoRepo.findById(input.contratoId)
    if (!contract) throw new Error(`Contrato ${input.contratoId} não encontrado`)

    rn_r06_contratoAtivo(contract, 'registrar receita única')

    const periodo = input.agora.slice(0, 7) // YYYY-MM

    const record = RevenueRecord.create({
      contratoId: input.contratoId,
      clienteId: input.clienteId,
      tipo: 'UNICA',
      valor: input.valor,
      periodo,
      descricao: input.descricao,
      reconhecidoEm: input.agora,
    })

    await this.revenueRepo.save(record)

    return {
      record: record.toObject(),
      eventPayload: {
        receita_id: record.id,
        contrato_id: record.contratoId,
        cliente_id: record.clienteId,
        tipo: 'UNICA',
        valor: record.valor,
        periodo: record.periodo,
        reconhecido_em: record.reconhecidoEm,
      },
    }
  }
}
