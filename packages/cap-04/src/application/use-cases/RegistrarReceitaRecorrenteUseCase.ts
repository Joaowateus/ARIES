import { RevenueRecord, RevenueRecordProps } from '../../domain/entities/RevenueRecord'
import { rn_r05_periodoUnico, rn_r06_contratoAtivo } from '../../domain/rules/BusinessRules'
import { IContractRepository, IRevenueRepository } from '../ports/repositories'

export interface RegistrarReceitaRecorrenteInput {
  contratoId: string
  clienteId: string
  valor: number
  periodo: string   // YYYY-MM
  descricao: string
  agora: string
}

export interface RegistrarReceitaRecorrenteOutput {
  record: RevenueRecordProps
  eventPayload: {
    receita_id: string
    contrato_id: string
    cliente_id: string
    tipo: 'RECORRENTE'
    valor: number
    periodo: string
    reconhecido_em: string
  }
}

export class RegistrarReceitaRecorrenteUseCase {
  constructor(
    private readonly contratoRepo: IContractRepository,
    private readonly revenueRepo: IRevenueRepository,
  ) {}

  async execute(input: RegistrarReceitaRecorrenteInput): Promise<RegistrarReceitaRecorrenteOutput> {
    const contract = await this.contratoRepo.findById(input.contratoId)
    if (!contract) throw new Error(`Contrato ${input.contratoId} não encontrado`)

    rn_r06_contratoAtivo(contract, 'registrar receita recorrente')

    // RN-R05: idempotência por (contratoId, periodo)
    const existente = await this.revenueRepo.findByContratoPeriodo(input.contratoId, input.periodo)
    rn_r05_periodoUnico(!!existente, input.contratoId, input.periodo)

    const record = RevenueRecord.create({
      contratoId: input.contratoId,
      clienteId: input.clienteId,
      tipo: 'RECORRENTE',
      valor: input.valor,
      periodo: input.periodo,
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
        tipo: 'RECORRENTE',
        valor: record.valor,
        periodo: record.periodo,
        reconhecido_em: record.reconhecidoEm,
      },
    }
  }
}
