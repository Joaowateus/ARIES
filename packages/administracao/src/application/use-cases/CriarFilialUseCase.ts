import { Filial, FilialProps } from '../../domain/entities/Filial'
import { IFilialRepository, IAuditLog } from '../ports/Repositories'
import { IEventPublisher } from '../ports/IEventPublisher'

export interface CriarFilialInput {
  empresaId: string
  nome: string
  cidade?: string
  estado?: string
  atorId: string
  agora: string
}

export class CriarFilialUseCase {
  constructor(
    private readonly repo: IFilialRepository,
    private readonly audit: IAuditLog,
    private readonly events: IEventPublisher,
  ) {}

  async execute(input: CriarFilialInput): Promise<FilialProps> {
    const filial = Filial.create({
      empresaId: input.empresaId,
      nome: input.nome,
      cidade: input.cidade,
      estado: input.estado,
      agora: input.agora,
    })

    await this.repo.save(filial)

    await this.audit.registrar({
      tipo: 'filial.criada',
      empresaId: input.empresaId,
      atorId: input.atorId,
      alvoId: filial.id,
      detalhe: { nome: input.nome, cidade: input.cidade, estado: input.estado },
      ocorridoEm: input.agora,
    })

    await this.events.publish({
      tipo: 'filial.criada',
      empresaId: input.empresaId,
      ocorridoEm: input.agora,
      payload: { filialId: filial.id, nome: input.nome },
    })

    return filial.toObject()
  }
}
