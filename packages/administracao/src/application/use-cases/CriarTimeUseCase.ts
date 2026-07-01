import { Time, TimeProps } from '../../domain/entities/Time'
import { ITimeRepository, IAuditLog } from '../ports/Repositories'
import { IEventPublisher } from '../ports/IEventPublisher'

export interface CriarTimeInput {
  empresaId: string
  nome: string
  descricao?: string
  liderId?: string
  atorId: string
  agora: string
}

export class CriarTimeUseCase {
  constructor(
    private readonly repo: ITimeRepository,
    private readonly audit: IAuditLog,
    private readonly events: IEventPublisher,
  ) {}

  async execute(input: CriarTimeInput): Promise<TimeProps> {
    const time = Time.create({
      empresaId: input.empresaId,
      nome: input.nome,
      descricao: input.descricao,
      liderId: input.liderId,
      agora: input.agora,
    })

    await this.repo.save(time)

    await this.audit.registrar({
      tipo: 'time.criado',
      empresaId: input.empresaId,
      atorId: input.atorId,
      alvoId: time.id,
      detalhe: { nome: input.nome },
      ocorridoEm: input.agora,
    })

    await this.events.publish({
      tipo: 'time.criado',
      empresaId: input.empresaId,
      ocorridoEm: input.agora,
      payload: { timeId: time.id, nome: input.nome },
    })

    return time.toObject()
  }
}
